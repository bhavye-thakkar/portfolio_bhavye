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
| `npm run build`     | Typecheck, then production bundle into `dist/`   |
| `npm run preview`   | Serve the production build locally               |

CI runs typecheck → build → asserts the bundle exists, on every push and PR (`.github/workflows/ci.yml`).

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

- `index.html` — title, description, Open Graph, JSON-LD, and a `<noscript>` text version of the page for crawlers that do not run JavaScript.
- `src/composables/useHead.ts` — per-route title, description and canonical.
- `public/llms.txt` — machine-readable summary for AI assistants.
- `public/sitemap.xml`, `public/robots.txt`, `public/_redirects`.

---

## Changing the domain

The production URL appears in five places and they have to move together:

1. `index.html` — `<link rel="canonical">`, `og:url`, and the `@id`/`url` values in the JSON-LD
2. `src/content/profile.ts` — the `site` constant
3. `public/sitemap.xml` — every `<loc>`
4. `public/robots.txt` — the `Sitemap:` line
5. `public/llms.txt` — the links

It is `https://example.com` until then, and nothing will rank while it is.

---

## Deploying

Any static host. `npm run build` emits `dist/`.

The app routes with `history.pushState`, so the host must rewrite unknown paths to `index.html` or `/project/…` and `/experience/…` will 404 on a hard refresh. `public/_redirects` covers Netlify; the file's comment lists the Vercel, GitHub Pages and nginx equivalents.
