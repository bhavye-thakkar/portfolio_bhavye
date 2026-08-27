import { CylinderGeometry, SkinnedMesh } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { bakeToBone } from "./spectacles";

import type { BufferGeometry, Material, Object3D, Skeleton } from "three";

/**
 * A smart watch on the avatar's left wrist.
 *
 * Everything is authored in `leftForeArmBone` space, where the forearm runs
 * along +Y and its surface is a ~0.135-radius tube centred on (0.06, 0.16) —
 * measured off the `skin` mesh's forearm-weighted vertices, not guessed. The
 * geometry is then baked into bind space and rigid-skinned to that bone, the
 * same way the spectacles ride the head, so it follows every clip for free.
 */
const P = {
  /** forearm tube centre, in the bone's XZ plane */
  cx: 0.06,
  cz: 0.16,
  /** forearm surface radius */
  armR: 0.135,
  /** how far up the forearm the strap sits (hand joint is at y = 0.538) */
  y: 0.435,
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
   * 150° is the back of the wrist: measured, not guessed — the direction from
   * the wrist to the camera lands at 151° in the contact pose and 148° in the
   * about pose, so one value reads in both.
   */
  caseAngle: (150 * Math.PI) / 180,
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
  const boneIndex = findBoneIndex(skeleton, "leftForeArmBone");

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
