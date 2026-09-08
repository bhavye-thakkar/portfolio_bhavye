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
  SRGBColorSpace,
  Vector3,
} from "three";
import gsap from "gsap";
import { getMatcap, createContactShadow } from "./workstation/materials";
import { raycast } from "../utils/raycast";
import { lerp } from "../../utils/math";
import { cv, cvStage } from "../../features/cv/state";
import { cvHeader, cvSections } from "../../content/cv";

import type { Material, Texture } from "three";
import type { ClickableBox3 } from "../types";

/**
 * ─── THE CV ON THE DESK ───────────────────────────────────────────────────
 *
 * A short stack of paper with the CV on top, lying where a printout lands
 * when you put it down. Click it and the top sheet lifts off the pile and tips
 * up to face you; a small prompt then offers the readable copy.
 *
 * ── WHY A SHEET AND NOT AN ENVELOPE ───────────────────────────────────────
 *
 * This used to be a sealed envelope. Nobody could tell what was in it. The
 * owner's instruction (2026-09-08) was blunt and right: a visitor should look
 * at the desk and see that it is a CV, not deduce it. So the document is face
 * up, typeset from `content/cv.ts` with his name at the top, and the only
 * thing the click does is pick it up. Nothing is hidden and then revealed;
 * what you see lying there is what you get.
 *
 * ── ONE BUILDER, TWO DESKS ────────────────────────────────────────────────
 *
 * There are two of these and they are the same object: one on the hero room's
 * desk, so a visitor who never scrolls past the first screen can still find the
 * CV, and one on the Experience workstation. They are never both on screen,
 * `hero` and `experience` are mutually exclusive scene weights, so
 * `setCvDocumentsOpen` plays the move on both and whichever the visitor is
 * looking at is the one they see.
 *
 * ── WHY IT IS A PROP AND NOT A BUTTON ─────────────────────────────────────
 *
 * The scenes are places you look around, not HUDs. So this is discovered the
 * way the orchid and the painting are, same `raycast.boxesToCheck` list, same
 * restraint on hover. It is deliberately NOT a `Clickable` /
 * `data-cursor="arrow"` element: that is the orange project arrow, and the
 * orange arrow means "this opens a case study".
 */

export type CvDocumentOptions = {
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

/**
 * Portrait, A4 proportions (1 : 1.414). The envelope this replaces was a
 * landscape 0.72 x 0.5; this covers about the same desk area, turned the way a
 * document lies, so both measured positions still land on clear desk.
 */
const WIDTH = 0.48;
const DEPTH = 0.68;
/** A few sheets, enough for an edge you can see from either camera. */
const CARD = 0.012;
const UNDER_SHEET = 0.007;
/**
 * How far the top sheet tips up when opened, off the desk. Not upright: a
 * sheet standing to attention reads as a sign. Around 55 degrees is a page
 * held up to be read, and it keeps the print facing both cameras.
 */
const TILT = 0.95;
const LIFT = 0.05;

const PAPER = new Color(0xf4f6f9);
const PAPER_HOVER = new Color(0xffffff);

/**
 * The printed side. THE CV, typeset from the same `content/cv.ts` the
 * readable panel uses, not a picture of one. It is set at 512 x 724, which is
 * A4 at 72dpi and a touch more: from either desk camera it reads as a document
 * with a name, a role line and headed sections, which is exactly the "yes, that
 * is a CV" the prop exists for. The legible copy is still the panel.
 *
 * Built once and shared: both documents show the same sheet.
 */
let pageTexture: Texture | null = null;

const TEXTURE_W = 512;
const TEXTURE_H = 724;

const wrap = (ctx: CanvasRenderingContext2D, text: string, width: number): string[] => {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

const getPageTexture = (): Texture | null => {
  if (pageTexture) return pageTexture;

  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_W;
  canvas.height = TEXTURE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const font = "Urbanist, system-ui, sans-serif";
  // Cooler than the desks it lies on. A warm white sheet on a warm white
  // laminate is one value, and the sheet vanished into it.
  ctx.fillStyle = "#f4f6f9";
  ctx.fillRect(0, 0, TEXTURE_W, TEXTURE_H);

  const left = 40;
  const width = TEXTURE_W - 80;
  const bottom = TEXTURE_H - 30;
  let y = 62;
  ctx.textBaseline = "alphabetic";

  // Name large enough to read from across the room; that is the whole tell.
  // Oversized for a real CV (a printed name is ~4% of the page width, this is
  // ~9%), because from either desk camera the sheet is a strip forty pixels
  // wide and the name is the one line that has to survive that.
  ctx.fillStyle = "#1d2b3a";
  ctx.font = `800 44px ${font}`;
  ctx.fillText(cvHeader.name, left, y + 8);
  y += 40;
  ctx.fillStyle = "#5b6b7a";
  ctx.font = `600 18px ${font}`;
  ctx.fillText(cvHeader.role, left, y);
  y += 22;
  ctx.fillStyle = "#7d8b99";
  ctx.font = `400 12px ${font}`;
  ctx.fillText(`${cvHeader.email}   ${cvHeader.address}`, left, y);
  y += 14;
  // The one cyan note on the sheet, the site's interactive colour.
  ctx.fillStyle = "#34bfff";
  ctx.fillRect(left, y, width, 4);
  y += 26;

  for (const section of cvSections) {
    if (y > bottom - 34) break;
    ctx.fillStyle = "#2b3a49";
    ctx.font = `800 13px ${font}`;
    ctx.fillText(section.label.toUpperCase(), left, y);
    y += 16;
    for (const entry of section.entries) {
      if (y > bottom - 18) break;
      ctx.fillStyle = "#1d2b3a";
      ctx.font = `700 12px ${font}`;
      ctx.fillText(entry.title, left, y);
      y += 14;
      if (entry.subtitle) {
        ctx.fillStyle = "#7d8b99";
        ctx.font = `400 11px ${font}`;
        ctx.fillText(entry.subtitle, left, y);
        y += 13;
      }
      ctx.fillStyle = "#3c4652";
      ctx.font = `400 10.5px ${font}`;
      for (const bullet of entry.bullets ?? []) {
        for (const line of wrap(ctx, bullet, width - 14)) {
          if (y > bottom) break;
          ctx.fillText(`• ${line}`, left + 4, y);
          y += 12.5;
        }
      }
      y += 6;
    }
    y += 10;
  }

  pageTexture = new CanvasTexture(canvas);
  pageTexture.colorSpace = SRGBColorSpace;
  pageTexture.anisotropy = 8;
  return pageTexture;
};

/**
 * Written out rather than inferred with `ReturnType<typeof createCvDocument>`:
 * the factory pushes itself into `instances`, so inferring the type from the
 * factory that references the list that is typed by the inference is a cycle
 * TypeScript refuses.
 */
export type CvDocument = {
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
const instances: CvDocument[] = [];

export const createCvDocument = (options: CvDocumentOptions): CvDocument => {
  const order = options.renderOrder ?? 12.6;

  const group = new Group();
  /** Everything above the desk, so hover lifts the prop as one piece. */
  const body = new Group();
  /** Hinged along the far edge; rotating it tips the top sheet up. */
  const paper = new Group();

  let disposables: (BufferGeometry | Material | Texture)[] = [];
  /** Every material the prop owns, so a scene fade can be applied to it. */
  let materials: Material[] = [];
  let cardMaterial: MeshMatcapMaterial | null = null;
  let clipMaterial: MeshBasicMaterial | null = null;
  /** Kept out of `materials` so the tilt's own reveal can drive it. */
  let leanShadow: MeshBasicMaterial | null = null;

  const box = new Box3() as ClickableBox3;
  const boxCentre = new Vector3();
  const boxSize = new Vector3();

  /** Eased toward 1 while the pointer is over it. */
  let hover = 0;
  /** 0 flat on the pile, 1 lifted and tipped up. Driven by `setOpen`, not hover. */
  const open = { value: 0 };
  /** The scene's own reveal, mirrored here, see `setOpacity`. */
  let opacity = 1;

  const build = () => {
    const paperMaterial = new MeshMatcapMaterial({
      matcap: getMatcap("matte"),
      color: PAPER.getHex(),
      transparent: true,
      side: DoubleSide,
    });
    cardMaterial = paperMaterial;
    materials.push(paperMaterial);
    disposables.push(paperMaterial);

    /**
     * ── THE PILE ────────────────────────────────────────────────────────────
     *
     * Two sheets under the top one, each a few degrees off square and a little
     * offset, because a printout put down on a desk is never a single aligned
     * page. They stay on the desk when the top sheet lifts, which is what makes
     * the lift read as picking one page OFF a stack rather than as a card
     * levitating.
     */
    const underSheets = [
      { yaw: -0.05, x: 0.012, z: -0.006 },
      { yaw: 0.035, x: -0.008, z: 0.01 },
    ];
    underSheets.forEach((sheet, i) => {
      const geometry = new BoxGeometry(WIDTH, UNDER_SHEET, DEPTH);
      geometry.rotateY(sheet.yaw);
      geometry.translate(sheet.x, UNDER_SHEET / 2 + i * UNDER_SHEET, sheet.z);
      const mesh = new Mesh(geometry, paperMaterial);
      mesh.renderOrder = order + i * 0.01;
      mesh.frustumCulled = false;
      body.add(mesh);
      disposables.push(geometry);
    });
    const pileTop = UNDER_SHEET * underSheets.length;

    /**
     * ── THE TOP SHEET ───────────────────────────────────────────────────────
     *
     * A thin box for the edge, and a plane a hair above it carrying the print.
     * A box's one material would wrap the CV round every face; the plane keeps
     * it on the top where a document's print is. `depthWrite` on so the
     * transparent plane still sorts against the card under it.
     */
    const page = new Group();
    const card = new BoxGeometry(WIDTH, CARD, DEPTH);
    card.translate(0, CARD / 2, 0);
    const cardMesh = new Mesh(card, paperMaterial);
    cardMesh.renderOrder = order + 0.03;
    cardMesh.frustumCulled = false;
    page.add(cardMesh);
    disposables.push(card);

    const print = new PlaneGeometry(WIDTH * 0.985, DEPTH * 0.985);
    print.rotateX(-Math.PI / 2);
    print.translate(0, CARD + 0.0015, 0);
    const printMaterial = new MeshBasicMaterial({
      map: getPageTexture(),
      transparent: true,
      toneMapped: false,
      side: DoubleSide,
      depthWrite: true,
    });
    const printMesh = new Mesh(print, printMaterial);
    printMesh.renderOrder = order + 0.04;
    printMesh.frustumCulled = false;
    page.add(printMesh);
    materials.push(printMaterial);
    disposables.push(print, printMaterial);

    /**
     * ── THE CLIP ────────────────────────────────────────────────────────────
     *
     * A cyan tab on the top edge of the sheet, a page marker. It is the one
     * bright note on the prop and where the eye lands: the site's interactive
     * language is cyan, so anyone who has clicked the orchid already knows
     * what this colour means. A child of the page, so it lifts with it.
     */
    const clip = new BoxGeometry(0.075, CARD + 0.008, 0.028);
    clip.translate(WIDTH * 0.3, (CARD + 0.008) / 2 - 0.002, -DEPTH / 2 + 0.006);
    clipMaterial = new MeshBasicMaterial({
      color: 0x34bfff,
      transparent: true,
      toneMapped: false,
    });
    const clipMesh = new Mesh(clip, clipMaterial);
    clipMesh.renderOrder = order + 0.06;
    clipMesh.frustumCulled = false;
    page.add(clipMesh);
    materials.push(clipMaterial);
    disposables.push(clip, clipMaterial);

    /**
     * The page hangs off the hinge at the far edge, so rotating `paper` about
     * X raises the near edge toward the camera.
     *
     * The half turn is what puts the NAME on the edge that rises. A plane's
     * texture top lands on local -z once it is laid flat, which is the hinge
     * side; without this the sheet stood up with the name at the desk and the
     * bullets in the air, which the first render of it did, and which was
     * caught in review rather than by eye. Both desk cameras sit on the -z
     * side of the prop, so after the turn the print faces them when tilted.
     */
    page.position.set(0, 0, DEPTH / 2);
    page.rotation.y = Math.PI;
    paper.add(page);
    paper.position.set(0, pileTop, -DEPTH / 2);
    body.add(paper);

    group.add(body);

    /**
     * A second pool, under where the sheet leans once lifted. Without it the
     * one thing on the desk standing UP was the only thing not casting
     * anything, and on a white desk a white sheet with no shadow is very hard
     * to read as an object at all. Its opacity follows the tilt.
     */
    if (options.shadow) {
      const lean = createContactShadow(WIDTH * 1.4, DEPTH * 1.2, 0, 0.0035, DEPTH * 0.1, 0.4);
      if (lean) {
        leanShadow = lean.mesh.material as MeshBasicMaterial;
        group.add(lean.mesh);
        disposables.push(...lean.disposables);
      }
    }

    // ── the thing that stops it hovering above the desk. It draws at 12.5,
    // ahead of every part above, so a multiply blend can only ever darken the
    // surface it is cast on, never the paper standing in it.
    if (options.shadow) {
      const shadow = createContactShadow(WIDTH * 1.5, DEPTH * 1.35, 0.015, 0.003, 0.02, 0.34);
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
      // First click lifts the sheet in the scene; a second one opens the
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
   * The opening move, and the only animation this owns. Deliberately small:
   * the top sheet lifts a few centimetres and tips up about its far edge.
   * Nothing crosses the screen, the CV panel is what the visitor is about to
   * read, and a sheet flying at the camera would be competing with it.
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
       * over a page whose document is nowhere on screen is worse than losing
       * the state, and the state is one click to get back.
       *
       * The `some` is load-bearing. Without it the OTHER document, the one
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
     * A sheet lying flat is a couple of centimetres thick, and both cameras
     * look along the desk, so its true bounds project to a thin strip. Two
     * things went wrong with that: it is too small to find, and the hover lift
     * moved the box by more than the strip was tall, the pointer fell out of
     * it, the lift reversed, and the hover flickered at several hertz.
     *
     * So the box is grown mostly UPWARD: a shallow column standing on the desk
     * where the document is. The lift is then a rounding error inside it.
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
    body.position.y = hover * 0.022;
    body.scale.setScalar(1 + hover * 0.022);
    cardMaterial?.color.lerpColors(PAPER, PAPER_HOVER, hover);

    /**
     * The lift leads the tilt slightly, so the sheet clears the pile before it
     * leans, the way a page comes off a stack when you pick it up by the near
     * edge. A couple of degrees of roll, because nothing a person lifts is
     * perfectly square.
     */
    const liftT = Math.min(1, open.value * 1.4);
    paper.position.y = UNDER_SHEET * 2 + liftT * LIFT;
    paper.rotation.x = -open.value * TILT;
    paper.rotation.z = open.value * 0.04;

    for (const material of materials) material.opacity = opacity;
    if (clipMaterial) clipMaterial.opacity = opacity * (0.7 + hover * 0.3);
    if (leanShadow) leanShadow.opacity = opacity * open.value;
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
    cardMaterial = null;
    clipMaterial = null;
    leanShadow = null;
    body.clear();
    paper.clear();
    group.clear();

    const at = instances.indexOf(instance);
    if (at !== -1) instances.splice(at, 1);
  };

  const instance: CvDocument = { init, destroy, tick, group, setOpen, setOpacity, isOnStage: options.isOnStage };
  instances.push(instance);
  return instance;
};

/**
 * Plays the lift on every document in the scene graph. The CV panel calls this
 * rather than holding a reference: only one is ever on screen, so animating
 * both is correct and saves threading "which one did the visitor click"
 * through the click handler and the panel.
 */
export const setCvDocumentsOpen = (value: number, duration: number) => {
  for (const item of instances) item.setOpen(value, duration);
};

/** The shared page texture; each instance disposes only what it built. */
export const disposeCvDocumentAssets = () => {
  pageTexture?.dispose();
  pageTexture = null;
};
