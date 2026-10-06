import { Box3, Color, Mesh, MeshBasicMaterial, Vector3 } from "three";
import gsap from "gsap";
import { raycast } from "../../utils/raycast";
import { registerInspectTarget } from "../../../animations/inspect";
import { useRouter } from "../../../composables/useRouter";
import { sceneWeights } from "../../../animations/scenes";
import { lerp } from "../../../utils/math";
import { getRoomMaterial } from "../../common/materials";
import { orchid } from "./orchid";

import type { ClickableBox3 } from "../../types";

/**
 * ─── THE TWO THINGS IN THE ROOM WORTH ASKING ABOUT ────────────────────────
 *
 * The penguin and the speaker are toys: click them and something happens in
 * the room. These two are not, the orchid and the painting each open
 * `/object/<slug>`, a page that says why they are in the scene at all. Both
 * stay real scene objects; nothing is swapped for an image.
 *
 * Everything here is deliberately restrained. A prop that pulses to advertise
 * itself stops being a prop, so hover is a few per cent of scale on the plant
 * and a little more light on the picture glass, enough to answer "is this
 * clickable", not enough to notice when you are not looking at it.
 *
 * Hover ALSO does the pointing: `raycast` already swaps in the ring cursor and
 * `Home.vue` already sets `cursor: pointer` for any hovered box, so neither
 * object ever gets the orange project arrow.
 */

const HERO_VISIBLE = 0.5;

type Hotspot = {
  slug: string;
  /** The route a click opens. */
  to: string;
  /** Whether `animations/inspect.ts` frames the camera on this box for its page. */
  inspect: boolean;
  box: ClickableBox3;
  /** Recomputes the world box, the room group is yawed by the hero timeline. */
  measure: (box: Box3) => void;
  hover: number;
  apply: (hover: number) => void;
};

const router = useRouter();
const hotspots: Hotspot[] = [];

/** The frame's own material, cloned off the shared room one so it can be lit. */
let frameMaterial: MeshBasicMaterial | null = null;
let frameMesh: Mesh | null = null;
const frameBase = new Color(1, 1, 1);
// A cool over-white. The room has no lights at all, so "illuminated" has to be
// a multiplier on the baked texel rather than a light, anything below 1 would
// read as the frame going dim on hover, which is the opposite signal.
const frameLit = new Color(1.09, 1.13, 1.2);

let orchidBaseScale = 1;
let orchidBaseY = 0;

const add = (hotspot: Omit<Hotspot, "hover">) => {
  const box = hotspot.box;
  box.onClick = () => {
    // A box that has been collapsed because the hero is off screen cannot be
    // hit, but the guard is cheap and the failure mode, navigating to an
    // object page from halfway down the site, is bad.
    if (sceneWeights.hero < HERO_VISIBLE) return;
    router.push(hotspot.to);
  };
  box.hoverSound = "hover";
  raycast.boxesToCheck.push(box);
  hotspots.push({ ...hotspot, hover: 0 });
  if (hotspot.inspect) registerInspectTarget(hotspot.slug, box);
};

/**
 * ─── THE BOOKS ON THE SHELF OPEN THE LIBRARY ──────────────────────────────
 *
 * The third thing in the room worth asking about is not a prop with a page of
 * its own but the row of books beside the orchid: they open /library, the
 * reading archive. It was a pill in the navigation first and read as bolted
 * on; a shelf of books that is already in the scene is the way into a shelf
 * of books that is not.
 *
 * The books are part of the shelf mesh (board, books and, until
 * `hideShelfPlant` drops it, a pot plant), so their box is taken from the
 * geometry itself: every vertex the mesh still draws that sits above the
 * board's top. The board's own top vertices are at exactly that height and
 * stay out; the plant's are past the draw range and stay out. Measured once in
 * the shelf's own space and carried to world space each frame, the room group
 * is yawed by the hero timeline.
 */
const BOARD_TOP = 4.037;

let shelfMesh: Mesh | null = null;
let shelfMaterial: MeshBasicMaterial | null = null;
const booksLocal = new Box3();
const vertex = new Vector3();

const measureBooks = (shelf: Mesh) => {
  booksLocal.makeEmpty();
  const index = shelf.geometry.getIndex();
  const position = shelf.geometry.getAttribute("position");
  if (!index) return;
  const count = Math.min(index.count, shelf.geometry.drawRange.count);
  for (let i = 0; i < count; i++) {
    const v = index.getX(i);
    if (position.getY(v) <= BOARD_TOP + 0.01) continue;
    booksLocal.expandByPoint(vertex.set(position.getX(v), position.getY(v), position.getZ(v)));
  }
};

const init = (frame: Mesh | undefined, shelf: Mesh | undefined) => {
  if (hotspots.length) return;

  orchidBaseScale = orchid.group.scale.x;
  orchidBaseY = orchid.group.position.y;

  add({
    slug: "orchid",
    to: "/object/orchid",
    inspect: true,
    box: new Box3() as ClickableBox3,
    measure: (box) => {
      box.setFromObject(orchid.group);
      // The blooms are narrow and the leaves are thin; without this the plant
      // is only clickable on the few pixels a petal actually covers.
      box.expandByScalar(0.12);
    },
    apply: (hover) => {
      orchid.group.scale.setScalar(orchidBaseScale * (1 + hover * 0.045));
      orchid.group.position.y = orchidBaseY + hover * 0.025;
    },
  });

  if (frame) {
    // Cloned off the shared room material rather than off `frame.material`: this
    // module can be torn down and re-initialised, and the second run would
    // otherwise clone the disposed clone the first run left behind.
    frameMesh = frame;
    frameMaterial = (getRoomMaterial() as MeshBasicMaterial).clone();
    frame.material = frameMaterial;

    add({
      slug: "starry-night",
      to: "/object/starry-night",
      inspect: true,
      box: new Box3() as ClickableBox3,
      measure: (box) => {
        box.setFromObject(frame);
        box.expandByScalar(0.08);
      },
      apply: (hover) => {
        frameMaterial?.color.lerpColors(frameBase, frameLit, hover);
      },
    });
  }

  // QA-SHIM temporary, remove before ship, same gate as three/index.ts
  if (location.search.includes("qa=1")) (window as unknown as Record<string, unknown>).__hotspots = hotspots;

  if (!shelf) return;
  measureBooks(shelf);
  if (booksLocal.isEmpty()) return;

  // The same over-white lift the frame gets: the shelf shares the room's one
  // baked material, so a hover brightens the board with its books.
  shelfMesh = shelf;
  shelfMaterial = (getRoomMaterial() as MeshBasicMaterial).clone();
  shelf.material = shelfMaterial;

  add({
    slug: "library",
    to: "/library",
    inspect: false,
    box: new Box3() as ClickableBox3,
    measure: (box) => {
      shelf.updateWorldMatrix(true, false);
      box.copy(booksLocal).applyMatrix4(shelf.matrixWorld).expandByScalar(0.08);
    },
    apply: (hover) => {
      shelfMaterial?.color.lerpColors(frameBase, frameLit, hover);
    },
  });
};

const tick = () => {
  if (!hotspots.length) return;

  const visible = sceneWeights.hero >= HERO_VISIBLE;
  const hovering = raycast.getHoveringBox();
  const delta = gsap.ticker.deltaRatio(60);

  for (const hotspot of hotspots) {
    // An empty Box3 (min +Inf, max -Inf) never intersects a ray, so collapsing
    // it is how these stop being clickable once the room has scrolled away -
    // cheaper and harder to get wrong than adding and removing them from the
    // raycaster's list.
    if (visible) hotspot.measure(hotspot.box);
    else hotspot.box.makeEmpty();

    const goal = visible && hovering === hotspot.box ? 1 : 0;
    if (hotspot.hover === goal) continue;

    let next = lerp(hotspot.hover, goal, 0.16 * delta);
    if (Math.abs(next - goal) < 0.002) next = goal;
    hotspot.hover = next;
    hotspot.apply(next);
  }
};

const destroy = () => {
  for (const hotspot of hotspots) {
    const index = raycast.boxesToCheck.indexOf(hotspot.box);
    if (index !== -1) raycast.boxesToCheck.splice(index, 1);
  }
  hotspots.length = 0;

  if (frameMesh) frameMesh.material = getRoomMaterial();
  frameMaterial?.dispose();
  frameMaterial = null;
  frameMesh = null;
  if (shelfMesh) shelfMesh.material = getRoomMaterial();
  shelfMaterial?.dispose();
  shelfMaterial = null;
  shelfMesh = null;
};

export const hotspots3D = { init, tick, destroy };
