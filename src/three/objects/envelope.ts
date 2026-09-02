import {
  Box3,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import gsap from "gsap";
import { getMatcap, createContactShadow } from "./workstation/materials";
import { raycast } from "../utils/raycast";
import { lerp } from "../../utils/math";
import { cv, cvStage } from "../../features/cv/state";

import type { Material, Texture } from "three";
import type { ClickableBox3 } from "../types";

/**
 * ─── THE CV ENVELOPE ──────────────────────────────────────────────────────
 *
 * A stuffed envelope lying on a desk. Click it and the flap swings open, a
 * sheet rises out of the mouth, and the readable CV opens over the scene.
 *
 * ── ONE BUILDER, TWO DESKS ────────────────────────────────────────────────
 *
 * There are two of these and they are the same object: one on the hero room's
 * desk, so a visitor who never scrolls past the first screen can still find the
 * CV, and one on the Experience workstation, where it belongs to the office the
 * section builds. They are never both on screen, `hero` and `experience` are
 * mutually exclusive scene weights, so `setOpenAll` simply plays the opening
 * move on both and whichever one the visitor is looking at is the one they see.
 *
 * That is why this is a factory rather than the singleton it started as. Each
 * instance owns its own geometry, its own hit box and its own hover state; the
 * only shared things are the baked matcaps, which are cached.
 *
 * ── WHY IT IS A PROP AND NOT A BUTTON ─────────────────────────────────────
 *
 * The scenes are places you look around, not HUDs. So this is discovered the
 * way the orchid and the painting are, same `raycast.boxesToCheck` list, same
 * restraint on hover. It is deliberately NOT a `Clickable` /
 * `data-cursor="arrow"` element: that is the orange project arrow, and the
 * orange arrow means "this opens a case study".
 */

export type EnvelopeOptions = {
  /** Where it lies, in the parent group's own space. */
  position: [number, number, number];
  yaw: number;
  /** 1 is the Experience workstation's scale. */
  scale?: number;
  /**
   * Whether the scene this belongs to is on screen. The hit box is collapsed
   * and the prop hidden whenever it is false, an empty Box3 never intersects
   * a ray, which is how a prop stops being clickable once its scene has
   * scrolled away.
   */
  isOnStage: () => boolean;
  /**
   * A multiply-blended pool under it. The Experience office has none of its
   * own so it needs one; the hero room is fully baked and already has contact
   * shadows painted into its atlas, so a second one there reads as a smudge.
   */
  shadow?: boolean;
  /**
   * Draw order. Both scenes sort against a `depthTest: false` composite, so
   * this is not optional, see the note next to the contact shadow below.
   */
  renderOrder?: number;
};

const WIDTH = 0.72;
const DEPTH = 0.5;
const THICKNESS = 0.05;

/** How far along its own hinge axis the sheet sits, tucked in and fully out. */
const SHEET_IN = 0.24;
const SHEET_OUT = 0.66;
/**
 * Where the sheet settles, as an angle off the desk. Not upright: a card
 * standing to attention out of an envelope reads as a sign, and it is twice
 * the screen height for no extra information.
 */
const SHEET_SETTLE = 1.14;

const SHELL = new Color(0xf3ecdf);
const SHELL_HOVER = new Color(0xfbfdff);

/**
 * The printed side of the sheet. Not the CV, the CV is the readable HTML
 * panel, just enough type-coloured structure that the paper reads as a
 * document from two metres away rather than as a white card.
 *
 * Built once and shared: both envelopes show the same sheet.
 */
let sheetTexture: Texture | null = null;

const getSheetTexture = (): Texture | null => {
  if (sheetTexture) return sheetTexture;

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 340;
  const context = canvas.getContext("2d");
  if (!context) return null;

  // Cooler than the desk it stands on. A warm white sheet on a warm white
  // laminate is one value, and the sheet vanished into it.
  context.fillStyle = "#f2f5f9";
  context.fillRect(0, 0, 256, 340);

  context.fillStyle = "#1d2b3a";
  context.fillRect(26, 30, 132, 13);
  context.fillStyle = "#7d8b99";
  context.fillRect(26, 50, 92, 6);
  context.fillStyle = "#34bfff";
  context.fillRect(26, 68, 204, 2);

  // Blocks of ragged-right rules, so it scans as set text instead of a grid.
  let y = 86;
  for (let block = 0; block < 5; block++) {
    context.fillStyle = "#2b3a49";
    context.fillRect(26, y, 62, 5);
    y += 13;
    context.fillStyle = "#b9c2cb";
    for (let line = 0; line < 3 + (block % 2); line++) {
      context.fillRect(26, y, 150 + ((block * 37 + line * 61) % 54), 4);
      y += 10;
    }
    y += 9;
  }

  sheetTexture = new CanvasTexture(canvas);
  sheetTexture.colorSpace = SRGBColorSpace;
  sheetTexture.anisotropy = 4;
  return sheetTexture;
};

/**
 * An isosceles triangle lying in the XZ plane, base along X at z = 0 and apex
 * `depth` away in the direction of `sign`. The flap and the front seam are the
 * same shape pointing opposite ways.
 *
 * `sign` is baked into the shape rather than applied afterwards as
 * `scale(1, 1, -1)`: a negative scale mirrors the winding, so every face
 * becomes back-facing, and a DoubleSide matcap material then shades them off
 * the FLIPPED normal, which is the bottom of the matcap disc, i.e. dark.
 */
const createTriangle = (width: number, depth: number, sign: 1 | -1 = 1) => {
  const shape = new Shape();
  shape.moveTo((-width / 2) * sign, 0);
  shape.lineTo((width / 2) * sign, 0);
  shape.lineTo(0, -depth * sign);
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  // (x, y) → (x, 0, -y), so the apex at -depth·sign lands at +Z·sign.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
};

/**
 * Written out rather than inferred with `ReturnType<typeof createEnvelope>`:
 * the factory pushes itself into `instances`, so inferring the type from the
 * factory that references the list that is typed by the inference is a cycle
 * TypeScript refuses.
 */
export type Envelope = {
  init: () => void;
  destroy: () => void;
  tick: (delta: number) => void;
  group: Group;
  setOpen: (value: number, duration: number) => void;
  setOpacity: (value: number) => void;
  /** Whether this one's scene is on screen. See the dismiss rule in `tick`. */
  isOnStage: () => boolean;
};

/** Every instance built, so the CV panel can open them without knowing which. */
const instances: Envelope[] = [];

export const createEnvelope = (options: EnvelopeOptions): Envelope => {
  const order = options.renderOrder ?? 12.6;

  const group = new Group();
  /** Everything above the desk, so hover lifts the prop as one piece. */
  const body = new Group();
  const flap = new Group();
  const paper = new Group();

  let disposables: (BufferGeometry | Material | Texture)[] = [];
  /** Every material the prop owns, so a scene fade can be applied to it. */
  let materials: Material[] = [];
  let shellMaterial: MeshMatcapMaterial | null = null;
  let sealMaterial: MeshBasicMaterial | null = null;
  let sheetMaterial: MeshBasicMaterial | null = null;
  /** Kept out of `materials` so the sheet's own reveal can drive it. */
  let leanShadow: MeshBasicMaterial | null = null;

  const box = new Box3() as ClickableBox3;
  const boxCentre = new Vector3();
  const boxSize = new Vector3();

  /** Eased toward 1 while the pointer is over it. */
  let hover = 0;
  /** 0 closed, 1 fully opened. Driven by `setOpen`, not by hover. */
  const open = { value: 0 };
  /** The scene's own reveal, mirrored here, see `setOpacity`. */
  let opacity = 1;

  const build = () => {
    // DoubleSide because the flap shares this material and its underside is in
    // full view once it is open. The pocket is a closed solid, so it costs
    // nothing.
    const shell = new MeshMatcapMaterial({
      matcap: getMatcap("matte"),
      color: SHELL.getHex(),
      transparent: true,
      side: DoubleSide,
    });
    shellMaterial = shell;
    materials.push(shell);
    disposables.push(shell);

    // ── the pocket. A rounded slab, not a plane: no thickness at the edge is
    // most of why a desk prop reads as a primitive.
    const pocket = new RoundedBoxGeometry(WIDTH, THICKNESS, DEPTH, 2, 0.012);
    pocket.translate(0, THICKNESS / 2, 0);
    const pocketMesh = new Mesh(pocket, shell);
    pocketMesh.renderOrder = order;
    pocketMesh.frustumCulled = false;
    body.add(pocketMesh);
    disposables.push(pocket);

    // ── the front seam: the V the front panel folds into, hinged at the near
    // edge and pointing back. A hair proud of the pocket so it catches the
    // matcap on its own rather than z-fighting.
    const seam = createTriangle(WIDTH * 0.97, DEPTH * 0.84);
    seam.translate(0, THICKNESS + 0.0015, -DEPTH / 2 + 0.004);
    const seamMaterial = new MeshMatcapMaterial({
      matcap: getMatcap("matte"),
      color: 0xe7ddca,
      transparent: true,
    });
    const seamMesh = new Mesh(seam, seamMaterial);
    seamMesh.renderOrder = order + 0.02;
    seamMesh.frustumCulled = false;
    body.add(seamMesh);
    materials.push(seamMaterial);
    disposables.push(seam, seamMaterial);


    // ── the flap. Hinged along the FAR edge and pointing toward the camera
    // when closed, so opening it swings the tip up and away rather than into
    // frame.
    const flapGeometry = createTriangle(WIDTH * 0.97, DEPTH * 0.86, -1);
    const flapMesh = new Mesh(flapGeometry, shell);
    flapMesh.renderOrder = order + 0.04;
    flapMesh.frustumCulled = false;
    flap.add(flapMesh);
    /**
     * A liner a hair under the flap, in the seam's darker paper.
     *
     * Open, the face pointed at the camera is the flap's UNDERSIDE, and in the
     * same white as the shell it read as a pale shard standing on a pale desk
     * rather than as the inside of an envelope. Real envelopes are lined for
     * exactly this reason. It also costs nothing: same triangle, one material
     * already in the list.
     */
    const linerGeometry = createTriangle(WIDTH * 0.93, DEPTH * 0.82, -1);
    linerGeometry.translate(0, -0.0025, 0);
    const linerMesh = new Mesh(linerGeometry, seamMaterial);
    linerMesh.renderOrder = order + 0.03;
    linerMesh.frustumCulled = false;
    flap.add(linerMesh);
    flap.position.set(0, THICKNESS + 0.002, DEPTH / 2);
    body.add(flap);
    disposables.push(flapGeometry, linerGeometry);

    // ── the seal. The one cyan note on the prop, and where the eye lands: the
    // site's interactive language is cyan, so anyone who has clicked the
    // orchid already knows what this dot means.
    const seal = new PlaneGeometry(0.1, 0.1);
    seal.rotateX(-Math.PI / 2);
    seal.translate(0, THICKNESS + 0.005, DEPTH * 0.04);
    sealMaterial = new MeshBasicMaterial({
      color: 0x34bfff,
      transparent: true,
      toneMapped: false,
      depthWrite: false,
    });
    const sealMesh = new Mesh(seal, sealMaterial);
    sealMesh.renderOrder = order + 0.08;
    sealMesh.frustumCulled = false;
    body.add(sealMesh);
    materials.push(sealMaterial);
    disposables.push(seal, sealMaterial);

    // ── the sheet. Hinged at the envelope's mouth: `paper.rotation.x` of
    // -PI/2 lays it flat inside (invisible, opacity 0), and opening stands it
    // up.
    const texture = getSheetTexture();
    /**
     * A thin BOX, not a plane. A document seen edge-on at the moment it clears
     * the flap is the frame that sells it as an object, and a plane has no
     * edge at all. 4mm at this scale.
     *
     * It is also smaller than it was: 0.605 x 0.75 standing nearly upright out
     * of a 0.72 x 0.5 envelope filled the frame and read as a poster propped on
     * the desk. This settles LEANING BACK, which is both what a card in an
     * envelope does and half the screen height.
     */
    const sheet = new BoxGeometry(WIDTH * 0.86, DEPTH * 1.42, 0.005);
    sheetMaterial = new MeshBasicMaterial({
      map: texture,
      transparent: true,
      toneMapped: false,
      side: DoubleSide,
      opacity: 0,
      depthWrite: false,
    });
    const sheetMesh = new Mesh(sheet, sheetMaterial);
    sheetMesh.renderOrder = order + 0.06;
    sheetMesh.frustumCulled = false;
    /**
     * Turned to face the OTHER way.
     *
     * The hinge sweep tips the sheet's top up and toward the camera, which is
     * what it should do, but that carries the face with it: the printed side
     * ended up pointing up and away, so what settled out of the envelope was
     * the back of a blank sheet. Half a turn puts the print where the camera
     * is. The artwork is abstract rules rather than real text, so mirroring it
     * costs nothing.
     */
    sheetMesh.rotation.y = Math.PI;
    // Offset along the hinge's own axis, so rotating the group raises it. The
    // tick slides this from tucked-in to clear, which is the "emerges" beat.
    sheetMesh.position.set(0, DEPTH * SHEET_IN, 0);
    paper.add(sheetMesh);
    paper.position.set(0, THICKNESS * 0.6, DEPTH * 0.34);
    paper.rotation.x = -Math.PI / 2;
    body.add(paper);
    materials.push(sheetMaterial);
    disposables.push(sheet, sheetMaterial);

    group.add(body);

    /**
     * A second pool, under where the sheet leans. Without it the one thing in
     * the scene that is standing UP off the desk was the only thing not
     * casting anything, and on a white desk a white sheet with no shadow is
     * very hard to read as an object at all. Its opacity follows the sheet.
     */
    if (options.shadow) {
      const lean = createContactShadow(WIDTH * 1.35, DEPTH * 1.5, 0, 0.0035, -DEPTH * 0.32, 0.42);
      if (lean) {
        leanShadow = lean.mesh.material as MeshBasicMaterial;
        group.add(lean.mesh);
        disposables.push(...lean.disposables);
      }
    }

    // ── the thing that stops it hovering above the desk. It draws at 12.5,
    // ahead of every part above, so a multiply blend can only ever darken the
    // surface it is cast on, never the envelope standing in it.
    if (options.shadow) {
      const shadow = createContactShadow(WIDTH * 1.55, DEPTH * 1.7, 0.015, 0.003, 0.025, 0.34);
      if (shadow) {
        group.add(shadow.mesh);
        materials.push(shadow.mesh.material as Material);
        disposables.push(...shadow.disposables);
      }
    }

    group.position.set(options.position[0], options.position[1], options.position[2]);
    group.rotation.y = options.yaw;
    group.scale.setScalar(options.scale ?? 1);
  };

  const init = () => {
    if (group.children.length) return;
    build();

    box.onClick = () => {
      // An off-screen box is collapsed and cannot be hit either (see `tick`),
      // but the guard is cheap and the failure mode, the CV opening from
      // halfway down the site, is bad.
      if (!options.isOnStage()) return;
      // First click opens the envelope in the scene; a second one opens the
      // reader. See `features/cv/state.ts`.
      cv.activate();
    };
    box.hoverSound = "hover";
    // Cyan, not the default dark ring: the Experience stage is deep blue and a
    // dark ring on it is invisible. Same call the certificate cards make, and
    // it keeps the prop inside the site's blue interactive language rather
    // than borrowing the orange project arrow.
    box.cursor = "circle-cyan";
    raycast.boxesToCheck.push(box);
  };

  /**
   * The opening move, and the only animation this owns. Deliberately small: the
   * flap swings, the sheet rises about its own hinge and settles. Nothing
   * crosses the screen, the CV panel is what the visitor is about to read, and
   * a sheet flying at the camera would be competing with it.
   */
  const setOpen = (value: number, duration: number) => {
    gsap.to(open, { value, duration, ease: value ? "power3.out" : "power2.inOut", overwrite: "auto" });
  };

  /** Mirrors a scene's own fade onto this prop's materials. */
  const setOpacity = (value: number) => {
    opacity = value;
  };

  const tick = (delta: number) => {
    const visible = options.isOnStage();
    group.visible = visible;

    if (!visible) {
      box.makeEmpty();
      /**
       * Scrolling away from BOTH scenes closes it: leaving the prompt bar up
       * over a page whose envelope is nowhere on screen is worse than losing
       * the state, and the state is one click to get back.
       *
       * The `some` is load-bearing. Without it the OTHER envelope, the one
       * whose scene is off screen, ran this branch on the very next frame and
       * dismissed the state the on-screen one had just opened. The click
       * worked, the store updated, and a tick later it was closed again, which
       * looked exactly like the click never registering.
       */
      if (cvStage.value === "open" && !instances.some((item) => item.isOnStage())) cv.dismiss();
      return;
    }

    // The parent group is re-posed every frame in both scenes, so the hit box
    // is measured from the live world matrix rather than cached.
    group.updateWorldMatrix(true, true);
    box.setFromObject(body);

    /**
     * ── THE HIT BOX IS A VOLUME, NOT THE PROP ─────────────────────────────
     *
     * An envelope lying flat is 5cm thick, and both cameras look along the
     * desk, so its true bounds project to a strip about 60 x 20 pixels. Two
     * things went wrong with that: it is far too small to find, and the 2cm
     * hover lift moved the box by more than the strip was tall, the pointer
     * fell out of it, the lift reversed, and the hover flickered at several
     * hertz. A click landing in an "off" frame did nothing at all.
     *
     * So the box is grown mostly UPWARD: a shallow column standing on the desk
     * where the envelope is. The lift is then a rounding error inside it.
     *
     * Height is the knob, and it is a trade rather than a free win, a box seen
     * from an elevated camera projects WIDER as it gets taller, and 0.55 of
     * extra height reached across the Experience monitor, so a pointer on the
     * screen bezel got the pointer cursor.
     */
    box.getCenter(boxCentre);
    box.getSize(boxSize);
    boxCentre.y += 0.14;
    boxSize.x += 0.08;
    boxSize.y += 0.3;
    boxSize.z += 0.08;
    box.setFromCenterAndSize(boxCentre, boxSize);

    const goal = raycast.getHoveringBox() === box ? 1 : 0;
    hover = Math.abs(hover - goal) < 0.002 ? goal : lerp(hover, goal, 0.16 * delta);

    // Hover: two millimetres of lift, two per cent of scale, and the paper
    // warming toward white. Enough to answer "is this clickable" from the
    // corner of the eye, not enough to pull the shot off the avatar.
    body.position.y = hover * 0.022 + open.value * 0.014;
    body.scale.setScalar(1 + hover * 0.022);
    shellMaterial?.color.lerpColors(SHELL, SHELL_HOVER, hover);

    /**
     * Flap first, sheet second, so the two beats read in order rather than as
     * one pop, and the sheet does two things at once on the way out: it SLIDES
     * along the hinge axis (clearing the pocket) while it swings up about it.
     * Rotating alone made it pivot out of a slot it was never inside.
     */
    const flapT = Math.min(1, open.value / 0.55);
    const sheetT = Math.max(0, (open.value - 0.3) / 0.7);
    // ease the slide out ahead of the lean, so it is clear of the mouth before
    // it starts tipping back
    const slideT = Math.min(1, sheetT * 1.6);
    // 1.85, not 2.2. Past vertical the flap leans back over the envelope and
    // its silhouette stops reading as a flap at all.
    flap.rotation.x = flapT * 1.85;
    paper.rotation.x = -Math.PI / 2 + sheetT * SHEET_SETTLE;
    // a couple of degrees off square, because nothing a person put down is
    // perfectly aligned
    paper.rotation.z = sheetT * 0.05;
    const sheetMesh = paper.children[0] as Mesh | undefined;
    if (sheetMesh) sheetMesh.position.y = DEPTH * (SHEET_IN + (SHEET_OUT - SHEET_IN) * slideT);

    for (const material of materials) material.opacity = opacity;
    if (sealMaterial) sealMaterial.opacity = opacity * (0.6 + hover * 0.4);
    if (sheetMaterial) sheetMaterial.opacity = opacity * sheetT;
    if (leanShadow) leanShadow.opacity = opacity * sheetT;
  };

  const destroy = () => {
    const index = raycast.boxesToCheck.indexOf(box);
    if (index !== -1) raycast.boxesToCheck.splice(index, 1);
    gsap.killTweensOf(open);
    open.value = 0;
    hover = 0;
    disposables.forEach((item) => item.dispose());
    disposables = [];
    materials = [];
    shellMaterial = null;
    sealMaterial = null;
    sheetMaterial = null;
    leanShadow = null;
    body.clear();
    flap.clear();
    paper.clear();
    group.clear();

    const at = instances.indexOf(instance);
    if (at !== -1) instances.splice(at, 1);
  };

  const instance: Envelope = { init, destroy, tick, group, setOpen, setOpacity, isOnStage: options.isOnStage };
  instances.push(instance);
  return instance;
};

/**
 * Plays the opening move on every envelope in the scene graph. The CV panel
 * calls this rather than holding a reference: only one envelope is ever on
 * screen, so animating both is correct and saves threading "which one did the
 * visitor click" through the click handler and the panel.
 */
export const setEnvelopesOpen = (value: number, duration: number) => {
  for (const item of instances) item.setOpen(value, duration);
};

/** The shared sheet texture; each instance disposes only what it built. */
export const disposeEnvelopeAssets = () => {
  sheetTexture?.dispose();
  sheetTexture = null;
};
