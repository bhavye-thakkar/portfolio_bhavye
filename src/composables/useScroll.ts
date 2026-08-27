import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ref, onMounted, onUnmounted, watch } from "vue";
import { isTransitioning } from "./useProjectTransition";

export const lenis = ref<Lenis | null>(null);
export const projectLenis = ref<Lenis | null>(null);
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

    // QA-SHIM temporary, remove before ship — same gate as three/index.ts
    if (location.search.includes("qa=1")) {
      const qa = window as unknown as Record<string, unknown>;
      qa.__lenis = lenis.value;
      qa.__gsap = gsap;
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
    gsap.ticker.lagSmoothing(0);

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
