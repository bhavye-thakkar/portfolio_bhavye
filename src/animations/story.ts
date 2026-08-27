import gsap from "gsap";
import { ref, nextTick } from "vue";
import { Vector3 } from "three";
import { sceneWeights, sceneWeightsInOut, stageHold } from "./scenes";
import { waypoints } from "./waypoints";
import { camera } from "../three/core/camera";
import { avatar } from "../three/objects/avatar";
import { lab } from "../three/objects/lab";
import { workstation } from "../three/objects/workstation";
import { screens } from "../three/objects/workstation/screens";
import { sizes } from "../utils/sizes";

import type { StoryChapterKey } from "../content/experience";

/**
 * ─── STORY MODE ───────────────────────────────────────────────────────────
 *
 * The /experience/:slug page reuses the whole Experience stage — same avatar,
 * same workstation, same grid floor — and drives it one pose per chapter
 * instead of by scrub. Nothing new is loaded or built.
 *
 * Two things make that safe. `storyActive` tells the home sections to tear
 * their scroll timelines down — the home wrapper goes `position: fixed` while
 * this page owns the document scroll, so every cached start/end those triggers
 * hold becomes a lie — and `stageHold` freezes the weight solver. The story
 * then sets the stage by hand, which also means a cold deep-link lands on the
 * same picture as an in-page click.
 *
 * The camera framings are the only new numbers here: he stands, sits, and is
 * seen from a different side per chapter, which is the whole of the avatar
 * storytelling — no new clips, no second rig.
 */

type Pose = {
  position: [number, number, number];
  focus: [number, number, number];
  /** Which of the two monitor scenarios is up. */
  blend: number;
};

/**
 * ── HE STAYS SEATED, ALL SIX CHAPTERS. ───────────────────────────────────
 *
 * Three of these poses used to stand him up. His root is the chair, and the
 * desk is measured off his *seated* pose, so standing put his hips through the
 * desk top and left the chair empty underneath him — and getting there meant
 * cross-fading `desktop-idle` into `t-idle`, which passes through a half-
 * sitting hover that reads as floating. The rig has no stand-up and no walk
 * that could sell the move honestly. So the camera does the storytelling and
 * he does not leave his desk.
 *
 * ── CLEARING THE FURNITURE ───────────────────────────────────────────────
 *
 * He sits at (0, 0, 6) facing +Z with the desk in front of him, so any camera
 * in front of him has to get past the two monitors. They sit at z 7.78 and
 * cover world x −2.42…−0.22 and 0.22…2.42, and their tops (y 3.03) are *above*
 * his seated head (y 2.5) — height alone never clears them. The ray from a
 * front camera crosses that plane at
 *
 *   x = cameraX · (7.78 − focusZ) / (cameraZ − focusZ)
 *
 * and every front pose below keeps that outside ±2.42; the rest look over a
 * shoulder from behind, where nothing is in the way. Nudging one of these
 * closer without re-checking is how a chapter ends up framed through a screen.
 *
 * Focus heights are the seated figure's: head y ≈ 2.5, desk top y = 1.5, so
 * aiming at ~2.3 puts his head in the upper third. Anything aimed at 2.8 was
 * framing a standing head that is no longer there.
 */
const LANDSCAPE: Record<StoryChapterKey, Pose> = {
  // Wide from his front-left: the bay is a place across the room. Clears the
  // right monitor at x −2.86.
  discovery: { position: [-7.6, 3.2, 9.9], focus: [0, 2.3, 6.5], blend: 0 },
  // Over the right shoulder — the applying-at-a-laptop beat. Behind him, so
  // there is nothing in the way.
  application: { position: [-5.2, 4.6, 1.2], focus: [0.4, 2.3, 7.0], blend: 0 },
  // From across the corner of the desk: the interview table. Clears at x 2.85.
  interview: { position: [9.6, 3.6, 8.4], focus: [0.35, 2.3, 6.2], blend: 0 },
  // Camera almost level with his eyeline. The one beat allowed to be
  // triumphant. Clears at x −3.02.
  hired: { position: [-7.0, 2.5, 9.6], focus: [0, 2.35, 6.4], blend: 0 },
  // Over the other shoulder, second scenario on the monitors: the work itself.
  experience: { position: [3.6, 4.2, 2.4], focus: [-0.6, 2.3, 7.0], blend: 1 },
  // Back and high — the chapter closes and the room gets its scale back.
  // Clears at x 2.83.
  learned: { position: [8.6, 4.6, 10.6], focus: [0, 2.3, 6.4], blend: 1 },
};

/**
 * Portrait holds far less width at the same distance, so every camera backs off
 * along its own axis. Same axis means the sight lines that were cleared above
 * stay cleared — and it is one number rather than a second table to keep in
 * sync, which is how the first pass at this ended up with four chapters framed
 * through a monitor.
 */
const PORTRAIT_PULLBACK = 1.6;

const poseFor = (chapter: StoryChapterKey): Pose => {
  const pose = LANDSCAPE[chapter];
  if (sizes.isLandscape) return pose;

  const [px, py, pz] = pose.position;
  const [fx, fy, fz] = pose.focus;
  return {
    ...pose,
    position: [
      fx + (px - fx) * PORTRAIT_PULLBACK,
      fy + (py - fy) * PORTRAIT_PULLBACK,
      fz + (pz - fz) * PORTRAIT_PULLBACK,
    ],
  };
};

/**
 * The story copy owns part of the frame, so the camera is aimed off the avatar
 * and he lands in the part that is left: right of the column in landscape, above
 * it in portrait. Framing is kept out of the pose numbers above, which are
 * staging.
 *
 * The offsets are fractions of the frame, not world units — the poses range
 * from arm's length over a shoulder to across the room, and a fixed world
 * offset that clears the text in the wide shot throws him off-screen in the
 * close one.
 *
 * Shifting the focus by `k × halfHeight` moves the subject by `k / 2` of the
 * FULL frame, since the frame is two half-heights tall. That factor of two is
 * what made portrait wrong: 0.26 lifted him only 13%, landing him at 37% of the
 * frame — under the copy, where the portrait scrim is already 0.94 opaque and
 * the chapter text runs straight across his face. The scrim is built to keep
 * the top ~24% clear for him, so the lift has to be ~0.6 to put him there.
 */
const FRAME_SHIFT_X = 0.55;
const FRAME_SHIFT_Y = 0.6;
const UP = new Vector3(0, 1, 0);
const forward = new Vector3();
const right = new Vector3();
const camUp = new Vector3();

const framedFocus = (pose: Pose, out: Vector3) => {
  out.set(pose.focus[0], pose.focus[1], pose.focus[2]);

  forward.set(pose.position[0], pose.position[1], pose.position[2]).sub(out).negate();
  const distance = forward.length();
  forward.normalize();

  const halfHeight = Math.tan((camera.instance.fov * Math.PI) / 360) * distance;

  if (sizes.isLandscape) {
    right.crossVectors(forward, UP).normalize();
    return out.addScaledVector(right, -FRAME_SHIFT_X * halfHeight * camera.instance.aspect);
  }

  // Portrait stacks the copy under the avatar instead of beside him, so he is
  // lifted rather than pushed sideways.
  right.crossVectors(forward, UP).normalize();
  camUp.crossVectors(right, forward).normalize();
  return out.addScaledVector(camUp, -FRAME_SHIFT_Y * halfHeight);
};

/**
 * Reactive so the home sections can drop their scroll timelines while the story
 * runs and rebuild them on the way out. Read it in a `watchEffect` and the
 * teardown comes free.
 */
export const storyActive = ref(false);

let isActive = false;
let tween: gsap.core.Timeline | null = null;
const target = new Vector3();

/** Everything the home timelines would normally have scrubbed into place. */
const setStage = () => {
  for (const key of Object.keys(sceneWeights) as (keyof typeof sceneWeights)[]) {
    sceneWeights[key] = key === "experience" ? 1 : 0;
  }
  // The avatar reads ambient light and the grid floor reads its opacity off
  // About's `in`, which never ran on a deep link.
  sceneWeightsInOut.about.in = 1;
  sceneWeightsInOut.about.out = 0;

  avatar.waypointsPosition.set(0, 0, 6);
  avatar.waypointsRotation.set(0, -Math.PI, 0);
  avatar.tIdleIntensity.value = 1;
  // The whole page is him at his desk, so this is a stage fact rather than a
  // per-chapter one. Setting it here is also what makes a cold deep-link land
  // seated: `seated` starts at 0, and the Experience in-timeline that normally
  // raises it never ran.
  avatar.seated.value = 1;
  avatar.materialise.value = 1;
  workstation.reveal.value = 1;
  workstation.group.scale.set(1, 1, 1);
  // The Experience in-timeline is what shrinks the About lab pod away, and
  // tearing that timeline down puts it back at full size — with its progress
  // counter sitting in the middle of the office floor.
  lab.group.scale.set(0.001, 0.001, 0.001);
};

const applyStage = (chapter: StoryChapterKey, snapPose: boolean) => {
  setStage();
  if (!snapPose) return;

  const pose = poseFor(chapter);
  waypoints.position.set(pose.position[0], pose.position[1], pose.position[2]);
  waypoints.focus.copy(framedFocus(pose, target));
  screens.state.blend = pose.blend;
};

const enter = (chapter: StoryChapterKey) => {
  if (isActive) return;
  isActive = true;
  storyActive.value = true;
  stageHold.value = true;

  // A visitor arriving from the section already has a camera somewhere in this
  // office, so the first chapter is a move rather than a cut. A cold deep-link
  // has the camera at the origin, where a "move" would start from nowhere.
  const cold = waypoints.position.lengthSq() < 0.001;

  applyStage(chapter, cold);
  // The home sections tear their timelines down on this flush, and a reverted
  // matchMedia puts the values it recorded back. Stamp the stage again once
  // that has happened — same microtask turn, so nothing paints in between.
  nextTick(() => {
    applyStage(chapter, cold);
    // Longer than a chapter-to-chapter move (1.1s): this one is the arrival,
    // and it runs under the masthead fading in rather than competing with it.
    if (!cold) goTo(chapter, 1.8);
  });
};

/** A camera move is motion whether or not it is made of CSS. */
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const goTo = (chapter: StoryChapterKey, duration = 1.1) => {
  if (!isActive) return;
  if (reducedMotion()) duration = 0;
  const pose = poseFor(chapter);

  framedFocus(pose, target);

  tween?.kill();
  tween = gsap.timeline({ defaults: { duration, ease: "power2.inOut", overwrite: "auto" } });
  tween.to(waypoints.position, { x: pose.position[0], y: pose.position[1], z: pose.position[2] }, 0);
  tween.to(waypoints.focus, { x: target.x, y: target.y, z: target.z }, 0);
  // The monitors change under the move rather than after it, so the new
  // scenario is already up by the time the shot settles.
  tween.to(screens.state, { blend: pose.blend, duration: duration * 0.5 }, 0);
};

/** Re-frames the current chapter after an orientation change. */
const reframe = (chapter: StoryChapterKey) => {
  if (!isActive) return;
  goTo(chapter, 0.4);
};

/**
 * Hands the stage back. The caller owns what happens next — the home sections
 * rebuild their timelines on the following flush, and only then is it worth
 * refreshing ScrollTrigger and restoring the scroll position.
 */
const exit = () => {
  if (!isActive) return;
  isActive = false;

  tween?.kill();
  tween = null;

  stageHold.value = false;
  storyActive.value = false;
};

export const story = { enter, exit, goTo, reframe, getIsActive: () => isActive };
