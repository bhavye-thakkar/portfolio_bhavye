import { BoxGeometry, CylinderGeometry, SkinnedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { bakeToBone } from "./spectacles";

import type { BufferGeometry, Material, Object3D, Skeleton } from "three";

/**
 * A Fire-Boltt-style smartwatch on the avatar's RIGHT wrist, his own right, not
 * the right of the screen.
 *
 * ── WHAT MAKES IT READ AS A SMARTWATCH ────────────────────────────────────
 *
 * It used to be a round case with a bright white disc on it, which from any
 * distance read as a dress watch. A smartwatch is recognised by its silhouette
 * before any detail: a RECTANGLE longer along the forearm than it is across,
 * a black bezel, and a display that runs nearly to the edges. So:
 *
 *   · the case is a box, 0.19 along the arm by 0.155 across, on a strap
 *     narrower than the case is long, so it overhangs top and bottom the way
 *     a real one does;
 *   · the display is an inset panel on the light matcap inside that black
 *     bezel, which is the whole contrast;
 *   · two thin dark bars sit proud of the display, a wide one and a short one.
 *     They read as a time readout at a glance and as nothing in particular up
 *     close, which is the point: there is no logo and no brand mark.
 *   · a side button breaks the case's right edge.
 *
 * ── EVERYTHING HERE MUST STAY INDEXED ─────────────────────────────────────
 *
 * `hologram.ts` merges these two geometries in with the GLB's own, and
 * `mergeGeometries` returns NULL, silently, if some inputs are indexed and
 * others are not. `BoxGeometry` and `CylinderGeometry` are both indexed;
 * `RoundedBoxGeometry` is not, which is why the corners here are chamfered
 * with a second box rather than with a rounded primitive. Getting this wrong
 * does not break the watch, it breaks the entire X-ray avatar.
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
  /**
   * Measured ALONG the arm, so this is the strap's width, and it is narrower
   * than the case is long on purpose: the case has to overhang it.
   */
  strapH: 0.132,
  /** case: across the arm, along the arm, and out from it */
  caseW: 0.155,
  caseL: 0.19,
  caseD: 0.046,
  /** display: inset inside the bezel on all four sides */
  screenW: 0.118,
  screenL: 0.148,
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

const findBoneIndex = (skeleton: Skeleton, name: string): number => {
  const index = skeleton.bones.findIndex((bone) => bone.name === name);
  if (index === -1) throw new Error(`[Watch] ${name} not found`);
  return index;
};

/**
 * A box sitting on a radial of the arm, `out` from the axis, swung round to
 * `caseAngle`. The box's own axes already line up with the frame the watch
 * wants: x across the arm, y along it, z out from it.
 */
const radialBox = (
  width: number,
  length: number,
  depth: number,
  out: number,
  slideY = 0,
  slideX = 0,
): BufferGeometry =>
  new BoxGeometry(width, length, depth)
    .translate(slideX, slideY, out)
    .rotateY(P.caseAngle)
    .translate(P.cx, P.y, P.cz);

export const createWatchGeometries = (skeleton: Skeleton): { body: BufferGeometry; screen: BufferGeometry } => {
  const boneIndex = findBoneIndex(skeleton, "rightForearmBone");

  const strapR = P.armR + P.strapGap;
  const strap = new CylinderGeometry(strapR, strapR, P.strapH, 20).translate(P.cx, P.y, P.cz);

  // The case stands off the strap by a third of its own depth, so the two read
  // as separate parts rather than as one extruded lump.
  const caseOut = strapR + P.caseD * 0.34;

  const parts: BufferGeometry[] = [
    strap,
    radialBox(P.caseW, P.caseL, P.caseD, caseOut),
    // A slightly smaller, slightly prouder slab: the chamfer that stops the
    // case ending in a hard mathematical edge. Cheaper than a rounded box and,
    // more to the point, still indexed.
    radialBox(P.caseW - 0.018, P.caseL - 0.018, P.caseD, caseOut + 0.006),
    // Side button, breaking the case's right edge the way every Fire-Boltt has.
    radialBox(0.012, 0.038, 0.026, caseOut, 0.012, P.caseW / 2 + 0.004),
  ];

  const body = mergeGeometries(parts);

  // ── the display, and the two bars that make it read as one ──────────────
  //
  // The bars are part of the SCREEN geometry, not the body, so they share its
  // material. On the light matcap they catch a different part of the sphere
  // from the flat panel and come out as a darker rule across it, which is all
  // the "digital" this needs at the size it is actually seen.
  const screenOut = caseOut + P.caseD * 0.5 + 0.002;
  const screen = mergeGeometries([
    radialBox(P.screenW, P.screenL, 0.008, screenOut),
    radialBox(P.screenW * 0.72, 0.02, 0.01, screenOut + 0.003, 0.022),
    radialBox(P.screenW * 0.4, 0.011, 0.01, screenOut + 0.003, -0.014),
  ]);

  bakeToBone(body, skeleton, boneIndex);
  bakeToBone(screen, skeleton, boneIndex);

  return { body, screen };
};

const init = (root: Object3D, bodyMaterial: Material, screenMaterial: Material) => {
  const sibling = root.getObjectByName("black") as SkinnedMesh;
  const { body, screen } = createWatchGeometries(sibling.skeleton);

  const bodyMesh = new SkinnedMesh(body, bodyMaterial);
  bodyMesh.name = "watch-body";
  const screenMesh = new SkinnedMesh(screen, screenMaterial);
  screenMesh.name = "watch-screen";

  for (const mesh of [bodyMesh, screenMesh]) {
    mesh.frustumCulled = false;
    mesh.bind(sibling.skeleton, sibling.bindMatrix);
    sibling.parent!.add(mesh);
    // same layer as the body, so the about-scene dissolve clips it in step
    mesh.renderOrder = 24;
  }
};

export const watch = { init };
