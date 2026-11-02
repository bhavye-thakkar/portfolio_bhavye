<script setup lang="ts">
import { ref, watch } from "vue";
import { holdHome as holdHomeTriggers, releaseHome as releaseHomeTriggers } from "../../../composables/useHomeHold";
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
 * Only `transform` and `opacity` are animated, as WAAPI animations, so the
 * compositor plays all of it whatever the main thread is doing. It used to be a
 * clip-path GSAP wrote every frame, and Chrome runs clip-path on the main thread
 * (block it for 800 ms and those frames stop, a transform's do not): on a phone
 * the fold's fastest 150 ms, also the page's busiest, came out in about three
 * frames. A flat colour scaled to a rounded box is the same picture as a clip,
 * and the artwork rides beside it rather than inside it.
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

let homeScroll: number | null = null;
let loaded: ProjectPreview[] = [];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const loadPreviews = async () => {
  const load = previews[locale.value as keyof typeof previews];
  if (load) loaded = (await load()).default;
};
loadPreviews();
watch(locale, loadPreviews);

type Card = { rect: DOMRect; radius: number };

/** The card's artwork rect, if that card is actually on screen right now. */
const cardRect = (slug: string): Card | null => {
  const card = document.querySelector<HTMLElement>(`.preview-card[href="/project/${slug}"] .preview-card-image-wrapper`);
  if (!card) return null;
  const rect = card.getBoundingClientRect();
  const visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
  if (!visible) return null;
  return { rect, radius: parseFloat(getComputedStyle(card).borderTopLeftRadius) || 16 };
};

/** Where the card lands: measured with home's 0.97 step-back off, since the compositor cannot follow it live. */
const settledCardRect = (slug: string) => {
  const home = document.querySelector<HTMLElement>(".home-wrapper");
  if (home) home.style.animation = "none";
  const card = cardRect(slug);
  if (home) home.style.animation = "";
  return card;
};

/** Lays the sheet, a viewport-sized box with its origin at the corner, over a box. */
const over = (left: number, top: number, width: number, height: number) =>
  `translate(${left}px, ${top}px) scale(${width / window.innerWidth}, ${height / window.innerHeight})`;

/**
 * The corners scale with the sheet, so they are drawn at whatever lands on the
 * card's own radius, and the open box overscans the screen by that much so they
 * are off it when the sheet is full.
 */
const cardShape = ({ rect, radius }: Card) => {
  const rx = (radius * window.innerWidth) / rect.width;
  const ry = (radius * window.innerHeight) / rect.height;
  return {
    corners: `${rx}px / ${ry}px`,
    closed: over(rect.left, rect.top, rect.width, rect.height),
    open: over(-rx, -ry, window.innerWidth + 2 * rx, window.innerHeight + 2 * ry),
  };
};

/** With no card to grow from: the bottom edge, its top corners overscanned the same way. */
const belowShape = () => ({
  corners: "48px 48px 0 0",
  closed: over(0, window.innerHeight, window.innerWidth, window.innerHeight),
  open: over(0, -48, window.innerWidth, window.innerHeight + 48),
});

// GSAP's expo.out and power curves, which this was tuned on.
const EXPO_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const POWER1_OUT = "cubic-bezier(0.5, 1, 0.89, 1)";
const POWER1_IN_OUT = "cubic-bezier(0.45, 0, 0.55, 1)";
const POWER2_OUT = "cubic-bezier(0.33, 1, 0.68, 1)";
const POWER3_OUT = "cubic-bezier(0.25, 1, 0.5, 1)";
const POWER3_IN = "cubic-bezier(0.5, 0, 0.75, 0)";

let running: Animation[] = [];

const stop = () => {
  running.forEach((animation) => animation.cancel());
  running = [];
};

const play = (element: HTMLElement | null, keyframes: Keyframe[], duration: number, easing: string, delay = 0) => {
  const animation = element?.animate(keyframes, { duration, easing, delay, fill: "both" });
  if (animation) running.push(animation);
};

/** Hides everything once the last move lands, unless a newer transition has taken over. */
const finish = () => {
  const mine = running;
  Promise.all(mine.map((animation) => animation.finished)).then(
    () => {
      if (mine !== running) return;
      [sheet.value, blend.value, art.value].forEach((element) => element?.style.removeProperty("visibility"));
      stop();
    },
    () => {},
  );
};

const showSheet = (corners: string) => {
  for (const element of [sheet.value, blend.value]) if (element) element.style.visibility = "visible";
  if (sheet.value) sheet.value.style.borderRadius = corners;
};

const placeArt = ({ rect, radius }: Card) => {
  if (!art.value) return;
  Object.assign(art.value.style, {
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    borderRadius: `${radius}px`,
    visibility: "visible",
  });
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
// The hold itself lives in composables/useHomeHold.ts, shared with the
// library page; this page keeps its own triggers (inside `.project-wrapper`) live.
const holdHome = () => holdHomeTriggers(".project-wrapper");
const releaseHome = releaseHomeTriggers;

const enter = (slug: string) => {
  stop();
  holdHome();
  // window.scrollY, not lenis.scroll: the smoothed value is not settled at the
  // moment of a click. The page takes the scroll over when it becomes visible.
  homeScroll = window.scrollY;

  const origin = setArt(slug) ? cardRect(slug) : null;

  if (reducedMotion()) {
    showSheet("0");
    play(blend.value, [{ opacity: 0 }, { opacity: 0.5, offset: 0.36 }, { opacity: 0.5 }], 550, "linear");
    finish();
    return;
  }

  play(blend.value, [{ opacity: 0 }, { opacity: 0.5 }], 450, POWER2_OUT);

  if (origin) {
    const shape = cardShape(origin);
    showSheet(shape.corners);
    placeArt(origin);
    // expo.out: half the distance is covered in the first ~100ms, so the click
    // is answered on the very next frames and the sheet still lands softly.
    // 0.5s: 99% open at 380ms, when the page mounts on top of it.
    play(sheet.value, [{ transform: shape.closed }, { transform: shape.open }], 500, EXPO_OUT);
    // The artwork pushes in a little as it dissolves: the camera going through
    // the card, not the card being blown up into a cover.
    play(art.value, [{ transform: "scale(1)" }, { transform: "scale(1.12)" }], 500, EXPO_OUT);
    // Still fading as the page mounts at 380ms, so the artwork dissolves into
    // the page instead of leaving an empty sheet between the two.
    play(art.value, [{ opacity: 1 }, { opacity: 0 }], 340, POWER1_IN_OUT, 140);
  } else {
    const shape = belowShape();
    showSheet(shape.corners);
    play(sheet.value, [{ transform: shape.closed }, { transform: shape.open }], 550, POWER3_OUT);
  }
  finish();
};

const exit = (slug: string) => {
  stop();

  // Home is back in flow by now (this watcher runs after the DOM update), so
  // put it back where the visitor left it before measuring the card. A deep
  // link has nowhere to go back to, so it lands on the Projects section.
  const projects = document.getElementById("projects");
  const restore = homeScroll ?? (projects ? projects.getBoundingClientRect().top + window.scrollY : 0);
  homeScroll = null;
  lenis.value?.scrollTo(restore, { immediate: true, force: true });
  window.scrollTo(0, restore);
  releaseHome();

  const target = setArt(slug) ? settledCardRect(slug) : null;

  // The sheet covers the home page from the very first frame: the project content
  // fades on top of a sheet of its own background colour, never over the grid.
  if (reducedMotion()) {
    showSheet("0");
    play(sheet.value, [{ opacity: 1 }, { opacity: 0 }], 250, POWER1_OUT, 100);
    play(blend.value, [{ opacity: 0.5 }, { opacity: 0 }], 250, POWER1_OUT, 100);
    finish();
    return;
  }

  // The content recedes over ~0.2s (Project.vue); the sheet starts folding
  // while it is still going, so there is no beat where nothing moves.
  const at = 40;
  play(blend.value, [{ opacity: 0.5 }, { opacity: 0 }], 550, POWER2_OUT, at);

  if (target) {
    const shape = cardShape(target);
    showSheet(shape.corners);
    placeArt(target);
    // expo.out, the enter's own curve: most of the fold happens in the first
    // ~150ms, which is what reads as the page answering the Back button.
    play(sheet.value, [{ transform: shape.open }, { transform: shape.closed }], 620, EXPO_OUT, at);
    play(art.value, [{ opacity: 0 }, { opacity: 1 }], 240, POWER1_OUT, at + 100);
  } else {
    const shape = belowShape();
    showSheet(shape.corners);
    play(sheet.value, [{ transform: shape.open }, { transform: shape.closed }], 500, POWER3_IN, at);
  }
  finish();
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
  ></div>
  <img ref="art" class="project-background-art" alt="" />
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
  transform-origin: 0 0;
  will-change: transform;

  /* Fixed, so these are viewport coordinates, which is what
     `getBoundingClientRect` hands over. Above the sheet, under the page. */
  &-art {
    position: fixed;
    top: 0;
    left: 0;
    z-index: calc(var(--z-index-project-background) - 2);
    object-fit: cover;
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
    will-change: transform, opacity;
  }

  &-blend {
    position: fixed;
    inset: 0;
    z-index: calc(var(--z-index-project-background) - 4);
    background-color: rgb(21, 34, 66);
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
    will-change: opacity;
  }
}
</style>
