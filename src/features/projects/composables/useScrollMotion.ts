import gsap from "gsap";
import { onBeforeUnmount, onMounted, watch } from "vue";
import { projectClosing } from "../../../composables/useProjectTransition";

import type { Ref } from "vue";
import type { ScrollTrigger } from "gsap/ScrollTrigger";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Scroll motion for the blocks of a project page, in one gsap.context per
 * block so unmounting reverts exactly what the block created.
 *
 * Reduced motion builds nothing: every block is laid out fully visible in CSS,
 * the animations only ever move it from somewhere else back to that state.
 *
 * ── FROZEN ON THE WAY OUT ──────────────────────────────────────────────────
 * Leaving a project, home takes the window scroll back (ProjectBackground.vue)
 * while this page is still fading out on top of it. Left live, every scrubbed
 * trigger would jump to wherever home's offset puts it, frames shrinking and
 * pictures sliding for the last few frames the page is visible. Disabling
 * them without reverting holds each block exactly as it was being read.
 */
export const useScrollMotion = (scope: Ref<HTMLElement | null>, build: (element: HTMLElement) => void) => {
  let context: gsap.Context | null = null;

  onMounted(() => {
    const element = scope.value;
    if (!element || prefersReducedMotion()) return;
    context = gsap.context(() => build(element), element);
  });

  watch(projectClosing, (closing) => {
    if (!closing || !context) return;
    for (const item of context.data as Array<{ scrollTrigger?: ScrollTrigger; disable?: (revert?: boolean) => void }>) {
      item.scrollTrigger?.disable(false);
      if (typeof item.disable === "function") item.disable(false);
    }
  });

  onBeforeUnmount(() => {
    context?.revert();
    context = null;
  });
};
