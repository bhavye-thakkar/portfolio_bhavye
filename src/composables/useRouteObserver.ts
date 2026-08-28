import { ref, computed, onMounted, onUnmounted } from "vue";
import { isTransitioning } from "./useProjectTransition";
import { projectIds } from "../content/projects/index";
import { experiences } from "../content/experience";

// -----------------------------------------------------------------------------
// GLOBAL REACTIVE PATH
// -----------------------------------------------------------------------------

export const path = ref(typeof window !== "undefined" ? window.location.pathname : "/");

// -----------------------------------------------------------------------------
// COMPUTED HELPERS
// -----------------------------------------------------------------------------

export const isProjectRoute = (path: string) => {
  return path.match(/^\/project\/([^/]+)$/);
};

export const projectId = computed(() => {
  const match = isProjectRoute(path.value);
  return match ? match[1] : null;
});

export const projectVisible = computed(() => {
  return projectId.value !== null && !isTransitioning.value;
});

export const recentProject = ref<string | null>(null);

export const recentProjectId = computed(() => {
  if (projectId.value) {
    recentProject.value = projectId.value;
  }
  return recentProject.value;
});

export const isExperienceRoute = (path: string) => {
  return path.match(/^\/experience\/([^/]+)$/);
};

export const experienceId = computed(() => {
  const match = isExperienceRoute(path.value);
  return match ? match[1] : null;
});

export const experienceVisible = computed(() => {
  return experienceId.value !== null && !isTransitioning.value;
});

export const recentExperience = ref<string | null>(null);

export const recentExperienceId = computed(() => {
  if (experienceId.value) {
    recentExperience.value = experienceId.value;
  }
  return recentExperience.value;
});

/**
 * Both detail routes ride the same overlay: home goes fixed, the overlay takes
 * the document scroll, and the header swaps its logo for a back button. Only
 * the content differs, so the transition watches this rather than either id.
 */
export const overlayId = computed(() => projectId.value ?? experienceId.value);

/**
 * ── UNKNOWN ROUTES ────────────────────────────────────────────────────────
 *
 * `/anything-else` used to render the home page: the two id computeds came
 * back null, no overlay opened, and the visitor got the hero at a URL that
 * was not the hero. To a search engine that is a soft 404 — a 200 response
 * with content that does not match the URL — which is worse than a 404,
 * because it gets indexed.
 *
 * The check is against the real slug lists rather than the URL shape, so
 * `/project/does-not-exist` is a miss too, not just `/nonsense`.
 */
const KNOWN_PATHS = new Set(["/", ""]);

export const isKnownRoute = computed(() => {
  const value = path.value.replace(/\/+$/, "") || "/";
  if (KNOWN_PATHS.has(value)) return true;

  const project = isProjectRoute(value);
  if (project) return projectIds.includes(project[1] as string);

  const experience = isExperienceRoute(value);
  if (experience) return experiences.some((entry) => entry.slug === experience[1]);

  return false;
});

export const notFound = computed(() => !isKnownRoute.value);

// -----------------------------------------------------------------------------
// HISTORY PATCH (safe & minimal)
// -----------------------------------------------------------------------------

let historyPatched = false;

function patchHistory() {
  if (historyPatched || typeof window === "undefined") return;
  historyPatched = true;

  const wrap = (key: "pushState" | "replaceState") => {
    const original = history[key];
    history[key] = function (...args) {
      // @ts-ignore
      original.apply(this, args);

      // IMPORTANT FIX: delay events to avoid reactivity collisions
      queueMicrotask(() => {
        window.dispatchEvent(new Event("route-change"));
      });
    };
  };

  wrap("pushState");
  wrap("replaceState");
}

// -----------------------------------------------------------------------------
// COMPOSABLE
// -----------------------------------------------------------------------------

export function useRouteObserver() {
  const update = () => {
    const newPath = window.location.pathname;
    if (newPath !== path.value) {
      path.value = newPath;
    }
  };
  onMounted(() => {
    patchHistory();
    update();

    window.addEventListener("popstate", update);
    window.addEventListener("route-change", update);
  });

  onUnmounted(() => {
    window.removeEventListener("popstate", update);
    window.removeEventListener("route-change", update);
  });

  return {
    path,
    projectId,
    recentProjectId,
  };
}
