import { ref, watch } from "vue";
import { experienceId, overlayId } from "./useRouteObserver";

export const ROUTE_TRANSITION_DURATION = 500;
export const isTransitioning = ref(false);

/**
 * True only while an Experience story page is on its way out, so it can fade
 * instead of blinking off. Driven by the same timer as `isTransitioning` — one
 * clock for the whole route transition rather than a second one to fall out of
 * sync with.
 */
export const experienceClosing = ref(false);

let timeout: ReturnType<typeof setTimeout> | null = null;

export const useProjectTransition = () => {
  // Watching experienceId rather than inferring the kind from overlayId: a
  // deep-linked story never fires an "entering" transition, so anything that
  // remembers what was opened misses it and the page blinks off instead of
  // fading. The id's own before/after is right either way.
  watch(experienceId, (newId, oldId) => {
    if (oldId !== null && newId === null) experienceClosing.value = true;
  });

  watch(overlayId, (newId, oldId, onInvalidate) => {
    // if neither entering nor leaving a detail route → do nothing
    const entering = oldId === null && newId !== null;
    const leaving = oldId !== null && newId === null;

    if (!entering && !leaving) return;

    // clear old timeout
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }

    isTransitioning.value = true;

    timeout = setTimeout(() => {
      isTransitioning.value = false;
      experienceClosing.value = false;
      timeout = null;
    }, ROUTE_TRANSITION_DURATION);

    onInvalidate(() => {
      if (timeout) clearTimeout(timeout);
    });
  });

  return { isTransitioning };
};
