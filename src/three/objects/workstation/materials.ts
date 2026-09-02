import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MultiplyBlending,
  PlaneGeometry,
  SRGBColorSpace,
} from "three";

import type { BufferGeometry, Material, Texture } from "three";

/**
 * ─── HOW THE OFFICE TELLS ONE MATERIAL FROM ANOTHER ───────────────────────
 *
 * There are no lights in this scene, the whole site is matcaps and baked
 * textures, so "roughness" cannot be a number on a standard material. It has
 * to be baked into the matcap itself, and the office only had ONE: the
 * avatar's white sphere, tinted per surface. Tinting changes hue and nothing
 * else, so the desk, the chair, the mug and the notebook all shaded
 * identically and the bay read as one plastic object cut into pieces. That is
 * the "everything is the same material" tell, and no amount of re-colouring
 * fixes it.
 *
 * So the profiles below are rendered here, once, on a 128px canvas. A matcap
 * is just a lit sphere sampled by the view-space normal, which is four lines
 * of maths per pixel, cheaper than downloading a sixth texture, and it means
 * ceramic and laminate differ in the way real materials differ: where the
 * highlight is, how tight it is, and how much light comes back at a grazing
 * angle.
 *
 * They are greyscale on purpose. `MeshMatcapMaterial` multiplies the matcap by
 * `color`, so one profile serves every surface that is made of that stuff and
 * the palette stays where it was.
 */

type Profile = {
  /** Light that comes back from the unlit side. High = chalky, low = dramatic. */
  ambient: number;
  /** Brightness at the lit pole. */
  diffuse: number;
  /** Diffuse falloff. >1 tightens the terminator, <1 wraps it round. */
  wrap: number;
  /** Specular strength, 0 = none. */
  spec: number;
  /** Specular tightness. Big = a small hard glint, small = a broad sheen. */
  specPower: number;
  /** Light returned at the silhouette, what makes fabric and metal read. */
  rim: number;
  rimPower: number;
};

/**
 * Upper-left and slightly toward the viewer, which is where the site's baked
 * lighting already comes from, the room's own shading and the avatar's white
 * matcap both key from that side, so the office does not fight them.
 */
const LIGHT: [number, number, number] = [-0.36, 0.58, 0.73];

const PROFILES = {
  /** Desk top. Melamine over board: wide soft sheen, no glint, no rim. */
  laminate: { ambient: 0.42, diffuse: 0.5, wrap: 0.85, spec: 0.1, specPower: 6, rim: 0.05, rimPower: 4 },
  /** Mug. Glazed: a small hard highlight and a second bounce off the far wall. */
  ceramic: { ambient: 0.4, diffuse: 0.44, wrap: 1.1, spec: 0.55, specPower: 42, rim: 0.16, rimPower: 3 },
  /** Keyboard, monitor shells, mouse. ABS: mid highlight, slightly waxy. */
  plastic: { ambient: 0.36, diffuse: 0.5, wrap: 1.0, spec: 0.24, specPower: 16, rim: 0.1, rimPower: 3.5 },
  /** Monitor stands, lamp, desk frame. Anodised: bright rim, tight glint. */
  metal: { ambient: 0.26, diffuse: 0.46, wrap: 1.3, spec: 0.6, specPower: 26, rim: 0.42, rimPower: 2.4 },
  /**
   * Chair. Woven: almost no specular, strong grazing sheen. The first pass
   * had ambient this high AND diffuse this low, which flattened the seat shell
   * into a grey cut-out, a chair with no form beside a desk with plenty is
   * worse than one that is the wrong colour.
   */
  fabric: { ambient: 0.3, diffuse: 0.5, wrap: 0.72, spec: 0.03, specPower: 4, rim: 0.26, rimPower: 2.2 },
  /** Paper, card, soil. Flattest thing in the room. */
  matte: { ambient: 0.52, diffuse: 0.4, wrap: 0.8, spec: 0.0, specPower: 4, rim: 0.03, rimPower: 4 },
} as const satisfies Record<string, Profile>;

export type MaterialKind = keyof typeof PROFILES;

const SIZE = 128;

const cache = new Map<MaterialKind, Texture>();

/**
 * One lit hemisphere, written straight into an ImageData. Layering canvas
 * gradients would be shorter to write and impossible to control, the whole
 * point is that `specPower` and `rim` mean the same thing across six profiles,
 * which only holds if they are the same formula.
 */
const render = (profile: Profile): Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(SIZE, SIZE);
  const data = image.data;

  const [lx, ly, lz] = LIGHT;
  // Half-vector between the light and the (fixed) view direction, +Z.
  const hx = lx;
  const hy = ly;
  const hz = lz + 1;
  const hLength = Math.hypot(hx, hy, hz);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      // Canvas Y runs down, matcap V runs up.
      const nx = (x / (SIZE - 1)) * 2 - 1;
      const ny = 1 - (y / (SIZE - 1)) * 2;
      const r2 = nx * nx + ny * ny;

      // Outside the disc there is no normal. Clamping to the silhouette rather
      // than leaving it black stops the edge texels bleeding a dark ring in
      // under linear filtering.
      const scale = r2 > 1 ? 1 / Math.sqrt(r2) : 1;
      const sx = nx * scale;
      const sy = ny * scale;
      const nz = Math.sqrt(Math.max(0, 1 - (sx * sx + sy * sy)));

      const diffuse = Math.max(0, sx * lx + sy * ly + nz * lz);
      const specular = Math.max(0, (sx * hx + sy * hy + nz * hz) / hLength);
      const rim = Math.pow(1 - nz, profile.rimPower);

      let value =
        profile.ambient +
        profile.diffuse * Math.pow(diffuse, profile.wrap) +
        profile.spec * Math.pow(specular, profile.specPower) +
        profile.rim * rim;

      value = Math.min(1, Math.max(0, value));
      const byte = Math.round(value * 255);

      const index = (y * SIZE + x) * 4;
      data[index] = byte;
      data[index + 1] = byte;
      data[index + 2] = byte;
      data[index + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
  // MeshMatcapMaterial runs its output through the sRGB encode, so the texture
  // has to declare that it is already in that space, the same correction the
  // shared white matcap makes.
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

/** Cached per kind, six textures for the whole office, built on first use. */
export const getMatcap = (kind: MaterialKind): Texture => {
  const existing = cache.get(kind);
  if (existing) return existing;
  const texture = render(PROFILES[kind]);
  cache.set(kind, texture);
  return texture;
};

/** Every shared asset this module hands out: the matcaps and the shadow pools. */
export const disposeMatcaps = () => {
  cache.forEach((texture) => texture.dispose());
  cache.clear();
  shadowTextures.forEach((texture) => texture.dispose());
  shadowTextures.clear();
  shadowPlane?.dispose();
  shadowPlane = null;
};

/**
 * ── CONTACT SHADOWS ───────────────────────────────────────────────────────
 *
 * Nothing in this scene casts a real shadow, so every prop on the desk was
 * hovering a few centimetres above it, the one tell that makes a modelled
 * scene read as assets dropped onto a plane. The plant already solved this
 * with a multiply-blended radial gradient; this is that trick as one call so
 * the mug, the keyboard, the stands, the lamp and the envelope all get the
 * same one.
 *
 * `width` and `depth` are separate so a wide flat object (a keyboard) gets a
 * wide flat shadow rather than a circular smudge, and `strength` is how dark
 * the core is, 0..1.
 */
const shadowTextures = new Map<number, Texture>();
/**
 * One unit plane for every pool in the office, scaled per mesh. A dozen props
 * want a dozen different footprints and none of them want a different shape.
 */
let shadowPlane: PlaneGeometry | null = null;

const shadowTexture = (strength: number): Texture | null => {
  // Quantised, so "0.44" and "0.46" share a canvas. There are about five
  // distinct strengths in the office and no visible difference inside a step.
  const key = Math.round(strength * 20) / 20;
  const existing = shadowTextures.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // White is "no shadow" under multiply, so only the core darkens. The stops
  // are cool rather than neutral: a warm shadow on warm laminate reads as a
  // stain, a cool one reads as light not reaching the surface.
  const core = Math.round(255 * (1 - key));
  const mid = Math.round(255 * (1 - key * 0.45));
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, `rgb(${core}, ${core + 6}, ${core + 12})`);
  gradient.addColorStop(0.38, `rgb(${mid}, ${mid + 5}, ${mid + 9})`);
  gradient.addColorStop(0.74, "rgb(226, 231, 236)");
  gradient.addColorStop(1, "#ffffff");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  shadowTextures.set(key, texture);
  return texture;
};

export const createContactShadow = (
  width: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  strength = 0.5,
): { mesh: Mesh; disposables: (BufferGeometry | Material | Texture)[] } | null => {
  const texture = shadowTexture(strength);
  if (!texture) return null;

  if (!shadowPlane) {
    shadowPlane = new PlaneGeometry(1, 1);
    shadowPlane.rotateX(-Math.PI / 2);
  }

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    blending: MultiplyBlending,
    premultipliedAlpha: true,
    depthWrite: false,
  });

  const mesh = new Mesh(shadowPlane, material);
  mesh.scale.set(width, 1, depth);
  mesh.position.set(x, y, z);
  mesh.frustumCulled = false;
  /**
   * After the furniture, not before it. Multiply blends against whatever is
   * already in the colour buffer, at a lower render order this multiplies the
   * dark blue background and the desk then paints over the middle of it,
   * leaving a hard rectangle. See the same note in `plant.ts`.
   */
  mesh.renderOrder = 12.5;

  // The plane and the texture are shared and outlive the caller, so only the
  // material is the caller's to dispose. `disposeMatcaps` owns the rest.
  return { mesh, disposables: [material] };
};

