import { CylinderGeometry, SkinnedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { bakeToBone } from "./spectacles";

import type { BufferGeometry, Material, Object3D, Skeleton } from "three";

/**
 * A smart watch on the avatar's RIGHT wrist — his own right, not the right of
 * the screen.
 *
 * Everything is authored in `rightForearmBone` space (note the spelling: the
 * rig capitalises the two sides differently — `leftForeArmBone` but
 * `rightForearmBone`), where the forearm runs along +Y and its surface is a
 * ~0.133-radius tube centred on (-0.06, 0.16). Those numbers are measured off
 * the `skin` mesh's forearm-weighted vertices, not guessed.
 *
 * ── WHY THE MIRROR IS SAFE ────────────────────────────────────────────────
 *
 * Measuring both forearms the same way returns rings at cx +0.065…+0.068 on
 * the left and −0.067…−0.070 on the right, with cz +0.161 and r 0.1334 on
 * BOTH. So the right bone's local frame is a clean reflection of the left
 * through its own YZ plane: x negates, z does not. (Had the rig instead
 * rotated the right arm 180° about Y — the other common convention — cz would
 * have flipped too, and a mirrored angle would have put the watch face
 * against the skin.)
 *
 * That is the whole port: negate `cx`, negate `caseAngle`, and scale `y` by
 * the two arms' measured lengths. The geometry is then baked into bind space
 * and rigid-skinned to that one bone, the same way the spectacles ride the
 * head, so it follows every clip and every transition for free — there is no
 * per-frame code and nothing to detach.
 *
 * There is exactly one watch: `init` builds two meshes, a body and a screen,
 * and both are bound to this bone alone.
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
  strapGap: 0.016,
  strapH: 0.115,
  /** case: a round body standing off the strap, facing out along +Z */
  caseR: 0.086,
  caseH: 0.052,
  /** screen: a slightly smaller disc sitting proud of the case face */
  screenR: 0.066,
  screenH: 0.056,
  /**
   * Which way round the wrist the case sits, measured from the bone's +Z.
   *
   * The left arm's tuned value was +150°, the back of that wrist. `rotateY(θ)`
   * sends +Z to (sin θ, 0, cos θ), so +150° points (+0.5, 0, −0.866) — out
   * along +X and back along −Z. The reflection that maps this bone's frame
   * onto the left one negates x, so the same anatomical direction here is
   * (−0.5, 0, −0.866), which is −150°.
   */
  caseAngle: (-150 * Math.PI) / 180,
};

const findBoneIndex = (skeleton: Skeleton, name: string): number => {
  const index = skeleton.bones.findIndex((bone) => bone.name === name);
  if (index === -1) throw new Error(`[Watch] ${name} not found`);
  return index;
};

/** Cylinder lying on a radial of the arm, `out` from the axis, swung to `caseAngle`. */
const radialDisc = (radius: number, height: number, out: number): BufferGeometry =>
  new CylinderGeometry(radius, radius, height, 20)
    .rotateX(Math.PI / 2) // axis +Y -> +Z
    .translate(0, 0, out)
    .rotateY(P.caseAngle) // swing around the arm axis, still `out` from it
    .translate(P.cx, P.y, P.cz);

export const createWatchGeometries = (skeleton: Skeleton): { body: BufferGeometry; screen: BufferGeometry } => {
  const boneIndex = findBoneIndex(skeleton, "rightForearmBone");

  const strapR = P.armR + P.strapGap;
  const strap = new CylinderGeometry(strapR, strapR, P.strapH, 18).translate(P.cx, P.y, P.cz);

  // the case sits on the outside of the strap, half its depth clear of it
  const caseOut = strapR + P.caseH * 0.35;
  const body = mergeGeometries([strap, radialDisc(P.caseR, P.caseH, caseOut)]);
  const screen = radialDisc(P.screenR, P.screenH, caseOut + 0.004);

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
