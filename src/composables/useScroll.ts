import gsap from "gsap";
import { cv, cvStage } from "../features/cv/state";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ref, shallowRef, onMounted, onUnmounted, watch } from "vue";
import { isTransitioning } from "./useProjectTransition";
import { story } from "../animations/story";

/**
 * ── `shallowRef`, NEVER `ref` ─────────────────────────────────────────────
 *
 * A plain `ref` wraps the Lenis instance in a deep reactive proxy, which made
 * its emitter's `events` object reactive too. Every `lenis.on("scroll")` made
 * inside a `watchEffect` (useHeaderTheme in Header and HeaderHome, the scroll
 * tracker in Project.vue) then READ `events.scroll`, a tracked dependency, and
 * every cleanup's `off()` WROTE it. The moment anything unsubscribed outside
 * an effect run, the site header unmounting on an object route, each of those
 * effects re-ran, wrote the key again and re-triggered the others, without end.
 *
 * Vue's dev build cuts that at 100 iterations ("Maximum recursive updates
 * exceeded in component <Project>"). The production build has NO cap: tapping
 * the orchid or the painting wedged the main thread for good, reproduced in
 * headless Chrome as a page that answered no script for 70 s while the
 * compositor kept scrolling the stale frame underneath, the avatar still on it.
 *
 * Lenis is a class instance with its own internal state, not data the UI
 * renders; only the ref's *assignment* has to be observable. A shallow ref
 * also takes the proxy out of `lenis.raf()`, which was running every property
 * access of every frame through it.
 */
export const lenis = shallowRef<Lenis | null>(null);
export const velocity = ref(0);

const handleScroll = () => {
  ScrollTrigger.update();
};

export const useScroll = () => {
  const tick = (time: number) => {
    const instance = lenis.value;
    if (!instance) return;

    if (instance.isScrolling === "smooth" && Math.abs(instance.velocity) > 0) {
      velocity.value = Math.min(Math.abs(instance.velocity * 0.75) || 0, 1);
    }

    instance.raf(time * 1000);
  };

  const createNewLenis = () => {
    if (lenis.value) {
      lenis.value.destroy();
      lenis.value.off("scroll", handleScroll);
    }

    lenis.value = new Lenis({
      lerp: 0.08,
    });

    lenis.value.on("scroll", handleScroll);

    // QA-SHIM temporary, remove before ship, same gate as three/index.ts
    if (location.search.includes("qa=1")) {
      const qa = window as unknown as Record<string, unknown>;
      qa.__lenis = lenis.value;
      qa.__cv = { cvStage, cv };
      qa.__gsap = gsap;
      // Story poses are driven by an IntersectionObserver, which never fires in
      // a headless or inactive tab; this is the only way to reach a chapter
      // beat without a real scroll.
      qa.__story = story;
      qa.__ScrollTrigger = ScrollTrigger;
      // Headless/inactive tabs never fire rAF, so scrubbed timelines never
      // render. Seek, then pump the ticker by hand.
      qa.__seek = (y: number, ticks = 6) => {
        window.scrollTo(0, y);
        lenis.value?.scrollTo(y, { immediate: true, force: true });
        for (let i = 0; i < ticks; i++) gsap.ticker.tick();
        ScrollTrigger.update();
        for (let i = 0; i < ticks; i++) gsap.ticker.tick();
      };
    }
  };

  onMounted(() => {
    gsap.ticker.add(tick);
    /**
     * GSAP's default, not the `lagSmoothing(0)` the Lenis guide suggests.
     *
     * With smoothing off, a frame gap is reported at its true length, and a
     * backgrounded tab stops rAF entirely, so coming back after a minute
     * hands every ticker a delta of 60 seconds. `deltaRatio(60)` is then 3600,
     * which is multiplied into `mixer.update(delta / 60)` (the avatar's
     * animation clock jumps a minute in one step) and into every
     * `lerp(a, b, k * delta)` in the scene, where a factor far above 1 does not
     * ease towards the target, it flies past it.
     *
     * 500/33 only ever triggers after a real stall, no normal frame is 500ms -
     * so Lenis stays in step and a tab switch stops corrupting the scene.
     */
    gsap.ticker.lagSmoothing(500, 33);

    createNewLenis();
  });

  watch(isTransitioning, (newIsTransitioning) => {
    if (newIsTransitioning) {
      lenis.value?.stop();
      ScrollTrigger.clearScrollMemory();
    } else {
      lenis.value?.start();
      ScrollTrigger.update();
    }
  });

  onUnmounted(() => {
    gsap.ticker.remove(tick);
  });
};
