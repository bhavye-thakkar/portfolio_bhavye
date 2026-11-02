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
import { resources } from "../../utils/resources";

/**
 * ─── STAGED INIT ──────────────────────────────────────────────────────────
 *
 * Building every object and compiling every shader used to happen in ONE
 * synchronous block inside the resources "ready" handler. Downloads finished
 * in under a second and the preloader then sat on a frozen main thread for
 * the whole of that block, the entire "loading takes too long" complaint
 * was this, not the network.
 *
 * `initHero` is only what the first visible frame needs: the room and the
 * avatar sitting in it. Everything else exists as module-scope groups the
 * timelines can already tween, and assembles one group per frame behind the
 * preloader's still name, ordered by how soon scrolling can reach it (About's
 * stage first, Contact's last). The full shader compile runs at the end,
 * async, so a first scroll is warm without ever blocking boot.
 *
 * Nothing here may gate the walk: a shader link blocks the main thread, and
 * the fill of an older loader stopped animating entirely while it waited on a
 * hero compile. All of it runs after the door is gone, on a still name, and
 * the name's flight waits for the last group and the compile (capped,
 * usePreloader), so their long tasks never land under a moving frame. The
 * hero's materials compile on the first render, the way they always did; the
 * win is that only the hero is in the scene at that point instead of all nine
 * object groups.
 */
const initHero = () => {
  // The hologram must exist before the avatar: avatar's animations module
  // builds clip actions against the hologram mesh in the same init.
  avatarHologram.init();
  avatar.init();
  room.init();
};

let deferId = 0;
/** Settles once the last group is in and the compile is done; usePreloader holds the name's flight for it. */
let deferred: Promise<void> = Promise.resolve();

const initDeferred = () => {
  const runId = ++deferId;
  const stages: (() => unknown)[] = [
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
    // Every file texture still on its way to the GPU. Contact's 1024px atlas decoded
    // and uploaded on the frame Contact first scrolled in, the longest stall of a
    // first scroll (172 ms on an 8x-slowed phone profile, gone on the second). After
    // the groups: their inits set flipY and colour space, which an upload bakes in.
    () => {
      for (const item of Object.values(resources.items)) if (item?.isTexture) renderer.getInstance().initTexture(item);
    },
    () => renderer.compile().catch(() => {}),
  ];

  deferred = new Promise<void>((resolve) => {
    let index = 0;
    const step = () => {
      if (runId !== deferId) return resolve();
      const result = stages[index++]!();
      if (index < stages.length) requestAnimationFrame(step);
      else void Promise.resolve(result).then(() => resolve());
    };
    requestAnimationFrame(step);
  });
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

export const objects = { initHero, initDeferred, destroy, deferred: () => deferred };
