import { ref, computed, onMounted, onUnmounted } from "vue";
import { isTransitioning } from "./useProjectTransition";
import { projectIds } from "../content/projects/index";
import { experiences } from "../content/experience";
import { objectSlugs } from "../content/objects";

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

/**
 * ── AN ID ONLY EXISTS IF THE THING DOES ───────────────────────────────────
 *
 * All three of these check the slug against the real content list, and answer
 * `null` for anything else. That is what makes `/project/does-not-exist` reach
 * the 404 page.
 *
 * It used to be the detail components' job: each one watched its own id and
 * called `router.replace("/")` when it could not find the slug. Which raced
 * `notFound` and won, so an unknown detail URL silently became the home page —
 * a soft 404, the exact thing NotFound.vue was added to stop. Deciding it here
 * means nothing downstream can see an id it cannot render.
 */
export const projectId = computed(() => {
  const match = isProjectRoute(path.value);
  if (!match) return null;
  return projectIds.includes(match[1] as string) ? match[1] : null;
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
  if (!match) return null;
  return experiences.some((entry) => entry.slug === match[1]) ? match[1] : null;
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
 * ── THE TWO CLICKABLE PROPS ───────────────────────────────────────────────
 *
 * `/object/orchid` and `/object/starry-night`. Real URLs rather than a modal
 * flag, for the same three reasons the story pages are: the browser Back
 * button closes them, a deep link lands somewhere, and each one has content a
 * crawler can read. They ride the same overlay as the other two.
 */
export const isObjectRoute = (path: string) => {
  return path.match(/^\/object\/([^/]+)$/);
};

export const objectId = computed(() => {
  const match = isObjectRoute(path.value);
  if (!match) return null;
  return objectSlugs.includes(match[1] as string) ? match[1] : null;
});

/**
 * No `isTransitioning` gate, unlike the two below. Project and Experience
 * REPLACE the home page — home goes `position: fixed` and hidden, so there has
 * to be a crossfade window where neither is showing. An object panel is a
 * layer OVER a home page that stays live and stays scrolled where it was: the
 * camera pushes in underneath it, so there is nothing to cross-fade and
 * nothing to restore on the way out.
 */
export const objectVisible = computed(() => objectId.value !== null);

export const recentObject = ref<string | null>(null);

export const recentObjectId = computed(() => {
  if (objectId.value) {
    recentObject.value = objectId.value;
  }
  return recentObject.value;
});

/**
 * Both detail routes ride the same overlay: home goes fixed, the overlay takes
 * the document scroll, and the header swaps its logo for a back button. Only
 * the content differs, so the transition watches this rather than either id.
 *
 * Deliberately NOT including `objectId` — see `objectVisible` above. An object
 * panel must not start the home-replacement transition, or home scales away
 * underneath a panel you can see straight through.
 */
export const overlayId = computed(() => projectId.value ?? experienceId.value);

/**
 * Any detail route at all. The header reads this rather than `overlayId`: the
 * back button, the shifted logo and the hidden nav pills are right for an
 * object panel too, even though the page underneath it is not being replaced.
 */
export const detailId = computed(() => overlayId.value ?? objectId.value);

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

  // The ids above already answer "is this a slug that exists"; asking them is
  // what keeps that answer in one place. A detail URL with a trailing slash
  // does not match them and lands here as a 404, which is right — `Link`
  // strips trailing slashes, so nothing on the site can produce one.
  return projectId.value !== null || experienceId.value !== null || objectId.value !== null;
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
