/**
 * ─── OFFLINE-FIRST SERVICE WORKER ─────────────────────────────────────────
 *
 * The promise: if you have opened this portfolio once with a connection, you
 * can open it again without one. Not "a page that says you are offline", the
 * actual 3D room, as far as the assets you already pulled will carry it.
 *
 * ── WHY IT IS HAND-WRITTEN AND NOT WORKBOX ────────────────────────────────
 *
 * Workbox and vite-plugin-pwa build a precache manifest of every hashed asset
 * and fetch the lot on first install. This site's payload is a GLB avatar, a
 * GLB room, an atlas, a spritesheet and several megabytes of texture, so that
 * would mean a returning visitor's FIRST visit paying for assets they may never
 * scroll to, on a page whose loading time is already the thing being complained
 * about. The requirement (§29) is that offline support must not make the first
 * load slower, and a precache manifest is exactly the thing that would.
 *
 * So: nothing is precached except the shell, and everything else is cached AS
 * IT IS FETCHED. A visitor who scrolled the whole site has the whole site
 * offline; one who read the hero has the hero. The cost of the guarantee is
 * paid by the visit that already happened, which is the entire point.
 *
 * ── THE THREE STRATEGIES ──────────────────────────────────────────────────
 *
 *   NAVIGATION      network first, cached shell as the fallback. The app is an
 *                   SPA, so every route is the same document; a stale HTML
 *                   shell served while online would pin an old build's script
 *                   tags forever, which is the one thing worth a round trip.
 *   BUILD OUTPUT    cache first. `/assets/` and `/chunks/` are content-hashed
 *                   by Vite, so a given URL's bytes never change and a
 *                   revalidation could only ever confirm what we have. Fonts,
 *                   icons and the CV PDF are on the same footing: they are
 *                   versioned by deploy, not by request.
 *   EVERYTHING ELSE network first, cache as backup. sitemap.xml, robots.txt
 *                   and llms.txt are small, unhashed and meant to be current.
 *
 * Cross-origin is NOT TOUCHED AT ALL (§25). The certificate links go to Google
 * Drive and the profile links go to four other hosts; caching somebody else's
 * responses in this origin's storage is not ours to do, and an opaque response
 * cached by mistake is a permanently broken asset with no way to tell.
 *
 * ── BUMPING THE VERSION ───────────────────────────────────────────────────
 *
 * `VERSION` is the cache name. Changing it orphans the old cache, which the
 * next activation deletes. It only needs bumping when the SHELL changes shape
 * (a new file in PRECACHE, a strategy change); ordinary deploys are handled by
 * Vite's content hashes, which make new URLs that simply miss the cache.
 */

const VERSION = "portfolio-v1";

/**
 * The smallest set that gets a first paint with no network: the document and
 * the two faces the preloader draws itself in. Everything else is runtime.
 * Kept short on purpose, an install that downloads a lot is an install that
 * competes with the page that triggered it.
 */
const PRECACHE = ["/", "/fonts/urbanist-400.woff2", "/fonts/pro-font-windows-400.woff2"];

/**
 * Content-hashed or deploy-versioned: safe to serve from cache forever.
 * `assets` and `chunks` are Vite's own output directories (see vite.config.ts),
 * the other three are `public/`. Everything the 3D scene loads, models,
 * textures, sound sprites and fonts, lands in one of them.
 */
const IMMUTABLE = /^\/(assets|chunks|fonts|meta|cv)\//;

/** Shown only when there is no cached shell either, i.e. a first visit offline. */
const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline - Bhavye Thakkar</title>
<style>html{color-scheme:light}body{margin:0;min-height:100vh;display:grid;place-items:center;
background:#f5efe6;color:#2d2a24;font:400 16px/1.5 system-ui,sans-serif;padding:24px}
main{max-width:32ch;text-align:center}h1{font-size:1.25rem;margin:0 0 .5rem}p{margin:0;opacity:.7}</style>
</head><body><main><h1>You are offline</h1>
<p>This portfolio has not been loaded on this device yet, so there is nothing cached to show.
Reconnect and it will work offline from then on.</p></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // `Promise.allSettled`, not `addAll`: `addAll` is atomic, so one font
      // that 404s on a future rename would fail the whole install and leave
      // the site with no worker at all rather than with a slightly thin cache.
      Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))),
    ),
  );
  // Deliberately NO skipWaiting. The running page is holding URLs from the
  // build it loaded with; activating over the top of it and then deleting that
  // build's cache would strand it mid-scroll. The new worker takes over on the
  // next navigation, which is soon enough and cannot break anything.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

/** Store a copy, but never a redirect, an error or an opaque cross-origin body. */
const put = async (request, response) => {
  if (!response || !response.ok || response.type !== "basic") return response;
  const cache = await caches.open(VERSION);
  cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request, fallback) => {
  try {
    return await put(request, await fetch(request));
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallback) {
      const shell = await caches.match(fallback);
      if (shell) return shell;
    }
    throw new Error("offline and uncached");
  }
};

const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  return put(request, await fetch(request));
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Someone else's origin, someone else's caching policy.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, "/").catch(
        () => new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
      ),
    );
    return;
  }

  if (IMMUTABLE.test(url.pathname)) {
    // No fallback and no catch: a texture that is neither cached nor reachable
    // has no stand-in, and letting the request fail lets three's loader report
    // it as the error it is instead of decoding an HTML page as a PNG.
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request).catch(() => fetch(request)));
});
