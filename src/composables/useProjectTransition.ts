import { ref, watch } from "vue";
import { experienceId, overlayId, projectId } from "./useRouteObserver";

export const ROUTE_TRANSITION_DURATION = 500;
/**
 * A project page mounts sooner than a story page. Its sheet grows out of the
 * clicked card on an expo curve and is ~95% open by 380ms, and at 500ms the
 * visitor was left looking at an empty sheet for a beat before the page began
 * to fade in. The story overlay keeps 500: its own fade is timed to it.
 */
export const PROJECT_TRANSITION_DURATION = 380;
export const isTransitioning = ref(false);

/**
 * True only while an Experience story page is on its way out, so it can fade
 * instead of blinking off. Driven by the same timer as `isTransitioning`, one
 * clock for the whole route transition rather than a second one to fall out of
 * sync with.
 */
export const experienceClosing = ref(false);

/**
 * The same for a project page. Its content used to be unmounted the instant
 * the route changed, so leaving a project cut the page out in a single frame
 * and the home page appeared behind a flat grey wash. It now stays mounted and
 * recedes while the sheet folds back into its card (ProjectBackground.vue).
 */
export const projectClosing = ref(false);

let timeout: ReturnType<typeof setTimeout> | null = null;

export const useProjectTransition = () => {
  // Watching experienceId rather than inferring the kind from overlayId: a
  // deep-linked story never fires an "entering" transition, so anything that
  // remembers what was opened misses it and the page blinks off instead of
  // fading. The id's own before/after is right either way.
  watch(experienceId, (newId, oldId) => {
    if (oldId !== null && newId === null) experienceClosing.value = true;
  });

  watch(projectId, (newId, oldId) => {
    if (oldId !== null && newId === null) projectClosing.value = true;
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

    // The projectId watcher above has already run for this change, so
    // `projectClosing` is set by now on the way out of a project.
    const isProject = projectId.value !== null || projectClosing.value;

    timeout = setTimeout(
      () => {
        isTransitioning.value = false;
        experienceClosing.value = false;
        projectClosing.value = false;
        timeout = null;
      },
      isProject ? PROJECT_TRANSITION_DURATION : ROUTE_TRANSITION_DURATION,
    );

    onInvalidate(() => {
      if (timeout) clearTimeout(timeout);
    });
  });

  return { isTransitioning };
};
