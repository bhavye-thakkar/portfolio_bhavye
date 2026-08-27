import {
  Curve,
  CylinderGeometry,
  Float32BufferAttribute,
  Matrix4,
  Quaternion,
  Shape,
  ShapeGeometry,
  SkinnedMesh,
  SphereGeometry,
  TubeGeometry,
  Uint8BufferAttribute,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { BufferGeometry, Material, Object3D, Skeleton } from "three";

// All sizes/offsets are in headBone-local units: +X = avatar's right on screen, +Y = up, +Z = out of the face.
const P = {
  cx: 0.03, // face midline offset
  eyeX: 0.2, // lens center distance from midline
  eyeY: 0.195, // lens center height above the head bone
  z: 0.458, // lens plane distance in front of the head bone (clears the face's center bulge)
  lensW: 0.165, // lens half-width
  lensH: 0.145, // lens half-height
  cornerR: 0.055, // corner radius (soft-square frame; = half-extents would make it round)
  rimR: 0.012,
  bridgeLift: 0.5, // bridge height above the eye line, as a fraction of lensH
  templeAttachLift: 0.4, // temple attach height above the eye line, as a fraction of lensH
  templeTip: { x: 0.68, y: 0.07, z: -0.13 }, // ear-ward temple end (y relative to eye line)
  tilt: -0.06, // pantoscopic tilt in radians (negative = top leans toward the face)
  nose: { y: -0.11, z: 0.46, r: 0.05 }, // small stylized nose bump (y relative to eye line)
};

// Closed rounded-rectangle outline in the XY plane, parameterized by arc length
class RoundedRectCurve extends Curve<Vector3> {
  private readonly hw: number;
  private readonly hh: number;
  private readonly r: number;

  constructor(hw: number, hh: number, r: number) {
    super();
    this.hw = hw;
    this.hh = hh;
    this.r = r;
  }

  override getPoint(t: number, target = new Vector3()): Vector3 {
    const { hw, hh, r } = this;
    const sw = 2 * (hw - r);
    const sh = 2 * (hh - r);
    const arc = (Math.PI / 2) * r;
    const corner = (cx: number, cy: number, from: number, k: number): [number, number] => {
      const a = from - (k * Math.PI) / 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    // counterclockwise from the left end of the top edge
    const segments: [number, (k: number) => [number, number]][] = [
      [sw, (k) => [-(hw - r) + k * sw, hh]],
      [arc, (k) => corner(hw - r, hh - r, Math.PI / 2, k)],
      [sh, (k) => [hw, hh - r - k * sh]],
      [arc, (k) => corner(hw - r, -(hh - r), 0, k)],
      [sw, (k) => [hw - r - k * sw, -hh]],
      [arc, (k) => corner(-(hw - r), -(hh - r), -Math.PI / 2, k)],
      [sh, (k) => [-hw, -(hh - r) + k * sh]],
      [arc, (k) => corner(-(hw - r), hh - r, Math.PI, k)],
    ];
    const total = 2 * sw + 2 * sh + 4 * arc;
    let d = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < segments.length; i++) {
      const [length, point] = segments[i]!;
      if (length <= 0) continue;
      if (d <= length || i === segments.length - 1) {
        const [x, y] = point(Math.min(d / length, 1));
        return target.set(x, y, 0);
      }
      d -= length;
    }
    return target;
  }
}

const roundedRectShape = (hw: number, hh: number, r: number): Shape => {
  const s = new Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  s.lineTo(hw, hh - r);
  s.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  s.lineTo(-hw + r, hh);
  s.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-hw, -hh + r);
  s.absarc(-hw + r, -hh + r, r, Math.PI, 1.5 * Math.PI, false);
  return s;
};

// Half-width of the rounded-rect outline at height y above its center
const halfWidthAt = (y: number): number => {
  const dy = Math.abs(y) - (P.lensH - P.cornerR);
  if (dy <= 0) return P.lensW;
  return P.lensW - P.cornerR + Math.sqrt(Math.max(0, P.cornerR * P.cornerR - dy * dy));
};

const cylinderBetween = (a: Vector3, b: Vector3, radius: number): BufferGeometry => {
  const direction = b.clone().sub(a);
  const geometry = new CylinderGeometry(radius, radius, direction.length(), 10);
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize());
  const middle = a.clone().add(b).multiplyScalar(0.5);
  geometry.applyMatrix4(new Matrix4().compose(middle, rotation, new Vector3(1, 1, 1)));
  return geometry;
};

export const applyRigidSkin = (geometry: BufferGeometry, boneIndex: number) => {
  const count = geometry.attributes.position!.count;
  // Uint8/Float32 match the GLB's JOINTS_0/WEIGHTS_0 types so hologram.ts can merge these
  // geometries with the avatar's own
  const indexes = new Uint8Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    indexes[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new Uint8BufferAttribute(indexes, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
};

const findHeadIndex = (skeleton: Skeleton): number => {
  const headIndex = skeleton.bones.findIndex((bone) => bone.name === "headBone");
  if (headIndex === -1) throw new Error("[Spectacles] headBone not found");
  return headIndex;
};

// Moves bone-local geometry into the skeleton's bind space and rigid-skins it, so
// any SkinnedMesh bound to the avatar's skeleton animates it in sync with that bone.
export const bakeToBone = (
  geometry: BufferGeometry,
  skeleton: Skeleton,
  boneIndex: number,
  pre?: Matrix4
): BufferGeometry => {
  const bind = new Matrix4().copy(skeleton.boneInverses[boneIndex]!).invert();
  geometry.applyMatrix4(pre ? bind.multiply(pre) : bind);
  applyRigidSkin(geometry, boneIndex);
  return geometry;
};

const bakeToHead = (
  geometry: BufferGeometry,
  skeleton: Skeleton,
  headIndex: number,
  pre?: Matrix4
): BufferGeometry => bakeToBone(geometry, skeleton, headIndex, pre);

// Small stylized nose bump under the spectacle bridge
export const createNoseGeometry = (skeleton: Skeleton): BufferGeometry => {
  const nose = new SphereGeometry(P.nose.r, 12, 10)
    .scale(1, 0.8, 0.55)
    .translate(P.cx, P.eyeY + P.nose.y, P.nose.z);
  return bakeToHead(nose, skeleton, findHeadIndex(skeleton));
};

export const createSpectaclesGeometries = (
  skeleton: Skeleton
): { frame: BufferGeometry; lenses: BufferGeometry } => {
  const headIndex = findHeadIndex(skeleton);

  const eyes = [
    new Vector3(P.cx - P.eyeX, P.eyeY, P.z),
    new Vector3(P.cx + P.eyeX, P.eyeY, P.z),
  ] as const;

  const rimPath = new RoundedRectCurve(P.lensW, P.lensH, P.cornerR);
  const rims = eyes.map((eye) =>
    new TubeGeometry(rimPath, 48, P.rimR, 8, true).translate(eye.x, eye.y, eye.z)
  );

  // Bridge endpoints sit on each rim at the bridge height
  const bridgeY = P.eyeY + P.lensH * P.bridgeLift;
  const bridgeX = halfWidthAt(P.lensH * P.bridgeLift);
  const bridge = cylinderBetween(
    new Vector3(eyes[0].x + bridgeX, bridgeY, P.z),
    new Vector3(eyes[1].x - bridgeX, bridgeY, P.z),
    P.rimR * 0.95
  );

  const temples = eyes.map((eye) => {
    const side = Math.sign(eye.x - P.cx);
    const attachX = halfWidthAt(P.lensH * P.templeAttachLift);
    const attach = new Vector3(eye.x + side * attachX, P.eyeY + P.lensH * P.templeAttachLift, P.z);
    const tip = new Vector3(P.cx + side * P.templeTip.x, P.eyeY + P.templeTip.y, P.templeTip.z);
    return cylinderBetween(attach, tip, P.rimR * 0.85);
  });

  const frame = mergeGeometries([...rims, bridge, ...temples]);
  const lensShape = roundedRectShape(
    P.lensW - P.rimR * 0.4,
    P.lensH - P.rimR * 0.4,
    P.cornerR * 0.9
  );
  const lenses = mergeGeometries(
    eyes.map((eye) => new ShapeGeometry(lensShape, 6).translate(eye.x, eye.y, eye.z - 0.004))
  );

  // Pantoscopic tilt around the eye line, applied before baking into bind space
  const pivot = new Vector3(P.cx, P.eyeY, P.z);
  const tilt = new Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new Matrix4().makeRotationX(P.tilt))
    .multiply(new Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));

  bakeToHead(frame, skeleton, headIndex, tilt);
  bakeToHead(lenses, skeleton, headIndex, tilt);

  return { frame, lenses };
};

const init = (
  root: Object3D,
  frameMaterial: Material,
  lensMaterial: Material,
  noseMaterial: Material
) => {
  const sibling = root.getObjectByName("black") as SkinnedMesh;
  const { frame, lenses } = createSpectaclesGeometries(sibling.skeleton);

  const frameMesh = new SkinnedMesh(frame, frameMaterial);
  frameMesh.name = "spectacles-frame";
  const lensMesh = new SkinnedMesh(lenses, lensMaterial);
  lensMesh.name = "spectacles-lenses";
  const noseMesh = new SkinnedMesh(createNoseGeometry(sibling.skeleton), noseMaterial);
  noseMesh.name = "nose";

  for (const mesh of [frameMesh, lensMesh, noseMesh]) {
    mesh.frustumCulled = false;
    mesh.bind(sibling.skeleton, sibling.bindMatrix);
    sibling.parent!.add(mesh);
  }

  // Face decal renders at 25 with depthTest off; the spectacles must draw after it.
  // The nose draws with the body - the decal's transparent texels leave it visible.
  noseMesh.renderOrder = 24;
  frameMesh.renderOrder = 26;
  lensMesh.renderOrder = 27;
};

export const spectacles = { init };
