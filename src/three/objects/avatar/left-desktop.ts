import gsap from "gsap";
import { animations as avatarAnimations } from "./animations";
import { desktops } from "../room/desktops";
import { sceneWeights, stageHold } from "../../../animations/scenes";
import { messagePopup } from "../room/message-popup";
import { sizes } from "../../../utils/sizes";
import { playSound } from "../../../features/sounds/utils/sounds";
import { sprites } from "../../../features/sounds/definitions/sprites";

let ctx: gsap.Context | null = null;
let currentId: number | undefined;
const isActive = { value: false };

const INTERVAL_DURATION = 7;

/**
 * Hero room, visible tab, nobody else driving the rig. Checked both to start a
 * glance and, every frame, to keep one running, see the timeline below.
 */
const onScreen = () => sceneWeights.hero > 0.95 && sizes.visible && !stageHold.value;

const init = () => {
  startInterval();
  sizes.on("show", handleWindowVisible);
};

const handleWindowVisible = () => {
  if (!isActive.value) return;
  if (currentId) {
    sprites.room.howl.stop(currentId);
    currentId = undefined;
  }
};

const startInterval = () => {
  const { actions } = avatarAnimations;
  const leftDesktop = actions.get("left-desktop");
  const idle = actions.get("desktop-idle");
  if (!leftDesktop || !idle) return;
  const clip = leftDesktop.getClip();

  if (ctx) ctx.kill();

  const calcDelay = () => {
    return Math.floor(INTERVAL_DURATION + Math.random() * 6 + clip.duration);
  };

  const playAnimation = () => {
    const delay = calcDelay();
    gsap.delayedCall(delay, playAnimation);

    // Hero only. This used to fire during Experience too, and it is why the
    // establishing shot kept getting caught as the back of his head: the clip
    // clamps him 70° left for seconds at a time, at random, on whatever beat
    // the visitor happens to be reading. It also called the HERO room's
    // message popup and desktop message while that room was nowhere on
    // stage. Experience's gaze is deterministic now, per-beat, in
    // avatar/index.ts, and the story page plays this clip itself on the
    // chapters where the glance IS the beat.
    // ...but NOT while a detail page owns the stage. The story page fires this
    // same clip deliberately, on the chapters where looking at the other screen
    // is the beat; a random one landing on top of it makes the avatar look
    // twitchy and makes the chapter motion non-deterministic.
    if (!onScreen()) return;

    // ── THE GUARD ABOVE IS A START CONDITION, NOT A RUNNING ONE ───────────
    //
    // It was the only check, and the clip runs for several real seconds after
    // it passes. Scroll fast out of the hero inside that window and the glance
    // kept playing through the handover: he arrived at the Experience desk
    // latched ~70° left, with the per-beat gaze in avatar/index.ts stacking its
    // own yaw on top of an already-turned head, and the keyboard sound firing
    // in a room that was no longer on screen. Slow scrolling hid it, the clip
    // had time to finish. So the stage leaving ends the beat, mid-clip.
    const stop = () => {
      avatarAnimations.play("desktop-idle", 0.3);
      isActive.value = false;
      if (currentId) {
        sprites.room.howl.stop(currentId);
        currentId = undefined;
      }
    };

    const tl = gsap.timeline({
      duration: clip.duration + 0.2,
      onUpdate: () => {
        if (onScreen()) return;
        tl.kill();
        stop();
      },
      onComplete: stop,
    });

    isActive.value = true;

    tl.add(() => {
      avatarAnimations.play("left-desktop", 0.3);
    }, 0.2);

    if (currentId) {
      sprites.room.howl.stop(currentId);
      currentId = undefined;
    }

    tl.add(() => {
      currentId = playSound("keyboard");
    }, 1.6);

    desktops.showMessage();
    messagePopup.show();
  };

  ctx = gsap.context(() => {
    const initialDelay = calcDelay();
    gsap.delayedCall(initialDelay, playAnimation);
  });
};

const destroy = () => {
  ctx?.kill();
  ctx = null;
  sizes.off("show", handleWindowVisible);
};

export const leftDesktop = { init, destroy, getIsActive: () => isActive.value };
