import { BoxGeometry, CircleGeometry, CylinderGeometry, SkinnedMesh, TorusGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { bakeToBone } from "./spectacles";

import type { BufferGeometry, Material, Object3D, Skeleton } from "three";

/**
 * ─── TWO WATCHES, ONE WRIST ───────────────────────────────────────────────
 *
 * Both on his RIGHT wrist, his own right, not the right of the screen, and
 * never both at once:
 *
 *   · at home (hero, About, Contact) a ROUND SMARTWATCH: a dark puck on a dark
 *     band, a dark always-on display with a light readout on it, and a side
 *     button breaking the rim. No logo, no brand. The display is dark on
 *     purpose: a round case with a bright white disc is the one silhouette
 *     that reads as a dress watch from the hero camera, and the Timex already
 *     owns "a watch with a light face" in this portfolio.
 *   · at work (Experience, and the story pages) the TIMEX: a round steel
 *     three-hander on a black strap, its face drawn by `../timex-dial`. Steel
 *     case, bezel, crown, lugs.
 *
 * `setTimex` swaps them. It is driven off `avatar.seated`, which only the
 * Experience timeline raises, and which is already at 1 before the materialise
 * scan makes him visible there and back at 0 only after the closing scan has
 * hidden him again, so the swap itself is never on screen.
 *
 * ── EVERYTHING HERE MUST STAY INDEXED ─────────────────────────────────────
 *
 * `hologram.ts` merges the smartwatch geometries in with the GLB's own, and
 * `mergeGeometries` returns NULL, silently, if some inputs are indexed and
 * others are not. Box, Cylinder, Circle and Torus are all indexed;
 * `RoundedBoxGeometry` is not, which is why the case is chamfered with a
 * second, smaller puck rather than with a rounded primitive. Getting this
 * wrong does not break the watch, it breaks the entire X-ray avatar.
 *
 * ── THE COORDINATE FRAME ──────────────────────────────────────────────────
 *
 * Everything is authored in `rightForearmBone` space (note the spelling: the
 * rig capitalises the two sides differently, `leftForeArmBone` but
 * `rightForearmBone`), where the forearm runs along +Y and its surface is a
 * ~0.135-radius tube centred on (-0.06, 0.16). Those numbers are measured off
 * the `skin` mesh's forearm-weighted vertices, not guessed.
 *
 * ── WHY THE MIRROR IS SAFE ────────────────────────────────────────────────
 *
 * Measuring both forearms the same way returns rings at cx +0.065 to +0.068 on
 * the left and -0.067 to -0.070 on the right, with cz +0.161 and r 0.1334 on
 * BOTH. So the right bone's local frame is a clean reflection of the left
 * through its own YZ plane: x negates, z does not. (Had the rig instead
 * rotated the right arm 180 degrees about Y, the other common convention, cz
 * would have flipped too, and a mirrored angle would have put the watch face
 * against the skin.)
 *
 * ── AND WHY IT NEVER DETACHES ─────────────────────────────────────────────
 *
 * The geometry is baked into bind space and rigid-skinned to that one bone,
 * the same way the spectacles ride the head. It follows every clip, every
 * cross-fade and every transition for free: there is no per-frame code, no
 * world-space placement, and nothing that can drift out of step with the
 * mixer. See [[portfolio-mixer-bone-writes]] for what happens when a prop is
 * driven by hand instead.
 */
const P = {
  /** forearm tube centre, in the bone's XZ plane. Negative = his right arm. */
  cx: -0.06,
  cz: 0.16,
  /** forearm surface radius */
  armR: 0.135,
  /**
   * How far up the forearm the strap sits. The left arm's tuned 0.435 sat
   * 0.004 under the top of its weighted skin (0.439); the right arm's skin
   * ends at 0.432, so the same clearance is 0.428. Going higher walks the
   * strap over the wrist crease and into the hand.
   */
  y: 0.428,
  /** strap: a band hugging the arm, slightly proud of the skin */
  strapGap: 0.014,
  /** Measured ALONG the arm, so this is the strap's width. */
  strapH: 0.132,
  /**
   * Which way round the wrist the case sits, measured from the bone's +Z.
   *
   * The left arm's tuned value was +150 degrees, the back of that wrist.
   * `rotateY(t)` sends +Z to (sin t, 0, cos t), so +150 points (+0.5, 0,
   * -0.866), out along +X and back along -Z. The reflection that maps this
   * bone's frame onto the left one negates x, so the same anatomical direction
   * here is (-0.5, 0, -0.866), which is -150 degrees.
   */
  caseAngle: (-150 * Math.PI) / 180,
};

/** The smartwatch: case radius, case depth, display radius. */
const SMART = { r: 0.094, depth: 0.046, screenR: 0.074 };
/** The Timex: case radius, case depth, dial radius. A hair bigger, a real watch is. */
const TIMEX = { r: 0.1, depth: 0.05, dialR: 0.079 };

const findBoneIndex = (skeleton: Skeleton, name: string): number => {
  const index = skeleton.bones.findIndex((bone) => bone.name === name);
  if (index === -1) throw new Error(`[Watch] ${name} not found`);
  return index;
};

/**
 * Puts a geometry authored in the watch's own frame onto the wrist. That frame
 * is x across the arm, y along it, z out from it; `out` is the distance from
 * the arm's axis, `slideY` walks along the arm, `slideX` across it.
 */
const onWrist = (geometry: BufferGeometry, out: number, slideY = 0, slideX = 0): BufferGeometry =>
  geometry.translate(slideX, slideY, out).rotateY(P.caseAngle).translate(P.cx, P.y, P.cz);

const radialBox = (width: number, length: number, depth: number, out: number, slideY = 0, slideX = 0) =>
  onWrist(new BoxGeometry(width, length, depth), out, slideY, slideX);

/** A puck whose flat faces point out from the arm. A cylinder's axis is Y; the rotate turns it to Z. */
const radialPuck = (radius: number, depth: number, out: number, segments = 28) =>
  onWrist(new CylinderGeometry(radius, radius, depth, segments).rotateX(Math.PI / 2), out);

const strapBand = () => {
  const strapR = P.armR + P.strapGap;
  return new CylinderGeometry(strapR, strapR, P.strapH, 20).translate(P.cx, P.y, P.cz);
};

/** The case stands off the strap by a third of its own depth, so the two read as separate parts. */
const caseOutFor = (depth: number) => P.armR + P.strapGap + depth * 0.34;

/** The smartwatch. `hologram.ts` merges these two into the X-ray body. */
export const createWatchGeometries = (skeleton: Skeleton): { body: BufferGeometry; screen: BufferGeometry } => {
  const boneIndex = findBoneIndex(skeleton, "rightForearmBone");
  const caseOut = caseOutFor(SMART.depth);

  const screenOut = caseOut + SMART.depth * 0.5 + 0.002;
  const body = mergeGeometries([
    strapBand(),
    radialPuck(SMART.r, SMART.depth, caseOut),
    // A slightly smaller, slightly prouder puck: the chamfer that stops the
    // case ending in a hard mathematical edge. Cheaper than a rounded
    // primitive and, more to the point, still indexed.
    radialPuck(SMART.r - 0.008, SMART.depth, caseOut + 0.006),
    // The display itself, dark like the case: an OLED face is black glass
    // until something is drawn on it, and what is drawn on it is below.
    radialPuck(SMART.screenR, 0.008, screenOut),
    // Side button, breaking the case's right edge.
    radialBox(0.012, 0.038, 0.026, caseOut, 0.012, SMART.r + 0.004),
  ]);

  // ── the readout: two light bars proud of the dark display ────────────────
  //
  // They are the only part of the smartwatch on the light matcap, so from the
  // hero camera the watch is a black puck with a bright line across it, which
  // is what an always-on display looks like at that distance. Both sit inside
  // the disc: at 0.022 off centre a 0.074 disc is still 0.141 wide.
  const screen = mergeGeometries([
    radialBox(SMART.screenR * 1.2, 0.024, 0.01, screenOut + 0.004, 0.02),
    radialBox(SMART.screenR * 0.7, 0.014, 0.01, screenOut + 0.004, -0.016),
  ]);

  bakeToBone(body, skeleton, boneIndex);
  bakeToBone(screen, skeleton, boneIndex);

  return { body, screen };
};

/**
 * The Timex, for the wrist. Built in this frame like the smartwatch, so the
 * strap wraps the arm. The dial is a disc with UVs, which is what the canvas
 * is painted onto.
 */
export const createWristTimexGeometries = (
  skeleton: Skeleton,
): { strap: BufferGeometry; steel: BufferGeometry; dial: BufferGeometry } => {
  const boneIndex = findBoneIndex(skeleton, "rightForearmBone");
  const { r, depth, dialR } = TIMEX;
  const caseOut = caseOutFor(depth);
  const top = caseOut + depth * 0.5;

  const strap = strapBand();

  // A torus lies in XY with its axis on Z, so once on the wrist it rings the
  // outward face; a cylinder turned onto X lies across the arm, which is
  // where a crown sits. The lugs bridge the case to the band along the arm.
  const bezel = new TorusGeometry(r - 0.011, 0.012, 8, 30);
  const crown = new CylinderGeometry(0.015, 0.015, 0.026, 10).rotateZ(Math.PI / 2);
  const steel = mergeGeometries([
    radialPuck(r, depth, caseOut),
    onWrist(bezel, top),
    onWrist(crown, caseOut, 0, r + 0.01),
    radialBox(0.11, 0.05, 0.022, caseOut - 0.008, r - 0.004),
    radialBox(0.11, 0.05, 0.022, caseOut - 0.008, -(r - 0.004)),
  ]);

  // Sits 3mm above the case top and 9mm under the bezel's crest: recessed,
  // the way a real dial is.
  const dial = onWrist(new CircleGeometry(dialR, 30), top + 0.003);

  bakeToBone(strap, skeleton, boneIndex);
  bakeToBone(steel, skeleton, boneIndex);
  bakeToBone(dial, skeleton, boneIndex);

  return { strap, steel, dial };
};

let smartMeshes: SkinnedMesh[] = [];
let timexMeshes: SkinnedMesh[] = [];

/**
 * `bodyMaterial` is the black matcap (case, band, strap), `lightMaterial` the
 * white one (display, steel), `dialMaterial` the textured dial. All three
 * carry the avatar's own dissolve.
 */
const init = (root: Object3D, bodyMaterial: Material, lightMaterial: Material, dialMaterial: Material) => {
  const sibling = root.getObjectByName("black") as SkinnedMesh;
  const smart = createWatchGeometries(sibling.skeleton);
  const timex = createWristTimexGeometries(sibling.skeleton);

  const make = (geometry: BufferGeometry, material: Material, name: string) => {
    const mesh = new SkinnedMesh(geometry, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    mesh.bind(sibling.skeleton, sibling.bindMatrix);
    // same layer as the body, so the about-scene dissolve clips it in step
    mesh.renderOrder = 24;
    sibling.parent!.add(mesh);
    return mesh;
  };

  smartMeshes = [make(smart.body, bodyMaterial, "watch-body"), make(smart.screen, lightMaterial, "watch-screen")];
  timexMeshes = [
    make(timex.strap, bodyMaterial, "timex-strap"),
    make(timex.steel, lightMaterial, "timex-case"),
    make(timex.dial, dialMaterial, "timex-dial"),
  ];
  setTimex(false);
};

/** Timex on, smartwatch off, or the other way round. */
const setTimex = (on: boolean) => {
  for (const mesh of smartMeshes) mesh.visible = !on;
  for (const mesh of timexMeshes) mesh.visible = on;
};

export const watch = { init, setTimex };
