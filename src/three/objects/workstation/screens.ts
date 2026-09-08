import { CanvasTexture, LinearFilter, SRGBColorSpace } from "three";
import { resources } from "../../../utils/resources";
import { getDesktopAtlas } from "../room/desktop-atlas";

/**
 * ─── THE EXPERIENCE MONITORS SHOW HOME'S SCREENS ──────────────────────────
 *
 * Home and Experience are the same workstation, and that has to include what is
 * ON the monitors. It used to not: the hero room's two panels are a dark code
 * editor and a chat app, baked into `assets/textures/desktops.webp`, while this
 * module drew its own pair of cyan-on-navy dashboards. Both were fine screens.
 * They were also unmistakably two different computers in what is supposed to be
 * one room, and screen content is the loudest thing on a desk: it is the only
 * part of the composition that emits light.
 *
 * So this now draws HOME'S OWN ATLAS, cropped to each monitor. Not a copy of it,
 * the same file, the same download, already in `resources` for the room. The
 * ~430 lines of dashboard drawing that used to live here are gone with it.
 *
 * ── WHY A CANVAS AND NOT THE TEXTURE DIRECTLY ─────────────────────────────
 *
 * Pointing a `MeshBasicMaterial` at a clone of the shared texture with its own
 * `offset`/`repeat` is the obvious move and it is a trap. `room/desktops.ts`
 * puts that texture into LINEAR colour space with `flipY = false`, because its
 * shader samples it raw; three shares one GPU upload between every texture that
 * shares a `source`, so the first of the two to be uploaded decides both. A
 * basic material would then either double-encode the panel (visibly washed out)
 * or fight the room for the setting. Blitting the region onto our own canvas
 * sidesteps all of it, costs one `drawImage` per redraw at 6fps, and keeps the
 * crop as plain pixel arithmetic instead of inverted UV transforms.
 *
 * ── THE ATLAS ─────────────────────────────────────────────────────────────
 *
 * 1024², read off the file rather than assumed:
 *
 *   LEFT HALF  (x 0..512)    the code editor, tiling vertically, 64 lines at
 *                            16px. The room shows the top third of it and
 *                            scrolls; so does this.
 *   RIGHT HALF (x 512..1024) the CV, painted over the chat app by
 *                            `room/desktop-atlas.ts`, the page in the top half.
 */

/** 16:9, matching MONITOR.screenWidth / screenHeight in `./index.ts`. */
const WIDTH = 640;
const HEIGHT = 360;

/** Source crop: 502px wide, and whatever height keeps the monitor's aspect. */
const CROP_W = 502;
const CROP_H = Math.round((CROP_W * HEIGHT) / WIDTH);

type Side = "left" | "right";

/**
 * Where each panel is cut from, and how far `blend` walks it.
 *
 * The pan is what `blend` means now. It used to cross-fade between two invented
 * dashboards; the Experience timeline still drives it per chapter, and a screen
 * that has been scrolled a few lines between one beat and the next says the
 * same thing ("time passed, work happened") in the room's own idiom rather than
 * in a second one. 96px is six lines of code, which is a nudge and not a jump.
 */
const CROPS: Record<Side, { x: number; y: number; pan: number }> = {
  left: { x: 6, y: 16, pan: 96 },
  right: { x: 518, y: 6, pan: 34 },
};

/**
 * The room's own monitor artwork, with the CV on it. Null until resources have
 * loaded; the raw file if the composite could not be drawn.
 */
const atlas = (): CanvasImageSource | null => {
  const composed = getDesktopAtlas();
  if (composed) return composed;
  const image = resources.items["desktops-texture"]?.image;
  // An Image that has not decoded yet has width 0, and drawing it throws.
  return image && image.width ? image : null;
};

class Screen {
  readonly texture: CanvasTexture;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly side: Side;

  constructor(side: Side) {
    this.side = side;
    this.canvas = document.createElement("canvas");
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.ctx = this.canvas.getContext("2d") as CanvasRenderingContext2D;

    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
  }

  draw(blend: number) {
    const image = atlas();
    const { ctx } = this;
    const crop = CROPS[this.side];

    // The editor's own background, so a frame drawn before the atlas has
    // decoded is a dark panel rather than a transparent hole.
    ctx.fillStyle = "#36393f";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    if (!image) return;

    ctx.drawImage(image, crop.x, crop.y + blend * crop.pan, CROP_W, CROP_H, 0, 0, WIDTH, HEIGHT);
    this.texture.needsUpdate = true;
  }

  dispose() {
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

let left: Screen | null = null;
let right: Screen | null = null;

/**
 * `blend` walks the panels (see CROPS); `dim` is how far they have gone dark,
 * 0 = on, 1 = off. The X-ray sequence drives `dim`, the monitors going quiet is
 * the cue that says something is about to happen to the scene, and it is applied
 * to the screen materials by the workstation tick rather than redrawn into the
 * canvases, which would cost a repaint per frame.
 */
const state = { blend: 0, dim: 0 };
let lastBlend = -1;
/** Cleared once a frame has been drawn with the atlas actually present. */
let drawnWithAtlas = false;

const init = () => {
  if (left) return;
  left = new Screen("left");
  right = new Screen("right");
  redraw();
};

const redraw = () => {
  left?.draw(state.blend);
  right?.draw(state.blend);
  drawnWithAtlas = atlas() !== null;
};

/**
 * Called from the workstation tick. The panels are a still image now, so there
 * is nothing to animate: redraw only when `blend` has actually moved, or while
 * the atlas has still not turned up.
 */
const update = (_time: number) => {
  const step = Math.round(state.blend * 240);
  if (step === lastBlend && drawnWithAtlas) return;
  lastBlend = step;
  redraw();
};

const destroy = () => {
  left?.dispose();
  right?.dispose();
  left = null;
  right = null;
  lastBlend = -1;
  drawnWithAtlas = false;
  state.blend = 0;
  state.dim = 0;
};

export const screens = {
  init,
  update,
  destroy,
  state,
  getLeftTexture: () => left?.texture ?? null,
  getRightTexture: () => right?.texture ?? null,
};
