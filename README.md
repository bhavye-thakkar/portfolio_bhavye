# Bhavye Thakkar — Portfolio

An interactive 3D portfolio. The whole site is one continuous WebGL scene: a room you scroll into, an x-ray figure that assembles out of it, an office bay that builds itself around him for the Experience chapters, and a goodbye at the end. There are no page loads between them — the camera moves and the scene changes under it.

Built with **Vue 3**, **TypeScript** and **Vite**. Motion via **GSAP** + **Lenis**, 3D via **three.js**, audio via **Howler**. GLSL is compiled through `vite-plugin-glsl`.

---

## Credit / reuse

**If you copy, fork or build on this site, credit me.** A visible link back to
[github.com/bhavye-thakkar](https://github.com/bhavye-thakkar) or to the live site is enough — in your README, your footer, or wherever your own credits live.

Concretely, please do not:

- ship this as your own portfolio with only the name swapped;
- reuse the 3D scene, the avatar, the shaders or the scroll choreography without saying where they came from;
- remove the credit and present the work as original.

You are welcome to learn from it, lift techniques, and reuse pieces with attribution. Ask first if you want to use it commercially.

The third-party assets keep their own terms: the artwork in the room's wall frame is a public-domain Van Gogh, and the fonts, models and libraries are governed by their own licences.

---

## Running it

| Command             | What it does                                     |
| ------------------- | ------------------------------------------------ |
| `npm install`       | Install dependencies                             |
| `npm run dev`       | Dev server (port 3000, or 5199 via `.claude/launch.json`) |
| `npm run typecheck` | `vue-tsc -b`, no emit                            |
| `npm run build`     | Typecheck, production bundle into `dist/`, then the SEO check |
| `node scripts/seo-check.mjs [origin]` | Checks every page of `dist/`, or of the live site |
| `npm run preview`   | Serve the production build locally               |

CI runs typecheck → build → SEO check on every push and PR (`.github/workflows/ci.yml`). Vercel deploys every push to `main`; its build runs the same `npm run build`, so a failing page never reaches production. After each production deploy, and every Monday, `.github/workflows/deploy.yml` checks the live site (pages, security headers, links, the Netlify copies' canonicals) and tells the IndexNow engines what is there.

---

## Where things live

### Content — edit these, not the components

| What | File |
| ---- | ---- |
| Name, role, bio, skills, certificates, links, hackathons | `src/content/profile.ts` |
| Experience chapters (companies, story beats) | `src/content/experience.ts` |
| Projects — copy, media, tags | `src/content/projects/en/<slug>.ts` |
| Projects — the grid | `src/content/projects/previews/en.ts` |
| Social icon row | `src/content/social.ts` |
| UI strings | `src/i18n/messages/namespaces/common/en.json` |

`profile.ts` is the single source for anything about the person. Certificates carry their real URLs there; a card with an empty `url` renders as a plain panel rather than a dead link, so a half-filled entry is safe to ship.

### The 3D scene

```
src/three/
  core/          renderer, camera, scene, render target
  objects/
    avatar/      the figure: face, spectacles, watch, hologram, walk clip
    room/        the hero room (baked atlas, no lights)
    workstation/ the Experience office — desk, monitors, plant
    lab/         the About pod
    contact/     the goodbye
  shaders/       GLSL, imported directly by the modules that use them
```

`src/animations/` drives all of it: `waypoints-data.ts` holds every camera framing, `scenes.ts` holds the weights that blend between them, and `transitions/*.ts` wire those to scroll.

### SEO / discoverability

- `index.html` — title, description, Open Graph, JSON-LD, and a text version of the page inside `#app` (Vue replaces it on mount) for crawlers that do not run JavaScript.
- `src/composables/useHead.ts` — per-route title, description and canonical.
- `public/llms.txt` — machine-readable summary for AI assistants.
- `public/sitemap.xml`, `public/robots.txt`, `public/_redirects`.
- `public/a5f401fab57d5ec353669aa8835382ac.txt` — the IndexNow key. `.github/workflows/deploy.yml` tells Bing (and so Microsoft Copilot), Yandex, Seznam and Naver after each production deploy; Google does not use IndexNow, it reads the sitemap.
- `vercel.json` — one URL per page (see below), the security headers (a new external script, font, image or API host has to be added to the Content-Security-Policy here), and a year of `immutable` caching for `/assets` and `/chunks`, whose file names are content hashes.
- `scripts/swManifest.ts` — writes the build's file list into `dist/sw.js`, so each deploy installs a new service worker that clears out the files it replaced.

---

## The canonical address

Every page names one canonical origin: `<link rel="canonical">`, `og:url`, the JSON-LD ids, the sitemap's `<loc>`s, robots.txt's `Sitemap:` line and llms.txt. The source files are written with the default in `scripts/siteOrigin.ts`; the build swaps it for the address the deployment is actually served from, in this order:

1. `SITE_ORIGIN` from the host's build environment — the ONE address meant to rank. Set it on every deployment of this repo.
2. Netlify's `URL` (the site's production address).
3. Vercel's `VERCEL_PROJECT_PRODUCTION_URL`.
4. The default in `scripts/siteOrigin.ts`, for local builds.

So an untouched deployment names itself, never a host it does not serve. When `SITE_ORIGIN` names a different host than the deployment's own production address, that deployment still serves every page itself (nothing redirects, the owner's call on 2026-11-26); only its canonical tags name the `SITE_ORIGIN` host.

This repo is deployed to more than one host; every host serves the whole site, and all of them name one canonical, so search engines credit one address. A canonical pointing at a host that serves something else tells every crawler to index that other thing instead.

The canonical is `https://bhavye.vercel.app`, the default in `scripts/siteOrigin.ts`. The Netlify copies (bhavyethakkar, thakkarbhavya, bhavyathakkar and thakkarbhavye .netlify.app) get `SITE_ORIGIN` from `netlify.toml` in this repo, so every Netlify build serves the site and names the Vercel address as its canonical; nothing has to be set in the Netlify dashboard. On Vercel, `vercel.json` keeps one URL per page (`cleanUrls` serves each route's own built HTML file and redirects `/page.html` to `/page`; `trailingSlash: false` redirects `/page/` to `/page`) and leaves an unknown path to `dist/404.html` with a real 404 status instead of rewriting it to the home page.

---

## Deploying

Any static host. `npm run build` emits `dist/`.

The app routes with `history.pushState`, and the build writes a static HTML file per route (`scripts/routePages.ts`), so the host has to serve `/project/<slug>` from `project/<slug>.html` and so on. `public/_redirects` covers Netlify; `vercel.json` does it with `cleanUrls`; the `_redirects` comment lists the GitHub Pages and nginx equivalents.
