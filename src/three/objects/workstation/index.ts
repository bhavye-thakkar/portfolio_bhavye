import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createPlant } from "./plant";
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
let disposables: (BufferGeometry | Material | Texture)[] = [];
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

/**
 * A box with its edges taken off. Two segments is enough at this scale — the
 * point is that the silhouette has a highlight where a primitive would have a
 * hard line, not that the corner is smooth under a magnifier.
 */
const roundedBox = (w: number, h: number, d: number, r: number, x: number, y: number, z: number) => {
  const geometry = new RoundedBoxGeometry(w, h, d, 2, r);
  geometry.translate(x, y, z);
  return geometry;
};

/** Places a monitor's chassis into the shell/dark/frame buckets. */
const addMonitor = (dark: Bucket, frame: Bucket, side: -1 | 1) => {
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

  // Bezel first, then the rear shell. The back slab is charcoal like the
  // bezel — the light-grey version fused with the cream desk from the
  // establishing shot, where the backs of both panels own half the frame.
  // The monitor reads as one dark device on light furniture, the way the
  // frame-grey neck and base then read as its stand.
  at(dark, MONITOR.screenWidth + 0.1, MONITOR.screenHeight + 0.1, 0.04, 0, centerY, 0.015);
  at(dark, MONITOR.screenWidth + 0.04, MONITOR.screenHeight + 0.04, 0.06, 0, centerY, -0.02);
  at(dark, MONITOR.screenWidth * 0.66, MONITOR.screenHeight * 0.6, 0.08, 0, centerY, -0.07);
  // neck: a flattened column rather than a slab, and a hinge collar where it
  // meets the panel — the join is what a real arm has and a primitive does not
  at(frame, 0.13, 0.6, 0.085, 0, centerY - MONITOR.screenHeight / 2 - 0.28, -0.05);
  at(dark, 0.19, 0.1, 0.1, 0, centerY - MONITOR.screenHeight / 2 - 0.02, -0.05);
  // base: a shallow plinth on a thinner riser, so it sits ON the desk instead
  // of being flush with it. Both in the stand grey — the cream foot plate
  // vanished into the cream desk top.
  at(frame, 0.34, 0.055, 0.2, 0, DESK_TOP + 0.06, -0.04);
  at(frame, 0.86, 0.035, 0.36, 0, DESK_TOP + 0.019, -0.02);
};

/**
 * The key field: rows of rounded keycaps drawn once onto a small canvas and
 * laid over the keyboard base. What was here before — a featureless lighter
 * slab — read as a tablet, and the hands resting on it read as resting on
 * glass. Keys are the difference between "device" and "prop".
 */
const buildKeyboard = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#343a48";
  context.fillRect(0, 0, 512, 160);

  const key = (x: number, y: number, w: number, h: number) => {
    context.beginPath();
    context.roundRect(x, y, w, h, 5);
    context.fill();
  };

  context.fillStyle = "#5a6275";
  const keyH = 26;
  for (let row = 0; row < 4; row++) {
    const y = 8 + row * (keyH + 6);
    let x = 10 + [0, 8, 14, 20][row]!;
    while (x + 26 < 496) {
      key(x, y, 26, keyH);
      x += 32;
    }
  }
  // bottom row: modifiers and a space bar
  const y = 8 + 4 * (keyH + 6);
  key(10, y, 40, keyH);
  key(56, y, 40, keyH);
  key(102, y, 190, keyH);
  key(298, y, 40, keyH);
  key(344, y, 40, keyH);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;

  const geometry = new PlaneGeometry(1.38, 0.42);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(-0.56, DESK_TOP + 0.046, -0.6);

  const material = new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 12;
  mesh.frustumCulled = false;
  group.add(mesh);
  materials.push(material);
  disposables.push(geometry, material, texture);
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
  /**
   * The deck used to share the desk's cream, and from every framing the
   * island, the desk top and the chair fused into one unbroken pale mass —
   * the single loudest "everything is the same material" tell in the section.
   * A cool pale blue-grey keeps the island bright against the dark floor but
   * lets the warm desk read as furniture standing ON something.
   */
  const deckMat: Bucket = {
    geometries: [],
    material: new MeshMatcapMaterial({ matcap: matcap(), color: 0xd9dfeb, transparent: true }),
  };

  // ── deck: an elliptical pad on the grid floor, the same island language as
  // the lab pod it replaces
  const deck = new CylinderGeometry(1, 1, 1, 56);
  deck.scale(4.5, 0.42, 3.05);
  deck.translate(0, -0.21, -1.0);
  deckMat.geometries.push(deck);

  const rim = new CylinderGeometry(1, 1, 1, 56, 1, true);
  rim.scale(4.54, 0.1, 3.09);
  rim.translate(0, -0.44, -1.0);
  accent.geometries.push(rim);

  /**
   * ── DESK ────────────────────────────────────────────────────────────────
   *
   * What was here was one box on four tapered pins, and it read as exactly
   * that. Three things fix it, none of them expensive:
   *
   *   1. The top is a RoundedBox, so its edges catch a highlight instead of
   *      ending in a mathematically sharp corner. A real desk has a 2-3mm
   *      radius on the laminate; at this scale that is 0.02.
   *   2. Underneath it is a slightly inset second slab in the frame colour.
   *      That is the edge band every laminate desk has, and it is what makes
   *      the top read as a manufactured panel with a thickness rather than as
   *      an infinitely thin plane.
   *   3. The legs are a T-frame per end — post, floor foot, top rail — braced
   *      by a rail across the back. Four independent pins is what a primitive
   *      looks like; a frame is what furniture looks like, and it also gives
   *      the eye an actual contact patch on the deck.
   */
  /**
   * DESK_BACK_Z is behind DESK_FRONT_Z, so `BACK - FRONT` is NEGATIVE (-2.2).
   * BoxGeometry shrugs that off — it just builds the box inside out and
   * nothing downstream cares about a thin slab's winding. RoundedBoxGeometry
   * subtracts the corner radius from each side and extrudes a shape, so a
   * negative depth gives it a self-inverted profile and it returns a slab the
   * size of the room. Take the magnitude.
   */
  const deskDepth = Math.abs(DESK_BACK_Z - DESK_FRONT_Z);
  const top = new RoundedBoxGeometry(DESK_HALF_WIDTH * 2, DESK_THICKNESS, deskDepth, 2, 0.02);
  top.translate(0, DESK_TOP - DESK_THICKNESS / 2, (DESK_FRONT_Z + DESK_BACK_Z) / 2);
  shell.geometries.push(top);

  // the edge band: inset on every side so it reads as a shadow line, not a
  // second slab
  frame.geometries.push(
    box(
      DESK_HALF_WIDTH * 2 - 0.05,
      0.035,
      deskDepth - 0.05,
      0,
      DESK_TOP - DESK_THICKNESS - 0.014,
      (DESK_FRONT_Z + DESK_BACK_Z) / 2,
    ),
  );

  const legTop = DESK_TOP - DESK_THICKNESS - 0.03;
  const deskMidZ = (DESK_FRONT_Z + DESK_BACK_Z) / 2;

  for (const side of [-1, 1] as const) {
    const legX = side * (DESK_HALF_WIDTH - 0.34);

    // upright post, flattened across the desk so it reads as a panel leg
    frame.geometries.push(roundedBox(0.11, legTop, 0.16, 0.022, legX, legTop / 2, deskMidZ));
    // top rail, tucked under the edge band
    frame.geometries.push(roundedBox(0.13, 0.07, 1.5, 0.02, legX, legTop - 0.035, deskMidZ));
    // floor foot
    frame.geometries.push(roundedBox(0.15, 0.075, 1.62, 0.03, legX, 0.0375, deskMidZ));
    // glides, so the foot lands on four points rather than on its whole length
    for (const footZ of [deskMidZ - 0.72, deskMidZ + 0.72]) {
      dark.geometries.push(cylinder(0.045, 0.05, 0.02, legX, 0.01, footZ, 10));
    }
  }

  // A slim cable tray rather than a full modesty panel — a solid panel closes
  // the leg room off and reads as one dark slab under the whole desk. It also
  // ties the two leg frames together, which is what stops them reading as two
  // separate objects that happen to be under the same board.
  frame.geometries.push(roundedBox(DESK_HALF_WIDTH * 2 - 0.9, 0.11, 0.17, 0.03, 0, DESK_TOP - 0.3, DESK_BACK_Z + 0.22));

  // ── monitors
  addMonitor(dark, frame, -1);
  addMonitor(dark, frame, 1);

  // ── keyboard under the left hand, mouse under the right: the seated pose
  // already has him split that way, so a centred full-width board would run
  // straight through the mouse at x 0.47. The key field itself is a textured
  // plane added in `buildKeyboard` — a flat slab read as a tablet lying on
  // the desk from every over-the-shoulder framing.
  dark.geometries.push(box(1.5, 0.045, 0.52, -0.56, DESK_TOP + 0.022, -0.6));

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

  for (const bucket of [shell, frame, dark, accent, deckMat]) {
    /**
     * `mergeGeometries` returns null — silently — if the inputs disagree on
     * whether they are indexed, and RoundedBoxGeometry is the one primitive
     * here that ships without an index. A null merge skips the bucket, which
     * is how the entire desk and leg frame disappeared the first time the
     * bevels went in: no error, no warning, just no furniture.
     *
     * Flattening everything to non-indexed is the fix that cannot be got
     * wrong. `mergeVertices` would be the other direction, but it welds by
     * position AND normal AND uv, so it is one attribute change away from
     * rounding off the flat shading these bevels exist to create. The extra
     * vertices are irrelevant at this scale — the whole office is a few
     * thousand triangles.
     */
    const parts = bucket.geometries.map((item) => (item.index ? item.toNonIndexed() : item));
    const geometry = mergeGeometries(parts);
    parts.forEach((part, i) => {
      if (part !== bucket.geometries[i]) part.dispose();
    });
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
  buildKeyboard();
  leftScreen = buildScreen(-1);
  rightScreen = buildScreen(1);

  const chair = cloneFromRoom("chair");
  if (chair) {
    /**
     * The clone lands at the room-mapped origin (-0.66, 0, 0), which puts the
     * seat pan roughly half a metre to HIS left — screenshots from the
     * chapter beats showed him perched on the seat's front corner with his
     * hip spilling past its edge. His hips sit at local (-0.08, 1.55, 0.57);
     * this centres the pan under them. Measured against renders, not derived:
     * the chair mesh's own origin is not its seat centre.
     */
    chair.position.x = -0.14;
    chair.position.z = 0.12;
    group.add(chair);
  }

  const mouse = cloneFromRoom("mouse");
  if (mouse) group.add(mouse);

  /**
   * Built rather than cloned — see `plant.ts`. Placement history: level with
   * the desk's front edge it blocked the establishing shot; at local +3.62 it
   * stood on the avatar's RIGHT in world -X — which no Experience camera ever
   * frames, so the plant effectively did not exist on the scroll journey.
   * Local -X maps to world +X: beside the desk's far end near the lamp, in
   * frame for the establishing shot and both chapter beats.
   */
  const plant = createPlant(matcap());
  plant.group.position.set(-4.05, 0, -1.15);
  plant.group.rotation.y = 0.7;
  plant.group.scale.setScalar(1.24);
  group.add(plant.group);
  materials.push(...plant.materials);
  disposables.push(...plant.disposables);

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
