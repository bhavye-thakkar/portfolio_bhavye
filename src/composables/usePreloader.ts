import { ref, nextTick, onMounted } from "vue";
import { resources } from "../utils/resources";
import { renderer, webglAvailable, webglSoftware } from "../three/core/renderer";
import { sceneFailed } from "../three/core/webgl";
import { three } from "../three";
import { loaderAvatar } from "../three/loader-avatar";
import { libraryActive, projectVisible } from "./useRouteObserver";

/**
 * True while the loader covers the page, and until its name has landed on the
 * hero's title: that is the frame the title shows itself (Hero.vue) and the
 * banner under it starts (Hero.vue, Banner), so the two never show twice.
 */
export const preloaderVisible = ref(true);

/**
 * True once every asset is in and the door has gone, while the loader still
 * covers the page. Home starts rendering on this, so the exit uncovers a
 * finished room rather than an empty beige page.
 */
export const preloaderLoaded = ref(false);

/**
 * True once this visit has shown itself to be a slow one: the bundle, or the
 * avatar, missed the door's deadline. From then on Home.vue keeps the room's
 * still under the loader, so a page shown before the scene can draw already
 * has its picture, instead of starting that download at the landing and
 * showing an empty hero while it queues behind the room's own files.
 */
export const preloaderSlow = ref(false);

/**
 * ─── THE OPENING ──────────────────────────────────────────────────────────
 *
 *   shut → push → (the name alone) → boot → land
 *
 * One function, top to bottom, each state entered once. What the markup does
 * in each is documented with the styles in index.html; how the avatar moves is
 * loader-avatar.ts. The door is ONE linear animation from shut to off the far
 * edge, with him on it the whole way, and his legs follow its distance, so
 * his feet cannot slide and he cannot be dragged. It never pauses: on a slow
 * connection he walks off and the name waits alone, as the reference does.
 *
 * Nothing here waits for show. The door takes as long as his walk takes, the
 * boot waits for the files and for the room's first frame, and every wait has
 * a ceiling (LOAD_CAP_MS, ARRIVE_CAP_MS, the first-frame cap), so a file that
 * never arrives, a scene that throws or a browser with no WebGL all end at
 * the page, with the room's still in the canvas's place (Home.vue).
 */

/** The name's flight to the hero title; keep in step with the backdrop fade in index.html. */
const LAND_MS = 800;
const LAND_EASE = "cubic-bezier(0.76, 0, 0.24, 1)";
/** The fade that stands in for the flight under reduced motion, or with no title to land on. */
const FADE_MS = 400;
/**
 * The longest a visit waits for the room's files, ~1.4 MB on a good day,
 * counted from the navigation and not from this bundle running: on a slow
 * line the bundle alone took 10s, and a cap that only started then held the
 * name over an unreachable page for half a minute. Past it the page is shown
 * with the room's still, and the scene boots on top of that when the files do
 * arrive (three/index.ts, `bootNow`). The page behind works without the scene.
 */
const LOAD_CAP_MS = 9000;
/**
 * How long the door may stay shut, his wait included, counted from the door's
 * own first paint. index.html opens it by itself at this mark
 * (`preloader-door-open`, keep the two in step), so a bundle still downloading
 * never leaves a dark page; a bundle that runs in time cancels that, takes the
 * door over, and waits for him only for what is left. His files are the first
 * wave of the download, so he misses it only on a slow connection, and then
 * joins the moving door when he does arrive.
 */
const SHUT_MS = 2500;
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

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves once the renderer has drawn a real frame, so the frame the exit
 * starts in already carries the room. Polled on a timer, NOT on the ticker:
 * a tab that gets no animation frames (opened in the background, an embedded
 * browser pane, a throttled webview) never ticks, and a check that lives on
 * the ticker never fires, cap included, so the loader sat over the page for
 * good. On a timer the cap always lands; the page then shows the room's
 * still until the scene does draw (Home.vue, sceneLive).
 *
 * Counted frames rather than the canvas turning visible: the renderer hides its
 * canvas until the camera has a pose, but a story deep link poses the camera
 * before the scene exists, the canvas is never hidden, and a wait for it to
 * turn visible sat out the whole cap.
 */
const firstFrame = () =>
  new Promise<void>((resolve) => {
    // A cold link to a project page or the library keeps the renderer switched
    // off, a browser without WebGL never gets one, a scene that failed will not
    // draw, and one whose files are not all in (the cap ran out) has not even
    // booted: no frame is coming.
    if (projectVisible.value || libraryActive.value || !webglAvailable || sceneFailed.value || !resources.isReady)
      return resolve();

    const start = performance.now();
    const timer = setInterval(() => {
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
      if (!drawn && !sceneFailed.value && performance.now() - start < (webglSoftware ? 12000 : 2500)) return;
      clearInterval(timer);
      resolve();
    }, 100);
  });

/** Resolves when every asset is in (or has failed: utils/resources.ts counts both). */
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

/**
 * ── THE NAME TAKES ITS PLACE ──────────────────────────────────────────────
 *
 * The reference opening ends with its mark in the middle of the screen
 * travelling to where it lives in the page, while the field under it fades
 * away. Here the mark is the name. It flies from the middle of the loader to
 * the hero's own title: same face, same weight, same tracking, so one scale
 * and one translate, read off the two boxes rather than guessed, land it to
 * the pixel. The hero title stays hidden until then (Hero.vue) and is shown
 * in the same frame this copy is removed, so there is never a second name on
 * screen. With no title to land on (a deep link into a project, where home is
 * hidden) or under reduced motion, the name simply fades.
 */
const land = (name: HTMLElement, reduced: boolean) => {
  const title = document.querySelector<HTMLElement>(".hero-title");
  const to = title?.getBoundingClientRect();
  const from = name.getBoundingClientRect();
  const flight = !reduced && to && to.height > 0 && from.height > 0;

  const animation = flight
    ? name.animate(
        [
          { transform: "translate(-50%, -50%)" },
          {
            transform: `translate(-50%, -50%) translate(${to.left + to.width / 2 - (from.left + from.width / 2)}px, ${
              to.top + to.height / 2 - (from.top + from.height / 2)
            }px) scale(${to.height / from.height})`,
          },
        ],
        { duration: LAND_MS, easing: LAND_EASE, fill: "forwards" },
      )
    : name.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: "ease-out", fill: "forwards" });

  // A timer beside the promise: in a tab that gets no animation frames the
  // finished promise can lag far behind the clock.
  return Promise.race([animation.finished.catch(() => undefined), wait(LAND_MS + 200)]);
};

export const usePreloader = () => {
  onMounted(async () => {
    const root = document.querySelector<HTMLElement>(".preloader");
    const curtain = root?.querySelector<HTMLElement>(".preloader-curtain");
    const name = root?.querySelector<HTMLElement>(".preloader-name");
    const canvas = root?.querySelector<HTMLCanvasElement>(".preloader-avatar canvas");
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // A cold link to a project page or the library never draws the room (the
    // renderer is off there, Home.vue), so its page does not wait for the
    // room's files: they keep downloading and the scene boots when they land.
    const needsRoom = !projectVisible.value && !libraryActive.value;
    const loaded = needsRoom ? Promise.race([assets(), wait(LOAD_CAP_MS - performance.now())]) : Promise.resolve();

    // The scene may boot, and Home render, only once nothing of his is left on
    // screen to stutter: the boot is a run of long tasks (see three/index.ts).
    const boot = async () => {
      three.bootNow();
      preloaderLoaded.value = true;
      await firstFrame();
    };
    const exit = async () => {
      document.body.classList.remove("is-loading");
      root?.classList.add("preloader-exit");
      if (name) await land(name, reduced);
      preloaderVisible.value = false;
      // The hero title is patched in before this copy of the name is taken
      // out, so both land in one paint.
      await nextTick();
      root?.remove();
    };

    // No door, no walk: the name is simply there, and leaves with a fade.
    if (!root || !curtain || reduced) {
      await loaded;
      await boot();
      return exit();
    }

    // ── shut: the door waits for him, up to its own deadline ──
    // Past SHUT_MS the door has already started to open by itself (index.html):
    // this bundle came too late for the walk, the name is alone on the page,
    // and all that is left is the files and the landing.
    const opening = curtain.getAnimations().find((a) => (a as CSSAnimation).animationName === "preloader-door-open");
    const shown = Number(opening?.currentTime ?? 0);
    if (opening && shown >= SHUT_MS) {
      preloaderSlow.value = needsRoom;
      await loaded;
      await boot();
      return exit();
    }
    opening?.cancel();

    // A failed mount resolves to null at once and nothing waits for it. Without
    // WebGL the mount is a sheet of his pre-rendered frames (loader-avatar.ts).
    const mounting = canvas ? loaderAvatar.mount(canvas).catch(() => null) : Promise.resolve(null);
    const walker = await Promise.race([mounting, wait(SHUT_MS - shown).then(() => null)]);
    if (walker) root.classList.add("preloader-live");
    // The door left without him: he joins it in plain sight, so he fades in.
    else {
      preloaderSlow.value = needsRoom;
      void mounting.then((late) => late && root.classList.add("preloader-late", "preloader-live"));
    }

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

    // ── land ──
    await exit();
    // only ever resolved, never rejected; the loader's context goes with it
    (await mounting)?.dispose();
  });
};
