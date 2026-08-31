import { ref, watch, onMounted } from "vue";
import { resources } from "../utils/resources";
import gsap from "gsap";

export const preloaderVisible = ref(true);

export const usePreloader = () => {
  const progress = ref(0);
  const resourcesProgress = ref(0);

  onMounted(() => {
    resources.on("progress", (newProgress) => {
      resourcesProgress.value = newProgress;
    });
  });

  /**
   * The bar tracks the DOWNLOADS and nothing else, which is what makes the
   * logo sweep read as a sweep.
   *
   * It briefly held the last 10% back for the hero's shader compile, on the
   * theory that "loaded" should mean "paintable". But a shader link blocks
   * the main thread, and a blocked main thread cannot run this watcher — so
   * the fill never animated at all: the logo sat as a grey ghost, then
   * snapped to solid dark in one frame when the thread came back. The honest
   * gate destroyed the very animation it was pacing.
   *
   * Boot is fast now because the SCENE is staged (see three/objects/index.ts),
   * not because the bar waits for anything.
   */
  watch(
    resourcesProgress,
    (newProgress) => {
      progress.value = 0.25 + newProgress * 0.75;
    },
    { immediate: true },
  );

  watch(
    progress,
    (newProgress) => {
      const rect = document.querySelector(".preloader-rect") as HTMLElement;
      const preloader = document.querySelector(".preloader") as HTMLElement;
      if (newProgress === 1) {
        gsap.delayedCall(0.2, () => {
          document.body.classList.remove("is-loading");
          preloader.classList.add("preloader-hidden");
          preloaderVisible.value = false;
        });
      }

      if (rect) rect.style.transform = `scaleY(${newProgress})`;
    },
    { immediate: true },
  );
};
