import { avatar } from "./avatar";
import { avatarHologram } from "./avatar/hologram";
import { contact } from "./contact";
import { darkPlane } from "./dark-plane";
import { gridFloor } from "./grid-floor";
import { lab } from "./lab";
import { room } from "./room";
import { sleepingSprite } from "./contact/sleeping-sprite";
import { workstation } from "./workstation";
import { renderer } from "../core/renderer";

/**
 * ─── STAGED INIT ──────────────────────────────────────────────────────────
 *
 * Building every object and compiling every shader used to happen in ONE
 * synchronous block inside the resources "ready" handler. Downloads finished
 * in under a second and the preloader then sat on a frozen main thread for
 * the whole of that block — the entire "loading takes too long" complaint
 * was this, not the network.
 *
 * `initHero` is only what the first visible frame needs: the room and the
 * avatar sitting in it. Everything else exists as module-scope groups the
 * timelines can already tween, and assembles one group per frame behind the
 * preloader's fade — ordered by how soon scrolling can reach it (About's
 * stage first, Contact's last). The full shader compile runs at the end,
 * async, so a first scroll is warm without ever blocking boot.
 *
 * NOTHING here is allowed to gate the preloader. A shader link blocks the
 * main thread, so anything the preloader waits on is time its own animation
 * cannot run — the fill stopped animating entirely when it waited on a
 * hero compile. The hero's materials compile on the first render, the way
 * they always did; the win is that only the hero is in the scene at that
 * point instead of all nine object groups.
 */
const initHero = () => {
  // The hologram must exist before the avatar: avatar's animations module
  // builds clip actions against the hologram mesh in the same init.
  avatarHologram.init();
  avatar.init();
  room.init();
};

let deferId = 0;

const initDeferred = () => {
  const runId = ++deferId;
  const stages: (() => void)[] = [
    () => {
      gridFloor.init();
      darkPlane.init();
    },
    () => lab.init(),
    () => workstation.init(),
    () => {
      contact.init();
      sleepingSprite.init();
    },
    () => void renderer.compile().catch(() => {}),
  ];

  let index = 0;
  const step = () => {
    if (runId !== deferId) return;
    stages[index++]!();
    if (index < stages.length) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};

const destroy = () => {
  deferId++;
  avatarHologram.destroy();
  avatar.destroy();
  contact.destroy();
  darkPlane.destroy();
  gridFloor.destroy();
  lab.destroy();
  room.destroy();
  sleepingSprite.destroy();
  workstation.destroy();
};

export const objects = { initHero, initDeferred, destroy };
