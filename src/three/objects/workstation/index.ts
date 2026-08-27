import {
  Box3,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import gsap from "gsap";
import { resources } from "../../../utils/resources";
import { scene } from "../../core/scene";
import { avatar } from "../avatar";
import { room } from "../room";
import { sceneWeights } from "../../../animations/scenes";
import { screens } from "./screens";

import type { BufferGeometry, Material, Texture } from "three";

/**
 * ─── THE EXPERIENCE WORKSTATION ───────────────────────────────────────────
 *
 * A small office bay that the seated avatar works at. Every number below is in
 * AVATAR-LOCAL space and was measured off the rig's own seated pose (the
 * `idle` clip the hero already uses), so the desk meets his hands instead of
 * being eyeballed:
 *
 *   he faces  -Z          hips   (-0.08, 1.55,  0.57)
 *   deck top   y = 0      hands  (-0.78, 1.85, -0.51) / (0.62, 1.85, -0.51)
 *   desk top   y = 1.50   feet   (±0.60, 0.48, -0.69)
 *   head       y = 2.50
 *
 * The group copies the avatar's own waypoint transform every frame, so the
 * office follows him wherever the scroll timeline puts him and the local
 * numbers stay true.
 *
 * Geometry is merged down to one mesh per material — the whole office is 6
 * draw calls plus the two screens.
 */

const DESK_TOP = 1.5;
const DESK_THICKNESS = 0.1;
const DESK_HALF_WIDTH = 3.0;
const DESK_FRONT_Z = -0.2;
const DESK_BACK_Z = -2.4;

const MONITOR = {
  offsetX: 1.32,
  z: -1.78,
  yaw: 0.3,
  screenWidth: 2.16,
  screenHeight: 1.22,
  centerY: 2.42,
};

const group = new Group();
const reveal = { value: 0 };

let materials: Material[] = [];
let disposables: (BufferGeometry | Material)[] = [];
let leftScreen: Mesh | null = null;
let rightScreen: Mesh | null = null;

/**
 * One matcap for the whole office, tinted per surface.
 *
 * The white matcap is the only one with enough range to tint — the black and
 * gray ones are the avatar's shoes and trousers, and multiplying them by a
 * colour just gives a darker shoe. It is shared with the avatar, which keeps it
 * in linear space and writes it straight out of a raw ShaderMaterial;
 * MeshMatcapMaterial runs the output through the sRGB encode, so this takes its
 * own sRGB-tagged view of the same image — same pixels, correct decode, no
 * second download.
 */
let sharedMatcap: Texture | null = null;

const matcap = (): Texture => {
  if (sharedMatcap) return sharedMatcap;
  sharedMatcap = (resources.items["matcap-white"] as Texture).clone();
  sharedMatcap.colorSpace = SRGBColorSpace;
  sharedMatcap.generateMipmaps = false;
  sharedMatcap.needsUpdate = true;
  return sharedMatcap;
};

type Bucket = { geometries: BufferGeometry[]; material: Material };

const box = (w: number, h: number, d: number, x: number, y: number, z: number, yaw = 0) => {
  const geometry = new BoxGeometry(w, h, d);
  if (yaw) geometry.rotateY(yaw);
  geometry.translate(x, y, z);
  return geometry;
};

const cylinder = (rTop: number, rBottom: number, h: number, x: number, y: number, z: number, segments = 16) => {
  const geometry = new CylinderGeometry(rTop, rBottom, h, segments);
  geometry.translate(x, y, z);
  return geometry;
};

/** Places a monitor's chassis into the shell/dark/frame buckets. */
const addMonitor = (shell: Bucket, dark: Bucket, frame: Bucket, side: -1 | 1) => {
  const x = MONITOR.offsetX * side;
  const yaw = MONITOR.yaw * -side;
  const { z, centerY } = MONITOR;

  // Rotating each part about the monitor's own centre keeps the yaw honest
  // without needing a nested group per screen.
  const at = (
    bucket: Bucket,
    w: number,
    h: number,
    d: number,
    localX: number,
    y: number,
    localZ: number,
  ) => {
    const geometry = new BoxGeometry(w, h, d);
    geometry.rotateY(yaw);
    geometry.translate(
      x + localX * Math.cos(yaw) + localZ * Math.sin(yaw),
      y,
      z - localX * Math.sin(yaw) + localZ * Math.cos(yaw),
    );
    bucket.geometries.push(geometry);
  };

  // Bezel first, then a darker rear shell set back from it, so the monitor
  // reads as a panel with a body rather than one blank slab from behind.
  at(dark, MONITOR.screenWidth + 0.1, MONITOR.screenHeight + 0.1, 0.04, 0, centerY, 0.015);
  at(frame, MONITOR.screenWidth + 0.04, MONITOR.screenHeight + 0.04, 0.06, 0, centerY, -0.02);
  at(dark, MONITOR.screenWidth * 0.66, MONITOR.screenHeight * 0.6, 0.08, 0, centerY, -0.07);
  at(frame, 0.15, 0.62, 0.1, 0, centerY - MONITOR.screenHeight / 2 - 0.29, -0.05);
  at(shell, 0.82, 0.045, 0.34, 0, DESK_TOP + 0.028, -0.02);
};

const buildScreen = (side: -1 | 1) => {
  const geometry = new PlaneGeometry(MONITOR.screenWidth, MONITOR.screenHeight);
  const texture = side === -1 ? screens.getLeftTexture() : screens.getRightTexture();
  const material = new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  const mesh = new Mesh(geometry, material);

  const yaw = MONITOR.yaw * -side;
  mesh.rotation.y = yaw;
  mesh.position.set(
    MONITOR.offsetX * side + 0.04 * Math.sin(yaw),
    MONITOR.centerY,
    MONITOR.z + 0.04 * Math.cos(yaw),
  );
  mesh.renderOrder = 13;
  materials.push(material);
  disposables.push(geometry, material);
  group.add(mesh);
  return mesh;
};

/**
 * The chair, the mouse and the plant already exist in room.glb in exactly this
 * art style. Cloning them shares geometry and material with the hero scene, so
 * the office costs three extra draw calls and nothing else.
 *
 * room.glb is authored in the room's own frame; the avatar sits rotated a
 * quarter turn from it (his yaw is the room's plus PI/2), so a room-local point
 * (x, y, z) lands at (-z, y, x) here and each clone takes a -PI/2 yaw.
 */
const ROOM_TO_LOCAL_YAW = -Math.PI / 2;

const cloneFromRoom = (name: string): Mesh | null => {
  // room/index.ts reparents these meshes out of the GLB scene into its own
  // group before this runs, so the group is where they actually live.
  const source = room.group.getObjectByName(name) as Mesh | undefined;
  if (!source) return null;

  const clone = source.clone() as Mesh;

  /**
   * The room's own material is opaque, which puts it in the opaque draw list —
   * ahead of the dark-plane composite, which draws with `depthTest: false` and
   * would paint straight over these props. Its own transparent copy lands after
   * the plane, and it can then fade in with the rest of the office.
   */
  const material = (source.material as Material).clone();
  material.transparent = true;
  clone.material = material;
  clone.renderOrder = 12;
  materials.push(material);
  disposables.push(material);

  const { x, y, z } = source.position;
  clone.position.set(-z, y, x);
  clone.rotation.set(0, ROOM_TO_LOCAL_YAW, 0);
  return clone;
};

/** Drops a cloned room prop so its footprint centre lands on a given spot. */
const placeByFootprint = (mesh: Mesh, x: number, y: number, z: number) => {
  const bounds = new Box3().setFromObject(mesh);
  const center = bounds.getCenter(new Vector3());
  mesh.position.x += x - center.x;
  mesh.position.y += y - bounds.min.y;
  mesh.position.z += z - center.z;
};

const buildChassis = () => {
  const shell: Bucket = {
    geometries: [],
    material: new MeshMatcapMaterial({ matcap: matcap(), color: 0xf4efe6, transparent: true }),
  };
  const frame: Bucket = {
    geometries: [],
    material: new MeshMatcapMaterial({ matcap: matcap(), color: 0x98a3ae, transparent: true }),
  };
  const dark: Bucket = {
    geometries: [],
    material: new MeshMatcapMaterial({ matcap: matcap(), color: 0x3c4150, transparent: true }),
  };
  const accent: Bucket = {
    geometries: [],
    material: new MeshBasicMaterial({ color: 0x34bfff, transparent: true, toneMapped: false }),
  };

  // ── deck: an elliptical pad on the grid floor, the same island language as
  // the lab pod it replaces
  const deck = new CylinderGeometry(1, 1, 1, 56);
  deck.scale(4.5, 0.42, 3.05);
  deck.translate(0, -0.21, -1.0);
  shell.geometries.push(deck);

  const rim = new CylinderGeometry(1, 1, 1, 56, 1, true);
  rim.scale(4.54, 0.1, 3.09);
  rim.translate(0, -0.44, -1.0);
  accent.geometries.push(rim);

  // ── desk
  shell.geometries.push(
    box(DESK_HALF_WIDTH * 2, DESK_THICKNESS, DESK_BACK_Z - DESK_FRONT_Z, 0, DESK_TOP - DESK_THICKNESS / 2, (DESK_FRONT_Z + DESK_BACK_Z) / 2),
  );
  // A slim cable tray rather than a full modesty panel — a solid panel closes
  // the leg room off and reads as one dark slab under the whole desk.
  frame.geometries.push(box(DESK_HALF_WIDTH * 2 - 1.4, 0.1, 0.16, 0, DESK_TOP - 0.28, DESK_BACK_Z + 0.22));
  for (const legX of [-DESK_HALF_WIDTH + 0.24, DESK_HALF_WIDTH - 0.24]) {
    for (const legZ of [DESK_FRONT_Z - 0.26, DESK_BACK_Z + 0.26]) {
      frame.geometries.push(cylinder(0.062, 0.042, DESK_TOP - DESK_THICKNESS, legX, (DESK_TOP - DESK_THICKNESS) / 2, legZ, 12));
    }
  }

  // ── monitors
  addMonitor(shell, dark, frame, -1);
  addMonitor(shell, dark, frame, 1);

  // ── keyboard under the left hand, mouse under the right: the seated pose
  // already has him split that way, so a centred full-width board would run
  // straight through the mouse at x 0.47.
  dark.geometries.push(box(1.5, 0.045, 0.52, -0.56, DESK_TOP + 0.022, -0.6));
  frame.geometries.push(box(1.38, 0.012, 0.42, -0.56, DESK_TOP + 0.05, -0.6));

  // ── notebook and pen, to his right
  shell.geometries.push(box(0.64, 0.055, 0.46, 1.62, DESK_TOP + 0.03, -0.72, -0.24));
  accent.geometries.push(box(0.36, 0.022, 0.03, 1.6, DESK_TOP + 0.07, -0.74, -0.24));

  // ── mug
  accent.geometries.push(cylinder(0.115, 0.1, 0.2, 1.02, DESK_TOP + 0.1, -0.24, 18));
  const handle = new TorusGeometry(0.062, 0.02, 6, 14);
  handle.rotateY(Math.PI / 2);
  handle.translate(1.14, DESK_TOP + 0.11, -0.24);
  accent.geometries.push(handle);

  // ── desk lamp, clear of the left monitor
  frame.geometries.push(cylinder(0.21, 0.23, 0.05, -2.72, DESK_TOP + 0.025, -1.95, 20));
  frame.geometries.push(box(0.06, 0.98, 0.06, -2.72, DESK_TOP + 0.52, -1.95));
  frame.geometries.push(box(0.44, 0.09, 0.24, -2.6, DESK_TOP + 0.98, -1.83, 0.3));
  accent.geometries.push(box(0.34, 0.02, 0.16, -2.6, DESK_TOP + 0.93, -1.83, 0.3));

  // ponytail: no back-wall or light columns. Every version of them either
  // crossed the desk in projection or pulled attention off the avatar, and the
  // grid floor plus the deck rim already say "environment". The plant and the
  // lamp are the only vertical props the bay needs.

  for (const bucket of [shell, frame, dark, accent]) {
    const geometry = mergeGeometries(bucket.geometries);
    bucket.geometries.forEach((item) => item.dispose());
    if (!geometry) continue;
    const mesh = new Mesh(geometry, bucket.material);
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    group.add(mesh);
    materials.push(bucket.material);
    disposables.push(geometry, bucket.material);
  }
};

const init = () => {
  if (group.children.length) return;

  screens.init();
  buildChassis();
  leftScreen = buildScreen(-1);
  rightScreen = buildScreen(1);

  const chair = cloneFromRoom("chair");
  if (chair) group.add(chair);

  const mouse = cloneFromRoom("mouse");
  if (mouse) group.add(mouse);

  const plant = cloneFromRoom("plant");
  if (plant) {
    placeByFootprint(plant, 3.5, 0, -0.1);
    group.add(plant);
  }

  group.visible = false;
  scene.instance.add(group);

  gsap.ticker.add(tick);
};

const tick = () => {
  const weight = sceneWeights.experience;
  const visible = weight > 0.001;
  group.visible = visible;
  if (!visible) return;

  // The office is pinned to the avatar's own waypoint transform, so every
  // measured offset above stays true wherever the timeline puts him.
  group.position.copy(avatar.waypointsPosition);
  group.rotation.copy(avatar.waypointsRotation);

  const opacity = reveal.value;
  for (const material of materials) {
    material.opacity = opacity;
    material.depthWrite = opacity > 0.9;
  }

  screens.update(gsap.ticker.time);
};

const destroy = () => {
  gsap.ticker.remove(tick);
  screens.destroy();
  disposables.forEach((item) => item.dispose());
  disposables = [];
  materials = [];
  sharedMatcap?.dispose();
  sharedMatcap = null;
  leftScreen = null;
  rightScreen = null;
  group.clear();
  scene.instance.remove(group);
};

export const workstation = { init, destroy, group, reveal, getScreens: () => [leftScreen, rightScreen] };
