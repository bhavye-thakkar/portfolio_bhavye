import { Box3, Color, Mesh, MeshBasicMaterial } from "three";
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
    router.push(`/object/${hotspot.slug}`);
  };
  box.hoverSound = "hover";
  raycast.boxesToCheck.push(box);
  hotspots.push({ ...hotspot, hover: 0 });
  registerInspectTarget(hotspot.slug, box);
};

const init = (frame: Mesh | undefined) => {
  if (hotspots.length) return;

  orchidBaseScale = orchid.group.scale.x;
  orchidBaseY = orchid.group.position.y;

  add({
    slug: "orchid",
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

  if (!frame) return;

  // Cloned off the shared room material rather than off `frame.material`: this
  // module can be torn down and re-initialised, and the second run would
  // otherwise clone the disposed clone the first run left behind.
  frameMesh = frame;
  frameMaterial = (getRoomMaterial() as MeshBasicMaterial).clone();
  frame.material = frameMaterial;

  add({
    slug: "starry-night",
    box: new Box3() as ClickableBox3,
    measure: (box) => {
      box.setFromObject(frame);
      box.expandByScalar(0.08);
    },
    apply: (hover) => {
      frameMaterial?.color.lerpColors(frameBase, frameLit, hover);
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
};

export const hotspots3D = { init, tick, destroy };
