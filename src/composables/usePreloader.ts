import { ref, onMounted } from "vue";
import gsap from "gsap";
import { resources } from "../utils/resources";
import { renderer, webglAvailable, webglSoftware } from "../three/core/renderer";
import { three } from "../three";
import { loaderAvatar } from "../three/loader-avatar";
import { projectVisible } from "./useRouteObserver";

/**
 * True while the loader covers the page. It flips as the exit wipe starts,
 * which is when Home's own entrance (the hero banner) should play: the wipe
 * uncovers it mid-animation instead of after it has finished unseen.
 */
export const preloaderVisible = ref(true);

/**
 * True once every asset is in and the door has gone, while the loader still
 * covers the page. Home starts rendering on this, so the wipe uncovers a
 * finished room rather than an empty beige page.
 */
export const preloaderLoaded = ref(false);

/**
 * ─── THE OPENING ──────────────────────────────────────────────────────────
 *
 *   shut → push → (the name alone) → boot → exit
 *
 * One function, top to bottom, each state entered once. What the markup does
 * in each is documented with the styles in index.html; how the avatar moves is
 * loader-avatar.ts. The door is ONE linear animation from shut to off the far
 * edge, with him on it the whole way, and his legs follow its distance, so
 * his feet cannot slide and he cannot be dragged. It never pauses: on a slow
 * connection he walks off and the name waits alone, as the reference does.
 */

/** Keep in step with the transition in index.html. */
const EXIT_MS = 600;
/**
 * How long the door waits, shut, for the avatar before it opens without him.
 * His files are the first wave of the download, so this only runs out on a bad
 * connection or a mount that hangs; a mount that FAILS is known at once.
 */
const ARRIVE_CAP_MS = 2500;
/**
 * The door's speed, as a share of the viewport width a second: the reference's
 * curtain crosses in about two and a half seconds. His legs follow at one cycle
 * per stride, so on a screen wide for his size that would be a scramble and on
 * a phone a stroll: the speed is clamped to keep his cadence, in cycles (two
 * steps) a second, between a brisk walk and a hurry.
 */
const DOOR_SHARE = 0.45;
const MIN_CADENCE = 1.4;
const MAX_CADENCE = 2.4;
/**
 * The scene boots once this much of him is off the far edge. Its long tasks
 * would freeze whatever is left of him, and a sliver of a trailing heel at the
 * edge of the screen is not worth the half second a full exit would add.
 */
const GONE_ENOUGH = 0.85;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves once the renderer has drawn a real frame, so the frame the wipe
 * starts in already carries the room. Checked on the ticker after the
 * renderer's own tick, which renders in the same callback.
 *
 * Counted frames rather than the canvas turning visible: the renderer hides its
 * canvas until the camera has a pose, but a story deep link poses the camera
 * before the scene exists, the canvas is never hidden, and a wait for it to
 * turn visible sat out the whole cap.
 */
const firstFrame = () =>
  new Promise<void>((resolve) => {
    // A cold link to a project page keeps the renderer switched off, and a
    // browser without WebGL never gets one: no frame is coming.
    if (projectVisible.value || !webglAvailable) return resolve();

    const start = performance.now();
    const check = () => {
      let drawn = false;
      try {
        const instance = renderer.getInstance();
        drawn = instance.info.render.frame > 0 && instance.domElement.style.visibility !== "hidden";
      } catch {
        // not initialised yet
      }
      // ponytail: a lost context or a stalled compile must never hold the loader up.
      // A CPU renderer needs seconds for that first frame, and the name card it
      // waits on is a better thing to look at than an empty page.
      if (!drawn && performance.now() - start < (webglSoftware ? 12000 : 2500)) return;
      gsap.ticker.remove(check);
      resolve();
    };
    gsap.ticker.add(check);
  });

/** Resolves when every asset is in. */
const assets = () =>
  new Promise<void>((resolve) => {
    if (resources.isReady) return resolve();
    // "progress" reaches 1 just before "ready" fires, and ahead of the scene's
    // own ready handler: a throw in there cannot strand the loader.
    const onProgress = (progress: number) => {
      if (progress < 1) return;
      resources.off("progress", onProgress);
      resolve();
    };
    resources.on("progress", onProgress);
  });

export const usePreloader = () => {
  onMounted(async () => {
    const root = document.querySelector<HTMLElement>(".preloader");
    const curtain = root?.querySelector<HTMLElement>(".preloader-curtain");
    const canvas = root?.querySelector<HTMLCanvasElement>(".preloader-avatar canvas");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loaded = assets();

    // The scene may boot, and Home render, only once nothing of his is left on
    // screen to stutter: the boot is a run of long tasks (see three/index.ts).
    const boot = async () => {
      three.bootNow();
      preloaderLoaded.value = true;
      await firstFrame();
    };
    const exit = async (ms: number) => {
      preloaderVisible.value = false;
      document.body.classList.remove("is-loading");
      root?.classList.add("preloader-exit");
      await wait(ms);
      root?.remove();
    };

    // No door, no walk: the name is simply there, and leaves with a fade.
    if (!root || !curtain || reduced) {
      await loaded;
      await boot();
      return exit(400);
    }

    // ── shut: the door waits for him ──
    // A failed mount resolves to null at once and nothing waits for it. Without
    // WebGL the mount is a sheet of his pre-rendered frames (loader-avatar.ts).
    const mounting = canvas ? loaderAvatar.mount(canvas).catch(() => null) : Promise.resolve(null);
    const walker = await Promise.race([mounting, wait(ARRIVE_CAP_MS).then(() => null)]);
    if (walker) root.classList.add("preloader-live");
    // The door left without him: he joins it in plain sight, so he fades in.
    else void mounting.then((late) => late && root.classList.add("preloader-late", "preloader-live"));

    // ── push: one linear move, at the pace of his legs, to off the far edge ──
    root.classList.add("preloader-arrive");
    const width = window.innerWidth;
    const share = DOOR_SHARE * width;
    const cycle = walker?.cyclePx() ?? 0;
    const speed = walker ? Math.min(MAX_CADENCE * cycle, Math.max(MIN_CADENCE * cycle, share)) : share;
    // the door across the screen, and him off the far edge behind it
    const box = root.querySelector(".preloader-walker")!.getBoundingClientRect();
    const distance = width - box.left;
    curtain.animate([{ transform: "translateX(0)" }, { transform: `translateX(${distance}px)` }], {
      duration: (distance / speed) * 1000,
      easing: "linear",
      fill: "both",
    });
    await Promise.all([wait(((distance - (1 - GONE_ENOUGH) * box.width) / speed) * 1000), loaded]);

    // ── the name alone ──
    await boot();

    // ── exit ──
    await exit(EXIT_MS);
    // only ever resolved, never rejected; the loader's context goes with it
    (await mounting)?.dispose();
  });
};
