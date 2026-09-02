import gsap from "gsap";
import { Vector3 } from "three";
import { Box3 } from "three";
import { stageHold } from "./scenes";
import { waypoints } from "./waypoints";
import { framedFocus } from "./story";
import { sizes } from "../utils/sizes";
import { objectBySlug } from "../content/objects";

/**
 * ─── INSPECT MODE ─────────────────────────────────────────────────────────
 *
 * Clicking the orchid or the painting opens `/object/<slug>`, and this is the
 * camera half of that: it walks the hero camera up to the object and holds it
 * there while the panel reads over the top, then walks it back.
 *
 * ── WHY THIS IS SO MUCH SMALLER THAN `story.ts` ───────────────────────────
 *
 * The Experience story replaces the home page: home goes `position: fixed`,
 * the story takes the document scroll, and every ScrollTrigger on the page is
 * left measuring a layout that is no longer there, hence the teardown flag,
 * the stage-setting by hand and the scroll restore.
 *
 * None of that happens here. The object panel is a layer over a home page
 * that stays exactly where it is, with Lenis stopped so it cannot scroll
 * underneath. Both objects only exist in the hero shot, which is where the
 * page already is when they are clicked, so the stage needs no setting, only
 * the camera moves.
 *
 * The one thing that IS needed is `stageHold`: the waypoint solver rebuilds
 * the camera from the scene weights every frame and would overwrite this
 * tween on the next tick.
 *
 * ── THE POSE IS COMPUTED, NOT TYPED IN ────────────────────────────────────
 *
 * The room group is yawed in the hero, and both objects are positioned in its
 * local space, so a hard-coded camera would quietly point at the wrong wall
 * the first time that transform changed. Instead the hotspots hand over the
 * object's live world-space box and the camera is derived from it: back off
 * along the line the hero camera already looks down, so the move reads as
 * stepping closer to something rather than cutting to a new angle.
 */

/** Filled by `three/objects/room/hotspots.ts` once the room is built. */
const targets = new Map<string, Box3>();

/**
 * A cold deep link to `/object/orchid` asks for the camera before the room
 * model has even downloaded, so `enter` records what it wanted and the
 * registration completes it. Nothing else needs to know about load order.
 */
let pendingSlug: string | null = null;

export const registerInspectTarget = (slug: string, box: Box3) => {
  targets.set(slug, box);
  if (pendingSlug !== slug) return;
  pendingSlug = null;
  enter(slug);
};

const centre = new Vector3();
const heroEye = new Vector3();
const direction = new Vector3();

type Pose = { position: [number, number, number]; focus: [number, number, number] };

const poseFor = (slug: string): Pose | null => {
  const box = targets.get(slug);
  const entry = objectBySlug(slug);
  if (!box || !entry || box.isEmpty()) return null;

  box.getCenter(centre);

  const hero = sizes.isLandscape ? waypoints.points.landscape.hero : waypoints.points.portrait.hero;
  heroEye.set(hero.position.x, hero.position.y, hero.position.z);

  // Straight back along the hero's own sight line. If the object somehow sits
  // exactly under the camera there is no line to back off along, so fall back
  // to the hero eye itself rather than dividing by zero.
  direction.subVectors(heroEye, centre);
  if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
  direction.normalize();

  // Portrait holds far less width at the same distance, so it stands further
  // back along the same line, one number, not a second table of poses.
  const distance = entry.framing.distance * (sizes.isLandscape ? 1 : 1.45);

  return {
    position: [
      centre.x + direction.x * distance,
      centre.y + direction.y * distance,
      centre.z + direction.z * distance,
    ],
    focus: [centre.x, centre.y + entry.framing.height, centre.z],
  };
};

let isActive = false;
/**
 * ── THE POSE IS RE-EVALUATED EVERY FRAME, NOT BAKED INTO A TWEEN ──────────
 *
 * The first version tweened `waypoints` to a pose computed once, at the moment
 * the panel opened. On a click that is fine, the hotspot boxes have been
 * measured for thousands of frames by then. On a COLD DEEP LINK it was not:
 * `/object/orchid` asks for the camera while the room group is still at
 * identity, so the box came back in local coordinates, the camera flew to a
 * point ~5 units from where the orchid actually is, and the panel opened on an
 * empty cream wall. Nothing ever recomputed it, because the tween had already
 * been built.
 *
 * So there is no tween. A ticker reads the live box every frame and eases the
 * camera toward it. Whenever the room's transform settles, the target simply
 * becomes correct and the camera follows, no ordering to get right, and
 * `reframe` on an orientation change comes free.
 */
const target = new Vector3();
const desired = new Vector3();

/**
 * Per-frame approach rate, as the fraction of the remaining distance covered
 * in one 60fps frame. Scaled by `deltaRatio` so a 144Hz screen and a 30fps one
 * take the same wall-clock time to arrive.
 */
const APPROACH = 0.055;
const RETURN = 0.075;
/** Close enough to stop: about a centimetre in room units. */
const ARRIVED = 0.01;

let activeSlug: string | null = null;
let returning = false;
/**
 * `gsap.ticker.add` does not de-duplicate, and reopening a panel while the
 * previous one is still easing home would have registered `tick` a second
 * time, two camera solvers fighting over the same vector, forever.
 */
let ticking = false;
/** Set when the camera has nowhere to move FROM, a cold deep link. */
let snapNext = false;

/** Where the camera was standing when the panel opened, so closing goes back. */
const returnPosition = new Vector3();
const returnFocus = new Vector3();

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const approach = (goalPosition: Vector3, goalFocus: Vector3, rate: number) => {
  if (snapNext || reducedMotion()) {
    waypoints.position.copy(goalPosition);
    waypoints.focus.copy(goalFocus);
    snapNext = false;
    return true;
  }

  const step = Math.min(1, rate * gsap.ticker.deltaRatio(60));
  waypoints.position.lerp(goalPosition, step);
  waypoints.focus.lerp(goalFocus, step);
  return waypoints.position.distanceToSquared(goalPosition) < ARRIVED * ARRIVED;
};

const tick = () => {
  if (returning) {
    if (!approach(returnPosition, returnFocus, RETURN)) return;
    // The solver is handed back only once the camera is home. Releasing it
    // early resumes it from wherever the scroll says the camera should be,
    // and the last frame of the return becomes a jump cut.
    stageHold.value = false;
    returning = false;
    stopTick();
    return;
  }

  if (!activeSlug) return;
  const pose = poseFor(activeSlug);
  // No pose yet means the room has not been built or measured. Hold the frame
  // rather than moving somewhere wrong; the next tick tries again.
  if (!pose) return;

  desired.set(pose.position[0], pose.position[1], pose.position[2]);
  // Same off-centre framing the story pages use, so the object lands beside
  // the copy rather than under it.
  framedFocus(pose, target);
  approach(desired, target, APPROACH);
};

const startTick = () => {
  if (ticking) return;
  ticking = true;
  gsap.ticker.add(tick);
};

const stopTick = () => {
  if (!ticking) return;
  ticking = false;
  gsap.ticker.remove(tick);
};
const enter = (slug: string) => {
  if (isActive) return;
  isActive = true;
  activeSlug = slug;
  returning = false;

  // Remember the hero framing before freezing, so `exit` has somewhere to
  // return to. On a cold deep link that is the origin, which is also the
  // signal that there is no shot to move away from: a "move" from there is a
  // swoop up out of the floor, so the first framed frame is a cut instead.
  returnPosition.copy(waypoints.position);
  returnFocus.copy(waypoints.focus);
  snapNext = waypoints.position.lengthSq() < 0.001;

  stageHold.value = true;
  startTick();
};

const exit = () => {
  // A close that arrives before the scene finished loading still has to clear
  // the request, or the model landing later would open the panel's camera move
  // on a page that is no longer on that route.
  pendingSlug = null;
  if (!isActive) return;
  isActive = false;
  activeSlug = null;

  // A cold deep link closed before it ever framed anything has no hero shot
  // recorded, the solver's own answer is better than the origin.
  if (returnPosition.lengthSq() < 0.001) {
    stageHold.value = false;
    stopTick();
    return;
  }

  returning = true;
  snapNext = false;
};

export const inspect = { enter, exit, getIsActive: () => isActive };
