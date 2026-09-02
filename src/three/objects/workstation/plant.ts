import {
  BufferGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  MultiplyBlending,
  PlaneGeometry,
  SRGBColorSpace,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Material, Texture } from "three";

/**
 * ─── THE OFFICE PLANT ─────────────────────────────────────────────────────
 *
 * A snake plant beside the desk, built here rather than cloned out of
 * room.glb. The clone was three flat cards in a pot: at the hero's framing it
 * reads fine, but the Experience camera comes within a couple of metres of it
 * and flat cards have no silhouette from the side and no thickness at the
 * edge, which is most of why the bay read as assembled from placeholders.
 *
 * WHAT MAKES IT NOT LOOK GENERATED:
 *
 *  · Every blade is a solid lens in cross-section, four points around, not a
 *    plane, so the edge has thickness from any angle and the keel catches
 *    the matcap the way a real leaf catches light.
 *  · No two blades are the same. Height, width, lean, the direction they
 *    arch, how much they twist and their exact green all come off one seeded
 *    RNG, so the fan has the irregularity a real plant has and the same
 *    irregularity on every reload.
 *  · Colour is per-vertex, dark at the soil and lighter at the tips, so one
 *    material covers the whole fan and still has variation across it.
 *  · A multiply-blended contact shadow sits under the pot. Nothing in this
 *    scene casts a real shadow, there are no lights, so without it the pot
 *    hovers, which is the single loudest "dropped in" tell.
 *
 * Cost: three meshes, three materials, ~1.4k triangles.
 */

/** Deterministic, so the fan is the same arrangement on every load. */
const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
};

const RINGS = 11;
/** Four points around the blade: two edges, a raised face, a shallow back. */
const SECTION = 4;

type Blade = {
  /** where round the pot it comes out of the soil */
  angle: number;
  /** how far the tip leans away from vertical, radians */
  lean: number;
  length: number;
  width: number;
  /** sideways arch, so the fan is not a flat plane */
  sway: number;
  /** how much the blade rotates about its own axis along its length */
  twist: number;
  /** 0 = deep green, 1 = the lighter, yellower green */
  tone: number;
};

/**
 * One blade, grown along +Y from the origin and then leaned/rotated into
 * place by the caller.
 *
 * The width profile is a snake plant's: narrow where it leaves the soil,
 * widest around 45% up, and drawn to a point rather than cut flat. The tip is
 * a single vertex, which is what stops the silhouette ending in a blunt edge.
 */
const createBlade = (blade: Blade, colorLow: Color, colorHigh: Color): BufferGeometry => {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const tip = new Color();

  for (let r = 0; r < RINGS; r++) {
    const t = r / (RINGS - 1);

    // centreline: straight out of the pot, then arching over as it rises
    const arch = Math.sin(t * Math.PI * 0.5);
    const y = blade.length * t * (1 - 0.12 * t * t);
    const x = Math.sin(blade.lean) * blade.length * arch * 0.55 + blade.sway * t * t;
    const z = blade.sway * 0.35 * arch;

    // widest at ~45%, tapering to nothing at the tip
    const w = blade.width * (0.42 + 0.58 * Math.sin(Math.PI * Math.pow(t, 0.72))) * (1 - Math.pow(t, 3.2));
    const thick = w * 0.34;

    const roll = blade.twist * t;
    const cos = Math.cos(roll);
    const sin = Math.sin(roll);

    // lens section: +edge, front keel, -edge, back keel
    const section: [number, number][] = [
      [w, 0],
      [0, thick],
      [-w, 0],
      [0, -thick * 0.55],
    ];

    tip.copy(colorLow).lerp(colorHigh, Math.min(1, t * 0.85 + blade.tone * 0.3));

    for (const [sx, sz] of section) {
      positions.push(x + sx * cos - sz * sin, y, z + sx * sin + sz * cos);
      colors.push(tip.r, tip.g, tip.b);
    }
  }

  for (let r = 0; r < RINGS - 1; r++) {
    for (let s = 0; s < SECTION; s++) {
      const a = r * SECTION + s;
      const b = r * SECTION + ((s + 1) % SECTION);
      const c = (r + 1) * SECTION + s;
      const d = (r + 1) * SECTION + ((s + 1) % SECTION);
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
};

/**
 * The pot: a lathe rather than a cylinder, so it has a foot, a slight belly
 * and a rim with real thickness. The profile is in metres, measured to sit
 * under a 1.2-ish fan without looking undersized.
 */
const POT_PROFILE: [number, number][] = [
  [0.001, 0],
  [0.185, 0],
  [0.208, 0.035],
  [0.232, 0.14],
  [0.262, 0.33],
  [0.278, 0.46],
  [0.286, 0.52],
  [0.284, 0.545],
  [0.262, 0.545],
  [0.256, 0.5],
  [0.238, 0.34],
];

const createPot = (): BufferGeometry => {
  const points = POT_PROFILE.map(([x, y]) => new Vector2(x, y));
  const lathe = new LatheGeometry(points, 28);

  // soil: a disc just under the rim, tucked inside the lip
  const soil = new PlaneGeometry(0.47, 0.47, 1, 1);
  soil.rotateX(-Math.PI / 2);
  soil.translate(0, 0.5, 0);

  const pot = mergeGeometries([lathe, soil], false);
  return pot ?? lathe;
};

const createContactShadow = (): { geometry: BufferGeometry; texture: Texture } | null => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // white is "no shadow" under multiply, so the gradient only darkens the core
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#5d6b78");
  gradient.addColorStop(0.35, "#93a2ae");
  gradient.addColorStop(0.7, "#d6dde3");
  gradient.addColorStop(1, "#ffffff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const geometry = new PlaneGeometry(1.05, 1.05);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0.04, 0.006, 0.03);

  return { geometry, texture };
};

/** Nine blades, no two alike. */
const BLADE_COUNT = 9;

export type PlantParts = {
  group: Group;
  disposables: (BufferGeometry | Material | Texture)[];
  materials: Material[];
};

/**
 * Two matcaps from `./materials.ts`: the blades are waxy and the terracotta
 * pot is not, and shading both with one profile was part of why the bay read
 * as a single substance. Neither carries a texture of its own, the leaf
 * colour is per-vertex and the pot is a tint, so the plant still costs no
 * extra downloads.
 */
export const createPlant = (leafMatcap: Texture, potMatcap: Texture): PlantParts => {
  const group = new Group();
  const disposables: (BufferGeometry | Material | Texture)[] = [];
  const materials: Material[] = [];

  const random = createRandom(20260828);

  // ── leaves
  const low = new Color(0x2f6b34);
  const high = new Color(0x8dc63f);
  const blades: BufferGeometry[] = [];

  for (let i = 0; i < BLADE_COUNT; i++) {
    // walk round the pot with a jittered step so the fan has gaps and pairs
    const angle = (i / BLADE_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.55;
    const blade = createBlade(
      {
        angle,
        lean: 0.1 + random() * 0.26,
        length: 0.95 + random() * 0.5,
        width: 0.085 + random() * 0.045,
        sway: (random() - 0.5) * 0.16,
        twist: (random() - 0.5) * 0.9,
        tone: random(),
      },
      low,
      high,
    );
    blade.rotateY(angle);
    // out of the soil, not out of the pot's floor
    blade.translate(Math.cos(angle) * 0.055, 0.48, Math.sin(angle) * 0.055);
    blades.push(blade);
  }

  const leafGeometry = mergeGeometries(blades, false);
  blades.forEach((b) => b.dispose());

  if (leafGeometry) {
    const leafMaterial = new MeshMatcapMaterial({ matcap: leafMatcap, vertexColors: true, transparent: true });
    const leafMesh = new Mesh(leafGeometry, leafMaterial);
    leafMesh.renderOrder = 12;
    leafMesh.frustumCulled = false;
    group.add(leafMesh);
    disposables.push(leafGeometry, leafMaterial);
    materials.push(leafMaterial);
  }

  // ── pot: muted clay rather than the deck's own off-white, the pale pot
  // dissolved into the pale deck and the plant read as leaves growing out of
  // the floor. One warm note in a cool scene is also what the room's own
  // corkboard-and-shelf palette does.
  const potGeometry = createPot();
  const potMaterial = new MeshMatcapMaterial({ matcap: potMatcap, color: 0xc98d6b, transparent: true });
  const potMesh = new Mesh(potGeometry, potMaterial);
  potMesh.renderOrder = 12;
  potMesh.frustumCulled = false;
  group.add(potMesh);
  disposables.push(potGeometry, potMaterial);
  materials.push(potMaterial);

  // ── the thing that stops it hovering
  const shadow = createContactShadow();
  if (shadow) {
    const shadowMaterial = new MeshBasicMaterial({
      map: shadow.texture,
      transparent: true,
      blending: MultiplyBlending,
      premultipliedAlpha: true,
      depthWrite: false,
    });
    const shadowMesh = new Mesh(shadow.geometry, shadowMaterial);
    /**
     * AFTER the office, not before it. A multiply blend multiplies against
     * whatever is already in the colour buffer, so at renderOrder 11, ahead
     * of the deck at 12, this multiplied the dark blue background and then
     * the deck painted over the middle of it, leaving a hard blue rectangle
     * on the floor. Drawing last means it multiplies the cream deck, which is
     * the surface the shadow is supposed to be on.
     */
    shadowMesh.renderOrder = 12.5;
    group.add(shadowMesh);
    disposables.push(shadow.geometry, shadowMaterial, shadow.texture);
    materials.push(shadowMaterial);
  }

  return { group, disposables, materials };
};
