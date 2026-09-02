import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  Group,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createPlant } from "./plant";
import gsap from "gsap";
import { scene } from "../../core/scene";
import { avatar } from "../avatar";
import { room } from "../room";
import { sceneWeights } from "../../../animations/scenes";
import { screens } from "./screens";
import { createContactShadow, disposeMatcaps, getMatcap } from "./materials";
import { createEnvelope, disposeEnvelopeAssets } from "../envelope";

import type { BufferGeometry, Material, Texture } from "three";
import type { MaterialKind } from "./materials";

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
 * ── WHAT MAKES IT READ AS MODELLED RATHER THAN ASSEMBLED ──────────────────
 *
 * Three things, and the first one is by far the biggest:
 *
 *  1. SIX MATERIALS, NOT ONE TINTED SIX WAYS. Every surface here used to share
 *     the avatar's white matcap with a different `color`, which changes hue
 *     and nothing else, so the laminate desk, the ceramic mug, the fabric
 *     chair and the paper notebook all shaded identically and the bay read as
 *     one plastic object cut into pieces. `./materials.ts` bakes a matcap per
 *     material instead, and the difference between ceramic and laminate is now
 *     where the highlight is and how tight it is, which is what actually
 *     separates them in real life.
 *  2. CONTACT SHADOWS. There are no lights in this scene, so nothing casts
 *     one, and every prop was floating a couple of centimetres above the desk.
 *     Each one now gets a multiply-blended pool sized to its own footprint.
 *  3. THINGS HAVE A PROFILE. The mug is a lathed wall with a real rim and a
 *     real interior rather than a capped cylinder; the pen is a barrel with a
 *     ferrule; the notebook is a cover plus a page block. A primitive is
 *     recognisable from any angle, and the Experience cameras get close.
 *
 * Geometry is still merged down to one mesh per material, the whole office is
 * eight draw calls plus the two screens, the envelope and the plant.
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

/** Mug, notebook and lamp positions, referenced by both geometry and shadows. */
const MUG = { x: 1.02, z: -0.24 };
/**
 * The notebook and the CV envelope swapped places. The notebook's old spot at
 * x 1.52 is the one part of the near half of the desk that the establishing
 * shot actually holds in frame, see the projection note in `envelope.ts` -
 * and the interactive prop needs that more than a passive one does. Out here
 * the notebook is partly cropped by the bottom edge, which reads as the desk
 * continuing past the frame rather than as a mistake.
 */
const NOTEBOOK = { x: 2.42, z: -0.62, yaw: -0.24 };
const LAMP = { x: -2.72, z: -1.95 };
const KEYBOARD = { x: -0.56, z: -0.6 };

const group = new Group();
const reveal = { value: 0 };

let materials: Material[] = [];
let disposables: (BufferGeometry | Material | Texture)[] = [];
/**
 * The two lit panels, kept apart from `materials` so the X-ray sequence can
 * take them dark under a still-solid office, see `screens.state.dim`.
 */
let screenMaterials: MeshBasicMaterial[] = [];
/** Built in `init`, because the factory registers a hit box as a side effect. */
let envelope: ReturnType<typeof createEnvelope> | null = null;

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

/** A bucket is one merged mesh; `kind` picks which baked matcap it shades with. */
const bucket = (kind: MaterialKind, color: number): Bucket => ({
  geometries: [],
  material: new MeshMatcapMaterial({ matcap: getMatcap(kind), color, transparent: true }),
});

/** Places a monitor's chassis into the shell/dark/frame buckets. */
const addMonitor = (dark: Bucket, frame: Bucket, side: -1 | 1) => {
  const x = MONITOR.offsetX * side;
  const yaw = MONITOR.yaw * -side;
  const { z, centerY } = MONITOR;

  // Rotating each part about the monitor's own centre keeps the yaw honest
  // without needing a nested group per screen.
  const at = (
    target: Bucket,
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
    target.geometries.push(geometry);
  };

  // Bezel first, then the rear shell. The back slab is charcoal like the
  // bezel, the light-grey version fused with the cream desk from the
  // establishing shot, where the backs of both panels own half the frame.
  // The monitor reads as one dark device on light furniture, the way the
  // frame-grey neck and base then read as its stand.
  at(dark, MONITOR.screenWidth + 0.1, MONITOR.screenHeight + 0.1, 0.04, 0, centerY, 0.015);
  at(dark, MONITOR.screenWidth + 0.04, MONITOR.screenHeight + 0.04, 0.06, 0, centerY, -0.02);
  at(dark, MONITOR.screenWidth * 0.66, MONITOR.screenHeight * 0.6, 0.08, 0, centerY, -0.07);
  // neck: a flattened column rather than a slab, and a hinge collar where it
  // meets the panel, the join is what a real arm has and a primitive does not
  at(frame, 0.13, 0.6, 0.085, 0, centerY - MONITOR.screenHeight / 2 - 0.28, -0.05);
  at(dark, 0.19, 0.1, 0.1, 0, centerY - MONITOR.screenHeight / 2 - 0.02, -0.05);
  // base: a shallow plinth on a thinner riser, so it sits ON the desk instead
  // of being flush with it. Both in the stand grey, the cream foot plate
  // vanished into the cream desk top.
  at(frame, 0.34, 0.055, 0.2, 0, DESK_TOP + 0.06, -0.04);
  at(frame, 0.86, 0.035, 0.36, 0, DESK_TOP + 0.019, -0.02);
};

/**
 * ── THE MUG ───────────────────────────────────────────────────────────────
 *
 * What was here was a capped cylinder in flat unlit cyan with a torus floating
 * near it, and from the establishing shot it read as a blue dot on the desk -
 * the single most obviously placeholder object in the section.
 *
 * A mug is a wall, and a lathed profile is the only cheap way to have one. The
 * points below go up the OUTSIDE, over the rim, and back down the INSIDE to a
 * floor that sits ~2cm above the base, so:
 *
 *   · the rim has a visible thickness from every angle, which is the detail
 *     that separates a mug from a cup-shaped solid;
 *   · there is an interior for the coffee to sit in;
 *   · the ceramic matcap's tight highlight runs round the belly and catches
 *     the rim edge separately, which no cylinder can do.
 *
 * The coffee is a disc at y 0.155, four centimetres under the 0.215 rim, so it
 * cannot intersect it at any camera angle.
 */
const MUG_HEIGHT = 0.215;

const createMugBody = () => {
  const profile = [
    new Vector2(0.0, 0.0),
    new Vector2(0.062, 0.0),
    new Vector2(0.07, 0.009),
    new Vector2(0.074, 0.03),
    new Vector2(0.082, 0.09),
    new Vector2(0.088, 0.175),
    new Vector2(0.089, 0.205),
    // over the rim
    new Vector2(0.086, MUG_HEIGHT),
    new Vector2(0.079, 0.213),
    // and back down the inside
    new Vector2(0.077, 0.175),
    new Vector2(0.071, 0.09),
    new Vector2(0.062, 0.035),
    new Vector2(0.052, 0.024),
    new Vector2(0.0, 0.022),
  ];
  return new LatheGeometry(profile, 32);
};

/**
 * A FULL torus, with its inner third buried in the mug wall.
 *
 * ponytail: an arc would look marginally better in a cutaway and is the wrong
 * trade here, its two open ends have to land inside a curved, tapered wall,
 * which is a pair of numbers that go wrong the moment the profile is touched.
 * A closed ring cannot come detached, and the buried half is inside an opaque
 * wall. Upgrade to an arc only if the mug ever becomes translucent.
 */
const createMugHandle = () => {
  const handle = new TorusGeometry(0.058, 0.0135, 8, 22);
  handle.rotateY(Math.PI / 2);
  // Outer wall is at 0.085 here; the ring's inner edge lands at 0.043.
  handle.translate(0.115, MUG_HEIGHT * 0.54, 0);
  return handle;
};

/**
 * The key field: rows of rounded keycaps drawn once onto a small canvas and
 * laid over the keyboard base. What was here before, a featureless lighter
 * slab, read as a tablet, and the hands resting on it read as resting on
 * glass. Keys are the difference between "device" and "prop".
 */
const buildKeyboard = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.fillStyle = "#d7dae1";
  context.fillRect(0, 0, 512, 160);

  const key = (x: number, y: number, w: number, h: number) => {
    context.beginPath();
    context.roundRect(x, y, w, h, 5);
    context.fill();
  };

  context.fillStyle = "#f4f6f9";
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
  geometry.translate(KEYBOARD.x, DESK_TOP + 0.046, KEYBOARD.z);

  const material = new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false });
  const mesh = new Mesh(geometry, material);
  mesh.renderOrder = 12.7;
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
  screenMaterials.push(material);
  disposables.push(geometry, material);
  group.add(mesh);
};

/**
 * The chair and the mouse already exist in room.glb in exactly this art style.
 * Cloning them shares geometry with the hero scene, so the office costs two
 * extra draw calls and no extra download.
 *
 * room.glb is authored in the room's own frame; the avatar sits rotated a
 * quarter turn from it (his yaw is the room's plus PI/2), so a room-local point
 * (x, y, z) lands at (-z, y, x) here and each clone takes a -PI/2 yaw.
 */
const ROOM_TO_LOCAL_YAW = -Math.PI / 2;

const cloneFromRoom = (name: string, kind?: MaterialKind, color?: number): Mesh | null => {
  // room/index.ts reparents these meshes out of the GLB scene into its own
  // group before this runs, so the group is where they actually live.
  const source = room.group.getObjectByName(name) as Mesh | undefined;
  if (!source) return null;

  const clone = source.clone() as Mesh;

  /**
   * By default the clone keeps the ROOM'S OWN baked material, because Home is
   * the reference: its chair is a white shell with silver legs and its mouse is
   * a pale grey blob, and both of those are painted into the room atlas. A
   * matcap here would make them a different chair and a different mouse in the
   * same portfolio, which is exactly the mismatch this pass exists to remove.
   *
   * It has to be a transparent CLONE of that material rather than the shared
   * one: the room's is opaque, which puts it in the opaque draw list ahead of
   * the dark-plane composite, and the composite draws with `depthTest: false`
   * and would paint straight over it. The clone also fades with the office.
   *
   * `kind` overrides that for anything the room does not have a good baked
   * answer for.
   */
  const material =
    kind === undefined
      ? Object.assign((source.material as Material).clone(), { transparent: true })
      : new MeshMatcapMaterial({ matcap: getMatcap(kind), color, transparent: true });

  clone.material = material;
  clone.renderOrder = 12;
  materials.push(material);
  disposables.push(material);

  const { x, y, z } = source.position;
  clone.position.set(-z, y, x);
  clone.rotation.set(0, ROOM_TO_LOCAL_YAW, 0);
  return clone;
};

const addShadow = (width: number, depth: number, x: number, y: number, z: number, strength?: number) => {
  const shadow = createContactShadow(width, depth, x, y, z, strength);
  if (!shadow) return;
  group.add(shadow.mesh);
  materials.push(shadow.mesh.material as Material);
  disposables.push(...shadow.disposables);
};

const buildChassis = () => {
  /**
   * ── THE PALETTE IS THE HOME DESK'S ────────────────────────────────────
   *
   * Home and Experience are meant to read as the same workspace, and Home's
   * desk is a WHITE top on TAN TAPERED WOODEN legs, not a cream top on a grey
   * metal frame. The frame was a defensible piece of furniture and the wrong
   * one: from the establishing shot the two rooms simply did not look like the
   * same place.
   *
   * Separation still has to come from somewhere, and it comes from where Home
   * gets it: the wood against the white, the charcoal monitors, and the warm
   * accessories (pencil cup, notebook) against the cool deck. Not from making
   * the desk a different white.
   */
  const shell = bucket("laminate", 0xfbf9f6);
  const wood = bucket("laminate", 0xc79a63);
  const frame = bucket("metal", 0x9aa5b2);
  const dark = bucket("plastic", 0x3c4150);
  const paper = bucket("matte", 0xf7f2e7);
  const ceramic = bucket("ceramic", 0xf3f5f8);
  const accent: Bucket = {
    geometries: [],
    material: new MeshBasicMaterial({ color: 0x34bfff, transparent: true, toneMapped: false }),
  };
  /**
   * The deck used to share the desk's cream, and from every framing the
   * island, the desk top and the chair fused into one unbroken pale mass -
   * the single loudest "everything is the same material" tell in the section.
   * A cool pale blue-grey keeps the island bright against the dark floor but
   * lets the warm desk read as furniture standing ON something.
   */
  const deckMat = bucket("matte", 0xd9dfeb);

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
   *   3. The legs are a T-frame per end, post, floor foot, top rail, braced
   *      by a rail across the back. Four independent pins is what a primitive
   *      looks like; a frame is what furniture looks like, and it also gives
   *      the eye an actual contact patch on the deck.
   */
  /**
   * DESK_BACK_Z is behind DESK_FRONT_Z, so `BACK - FRONT` is NEGATIVE (-2.2).
   * BoxGeometry shrugs that off, it just builds the box inside out and
   * nothing downstream cares about a thin slab's winding. RoundedBoxGeometry
   * subtracts the corner radius from each side and extrudes a shape, so a
   * negative depth gives it a self-inverted profile and it returns a slab the
   * size of the room. Take the magnitude.
   */
  const deskDepth = Math.abs(DESK_BACK_Z - DESK_FRONT_Z);
  const deskMidZ = (DESK_FRONT_Z + DESK_BACK_Z) / 2;
  const top = new RoundedBoxGeometry(DESK_HALF_WIDTH * 2, DESK_THICKNESS, deskDepth, 2, 0.02);
  top.translate(0, DESK_TOP - DESK_THICKNESS / 2, deskMidZ);
  shell.geometries.push(top);

  // The edge band, in the leg's wood rather than in metal: it is the band of
  // carcass you see under a white top, and it ties the top to the legs.
  wood.geometries.push(
    box(
      DESK_HALF_WIDTH * 2 - 0.05,
      0.035,
      deskDepth - 0.05,
      0,
      DESK_TOP - DESK_THICKNESS - 0.014,
      deskMidZ,
    ),
  );

  /**
   * Four round tapered legs in wood, which is what the Home desk stands on.
   * Wider at the top than at the floor, and inset from the corners rather than
   * flush with them, both measured off the hero shot.
   */
  const legTop = DESK_TOP - DESK_THICKNESS - 0.02;

  for (const sideX of [-1, 1] as const) {
    const legX = sideX * (DESK_HALF_WIDTH - 0.42);
    for (const sideZ of [-1, 1] as const) {
      const legZ = deskMidZ + sideZ * (deskDepth / 2 - 0.34);
      wood.geometries.push(cylinder(0.078, 0.052, legTop, legX, legTop / 2, legZ, 14));
      // a foot pad, so the leg lands on the deck rather than ending in it
      dark.geometries.push(cylinder(0.05, 0.052, 0.018, legX, 0.009, legZ, 12));
      addShadow(0.42, 0.42, legX, 0.008, legZ, 0.38);
    }
  }

  // ponytail: no cable tray. The old leg frame needed something tying its two
  // ends together; four separate legs do not, and the Home desk has nothing
  // under it either.

  // ── monitors
  addMonitor(dark, frame, -1);
  addMonitor(dark, frame, 1);
  for (const side of [-1, 1] as const) {
    const x = MONITOR.offsetX * side;
    addShadow(1.5, 0.9, x, DESK_TOP + 0.004, MONITOR.z, 0.5);
  }

  // ── keyboard under the left hand, mouse under the right: the seated pose
  // already has him split that way, so a centred full-width board would run
  // straight through the mouse at x 0.47. The key field itself is a textured
  // plane added in `buildKeyboard`, a flat slab read as a tablet lying on
  // the desk from every over-the-shoulder framing.
  // Pale, low and thin, the way the Home keyboard reads. It was charcoal,
  // which made it the darkest thing on the desk in a room where Home's is one
  // of the lightest.
  frame.geometries.push(box(1.5, 0.045, 0.52, KEYBOARD.x, DESK_TOP + 0.022, KEYBOARD.z));
  addShadow(2.1, 1.0, KEYBOARD.x, DESK_TOP + 0.004, KEYBOARD.z + 0.02, 0.46);

  /**
   * ── NOTEBOOK ────────────────────────────────────────────────────────────
   *
   * A cover plus a page block, not a single slab. The slab was the same cream
   * as the desk top it sat on and had no edge, so it read as a stain on the
   * laminate. The page block is inset on all sides and sits proud of the
   * cover, which is the whole tell.
   */
  const { x: nbX, z: nbZ, yaw: nbYaw } = NOTEBOOK;
  frame.geometries.push(box(0.68, 0.03, 0.5, nbX, DESK_TOP + 0.015, nbZ, nbYaw));
  paper.geometries.push(box(0.63, 0.038, 0.45, nbX, DESK_TOP + 0.049, nbZ, nbYaw));
  addShadow(1.1, 0.95, nbX, DESK_TOP + 0.004, nbZ, 0.42);

  /**
   * The pen: a barrel with a ferrule and a nib, lying across the notebook. A
   * flat cyan bar was the second-worst object in the section after the mug -
   * an unlit rectangle reads as a UI element, not as a thing on a desk.
   */
  const penY = DESK_TOP + 0.082;
  const penBody = new CylinderGeometry(0.014, 0.014, 0.3, 10);
  penBody.rotateZ(Math.PI / 2);
  penBody.rotateY(nbYaw);
  penBody.translate(nbX - 0.02, penY, nbZ - 0.02);
  dark.geometries.push(penBody);

  const ferrule = new CylinderGeometry(0.0155, 0.0155, 0.05, 10);
  ferrule.rotateZ(Math.PI / 2);
  ferrule.rotateY(nbYaw);
  ferrule.translate(nbX - 0.02 + 0.115 * Math.cos(nbYaw), penY, nbZ - 0.02 - 0.115 * Math.sin(nbYaw));
  frame.geometries.push(ferrule);

  const nib = new CylinderGeometry(0.002, 0.013, 0.045, 8);
  nib.rotateZ(-Math.PI / 2);
  nib.rotateY(nbYaw);
  nib.translate(nbX - 0.02 - 0.17 * Math.cos(nbYaw), penY, nbZ - 0.02 + 0.17 * Math.sin(nbYaw));
  frame.geometries.push(nib);

  // ── mug: a lathed wall with a real rim, a real interior and a ring handle
  const mugBody = createMugBody();
  mugBody.translate(MUG.x, DESK_TOP, MUG.z);
  ceramic.geometries.push(mugBody);

  const mugHandle = createMugHandle();
  mugHandle.translate(MUG.x, DESK_TOP, MUG.z);
  ceramic.geometries.push(mugHandle);

  // The coffee: a disc four centimetres below the rim, so no camera angle can
  // catch it crossing the lip.
  const coffee = new CircleGeometry(0.0745, 28);
  coffee.rotateX(-Math.PI / 2);
  coffee.translate(MUG.x, DESK_TOP + 0.155, MUG.z);
  const coffeeMaterial = new MeshMatcapMaterial({ matcap: getMatcap("ceramic"), color: 0x4a2c1c, transparent: true });
  const coffeeMesh = new Mesh(coffee, coffeeMaterial);
  coffeeMesh.renderOrder = 12.1;
  coffeeMesh.frustumCulled = false;
  group.add(coffeeMesh);
  materials.push(coffeeMaterial);
  disposables.push(coffee, coffeeMaterial);

  addShadow(0.42, 0.42, MUG.x, DESK_TOP + 0.004, MUG.z, 0.52);

  /**
   * ── PENCIL CUP ──────────────────────────────────────────────────────────
   *
   * Home has a tan cup of pencils beside the left monitor and Experience had
   * nothing there. It is the cheapest prop on the desk that says "same room":
   * a warm cylinder and three coloured sticks, and it puts a second warm note
   * next to the wooden legs.
   */
  const cupX = -2.15;
  const cupZ = -0.5;
  wood.geometries.push(cylinder(0.15, 0.14, 0.3, cupX, DESK_TOP + 0.15, cupZ, 18));
  // hollow it, so the pencils stand IN it rather than on it
  dark.geometries.push(cylinder(0.128, 0.128, 0.02, cupX, DESK_TOP + 0.27, cupZ, 18));
  const pencils: [number, number, number, number][] = [
    // x offset, z offset, lean, colour bucket index
    [-0.05, 0.03, 0.1, 0],
    [0.04, -0.02, -0.07, 1],
    [0.01, 0.06, 0.05, 2],
  ];
  for (const [dx, dz, lean, tone] of pencils) {
    const stick = new CylinderGeometry(0.017, 0.017, 0.42, 8);
    stick.rotateZ(lean);
    stick.translate(cupX + dx, DESK_TOP + 0.38, cupZ + dz);
    (tone === 0 ? accent : tone === 1 ? dark : wood).geometries.push(stick);
  }
  addShadow(0.62, 0.62, cupX, DESK_TOP + 0.004, cupZ, 0.5);

  // ── desk lamp, clear of the left monitor
  frame.geometries.push(cylinder(0.21, 0.23, 0.05, LAMP.x, DESK_TOP + 0.025, LAMP.z, 20));
  frame.geometries.push(box(0.06, 0.98, 0.06, LAMP.x, DESK_TOP + 0.52, LAMP.z));
  frame.geometries.push(box(0.44, 0.09, 0.24, LAMP.x + 0.12, DESK_TOP + 0.98, LAMP.z + 0.12, 0.3));
  accent.geometries.push(box(0.34, 0.02, 0.16, LAMP.x + 0.12, DESK_TOP + 0.93, LAMP.z + 0.12, 0.3));
  addShadow(0.7, 0.7, LAMP.x, DESK_TOP + 0.004, LAMP.z, 0.5);

  // ponytail: no back-wall or light columns. Every version of them either
  // crossed the desk in projection or pulled attention off the avatar, and the
  // grid floor plus the deck rim already say "environment". The plant and the
  // lamp are the only vertical props the bay needs.

  for (const item of [shell, wood, frame, dark, paper, ceramic, accent, deckMat]) {
    /**
     * `mergeGeometries` returns null, silently, if the inputs disagree on
     * whether they are indexed, and RoundedBoxGeometry is the one primitive
     * here that ships without an index. A null merge skips the bucket, which
     * is how the entire desk and leg frame disappeared the first time the
     * bevels went in: no error, no warning, just no furniture.
     *
     * Flattening everything to non-indexed is the fix that cannot be got
     * wrong. `mergeVertices` would be the other direction, but it welds by
     * position AND normal AND uv, so it is one attribute change away from
     * rounding off the flat shading these bevels exist to create. The extra
     * vertices are irrelevant at this scale, the whole office is a few
     * thousand triangles.
     */
    const parts = item.geometries.map((geometry) => (geometry.index ? geometry.toNonIndexed() : geometry));
    const merged = mergeGeometries(parts);
    parts.forEach((part, i) => {
      if (part !== item.geometries[i]) part.dispose();
    });
    item.geometries.forEach((geometry) => geometry.dispose());
    if (!merged) continue;
    const mesh = new Mesh(merged, item.material);
    mesh.renderOrder = 12;
    mesh.frustumCulled = false;
    group.add(mesh);
    materials.push(item.material);
    disposables.push(merged, item.material);
  }
};

const init = () => {
  if (group.children.length) return;

  screens.init();
  buildChassis();
  buildKeyboard();
  buildScreen(-1);
  buildScreen(1);

  // Home's own chair, with Home's own baked shading: white shell, silver
  // cantilever legs. See `cloneFromRoom`.
  const chair = cloneFromRoom("chair");
  if (chair) {
    /**
     * The clone lands at the room-mapped origin (-0.66, 0, 0), which puts the
     * seat pan roughly half a metre to HIS left, screenshots from the
     * chapter beats showed him perched on the seat's front corner with his
     * hip spilling past its edge. His hips sit at local (-0.08, 1.55, 0.57);
     * this centres the pan under them. Measured against renders, not derived:
     * the chair mesh's own origin is not its seat centre.
     */
    chair.position.x = -0.14;
    chair.position.z = 0.12;
    group.add(chair);
    // The chair stands on the deck, not on the desk.
    addShadow(1.5, 1.5, -0.14, 0.01, 0.12, 0.44);
  }

  const mouse = cloneFromRoom("mouse");
  if (mouse) {
    group.add(mouse);
    addShadow(0.42, 0.42, mouse.position.x, DESK_TOP + 0.004, mouse.position.z, 0.44);
  }

  /**
   * Built rather than cloned, see `plant.ts`. Placement history: level with
   * the desk's front edge it blocked the establishing shot; at local +3.62 it
   * stood on the avatar's RIGHT in world -X, which no Experience camera ever
   * frames, so the plant effectively did not exist on the scroll journey.
   * Local -X maps to world +X: beside the desk's far end near the lamp, in
   * frame for the establishing shot and both chapter beats.
   *
   * Two matcaps: the blades are waxy and the terracotta pot is not.
   */
  const plant = createPlant(getMatcap("plastic"), getMatcap("matte"));
  plant.group.position.set(-4.05, 0, -1.15);
  plant.group.rotation.y = 0.7;
  plant.group.scale.setScalar(1.24);
  group.add(plant.group);
  materials.push(...plant.materials);
  disposables.push(...plant.disposables);

  /**
   * The CV envelope, on the near right of the desk. Its position was measured
   * against the establishing shot's projection rather than chosen, see the
   * note in `objects/envelope.ts`. It swapped places with the notebook to get
   * there.
   */
  envelope = createEnvelope({
    position: [1.52, DESK_TOP, -0.8],
    yaw: 0.26,
    isOnStage: () => sceneWeights.experience > 0.5,
    shadow: true,
  });
  envelope.init();
  group.add(envelope.group);

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

  // The panels go dark ahead of the office, not with it: the X-ray phase takes
  // them out while the desk is still solid, which is the cue that says the
  // scene is about to change rather than that it is ending.
  const lit = opacity * (1 - screens.state.dim);
  for (const material of screenMaterials) {
    material.opacity = lit;
    material.depthWrite = lit > 0.9;
  }

  // After the sweep above, not before it: the envelope owns its own materials
  // so that hover and the opening animation can drive the seal and the sheet
  // independently of the office's single reveal value.
  envelope?.setOpacity(opacity);
  envelope?.tick(gsap.ticker.deltaRatio(60));

  screens.update(gsap.ticker.time);
};

const destroy = () => {
  gsap.ticker.remove(tick);
  screens.destroy();
  envelope?.destroy();
  envelope = null;
  disposeEnvelopeAssets();
  disposables.forEach((item) => item.dispose());
  disposables = [];
  materials = [];
  screenMaterials = [];
  disposeMatcaps();
  group.clear();
  scene.instance.remove(group);
};

export const workstation = { init, destroy, group, reveal };
