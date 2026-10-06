<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import Link from "../../../components/Link.vue";
import Breadcrumbs from "../../../components/Breadcrumbs.vue";
import ButtonRound from "../../../components/ButtonRound.vue";
import ArrowRight from "../../../components/icons/ArrowRight.vue";
import { t } from "../../../i18n/utils/translate";
import { books, shelves, bookBySlug, coverSrc, coverSrcset, type Book, type Shelf } from "../../../content/library";
import { libraryActive, libraryVisible, bookId } from "../../../composables/useRouteObserver";
import { useAgent } from "../../../composables/useAgent";
import { lenis } from "../../../composables/useScroll";
import { holdHome, releaseHome } from "../../../composables/useHomeHold";
import { createArchive, metrics } from "../useArchive";

/**
 * ─── /library ─────────────────────────────────────────────────────────────
 *
 * A personal reading archive: the books standing on one long shelf, spines
 * out, about half the screen tall, the way the reference archive stands its
 * editions up. The shelf moves sideways without end; the motion, the drag,
 * the wheel and the keys are all in `../useArchive.ts`, this file is the
 * markup, each book's own build and the glue to the route.
 *
 * The page replaces home the way a project page does (App.vue): home goes
 * fixed and hidden, the renderer stops, the home ScrollTriggers are held, and
 * this takes the document. The root carries `data-lenis-prevent` (Lenis
 * leaves wheel and touch inside it alone) and `data-scene-blocker` (the 3D
 * scene's window-level click never reaches the room behind).
 *
 * ── A BOOK IS A SPINE WITH ITS COVER BEHIND IT ────────────────────────────
 *
 * Each book is two faces in CSS 3D: the spine, which faces the shelf, and the
 * front cover, hinged at the spine's right edge and standing back into the
 * shelf. The whole book is turned a few degrees so the cover shows as a
 * sliver, like a row of books seen from a little to the left. The spine is
 * typographic, title and author set vertically on the colour its own cover
 * is mostly made of, because publishers' spine artwork cannot be sourced for
 * every book and a drawn spine is honest about that. The cover is the real
 * one. The book page turns the book over.
 *
 * ── REAL PROPORTIONS ──────────────────────────────────────────────────────
 *
 * The spine's thickness comes from the book's page count (content/library.ts),
 * at roughly a paperback's ratio of thickness to height, so a 575-page epic
 * stands next to a 126-page novella the way they do on a real shelf. Height,
 * the angle it stands at and the air after it come from a hash of the slug,
 * so the same book always stands the same way. Every book is on the shelf
 * exactly once; the three groups are marked by bookends standing between them.
 */

const { isTouch } = useAgent();
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rootRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const counterRef = ref<HTMLElement | null>(null);
const scrubRef = ref<HTMLElement | null>(null);
const slotEls: HTMLElement[] = [];

/** A small, stable number from a slug. */
const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const unit = (h: number, shift: number) => ((h >>> shift) % 1000) / 1000;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Relative luminance of a hex colour, for choosing the ink on a spine. */
const luminance = (hex: string) => {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

type Geometry = {
  /** Spine width, cover width, air after the book, all as multiples of the row's book height. */
  spine: number;
  cover: number;
  air: number;
  /** Height variation around 1. */
  scale: number;
  /** Degrees the book is turned toward the shelf, showing its cover. */
  angle: number;
  /** The whole footprint on the shelf, as a multiple of the book height. */
  footprint: number;
  ink: "light" | "dark";
};

const geometryCache = new Map<string, Geometry>();

const geometryOf = (book: Book): Geometry => {
  const cached = geometryCache.get(book.slug);
  if (cached) return cached;
  const h = hash(book.slug);
  // One book in four stands turned enough to show a real piece of its cover;
  // the rest show a sliver. The spine stays the face you read either way.
  const turned = unit(h, 4) < 0.25;
  const angle = turned ? 16 + unit(h, 8) * 8 : 6 + unit(h, 8) * 7;
  // A paperback is about 0.065 of its height thick per 200 pages, boards
  // included; the clamp keeps a novella readable and an epic believable.
  const spine = clamp(0.028 + book.pages * 0.00027, 0.052, 0.19);
  const scale = 0.93 + unit(h, 16) * 0.12;
  const air = 0.008 + unit(h, 20) * 0.045;
  const cover = book.cover.width / book.cover.height;
  const rad = (angle * Math.PI) / 180;
  const footprint = (spine * Math.cos(rad) + cover * Math.sin(rad)) * scale + air;
  const geometry: Geometry = { spine, cover, air, scale, angle, footprint, ink: luminance(book.spine) > 0.42 ? "dark" : "light" };
  geometryCache.set(book.slug, geometry);
  return geometry;
};

/** The bookend that marks a group: narrow, a little shorter than the books. */
const DIVIDER_FOOTPRINT = 0.075;

const bookStyle = (book: Book) => {
  const g = geometryOf(book);
  return {
    "--spine": g.spine,
    "--cover": g.cover,
    "--scale": g.scale,
    "--angle": `${g.angle.toFixed(1)}deg`,
    "--spine-color": book.spine,
    "--spine-ink": g.ink === "dark" ? "rgba(20, 16, 10, 0.92)" : "rgba(255, 250, 242, 0.95)",
    "--spine-ink-dim": g.ink === "dark" ? "rgba(20, 16, 10, 0.62)" : "rgba(255, 250, 242, 0.7)",
  };
};

type Item =
  | { key: string; kind: "book"; book: Book; ordinal: number; copy: number }
  | { key: string; kind: "divider"; shelf: Shelf; copy: number };

/**
 * The set is repeated only if one pass of it is narrower than the screen plus
 * a book (a very wide monitor at a small height); on anything usual the shelf
 * is longer than the screen and every book is on it once.
 */
const copies = ref(1);

const items = computed<Item[]>(() => {
  const list: Item[] = [];
  for (let copy = 0; copy < copies.value; copy++) {
    let ordinal = 0;
    for (const shelf of shelves) {
      list.push({ key: `group-${shelf.slug}-${copy}`, kind: "divider", shelf, copy });
      for (const slug of shelf.books) {
        const book = bookBySlug(slug);
        if (book) list.push({ key: `${slug}-${copy}`, kind: "book", book, ordinal: ++ordinal, copy });
      }
    }
  }
  return list;
});

const count = computed(() => books.length);

const onCurrent = (ordinal: number) => {
  if (counterRef.value) counterRef.value.textContent = String(ordinal);
  if (scrubRef.value) scrubRef.value.style.transform = `scaleX(${count.value > 1 ? (ordinal - 1) / (count.value - 1) : 1})`;
};

const archive = createArchive({ reducedMotion, onCurrent });

const setSlot = (index: number, el: unknown) => {
  slotEls[index] = el as HTMLElement;
};

const collectRow = () =>
  archive.setRows([
    {
      el: trackRef.value!,
      nodes: items.value.map((_, i) => slotEls[i]).filter((node): node is HTMLElement => !!node),
      footprints: items.value.map((item) => (item.kind === "book" ? geometryOf(item.book).footprint : DIVIDER_FOOTPRINT)),
      ordinals: items.value.map((item) => (item.kind === "book" ? item.ordinal : null)),
      direction: -1,
      depth: 1,
    },
  ]);

let lastMetrics = { bookH: 0, gap: 0, width: 0 };

const layout = async () => {
  const root = rootRef.value;
  if (!root) return;
  const { bookH, gap } = metrics(window.innerWidth, window.innerHeight);
  const width = root.clientWidth;
  root.style.setProperty("--book-h", `${bookH}px`);

  let length = 0;
  let maxW = 0;
  for (const shelf of shelves) {
    length += Math.round(bookH * DIVIDER_FOOTPRINT) + gap;
    for (const slug of shelf.books) {
      const book = bookBySlug(slug);
      if (!book) continue;
      const w = Math.round(bookH * geometryOf(book).footprint);
      maxW = Math.max(maxW, w);
      length += w + gap;
    }
  }
  const next = Math.max(1, Math.ceil((width + maxW + gap) / Math.max(1, length)));
  if (next !== copies.value) {
    copies.value = next;
    await nextTick();
    collectRow();
  }
  lastMetrics = { bookH, gap, width };
  archive.layout(bookH, gap, width);
};

let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  await nextTick();
  if (rootRef.value) archive.mount(rootRef.value);
  collectRow();
  await layout();
  resizeObserver = new ResizeObserver(() => {
    const { innerWidth, innerHeight } = window;
    const { bookH, gap } = metrics(innerWidth, innerHeight);
    if (bookH === lastMetrics.bookH && gap === lastMetrics.gap && rootRef.value?.clientWidth === lastMetrics.width) return;
    void layout();
  });
  resizeObserver.observe(rootRef.value as HTMLElement);
  if (libraryActive.value) archive.start();
});

// The shelf only moves while the route is this page: nothing ticks for a
// page that is not on screen.
watch(libraryActive, (active) => {
  if (active) archive.start();
  else archive.stop();
});

// A book page over the shelf: it holds still and answers nothing until it closes.
watch(bookId, (id) => archive.setPaused(id !== null), { immediate: true });

/**
 * ── HOME, HELD AND PUT BACK ───────────────────────────────────────────────
 *
 * Same contract as a project page (ProjectBackground.vue): on the way in,
 * home's ScrollTriggers are held and its scroll offset remembered, because
 * home goes `position: fixed` and the document becomes this page. On the way
 * out, after the DOM update that puts home back in flow (`flush: "post"`),
 * the offset is restored and the triggers released. A visitor who arrived
 * here cold has nowhere to go back to and lands at the top.
 */
let homeScroll: number | null = null;

watch(
  libraryActive,
  (active, wasActive) => {
    if (active && !wasActive) {
      holdHome();
      homeScroll = window.scrollY;
    } else if (!active && wasActive) {
      const restore = homeScroll ?? 0;
      homeScroll = null;
      lenis.value?.scrollTo(restore, { immediate: true, force: true });
      window.scrollTo(0, restore);
      releaseHome();
    }
  },
  { flush: "post" },
);

// A cold link straight here never runs the branch above with home in flow:
// home builds its triggers underneath while the preloader is up, so hold them
// once the page is actually standing.
if (libraryActive.value) {
  holdHome();
  homeScroll = null;
}

// Once this page owns the document, it starts at its top, whatever offset
// home was scrolled to.
watch(libraryVisible, (visible) => {
  if (!visible) return;
  lenis.value?.scrollTo(0, { immediate: true, force: true });
  window.scrollTo(0, 0);
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  archive.destroy();
});
</script>

<template>
  <section ref="rootRef" class="library" data-scene-blocker data-lenis-prevent :inert="bookId !== null" aria-labelledby="library-title">
    <header class="library-masthead">
      <div class="library-masthead-title">
        <Breadcrumbs class="library-breadcrumbs" variant="light" :trail="[{ label: t('home'), to: '/' }]" :current="t('library')" />
        <h1 id="library-title" class="library-title">{{ t("library") }}</h1>
      </div>
      <div class="library-masthead-copy">
        <p class="library-intro">{{ t("library-intro", { count }) }}</p>
        <p class="library-hint library-hint-top">{{ isTouch ? t("library-hint-touch") : t("library-hint-pointer") }}</p>
      </div>
    </header>

    <div class="library-shelf">
      <!-- The track is what gets dragged. `pan-y` leaves vertical pans to the
           browser; only a sideways move becomes a drag (useArchive.ts). -->
      <ul ref="trackRef" class="library-track" :aria-label="t('library')">
        <li
          v-for="(item, i) in items"
          :key="item.key"
          class="library-slot"
          :class="{ 'library-slot-divider': item.kind === 'divider' }"
          :ref="(el) => setSlot(i, el)"
        >
          <Link
            v-if="item.kind === 'book'"
            :to="`/library/${item.book.slug}`"
            class="library-book"
            :style="bookStyle(item.book)"
            :aria-label="`${item.book.title}, ${item.book.author}`"
            draggable="false"
            data-cursor="circle-black"
            data-sound="click"
            data-hoversound="hover"
          >
            <span class="library-book-shadow" aria-hidden="true"></span>
            <span class="library-book-object">
              <span class="library-book-spine">
                <span class="library-book-spine-title">{{ item.book.title }}</span>
                <span class="library-book-spine-author">{{ item.book.author }}</span>
              </span>
              <span class="library-book-face">
                <img
                  class="library-book-cover"
                  :src="coverSrc(item.book.slug, 480)"
                  :srcset="coverSrcset(item.book.slug)"
                  sizes="(orientation: portrait) 300px, 340px"
                  :width="item.book.cover.width"
                  :height="item.book.cover.height"
                  :alt="`Cover of ${item.book.title} by ${item.book.author}`"
                  :loading="item.copy === 0 && item.ordinal <= 6 ? 'eager' : 'lazy'"
                  :fetchpriority="item.copy === 0 && item.ordinal <= 3 ? 'high' : undefined"
                  decoding="async"
                  draggable="false"
                />
              </span>
            </span>
          </Link>
          <!-- A bookend between groups, carrying the group's name. -->
          <span v-else class="library-bookend" role="separator" :aria-label="item.shelf.title">
            <span class="library-bookend-label">{{ item.shelf.title }}</span>
          </span>
        </li>
      </ul>

      <!-- The way along the shelf without a wheel or a finger: one book a press. -->
      <div v-if="!isTouch" class="library-arrows">
        <ButtonRound
          variant="border"
          class="library-arrow library-arrow-prev"
          :aria-label="t('previous-book')"
          data-cursor="circle-black"
          data-sound="click"
          data-hoversound="hover"
          @click="archive.stepBy(-1)"
        >
          <ArrowRight class="library-arrow-icon library-arrow-icon-prev" />
        </ButtonRound>
        <ButtonRound
          variant="border"
          class="library-arrow library-arrow-next"
          :aria-label="t('next-book')"
          data-cursor="circle-black"
          data-sound="click"
          data-hoversound="hover"
          @click="archive.stepBy(1)"
        >
          <ArrowRight class="library-arrow-icon" />
        </ButtonRound>
      </div>
    </div>

    <!-- Where along the shelf the reader is: the book nearest the middle. -->
    <div class="library-tools">
      <p class="library-counter" aria-live="off"><span ref="counterRef">1</span><span class="library-counter-sep">/</span>{{ count }}</p>
      <span class="library-scrub" aria-hidden="true"><span ref="scrubRef" class="library-scrub-fill"></span></span>
      <p class="library-hint library-hint-bottom">{{ isTouch ? t("library-hint-touch") : t("library-hint-pointer") }}</p>
    </div>
  </section>
</template>

<style scoped lang="scss">
/**
 * The page is the site's own paper: the same beige and ink as home, Urbanist
 * throughout. The colour comes from the books, and the shelf exists to give
 * them somewhere to stand.
 */
.library {
  --shelf-ink: var(--color-text-400);
  --shelf-ink-dim: var(--color-text-300);
  --shelf-line: var(--color-beige-700);
  --book-h: 400px;
  /* Room above the books for the hover lift. */
  --shelf-air: 18px;
  --board-h: 12px;

  position: relative;
  width: 100%;
  min-height: calc(var(--svh) * 100);
  padding: calc(var(--height-header) + var(--space-sm)) 0 var(--space-lg);
  background: var(--color-background-400);
  color: var(--shelf-ink);
  /* NOT `overflow: hidden`. Lenis's stylesheet gives every `[data-lenis-prevent]`
     element `overscroll-behavior: contain`, and a hidden-overflow box is still a
     scroll container: a finger moving up the page latched onto this element,
     which cannot scroll, and the containment kept the gesture from reaching
     the document. The track clips its own books; nothing here needs clipping. */
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  @include mixins.mq("md") {
    gap: var(--space-lg);
  }
}

/* Title on the left, the copy beside it once there is room. */
.library-masthead {
  width: 100%;
  max-width: var(--breakpoint-xxxl);
  margin: 0 auto;
  padding: 0 var(--space-outer);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);

  @include mixins.landscape {
    @include mixins.mq("md") {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--space-xl);
    }
  }
}

.library-masthead-title,
.library-masthead-copy {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.library-masthead-copy {
  @include mixins.landscape {
    @include mixins.mq("md") {
      max-width: 48ch;
      padding-bottom: var(--space-xs);
    }
  }
}

.library-breadcrumbs {
  color: var(--shelf-ink-dim);
}

.library-title {
  font-weight: 900;
  letter-spacing: 0.02em;
  line-height: var(--line-height-title);
  font-size: var(--font-size-title-md);
  text-wrap: balance;

  @include mixins.mq("md") {
    font-size: var(--font-size-title-lg);
  }

  @include mixins.mq("xl") {
    font-size: var(--font-size-title-xl);
  }
}

.library-intro {
  font-size: var(--font-size-md);
  line-height: var(--line-height-copy);
  color: var(--shelf-ink);
  max-width: 46ch;
  text-wrap: pretty;

  @include mixins.mq("md") {
    font-size: var(--font-size-lg);
  }
}

.library-hint {
  font-size: var(--font-size-xs);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--shelf-ink-dim);
  text-wrap: balance;

  /* On a phone the hint sits under the shelf with the counter, where the thumb is. */
  &-top {
    display: none;

    @include mixins.mq("md") {
      display: block;
    }
  }

  &-bottom {
    text-align: center;

    @include mixins.mq("md") {
      display: none;
    }
  }
}

.library-shelf {
  position: relative;
  width: 100%;
  margin-top: var(--space-sm);
}

/* The track: full-bleed, the books are placed absolutely inside it and the
   board is drawn under them. `pan-y` is load-bearing, see useArchive.ts. */
.library-track {
  position: relative;
  width: 100%;
  height: calc(var(--book-h) + var(--shelf-air) + var(--board-h) + 16px);
  list-style: none;
  touch-action: pan-y;
  cursor: grab;
  overflow: hidden;

  &.is-dragging {
    cursor: grabbing;
  }

  /* The board the books stand on: a front edge, and the shadow it throws on
     the floor below, the way the reference's shelf meets its floor. */
  &::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: calc(var(--shelf-air) + var(--book-h));
    height: var(--board-h);
    background: linear-gradient(to bottom, var(--color-beige-600), var(--shelf-line));
    border-top: var(--stroke-sm) solid rgba(45, 42, 36, 0.14);
    box-shadow: 0 10px 14px -6px rgba(45, 42, 36, 0.28);
    pointer-events: none;
  }
}

.library-slot {
  position: absolute;
  left: 0;
  top: 0;
  height: calc(var(--book-h) + var(--shelf-air));
  /* Set from the data in useArchive.layout(), never read from the DOM. */
  width: 0;
  will-change: transform;
}

.library-book {
  position: absolute;
  inset: 0;
  display: block;
  color: inherit;
  text-decoration: none;
  outline: none;

  &:focus-visible .library-book-spine {
    outline: var(--stroke-md) solid var(--color-orange-400);
    outline-offset: 3px;
  }
}

/* The contact shadow on the board, under the book, outside its 3D context. */
.library-book-shadow {
  position: absolute;
  left: -6%;
  right: 4%;
  bottom: -6px;
  height: 18px;
  background: radial-gradient(60% 100% at 38% 100%, rgba(45, 42, 36, 0.4), rgba(45, 42, 36, 0) 72%);
  pointer-events: none;
}

/* The book: spine facing out, cover hinged behind its right edge, the whole
   thing turned by its own angle around the edge that stays on the shelf. */
.library-book-object {
  position: absolute;
  left: 0;
  bottom: 0;
  width: calc(var(--book-h) * var(--spine) * var(--scale));
  height: calc(var(--book-h) * var(--scale));
  transform-style: preserve-3d;
  transform-origin: 0% 100%;
  transform: perspective(1600px) rotateY(calc(var(--angle) * -1));
  transition: transform 0.5s var(--ease-out-quint);
}

.library-book-spine {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.2em;
  padding: 7% 0 6%;
  writing-mode: vertical-rl;
  overflow: hidden;
  border-radius: 3px 1px 1px 3px;
  color: var(--spine-ink);
  background:
    linear-gradient(to right, rgba(0, 0, 0, 0.26), rgba(255, 255, 255, 0.12) 26%, rgba(255, 255, 255, 0.05) 64%, rgba(0, 0, 0, 0.3)),
    var(--spine-color);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.18),
    inset -1px 0 0 rgba(0, 0, 0, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  backface-visibility: hidden;
}

.library-book-spine-title {
  font-weight: 700;
  font-size: clamp(11px, calc(var(--book-h) * var(--scale) * 0.031), 16px);
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-wrap: balance;
}

.library-book-spine-author {
  font-size: clamp(9px, calc(var(--book-h) * var(--scale) * 0.024), 12px);
  line-height: 1.2;
  letter-spacing: 0.05em;
  color: var(--spine-ink-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The front cover, standing back from the spine's right edge. */
.library-book-face {
  position: absolute;
  top: 0;
  left: 100%;
  height: 100%;
  width: calc(var(--book-h) * var(--scale) * var(--cover));
  transform-origin: 0% 50%;
  transform: rotateY(90deg);
  backface-visibility: hidden;
  overflow: hidden;
  border-radius: 0 4px 4px 0;
  background: var(--color-beige-600);

  /* Light falls off along the cover as it recedes from the spine. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.12), rgba(0, 0, 0, 0.48));
    pointer-events: none;
  }
}

.library-book-cover {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  -webkit-user-drag: none;
}

/* A bookend: a short block of the shelf's own wood with the group's name on
   it, standing between two groups the way a divider card does. */
.library-bookend {
  position: absolute;
  left: 0;
  bottom: 0;
  width: calc(var(--book-h) * 0.05);
  height: calc(var(--book-h) * 0.62);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-top: 8%;
  writing-mode: vertical-rl;
  border-radius: 2px 2px 1px 1px;
  background: linear-gradient(to right, var(--color-beige-700), var(--color-beige-500) 50%, var(--color-beige-700));
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.5),
    0 8px 10px -6px rgba(45, 42, 36, 0.3);
}

.library-bookend-label {
  font-size: var(--font-size-xxs);
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--shelf-ink-dim);
  white-space: nowrap;
}

@include mixins.hover {
  /* The book comes a little way out and squares up, as a hand would pull it. */
  .library-book:hover .library-book-object {
    transform: perspective(1600px) rotateY(calc(var(--angle) * -0.4)) translateY(-12px) translateZ(14px);
  }
}

/* Prev / next, at the shelf's sides, level with the books. */
.library-arrows {
  position: absolute;
  inset: 0 var(--space-outer) auto;
  top: calc(var(--shelf-air) + var(--book-h) * 0.5);
  display: flex;
  justify-content: space-between;
  pointer-events: none;
  transform: translateY(-50%);

  :deep(.library-arrow) {
    pointer-events: auto;
    background-color: rgba(245, 239, 230, 0.86);
    backdrop-filter: blur(2px);
  }
}

.library-arrow-icon {
  width: var(--icon-size-xs);

  &-prev {
    transform: rotate(180deg);
  }
}

/* Counter and the scrub line, centred under the shelf. */
.library-tools {
  width: 100%;
  max-width: var(--breakpoint-xxxl);
  margin: 0 auto;
  padding: 0 var(--space-outer);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}

.library-counter {
  font-size: var(--font-size-sm);
  letter-spacing: 0.14em;
  color: var(--shelf-ink);
  font-variant-numeric: tabular-nums;
}

.library-counter-sep {
  margin: 0 0.5em;
  opacity: 0.45;
}

.library-scrub {
  position: relative;
  display: block;
  width: min(240px, 48vw);
  height: 2px;
  background: var(--shelf-line);
  overflow: hidden;
}

.library-scrub-fill {
  position: absolute;
  inset: 0;
  background: var(--shelf-ink);
  transform-origin: 0 50%;
  transform: scaleX(0);
  transition: transform 0.25s var(--ease-out-quint);
}

@media (prefers-reduced-motion: reduce) {
  .library-book-object,
  .library-scrub-fill {
    transition: none;
  }
}
</style>
