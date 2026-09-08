/**
 * ─── OFFLINE SUPPORT, REGISTERED OUT OF THE WAY ───────────────────────────
 *
 * The worker itself is `public/sw.js` and every decision about what gets cached
 * is documented there. This is only the registration, and the two rules it has
 * to obey are both about not making the first visit worse:
 *
 *   1. AFTER `load`. A `register()` call during boot competes with the GLBs and
 *      the textures for the same connection budget, and the requirement is that
 *      offline support costs the first load nothing. By `load` the scene's own
 *      downloads are done.
 *   2. PRODUCTION ONLY. In dev the worker would sit in front of Vite's module
 *      graph and serve yesterday's transformed modules back at you, which is a
 *      genuinely confusing hour to lose. It also actively UNREGISTERS anything
 *      it finds in dev, because a worker installed by a `vite preview` run on
 *      the same origin (localhost) outlives that run and would do exactly that.
 */
export const usePwa = () => {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  if (!import.meta.env.PROD) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => registrations.forEach((registration) => registration.unregister()))
      .catch(() => {});
    return;
  }

  // Nothing is awaited and nothing is reported: a failed registration means the
  // site works exactly as it did before there was one, which needs no handling.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => navigator.serviceWorker.ready)
      .then(warmCache)
      .catch(() => {});
  });
};

/**
 * ─── THE FIRST VISIT IS THE ONE THAT MATTERS ──────────────────────────────
 *
 * The worker only sees fetches made AFTER it controls the page, and on a first
 * visit that is after everything the hero needed has already been downloaded.
 * Left alone, the offline cache after one visit holds the shell and two fonts,
 * and whether the 3D room comes back offline depends on the HTTP cache being
 * kind, which the production host's `must-revalidate` headers are not.
 *
 * So once the worker is ready, copy what this page already fetched into its
 * cache. `force-cache` takes each file from the HTTP cache the page just filled,
 * so the first load pays for nothing twice, and it runs in idle time so it
 * never competes with the scene. Same-origin only, and the cache name has to
 * match `VERSION` in public/sw.js.
 */
const warmCache = () => {
  if (!("caches" in window)) return;

  const run = () => {
    const urls = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((url) => url.startsWith(location.origin));

    caches
      .open("portfolio-v1")
      .then((cache) =>
        Promise.allSettled(
          urls.map((url) =>
            cache.match(url).then((hit) => (hit ? undefined : cache.add(new Request(url, { cache: "force-cache" })))),
          ),
        ),
      )
      .catch(() => {});
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 8000 });
  else setTimeout(run, 3000);
};
