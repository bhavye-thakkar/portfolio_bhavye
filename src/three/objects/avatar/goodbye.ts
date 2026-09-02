import gsap from "gsap";

import { WALK_DURATION, walkSpeed } from "./walk-clip";

/**
 * The closing beat of the site: the avatar is standing in the contact scene
 * facing the visitor, then turns and walks off into the distance while the scene
 * fades. Everything here is state that `avatar/index.ts` reads in its contact
 * branch and `contact/shadow.ts` reads for the moving contact shadow, nothing
 * touches the scene graph directly, so the existing tick order is unchanged.
 *
 * Landscape/desktop only; `transitions/contact.ts` never arms it on portrait, so
 * the mobile ending keeps its current behaviour.
 */

/** roughly hip height to sole, in scene units, sets the stride/speed match */
const LEG_LENGTH = 3;
/** how far he gets before the fade has finished; the floor plane runs well past this */
const DISTANCE = 12.4;

const SPEED = walkSpeed(LEG_LENGTH);
const WALK_TIME = DISTANCE / SPEED;

export const state = {
  /** extra yaw on top of the contact rotation: 0 faces the visitor, PI faces away */
  yaw: 0,
  /** metres walked away from the standing spot, along -Z */
  distance: 0,
  /** blend of the walk action against contact-idle */
  walk: 0,
  /** 0 = baked contact shadow untouched, 1 = shadow fully follows the figure */
  shadow: 0,
  /** scene opacity, applied to the canvas element */
  fade: 1,
};

let timeline: gsap.core.Timeline | null = null;
let canvas: HTMLCanvasElement | null = null;

const reset = () => {
  state.yaw = 0;
  state.distance = 0;
  state.walk = 0;
  state.shadow = 0;
  state.fade = 1;
  if (canvas) canvas.style.opacity = "";
};

const build = () => {
  const tl = gsap.timeline({
    paused: true,
    onUpdate: () => {
      if (canvas) canvas.style.opacity = state.fade === 1 ? "" : String(state.fade);
    },
  });

  // 1. a beat of stillness, so the turn reads as a decision rather than a reflex.
  //    ponytail: no wave, the rig's `wave` clip is authored over the intro pose
  //    and blends against contact-idle's folded arms as a fidget, not a goodbye.
  //    The walk-away carries it instead.
  tl.to({}, { duration: 1.4 });

  // 2. turn away: slow in, slow out, no spin
  tl.to(state, { yaw: Math.PI, duration: 1.1, ease: "power2.inOut" }, "turn");
  // the legs pick up just before the turn finishes, the way a real turn-and-go looks
  tl.to(state, { walk: 1, duration: 0.5, ease: "none" }, "turn+=0.7");
  tl.to(state, { shadow: 1, duration: 0.4, ease: "none" }, "turn+=0.7");

  // 3. walk away at the speed the stride was built for, so the feet do not skate
  tl.to(state, { distance: DISTANCE, duration: WALK_TIME, ease: "none" }, "turn+=1.1");

  // 4. the scene dissolves into the page behind it once he is well away
  tl.to(state, { fade: 0, duration: WALK_TIME * 0.45, ease: "power1.in" }, `turn+=${1.1 + WALK_TIME * 0.55}`);

  return tl;
};

const init = (element: HTMLCanvasElement | null) => {
  canvas = element;
};

/**
 * Safety net for the shared canvas: the fade only ever belongs to the contact
 * scene, so whenever that scene is off stage the canvas goes back to full
 * opacity. Without it, leaving the ending mid-fade (a jump to the top, a route
 * change) could strand every other scene behind a faded canvas.
 */
const clearFade = () => {
  if (canvas && canvas.style.opacity !== "") canvas.style.opacity = "";
};

/** Plays the goodbye from wherever it is; safe to call repeatedly. */
const play = () => {
  if (!timeline) timeline = build();
  timeline.play();
};

/** Rewinds it when the visitor scrolls back up into the contact section. */
const rewind = () => {
  if (!timeline) return;
  timeline.reverse();
};

const destroy = () => {
  timeline?.kill();
  timeline = null;
  canvas = null;
  reset();
};

export const goodbye = { init, play, rewind, destroy, state, reset, clearFade, WALK_DURATION };
