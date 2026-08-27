import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhysicalMaterial,
  MultiplyBlending,
  Object3D,
  PlaneGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";

import type { BufferGeometry as Geometry, Material } from "three";

/**
 * Blue Phalaenopsis on the wall shelf, standing where the shelf's own potted
 * plant used to (see `hideShelfPlant` in ./index.ts, which drops that plant from
 * the shelf mesh) — at the open end of the board, beside the books.
 *
 * Proportions come off the reference photo, measured against the pot width: the
 * pot is 1.27 wide for every 1 tall, the whole plant ~2.55 pot-widths tall, the
 * leaf spread ~1.55 pot-widths, one open bloom ~0.5 pot-widths across. Everything
 * below is built around a pot 0.96 wide and scaled by SCALE, so those ratios
 * survive a move or a resize.
 *
 * The room is lit entirely by a baked atlas (MeshBasicMaterial), so the orchid
 * carries its own lights. They live inside this group and only reach the
 * Lambert / Physical materials below, which no other object in the scene uses.
 *
 * Every bloom is generated from its own jittered parameters (see `SEED`), so no
 * two flowers share geometry — that irregularity is most of what separates a
 * plant from duplicated game-asset props. Each one still merges down to a single
 * mesh, so the whole plant is ~16 meshes and 6 materials.
 */
const POSITION = new Vector3(-2.24, 4.037, 2.93);
const SCALE = 0.6;
/**
 * The room group is yawed -2.3 rad in the hero (see transitions/about.ts), which
 * would turn the blooms towards the wall. This cancels it so the flowers, the
 * pot highlight and the leaf spread all face the hero camera, like the reference.
 */
const GROUP_YAW = 2.3;
const SEED = 20260821;

/**
 * Sampled off the reference photo. The blue reads pale at the throat and deepens
 * towards the margins, with slightly deeper veins fanning out from the base —
 * the opposite of the usual "bright centre" instinct, and the main reason the
 * earlier pass looked printed rather than grown.
 */
const PALETTE = {
  potBase: new Color("#7fa0cf"),
  potMid: new Color("#9dbbe4"),
  potRim: new Color("#c2d6f2"),
  soil: new Color("#4b3f33"),
  stem: new Color("#3d5a3a"),
  stemDark: new Color("#27402a"),
  leafBase: new Color("#2b4a33"),
  leafMid: new Color("#356041"),
  leafTip: new Color("#437349"),
  petalThroat: new Color("#cfdcfb"),
  petalMid: new Color("#7b98e2"),
  petalEdge: new Color("#5878cf"),
  petalDeep: new Color("#4360b6"),
  petalVein: new Color("#3f5cb4"),
  lipWhite: new Color("#eef1fb"),
  lipPurple: new Color("#6d5bb8"),
  callus: new Color("#e8bf49"),
  column: new Color("#f4efdf"),
  bud: new Color("#a8bbe8"),
  budTip: new Color("#8ba0d8"),
};

const group = new Group();
const scratch = new Object3D();

let materials: Material[] = [];
let geometries: Geometry[] = [];
let textures: CanvasTexture[] = [];
let spikes: Group[] = [];
let leaves: Group | null = null;
let blooms: { object: Object3D; yaw: number; roll: number }[] = [];
let reducedMotion = false;
let initialized = false;

/* ------------------------------------------------------------------ helpers */

/** mulberry32 — seeded so the plant's irregularity is the same every load. */
const createRandom = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const track = <T extends Geometry | Material | CanvasTexture>(item: T, list: T[]): T => {
  list.push(item);
  return item;
};

type Placement = {
  /** radial angle in the XZ plane */
  angle?: number;
  /** pitch up (+) or down (-) */
  tilt?: number;
  /** spin around the part's own axis */
  roll?: number;
  scale?: number;
  x?: number;
  y?: number;
  z?: number;
};

/** Bakes a transform into a copy of the geometry so a whole bloom merges to one mesh. */
const place = (geometry: Geometry, placement: Placement): Geometry => {
  scratch.position.set(placement.x ?? 0, placement.y ?? 0, placement.z ?? 0);
  scratch.rotation.set(placement.roll ?? 0, placement.angle ?? 0, placement.tilt ?? 0, "YZX");
  scratch.scale.setScalar(placement.scale ?? 1);
  scratch.updateMatrix();

  return geometry.clone().applyMatrix4(scratch.matrix);
};


/* ------------------------------------------------------------------- petals */

type PetalOptions = {
  length: number;
  width: number;
  /** >1 pushes the widest point towards the tip, giving the obovate orchid outline */
  shoulder: number;
  /** lower is blunter; 0.5 gives the rounded margin a real petal has */
  round: number;
  /** how far the tip falls below the base */
  bend: number;
  /** arch through the middle, before the tip falls away */
  lift: number;
  /** concave spoon across the width; the single biggest cue that it is not a card */
  cup: number;
  /** gentle ripple along the margin */
  ripple: number;
  waves: number;
  /** roll along the length, so no two petals present the same face */
  twist: number;
  segments: number;
  sides: number;
  throat: Color;
  mid: Color;
  edge: Color;
  deep: Color;
  vein: Color;
  veins: number;
  veinStrength: number;
};

/**
 * One petal as a cupped, rippled surface, coloured per-vertex: pale at the
 * throat, deepening to the margin, with veins fanning out from the base.
 * Sepals, lip lobes and leaves are all this shape with different numbers.
 */
const createPetal = (options: PetalOptions): Geometry => {
  const rows = options.segments + 1;
  const cols = options.sides * 2 + 1;
  const count = rows * cols;

  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const index: number[] = [];
  const tint = new Color();

  for (let i = 0; i < rows; i++) {
    const u = i / options.segments;
    const half = options.width * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, options.shoulder)), options.round);
    const spine = options.lift * Math.sin(Math.PI * Math.pow(u, 0.85)) - options.bend * u * u;
    const cupAt = options.cup * Math.sin(Math.PI * Math.pow(u, 0.7));
    const twistAt = options.twist * u;
    const cos = Math.cos(twistAt);
    const sin = Math.sin(twistAt);

    for (let j = 0; j < cols; j++) {
      const v = j / options.sides - 1;
      const offset = (i * cols + j) * 3;

      const across = half * v;
      // margins rise into a spoon, then ripple; both fade out at the base
      const rise = cupAt * v * v + options.ripple * Math.sin(v * Math.PI * options.waves) * Math.pow(u, 1.6);

      position[offset] = options.length * u;
      position[offset + 1] = spine + rise * cos - across * sin;
      position[offset + 2] = across * cos + rise * sin;

      const edgeness = Math.abs(v);
      tint.copy(options.throat).lerp(options.mid, Math.min(1, Math.pow(u, 0.75) * 1.6));
      tint.lerp(options.edge, Math.max(0, (u - 0.35) / 0.65) * 0.85);
      tint.lerp(options.deep, Math.pow(edgeness, 2.4) * 0.5);

      // veins fan from the base, strongest across the middle of the blade
      const vein = Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * options.veins), 3);
      tint.lerp(options.vein, vein * options.veinStrength * Math.min(1, u * 2.2) * (1 - edgeness * 0.55));

      // baked occlusion: deep in the throat, where the petals crowd the column,
      // no light reaches. Without it every bloom reads as one flat silhouette.
      tint.multiplyScalar(0.62 + 0.38 * Math.min(1, Math.pow(u / 0.34, 1.1)));

      color.set([tint.r, tint.g, tint.b], offset);

      if (i === 0 || j === 0) continue;
      const a = (i - 1) * cols + (j - 1);
      const b = (i - 1) * cols + j;
      const c = i * cols + j;
      const d = i * cols + (j - 1);
      index.push(a, b, c, a, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("color", new BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  return geometry;
};

/* -------------------------------------------------------------------- leaves */

type LeafOptions = {
  length: number;
  width: number;
  /**
   * Arch up before the tip falls away. Without it a leaf leaving the crown at a
   * downward angle drives straight through the pot wall — real ones rise clear
   * of the rim first, which is also what the reference shows.
   */
  lift: number;
  bend: number;
  cup: number;
  /** half-thickness at the midrib; tapers to nothing at the margin */
  thickness: number;
  segments: number;
  sides: number;
  base: Color;
  mid: Color;
  tip: Color;
};

/**
 * A leaf as a closed shell: the upper surface plus a mirrored under-surface that
 * tapers to nothing at the margin. Real Phalaenopsis leaves are thick and
 * succulent, and a single-sided blade reads as a cut-out from every angle.
 */
const createLeaf = (options: LeafOptions): Geometry => {
  const rows = options.segments + 1;
  const cols = options.sides * 2 + 1;
  const perSide = rows * cols;
  const count = perSide * 2;

  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const index: number[] = [];
  const tint = new Color();

  for (let i = 0; i < rows; i++) {
    const u = i / options.segments;
    // blunt, strap-shaped: wide almost immediately, rounded off at the tip
    const half = options.width * 0.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 1.25)), 0.5);
    const spine = options.lift * Math.sin(Math.PI * Math.pow(u, 0.62)) - options.bend * u * u * u;
    const cupAt = options.cup * Math.sin(Math.PI * Math.pow(u, 0.8));

    for (let j = 0; j < cols; j++) {
      const v = j / options.sides - 1;
      const edgeness = Math.abs(v);
      const across = half * v;
      const rise = cupAt * v * v;
      const solid = options.thickness * (1 - edgeness * edgeness) * Math.sin(Math.PI * Math.pow(u, 0.6));

      const top = (i * cols + j) * 3;
      const under = (perSide + i * cols + j) * 3;

      position[top] = options.length * u;
      position[top + 1] = spine + rise + solid;
      position[top + 2] = across;

      position[under] = options.length * u;
      position[under + 1] = spine + rise - solid;
      position[under + 2] = across;

      tint.copy(options.base).lerp(options.mid, Math.min(1, u * 1.7));
      tint.lerp(options.tip, Math.max(0, (u - 0.45) / 0.55) * 0.8);
      // the midrib catches the light, the margins fall away
      tint.multiplyScalar(1 - Math.pow(edgeness, 2) * 0.22);
      color.set([tint.r, tint.g, tint.b], top);
      // the underside is always in its own shade
      tint.multiplyScalar(0.72);
      color.set([tint.r, tint.g, tint.b], under);

      if (i === 0 || j === 0) continue;
      const a = (i - 1) * cols + (j - 1);
      const b = (i - 1) * cols + j;
      const c = i * cols + j;
      const d = i * cols + (j - 1);
      index.push(a, b, c, a, c, d);
      index.push(perSide + a, perSide + c, perSide + b, perSide + a, perSide + d, perSide + c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("color", new BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  return geometry;
};

/* --------------------------------------------------------------------- stems */

/** A stem that thins as it climbs, following the spike curve. */
const createStem = (curve: CatmullRomCurve3, from: number, to: number, segments: number, radial: number): Geometry => {
  const rows = segments + 1;
  const count = rows * radial;
  const position = new Float32Array(count * 3);
  const color = new Float32Array(count * 3);
  const index: number[] = [];

  const point = new Vector3();
  const tangent = new Vector3();
  const normal = new Vector3();
  const binormal = new Vector3();
  const tint = new Color();

  for (let i = 0; i < rows; i++) {
    const t = i / segments;
    curve.getPointAt(t, point);
    curve.getTangentAt(t, tangent).normalize();

    normal.set(0, 1, 0);
    if (Math.abs(tangent.y) > 0.92) normal.set(1, 0, 0);
    binormal.crossVectors(tangent, normal).normalize();
    normal.crossVectors(binormal, tangent).normalize();

    const radius = from + (to - from) * t;
    tint.copy(PALETTE.stemDark).lerp(PALETTE.stem, Math.min(1, 0.25 + t * 1.1));

    for (let j = 0; j < radial; j++) {
      const angle = (j / radial) * Math.PI * 2;
      const cos = Math.cos(angle) * radius;
      const sin = Math.sin(angle) * radius;
      const offset = (i * radial + j) * 3;

      position[offset] = point.x + normal.x * cos + binormal.x * sin;
      position[offset + 1] = point.y + normal.y * cos + binormal.y * sin;
      position[offset + 2] = point.z + normal.z * cos + binormal.z * sin;

      // the shaded side of a round stem, without needing a second light
      const shade = 0.78 + 0.22 * Math.cos(angle - 0.9);
      color.set([tint.r * shade, tint.g * shade, tint.b * shade], offset);

      if (i === 0) continue;
      const a = (i - 1) * radial + j;
      const b = (i - 1) * radial + ((j + 1) % radial);
      const c = i * radial + ((j + 1) % radial);
      const d = i * radial + j;
      index.push(a, b, c, a, c, d);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(position, 3));
  geometry.setAttribute("color", new BufferAttribute(color, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();

  return geometry;
};

/** A short tapered stalk from `from` to `to` — spike to bloom, and the lip antennae. */
const createStalk = (from: Vector3, to: Vector3, radius: number, taper = 0.6): Geometry => {
  const curve = new CatmullRomCurve3([from, from.clone().lerp(to, 0.5), to]);
  return createStem(curve, radius, radius * taper, 4, 5);
};

/* --------------------------------------------------------------------- parts */

/**
 * Rounded bowl off the reference: a small flat foot, the shoulder swelling to
 * its widest just above halfway, then drawing in to a slightly everted lip.
 */
const POT_PROFILE = [
  [0, 0],
  [0.2, 0],
  [0.255, 0.012],
  [0.315, 0.042],
  [0.372, 0.095],
  [0.418, 0.165],
  [0.452, 0.245],
  [0.472, 0.325],
  [0.478, 0.4],
  [0.472, 0.475],
  [0.455, 0.545],
  [0.43, 0.61],
  [0.404, 0.665],
  [0.385, 0.705],
  [0.376, 0.732],
  [0.382, 0.745],
  [0.372, 0.752],
  [0.352, 0.746],
  [0.346, 0.7],
];
const POT_HEIGHT = 0.752;
const CROWN_Y = 0.74;

const createPot = (material: Material) => {
  const profile = POT_PROFILE.map(([x, y]) => new Vector2(x!, y!));
  const geometry = track(new LatheGeometry(profile, 40), geometries);
  geometry.deleteAttribute("uv");

  const position = geometry.getAttribute("position");
  const color = new Float32Array(position.count * 3);
  const tint = new Color();

  for (let i = 0; i < position.count; i++) {
    const height = Math.min(1, Math.max(0, position.getY(i) / POT_HEIGHT));
    tint.copy(PALETTE.potBase).lerp(PALETTE.potMid, Math.pow(height, 0.9));
    tint.lerp(PALETTE.potRim, Math.pow(height, 3.2) * 0.85);
    // glazed ceramic darkens where it turns away from the key light
    const facing = Math.atan2(position.getZ(i), position.getX(i));
    tint.multiplyScalar(0.93 + 0.07 * Math.cos(facing - 2.1));
    color.set([tint.r, tint.g, tint.b], i * 3);
  }

  geometry.setAttribute("color", new BufferAttribute(color, 3));

  return new Mesh(geometry, material);
};

const createSoil = (material: Material) => {
  const geometry = track(new CircleGeometry(0.3, 20), geometries);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, POT_HEIGHT - 0.055, 0);
  return new Mesh(geometry, material);
};

/**
 * Soft contact patch under the pot. The room is a baked atlas with no shadow
 * pass, so without this the plant reads as hovering a few millimetres above the
 * shelf. Multiply blending means it darkens the baked board rather than painting
 * a grey disc on top of it.
 */
const createContactShadow = () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "#877a6d");
  gradient.addColorStop(0.3, "#a39485");
  gradient.addColorStop(0.62, "#d8cec4");
  gradient.addColorStop(1, "#ffffff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = track(new CanvasTexture(canvas), textures);
  // barely wider than the pot, so it grounds the base instead of smudging the board
  const geometry = track(new PlaneGeometry(1.16, 1.16), geometries);
  geometry.rotateX(-Math.PI / 2);
  // thrown away from the key light, which sits front-left
  geometry.translate(0.1, 0.004, -0.06);

  const material = track(
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      blending: MultiplyBlending,
      // three warns (every frame) without this; the texture is fully opaque, so
      // it changes nothing numerically — multiply only reads the source colour
      premultipliedAlpha: true,
      depthWrite: false,
    }),
    materials,
  );

  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = -1;
  return mesh;
};

/**
 * Six broad leaves fanning from the crown. `tilt` sets how steeply each one
 * leaves the rim; the arch in `createLeaf` carries it out over the pot before
 * the tip drops, so nothing intersects the ceramic.
 */
const LEAVES = [
  { angle: 0.34, tilt: 0.2, scale: 1, roll: 0.09 },
  { angle: 1.26, tilt: 0.3, scale: 0.86, roll: -0.13 },
  { angle: 2.3, tilt: 0.16, scale: 0.97, roll: 0.07 },
  { angle: 3.3, tilt: 0.28, scale: 0.9, roll: -0.09 },
  { angle: 4.3, tilt: 0.14, scale: 1.04, roll: 0.12 },
  { angle: 5.26, tilt: 0.32, scale: 0.83, roll: -0.06 },
];

const createLeaves = (material: Material) => {
  const random = createRandom(SEED + 977);

  const parts = LEAVES.map((leaf) =>
    place(
      createLeaf({
        length: 0.84 + random() * 0.1,
        // ~2.7 long for every 1 wide, off the reference; wider reads as a paddle
        width: 0.31 + random() * 0.04,
        lift: 0.24 + random() * 0.04,
        // shallow: the tip settles around the pot's waist rather than sliding
        // down its face
        bend: 0.2 + random() * 0.07,
        cup: 0.09 + random() * 0.03,
        thickness: 0.024,
        segments: 14,
        sides: 6,
        base: PALETTE.leafBase,
        mid: PALETTE.leafMid,
        tip: PALETTE.leafTip,
      }),
      { ...leaf, y: CROWN_Y - 0.055 },
    ),
  );

  const merged = track(mergeGeometries(parts), geometries);
  parts.forEach((part) => part.dispose());

  const rosette = new Group();
  rosette.add(new Mesh(merged, material));
  return rosette;
};

/* -------------------------------------------------------------------- blooms */

/**
 * Phalaenopsis face: dorsal sepal up, two broad lateral petals flanking it, two
 * lateral sepals below, lip at the bottom. Angles are measured off the reference.
 */
const BLOOM_PARTS = [
  { kind: "sepal", angle: Math.PI * 0.5, scale: 0.94 },
  { kind: "petal", angle: Math.PI * 0.16, scale: 1 },
  { kind: "petal", angle: Math.PI * 0.84, scale: 1 },
  { kind: "sepal", angle: Math.PI * 1.16, scale: 0.9 },
  { kind: "sepal", angle: Math.PI * 1.84, scale: 0.9 },
] as const;

/**
 * The lip: a hooded column over a small white platform with two purple side
 * lobes, a yellow callus and the two curling antennae Phalaenopsis is known for.
 * At this scale they read as a dark, detailed centre rather than a blank dot —
 * which is what stops each bloom looking like a generic five-petal star.
 */
const createLabellum = (random: () => number): Geometry => {
  const parts: Geometry[] = [];

  // hooded column, arching forward over the throat
  const column = createPetal({
    length: 0.082,
    width: 0.066,
    shoulder: 1.1,
    round: 0.44,
    bend: -0.026,
    lift: 0.012,
    cup: -0.02,
    ripple: 0,
    waves: 1,
    twist: 0,
    segments: 6,
    sides: 3,
    throat: PALETTE.column,
    mid: PALETTE.column,
    edge: PALETTE.lipWhite,
    deep: PALETTE.lipPurple,
    vein: PALETTE.column,
    veins: 1,
    veinStrength: 0,
  });
  parts.push(place(column, { angle: Math.PI * 1.5, tilt: 0.5, y: 0.014 }));

  // side lobes, standing up either side of the column
  const lobe = createPetal({
    length: 0.066,
    width: 0.045,
    shoulder: 1.25,
    round: 0.5,
    bend: -0.03,
    lift: 0.006,
    cup: 0.014,
    ripple: 0,
    waves: 1,
    twist: 0,
    segments: 6,
    sides: 3,
    throat: PALETTE.lipWhite,
    mid: PALETTE.lipWhite,
    edge: PALETTE.lipPurple,
    deep: PALETTE.lipPurple,
    vein: PALETTE.lipPurple,
    veins: 1,
    veinStrength: 0.3,
  });
  parts.push(place(lobe, { angle: Math.PI * 1.26, tilt: 0.34, y: 0.006 }));
  parts.push(place(lobe, { angle: Math.PI * 1.74, tilt: 0.34, y: 0.006 }));

  // mid lobe: the little anchor-shaped platform below the column
  const midLobe = createPetal({
    length: 0.078,
    width: 0.064,
    shoulder: 1.5,
    round: 0.42,
    bend: 0.012,
    lift: 0.008,
    cup: 0.012,
    ripple: 0.004,
    waves: 2,
    twist: 0,
    segments: 7,
    sides: 4,
    throat: PALETTE.callus,
    mid: PALETTE.lipWhite,
    edge: PALETTE.lipWhite,
    deep: PALETTE.lipPurple,
    vein: PALETTE.callus,
    veins: 2,
    veinStrength: 0.35,
  });
  parts.push(place(midLobe, { angle: Math.PI * 1.5, tilt: -0.22, y: -0.004, z: 0.004 }));

  // the two antennae curling off the lip tip
  const tip = new Vector3(0, -0.006, 0.05);
  parts.push(createStalk(tip, new Vector3(-0.022, 0.018, 0.078), 0.0035, 0.4));
  parts.push(createStalk(tip, new Vector3(0.022, 0.018, 0.078), 0.0035, 0.4));

  const merged = mergeGeometries(parts);
  [column, lobe, midLobe].forEach((shape) => shape.dispose());
  parts.forEach((part) => part.dispose());

  // a touch of asymmetry so no two lips sit identically
  merged.rotateY((random() - 0.5) * 0.12);

  return merged;
};

/** One bloom, built from its own jittered numbers so no two flowers match. */
const createBloom = (random: () => number): Geometry => {
  // each flower drifts a little in hue and depth, the way a real spike does
  const drift = (random() - 0.5) * 0.055;
  const shade = 0.94 + random() * 0.12;
  const tint = (base: Color) => base.clone().offsetHSL(drift, (random() - 0.5) * 0.06, (shade - 1) * 0.5);

  const throat = tint(PALETTE.petalThroat);
  const mid = tint(PALETTE.petalMid);
  const edge = tint(PALETTE.petalEdge);
  const deep = tint(PALETTE.petalDeep);
  const vein = tint(PALETTE.petalVein);

  const shapes = {
    petal: createPetal({
      length: 0.24 + random() * 0.02,
      width: 0.255 + random() * 0.025,
      shoulder: 1.34 + random() * 0.14,
      round: 0.5 + random() * 0.05,
      bend: -0.012 + random() * 0.016,
      lift: 0.018 + random() * 0.01,
      cup: 0.03 + random() * 0.014,
      ripple: 0.005 + random() * 0.004,
      waves: 2,
      twist: (random() - 0.5) * 0.2,
      segments: 16,
      sides: 7,
      throat,
      mid,
      edge,
      deep,
      vein,
      veins: 5,
      veinStrength: 0.32 + random() * 0.12,
    }),
    sepal: createPetal({
      length: 0.225 + random() * 0.02,
      width: 0.145 + random() * 0.02,
      shoulder: 1.22 + random() * 0.12,
      round: 0.52,
      bend: -0.01 + random() * 0.014,
      lift: 0.014,
      cup: 0.022 + random() * 0.01,
      ripple: 0.004,
      waves: 2,
      twist: (random() - 0.5) * 0.18,
      segments: 14,
      sides: 6,
      throat,
      mid,
      edge,
      deep,
      vein,
      veins: 4,
      veinStrength: 0.28 + random() * 0.1,
    }),
  };

  const parts: Geometry[] = BLOOM_PARTS.map((part) =>
    place(shapes[part.kind], {
      angle: part.angle + (random() - 0.5) * 0.09,
      scale: part.scale * (0.96 + random() * 0.08),
      tilt: (random() - 0.5) * 0.1,
      roll: (random() - 0.5) * 0.12,
    }),
  );

  // no `angle` here: createLabellum already builds its parts around 1.5π (the
  // bottom of the face), so rotating again would swing the lip out to the side
  const labellum = createLabellum(random);
  parts.push(place(labellum, { y: 0.006, scale: 0.98 + random() * 0.06 }));

  const merged = mergeGeometries(parts);
  Object.values(shapes).forEach((shape) => shape.dispose());
  labellum.dispose();
  parts.forEach((part) => part.dispose());

  return merged;
};

/** A plump teardrop bud, pointed at the tip, the way the reference's cluster reads. */
const createBud = (): Geometry => {
  const profile: Vector2[] = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    const radius = Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.5 * (1 - Math.pow(t, 3) * 0.35);
    profile.push(new Vector2(radius, t));
  }

  const geometry = new LatheGeometry(profile, 12);
  geometry.deleteAttribute("uv");

  const position = geometry.getAttribute("position");
  const color = new Float32Array(position.count * 3);
  const tint = new Color();

  for (let i = 0; i < position.count; i++) {
    tint.copy(PALETTE.bud).lerp(PALETTE.budTip, Math.pow(position.getY(i), 1.4));
    const facing = Math.atan2(position.getZ(i), position.getX(i));
    tint.multiplyScalar(0.85 + 0.15 * Math.cos(facing - 2.1));
    color.set([tint.r, tint.g, tint.b], i * 3);
  }

  geometry.setAttribute("color", new BufferAttribute(color, 3));
  return geometry;
};

/* -------------------------------------------------------------------- spikes */

type BloomSpot = {
  /** where along the spike */
  t: number;
  /** offset from the spike, x sideways, z towards the viewer */
  x: number;
  y?: number;
  z: number;
  yaw: number;
  roll: number;
  /** pitch: + looks up */
  pitch?: number;
  scale: number;
};

type SpikeOptions = {
  /** where the spike leaves the crown; the sway pivots here */
  base: Vector3;
  /** curve of the spike, relative to `base` */
  points: Vector3[];
  blooms: BloomSpot[];
  budsAt: number[];
};

/**
 * One tall spike rising then arching right with the open blooms and a cluster of
 * buds trailing off its drooping tip; a shorter one leaning left with two more.
 */
const SPIKES: SpikeOptions[] = [
  {
    base: new Vector3(0.02, CROWN_Y + 0.01, 0.03),
    points: [
      new Vector3(0, 0, 0),
      new Vector3(0.02, 0.34, 0.02),
      new Vector3(0.06, 0.66, 0.04),
      new Vector3(0.11, 0.94, 0.05),
      new Vector3(0.19, 1.15, 0.04),
      new Vector3(0.31, 1.3, 0.01),
      new Vector3(0.46, 1.37, -0.02),
      new Vector3(0.6, 1.35, -0.05),
      new Vector3(0.71, 1.28, -0.08),
    ],
    blooms: [
      { t: 0.4, x: -0.19, y: -0.02, z: 0.1, yaw: -0.3, roll: 0.12, scale: 1 },
      { t: 0.53, x: 0.17, y: 0.01, z: 0.09, yaw: 0.35, roll: -0.1, scale: 0.93 },
      { t: 0.64, x: -0.2, y: 0.02, z: 0.11, yaw: -0.2, roll: -0.08, pitch: 0.06, scale: 0.99 },
      { t: 0.74, x: -0.04, y: 0.16, z: 0.12, yaw: 0.05, roll: 0.15, pitch: 0.12, scale: 0.9 },
      { t: 0.85, x: 0.16, y: -0.06, z: 0.1, yaw: 0.45, roll: -0.18, pitch: -0.08, scale: 0.86 },
    ],
    budsAt: [0.9, 0.945, 0.98, 1],
  },
  {
    base: new Vector3(-0.07, CROWN_Y + 0.01, -0.02),
    points: [
      new Vector3(0, 0, 0),
      new Vector3(-0.05, 0.3, 0.01),
      new Vector3(-0.16, 0.56, 0.04),
      new Vector3(-0.3, 0.76, 0.06),
      new Vector3(-0.45, 0.87, 0.05),
    ],
    blooms: [
      { t: 0.62, x: -0.17, y: 0.02, z: 0.1, yaw: -0.4, roll: 0.1, pitch: 0.05, scale: 0.91 },
      { t: 0.85, x: 0.06, y: 0.14, z: 0.11, yaw: -0.15, roll: -0.12, pitch: 0.1, scale: 0.85 },
    ],
    budsAt: [0.95, 1],
  },
];

const createSpike = (
  options: SpikeOptions,
  random: () => number,
  bud: Geometry,
  stemMaterial: Material,
  bloomMaterial: Material,
) => {
  const curve = new CatmullRomCurve3(options.points, false, "catmullrom", 0.4);

  const pivot = new Group();
  pivot.position.copy(options.base);

  const stemParts: Geometry[] = [track(createStem(curve, 0.017, 0.009, 26, 6), geometries)];

  options.blooms.forEach((spot) => {
    const object = new Object3D();
    const point = curve.getPointAt(spot.t);

    object.position.set(point.x + spot.x, point.y + (spot.y ?? 0), point.z + spot.z);
    object.scale.setScalar(spot.scale * (0.97 + random() * 0.06));
    object.rotation.order = "YXZ";
    object.rotation.x = Math.PI / 2 - 0.16 - (spot.pitch ?? 0) + (random() - 0.5) * 0.07;
    object.rotation.y = spot.yaw + (random() - 0.5) * 0.08;
    object.rotation.z = spot.roll + (random() - 0.5) * 0.08;

    const geometry = track(createBloom(random), geometries);
    object.add(new Mesh(geometry, bloomMaterial));

    // pedicel: a short tapered stalk from the spike to the back of the bloom
    stemParts.push(createStalk(point, object.position, 0.008));

    pivot.add(object);
    blooms.push({ object, yaw: object.rotation.y, roll: object.rotation.z });
  });

  const stem = track(mergeGeometries(stemParts), geometries);
  stemParts.forEach((part) => part.dispose());
  pivot.add(new Mesh(stem, stemMaterial));

  const budParts = options.budsAt.map((t, index) => {
    const point = curve.getPointAt(t);
    const side = index % 2 ? 0.04 : -0.04;
    return place(bud, {
      x: point.x + side,
      y: point.y - 0.035,
      z: point.z + 0.05,
      scale: (0.2 - index * 0.022) * (0.92 + random() * 0.16),
      tilt: -0.6 - random() * 0.25,
      angle: random() * Math.PI,
    });
  });

  const buds = track(mergeGeometries(budParts), geometries);
  budParts.forEach((part) => part.dispose());
  pivot.add(new Mesh(buds, bloomMaterial));

  return pivot;
};

/* ------------------------------------------------------------------- lighting */

/**
 * Soft daylight, matching the reference photo: a broad key from the upper left
 * front, a cool fill from the right so the shadowed side is not black, and a
 * faint back light to separate the leaves from the board. Nothing here is
 * emissive — the orchid is lit, not glowing, which is what keeps it reading as a
 * real object inside the otherwise stylised room.
 */
const createLights = () => {
  // kept low so the key can actually carve shape; a bright hemisphere is what
  // flattens procedural plants into stickers
  const hemisphere = new HemisphereLight("#eef2ff", "#9c8a70", 0.62);

  const key = new DirectionalLight("#fff3e2", 2.35);
  key.position.set(-1.2, 3.6, 3.2);
  key.target.position.set(0, 1, 0);

  const fill = new DirectionalLight("#c6d6f2", 0.4);
  fill.position.set(2.6, 1.4, 2.2);
  fill.target.position.set(0, 1.1, 0);

  const rim = new DirectionalLight("#e6ecff", 0.42);
  rim.position.set(0.6, 2.2, -2.8);
  rim.target.position.set(0, 1.2, 0);

  group.add(hemisphere, key, key.target, fill, fill.target, rim, rim.target);
};

/* ---------------------------------------------------------------- lifecycle */

const init = () => {
  if (initialized) return;
  initialized = true;

  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const potMaterial = track(
    new MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.42,
      reflectivity: 0.32,
    }),
    materials,
  );
  const soilMaterial = track(new MeshLambertMaterial({ color: PALETTE.soil }), materials);
  const stemMaterial = track(new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0 }), materials);
  // orchid leaves are waxy: a broad diffuse body under a weak clearcoat sheen
  const foliageMaterial = track(
    new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.46, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.55 }),
    materials,
  );
  /**
   * Petals are thin and translucent. `sheen` lifts the grazing angles the way
   * light scattering through a petal edge does, and a very low emissive keeps the
   * shadowed side from going flat — both far cheaper than `transmission`, which
   * would force a separate render pass for one small object.
   */
  const bloomMaterial = track(
    new MeshPhysicalMaterial({
      vertexColors: true,
      side: DoubleSide,
      roughness: 0.66,
      metalness: 0,
      sheen: 0.8,
      sheenRoughness: 0.85,
      sheenColor: new Color("#dbe4ff"),
      emissive: new Color("#2c3a76"),
      emissiveIntensity: 0.07,
    }),
    materials,
  );

  group.position.copy(POSITION);
  group.rotation.y = GROUP_YAW;
  group.scale.setScalar(SCALE);

  const contactShadow = createContactShadow();
  if (contactShadow) group.add(contactShadow);

  group.add(createPot(potMaterial), createSoil(soilMaterial));

  leaves = createLeaves(foliageMaterial);
  group.add(leaves);

  const bud = track(createBud(), geometries);
  const random = createRandom(SEED);
  spikes = SPIKES.map((options) => createSpike(options, random, bud, stemMaterial, bloomMaterial));
  spikes.forEach((spike) => group.add(spike));

  createLights();
};

/** Barely-there sway: slow, low amplitude, no two parts in phase. */
const tick = () => {
  if (reducedMotion || !initialized) return;
  const time = gsap.ticker.time;

  spikes.forEach((spike, i) => {
    spike.rotation.z = Math.sin(time * 0.33 + i * 2.1) * 0.042;
    spike.rotation.x = Math.sin(time * 0.25 + i * 4.3) * 0.03;
  });

  blooms.forEach(({ object, yaw, roll }, i) => {
    object.rotation.y = yaw + Math.sin(time * 0.54 + i * 1.7) * 0.05;
    object.rotation.z = roll + Math.sin(time * 0.41 + i * 0.9) * 0.04;
  });

  if (leaves) {
    leaves.rotation.z = Math.sin(time * 0.19) * 0.018;
    leaves.rotation.x = Math.sin(time * 0.23 + 1.9) * 0.014;
  }
};

const destroy = () => {
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  geometries = [];
  materials = [];
  textures = [];
  spikes = [];
  blooms = [];
  leaves = null;
  group.clear();
  group.scale.setScalar(1);
  initialized = false;
};

export const orchid = { init, tick, destroy, group };
