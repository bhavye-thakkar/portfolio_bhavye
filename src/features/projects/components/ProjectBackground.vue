<script setup lang="ts">
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ref, watch } from "vue";
import { projectId, recentProjectId } from "../../../composables/useRouteObserver";
import { lenis } from "../../../composables/useScroll";
import { preloaderVisible } from "../../../composables/usePreloader";
import { previews } from "../../../content/projects/previews";
import { locale } from "../../../i18n/store";

import type { ProjectPreview } from "../../../content/types";

/**
 * ─── THE SHEET A PROJECT PAGE GROWS OUT OF ────────────────────────────────
 *
 * Opening a project used to slide a full-width panel up from the bottom of the
 * screen, whatever had been clicked, and that panel was transparent: its colour
 * token came from the old per-project themes, which no longer exist. What a
 * visitor actually saw was the grid going grey, a jump, a blank beat and then
 * the page. Leaving cut the page out in one frame.
 *
 * Now the sheet starts as the clicked card's own artwork, clipped to the card,
 * and opens out to the full screen while the artwork fades, so the page reads
 * as the card being entered rather than a new page arriving. Leaving runs the
 * same move backwards into the card, with the artwork fading back in as the
 * sheet lands. Where there is no card on screen to grow from (a deep link, the
 * browser's forward button, a card scrolled out of view) the sheet rises from
 * the bottom edge and sinks back into it, the old gesture, done properly.
 *
 * The page content itself rides on top (App.vue / Project.vue): it appears as
 * the sheet finishes opening and recedes before the sheet starts to close.
 *
 * Only `clip-path` and `opacity` are animated, nothing that triggers layout.
 */

const sheet = ref<HTMLDivElement | null>(null);
const blend = ref<HTMLDivElement | null>(null);
const art = ref<HTMLImageElement | null>(null);

/**
 * Set on the element directly rather than through a binding: a bound `src`
 * lands on the next render, one frame after the sheet has already started to
 * open. The card has just displayed this exact file, so it is decoded and in
 * the memory cache, and it paints on the first frame.
 */
const setArt = (slug: string) => {
  const src = loaded.find((preview) => preview.slug === slug)?.thumbnail;
  if (art.value && src && art.value.getAttribute("src") !== src) art.value.src = src;
  return !!src;
};

let timeline: gsap.core.Timeline | null = null;
let homeScroll: number | null = null;
let loaded: ProjectPreview[] = [];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const loadPreviews = async () => {
  const load = previews[locale.value as keyof typeof previews];
  if (load) loaded = (await load()).default;
};
loadPreviews();
watch(locale, loadPreviews);

/** The card's artwork rect, if that card is actually on screen right now. */
const cardRect = (slug: string) => {
  const card = document.querySelector<HTMLElement>(`.preview-card[href="/project/${slug}"] .preview-card-image-wrapper`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  const visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  if (!visible) return null;
  return { rect, radius: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 16 };
};

const insetFor = (rect: DOMRect, radius: number, k = 1) => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const r = `${radius * k}px`;
  return `inset(${rect.top * k}px ${(w - rect.right) * k}px ${(h - rect.bottom) * k}px ${rect.left * k}px round ${r} ${r} ${r} ${r})`;
};

/**
 * ── HOME HOLDS STILL WHILE A PROJECT IS OPEN ──────────────────────────────
 *
 * The project page takes the document scroll while home sits `fixed` under it,
 * and home's ScrollTriggers went on scrubbing to that scroll: reading to the
 * bottom of the case study moved the hidden home page into About and
 * Experience (weights about 0.56, experience 0.23), running its timelines,
 * callbacks and monitor redraws for a page nobody could see. The Experience
 * story page tears the home timelines down (`storyActive`); a project page only
 * needs them paused, so they are disabled without reverting, which keeps home
 * exactly as the visitor left it, and re-enabled once the home scroll is back.
 *
 * Only triggers outside the project page are held, its own media and text
 * triggers are created after this and stay live.
 */
let heldTriggers: ScrollTrigger[] = [];

const holdHome = () => {
  const held = ScrollTrigger.getAll().filter(
    // `enabled` exists at runtime but is missing from gsap's type definitions.
    (st) => (st as ScrollTrigger & { enabled: boolean }).enabled && !(st.trigger instanceof Element && st.trigger.closest(".project-wrapper")),
  );
  held.forEach((st) => st.disable(false));
  heldTriggers.push(...held);
};

const releaseHome = () => {
  // ponytail: a trigger rebuilt by a resize while the page was open is new and
  // was never held; it has scrubbed along with the page and simply refreshes.
  const alive = new Set(ScrollTrigger.getAll());
  heldTriggers.filter((st) => alive.has(st)).forEach((st) => st.enable(false));
  heldTriggers = [];
  ScrollTrigger.update();
};

const FULL = "inset(0px 0px 0px 0px round 0px 0px 0px 0px)";
const BELOW = "inset(100% 0px 0px 0px round 48px 48px 0px 0px)";

const placeArt = (rect: DOMRect | null) => {
  if (!art.value || !rect) return;
  gsap.set(art.value, { top: rect.top, left: rect.left, width: rect.width, height: rect.height });
};

const enter = (slug: string) => {
  timeline?.kill();
  holdHome();
  // window.scrollY, not lenis.scroll: the smoothed value is not settled at the
  // moment of a click. The page takes the scroll over when it becomes visible.
  homeScroll = window.scrollY;

  const origin = setArt(slug) ? cardRect(slug) : null;

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set([sheet.value, blend.value], { visibility: "hidden" });
    },
  });
  timeline = tl;

  gsap.set(sheet.value, { visibility: "visible" });
  gsap.set(blend.value, { visibility: "visible", opacity: 0 });

  if (reducedMotion()) {
    gsap.set(sheet.value, { clipPath: FULL });
    gsap.set(art.value, { opacity: 0 });
    tl.to(blend.value, { opacity: 0.5, duration: 0.2 }, 0).to({}, { duration: 0.35 });
    return;
  }

  tl.to(blend.value, { opacity: 0.5, duration: 0.45, ease: "power2.out" }, 0);

  if (origin) {
    placeArt(origin.rect);
    gsap.set(art.value, { opacity: 1, scale: 1 });
    gsap.set(sheet.value, { clipPath: insetFor(origin.rect, origin.radius) });
    // expo.out: half the distance is covered in the first ~100ms, so the click
    // is answered on the very next frames and the sheet still lands softly.
    // 0.5s: 99% open at 380ms, when the page mounts on top of it.
    tl.to(sheet.value, { clipPath: FULL, duration: 0.5, ease: "expo.out" }, 0);
    // The artwork pushes in a little as it dissolves: the camera going through
    // the card, not the card being blown up into a cover.
    tl.to(art.value, { scale: 1.12, duration: 0.5, ease: "expo.out" }, 0);
    // Still fading as the page mounts at 380ms, so the artwork dissolves into
    // the page instead of leaving an empty sheet between the two.
    tl.to(art.value, { opacity: 0, duration: 0.34, ease: "power1.inOut" }, 0.14);
  } else {
    gsap.set(art.value, { opacity: 0 });
    gsap.set(sheet.value, { clipPath: BELOW });
    tl.to(sheet.value, { clipPath: FULL, duration: 0.55, ease: "power3.out" }, 0);
  }
};

const exit = (slug: string) => {
  timeline?.kill();

  // Home is back in flow by now (this watcher runs after the DOM update), so
  // put it back where the visitor left it before measuring the card. A deep
  // link has nowhere to go back to, so it lands on the Projects section.
  const projects = document.getElementById("projects");
  const restore = homeScroll ?? (projects ? projects.getBoundingClientRect().top + window.scrollY : 0);
  homeScroll = null;
  lenis.value?.scrollTo(restore, { immediate: true, force: true });
  window.scrollTo(0, restore);
  releaseHome();

  const target = setArt(slug) ? cardRect(slug) : null;

  const tl = gsap.timeline({
    onComplete: () => {
      gsap.set([sheet.value, blend.value], { visibility: "hidden" });
      gsap.set(art.value, { opacity: 0 });
    },
  });
  timeline = tl;

  // Covers the home page from the very first frame: the project content fades
  // on top of a sheet of its own background colour, never over the grid.
  gsap.set(sheet.value, { visibility: "visible", clipPath: FULL });
  gsap.set(blend.value, { visibility: "visible", opacity: 0.5 });
  gsap.set(art.value, { opacity: 0, scale: 1 });

  if (reducedMotion()) {
    tl.to([sheet.value, blend.value], { opacity: 0, duration: 0.25 }, 0.1).set(sheet.value, { opacity: 1 });
    return;
  }

  // The content recedes over ~0.2s (Project.vue); the sheet starts folding
  // while it is still going, so there is no beat where nothing moves.
  const at = 0.04;
  tl.to(blend.value, { opacity: 0, duration: 0.55, ease: "power2.out" }, at);

  if (target) {
    // Tracked live rather than aimed at one measurement: home is still easing
    // back from its 0.97 step-back while this runs, and the visitor may already
    // be scrolling, so the card keeps moving until the sheet lands on it.
    let last = target;
    const fold = { k: 1 };
    const follow = () => {
      last = cardRect(slug) ?? last;
      placeArt(last.rect);
      gsap.set(sheet.value, { clipPath: insetFor(last.rect, last.radius, 1 - fold.k) });
    };
    placeArt(target.rect);
    // expo.out, the enter's own curve: most of the fold happens in the first
    // ~150ms, which is what reads as the page answering the Back button.
    tl.to(fold, { k: 0, duration: 0.62, ease: "expo.out", onUpdate: follow }, at);
    tl.to(art.value, { opacity: 1, duration: 0.24, ease: "power1.out" }, at + 0.1);
  } else {
    tl.to(sheet.value, { clipPath: BELOW, duration: 0.5, ease: "power3.in" }, at);
  }
};

watch(
  projectId,
  (id, previous) => {
    if (previous == null && id) enter(id);
    else if (previous && id == null) exit(previous);
  },
  { flush: "post" },
);

// A cold link straight to a project never runs `enter`: home builds its
// triggers underneath while the preloader is up, so hold them once it is gone.
// The card artwork is lazy and has never been near the viewport on this visit,
// so fetch it now; otherwise Back folds the sheet into a card that has no art.
watch(preloaderVisible, (visible) => {
  if (!visible && projectId.value) {
    holdHome();
    setArt(projectId.value);
  }
});
</script>

<template>
  <div ref="blend" :class="['project-background-blend', typeof recentProjectId === 'string' && `project-${recentProjectId}`]"></div>
  <div
    ref="sheet"
    :class="['project-background', typeof recentProjectId === 'string' && `project-${recentProjectId}`]"
    aria-hidden="true"
  >
    <img ref="art" class="project-background-art" alt="" />
  </div>
</template>

<style scoped lang="scss">
.project-background {
  position: fixed;
  inset: 0;
  /* The old per-project themes defined background-300; none of the current
     projects do, and an undefined token here is what made the sheet
     transparent. The page's own background is the fallback, so the sheet is
     exactly the colour of the page it becomes. */
  background-color: var(--color-background-300, var(--color-background-400));
  z-index: calc(var(--z-index-project-background) - 3);
  pointer-events: none;
  visibility: hidden;
  clip-path: inset(100% 0px 0px 0px round 48px 48px 0px 0px);
  will-change: clip-path;

  /* The sheet is fixed at inset 0, so absolute here is viewport coordinates,
     which is what `getBoundingClientRect` hands over. */
  &-art {
    position: absolute;
    top: 0;
    left: 0;
    object-fit: cover;
    opacity: 0;
  }

  &-blend {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-index-project-background) - 4);
    background-color: rgb(21, 34, 66);
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
}
</style>
