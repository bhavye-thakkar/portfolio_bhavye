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
 * ── A BOOK IS A BOX ──────────────────────────────────────────────────────
 *
 * Each book is three faces in CSS 3D, the three a shelf shows: the spine,
 * facing out; the front cover, hinged at the spine's right edge and standing
 * back into the shelf; and the top, the block of pages between the two cover
 * boards, hinged at the spine's top edge. The spine is typographic, title and
 * author set vertically on the colour its own cover is mostly made of, because
 * publishers' spine artwork cannot be sourced for every book and a drawn spine
 * is honest about that. The cover is the real one, at the artwork's own
 * proportions. The book page turns the book over.
 *
 * ── ONE CAMERA ────────────────────────────────────────────────────────────
 *
 * Every book stands the same way: turned `--yaw` so the cover shows, seen
 * from `--pitch` above so the page edges show, with the same perspective
 * (`.library-book` is the perspective container, its origin a little below
 * the books' tops). Nothing about a book's stance comes from the book itself,
 * so the row reads as one shelf photographed once, not as thirty objects each
 * leaning its own way; the row's own movement is a `translate3d` on the slot,
 * outside the book's 3D context, so moving the shelf cannot turn a book. The
 * hover pulls the book out along its own depth, the way a hand does, and lets
 * it back to exactly where it stood.
 *
 * ── REAL PROPORTIONS ──────────────────────────────────────────────────────
 *
 * The spine's thickness comes from the book's page count (content/library.ts),
 * at roughly a paperback's ratio of thickness to height, so a 575-page epic
 * stands next to a 126-page novella the way they do on a real shelf; the
 * cover's width comes from the artwork's own aspect ratio. Every book is on
 * the shelf exactly once; each of the three groups stands between a pair of
 * bracket bookends that carry its name.
 */

const { isTouch } = useAgent();
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The book just clicked: it comes off the shelf and turns toward the reader
 * while its page fades in over the shelf, the first beat of the opening that
 * BookDetail.vue carries on with. Cleared when the page closes, so the book
 * is back in its place when the shelf shows again.
 */
const openingSlug = ref<string | null>(null);
watch(bookId, (id) => {
  if (id === null) openingSlug.value = null;
});

const rootRef = ref<HTMLElement | null>(null);
const trackRef = ref<HTMLElement | null>(null);
const counterRef = ref<HTMLElement | null>(null);
const groupRef = ref<HTMLElement | null>(null);
const scrubRef = ref<HTMLElement | null>(null);
const slotEls: HTMLElement[] = [];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Relative luminance of a hex colour, for choosing the ink on a spine. */
const luminance = (hex: string) => {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/** Degrees every book is turned toward the shelf, showing its cover. Mirrored in `--yaw`. */
const YAW = 24;
/** Air after each book, as a multiple of the book height: spines stand close, not touching. */
const AIR = 0.03;
/** A bracket bookend and the air after it, as a multiple of the book height. */
const BRACKET_FOOTPRINT = 0.14;

type Geometry = {
  /** Spine width and cover width as multiples of the row's book height. */
  spine: number;
  cover: number;
  /** The whole footprint on the shelf, as a multiple of the book height. */
  footprint: number;
  ink: "light" | "dark";
};

const geometryCache = new Map<string, Geometry>();
const YAW_RAD = (YAW * Math.PI) / 180;

const geometryOf = (book: Book): Geometry => {
  const cached = geometryCache.get(book.slug);
  if (cached) return cached;
  // A paperback is about 0.065 of its height thick per 200 pages, boards
  // included; the clamp keeps a novella readable and an epic believable.
  const spine = clamp(0.028 + book.pages * 0.00027, 0.052, 0.19);
  const cover = book.cover.width / book.cover.height;
  const footprint = spine * Math.cos(YAW_RAD) + cover * Math.sin(YAW_RAD) + AIR;
  // Near-black ink reads at 4.5:1 on anything lighter than 0.19 relative
  // luminance; white does on anything darker. The crossover is where both
  // just pass, so the switch sits there, not at the midpoint of the scale.
  const geometry: Geometry = { spine, cover, footprint, ink: luminance(book.spine) > 0.19 ? "dark" : "light" };
  geometryCache.set(book.slug, geometry);
  return geometry;
};

const bookStyle = (book: Book) => {
  const g = geometryOf(book);
  return {
    "--spine": g.spine,
    "--cover": g.cover,
    "--spine-color": book.spine,
    "--spine-ink": g.ink === "dark" ? "rgba(20, 16, 10, 0.92)" : "rgba(255, 250, 242, 0.95)",
    "--spine-ink-dim": g.ink === "dark" ? "rgba(20, 16, 10, 0.62)" : "rgba(255, 250, 242, 0.7)",
  };
};

type Item =
  | { key: string; kind: "book"; book: Book; ordinal: number; copy: number }
  | { key: string; kind: "open" | "close"; shelf: Shelf; copy: number };

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
      list.push({ key: `open-${shelf.slug}-${copy}`, kind: "open", shelf, copy });
      for (const slug of shelf.books) {
        const book = bookBySlug(slug);
        if (book) list.push({ key: `${slug}-${copy}`, kind: "book", book, ordinal: ++ordinal, copy });
      }
      list.push({ key: `close-${shelf.slug}-${copy}`, kind: "close", shelf, copy });
    }
  }
  return list;
});

const count = computed(() => books.length);

/** The group each book (by its 1-based number along the shelf) belongs to. */
const groupOfOrdinal: Shelf[] = [];
for (const shelf of shelves) for (const slug of shelf.books) if (bookBySlug(slug)) groupOfOrdinal.push(shelf);

const onCurrent = (ordinal: number) => {
  if (counterRef.value) counterRef.value.textContent = String(ordinal);
  if (groupRef.value) groupRef.value.textContent = groupOfOrdinal[ordinal - 1]?.title ?? "";
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
      footprints: items.value.map((item) => (item.kind === "book" ? geometryOf(item.book).footprint : BRACKET_FOOTPRINT)),
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
    length += 2 * (Math.round(bookH * BRACKET_FOOTPRINT) + gap);
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
  // The shelf opens on the first group's bracket, a page margin in.
  archive.layout(bookH, gap, width, parseFloat(getComputedStyle(root).getPropertyValue("--space-outer")) || 16);
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
          :class="{ 'library-slot-bracket': item.kind !== 'book' }"
          :ref="(el) => setSlot(i, el)"
        >
          <Link
            v-if="item.kind === 'book'"
            :to="`/library/${item.book.slug}`"
            :class="['library-book', { 'library-book-opening': openingSlug === item.book.slug }]"
            :style="bookStyle(item.book)"
            @click="openingSlug = item.book.slug"
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
              <!-- The block of pages between the boards, seen from above. -->
              <span class="library-book-top" aria-hidden="true"></span>
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
          <!-- A bracket bookend at each end of a group, the group's name above
               it. The opening one is the group's landmark; the closing one
               repeats the name so whichever end is on screen says which group
               this is. -->
          <span
            v-else
            class="library-bracket"
            :class="`library-bracket-${item.kind}`"
            :role="item.kind === 'open' ? 'separator' : undefined"
            :aria-label="item.kind === 'open' ? item.shelf.title : undefined"
            :aria-hidden="item.kind === 'close' ? 'true' : undefined"
          >
            <span class="library-bracket-label">{{ item.shelf.title }}</span>
            <span class="library-bracket-shape"></span>
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

    <!-- Where along the shelf the reader is: the book nearest the middle, and its group. -->
    <div class="library-tools">
      <p class="library-counter" aria-live="off">
        <span ref="counterRef">1</span><span class="library-counter-sep">/</span>{{ count }}
        <span class="library-counter-group"><span class="library-counter-dot" aria-hidden="true">·</span><span ref="groupRef">{{ shelves[0]?.title }}</span></span>
      </p>
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
  --paper: #f1e8d7;
  --book-h: 400px;
  /* The one camera (see the script's "ONE CAMERA"): the turn that shows the
     cover, the look down that shows the page edges, and how far away it is. */
  --yaw: 24deg;
  --pitch: 6deg;
  --persp: calc(var(--book-h) * 8);
  /* Above the books: the page edges seen from the camera's height, then the
     group labels, clear of both. */
  --shelf-air: 60px;
  /* The shelf's top seen from above: how far up the screen the books' bases
     reach behind their spines. Matches the pitch and the camera's height. */
  --surface-h: calc(var(--book-h) * 0.13);
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
   shelf is drawn under them. `pan-y` is load-bearing, see useArchive.ts. */
.library-track {
  position: relative;
  width: 100%;
  height: calc(var(--shelf-air) + var(--book-h) + var(--board-h) + 18px);
  list-style: none;
  touch-action: pan-y;
  cursor: grab;
  overflow: hidden;

  &.is-dragging {
    cursor: grabbing;
  }

  /* The shelf's top, behind the books' bases: lit at its front edge, falling
     into the books' shade toward the back. */
  &::before {
    content: "";
    position: absolute;
    z-index: 0;
    left: 0;
    right: 0;
    top: calc(var(--shelf-air) + var(--book-h) - var(--surface-h));
    height: var(--surface-h);
    background: linear-gradient(to top, var(--color-beige-500), var(--color-beige-700));
    pointer-events: none;
  }

  /* The board's front edge, and the shadow it throws on the floor below. */
  &::after {
    content: "";
    position: absolute;
    z-index: 0;
    left: 0;
    right: 0;
    top: calc(var(--shelf-air) + var(--book-h));
    height: var(--board-h);
    background: linear-gradient(to bottom, rgb(214, 198, 174), var(--shelf-line));
    border-top: var(--stroke-sm) solid rgba(45, 42, 36, 0.16);
    box-shadow: 0 10px 14px -6px rgba(45, 42, 36, 0.28);
    pointer-events: none;
  }
}

.library-slot {
  position: absolute;
  z-index: 1;
  left: 0;
  top: 0;
  height: calc(var(--book-h) + var(--shelf-air));
  /* Set from the data in useArchive.layout(), never read from the DOM. */
  width: 0;
  will-change: transform;
}

/* The perspective container: one camera, a little below the books' tops, so
   every book is seen from the same place and the spine (the z = 0 face) is a
   true rectangle. */
.library-book,
.library-slot-bracket {
  perspective: var(--persp);
  perspective-origin: 50% 25%;
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

/* The contact shadow on the shelf's top, under and behind the book, outside its 3D context. */
.library-book-shadow {
  position: absolute;
  left: -4%;
  right: 8%;
  bottom: 0;
  height: calc(var(--book-h) * 0.09);
  background: radial-gradient(70% 100% at 36% 100%, rgba(45, 42, 36, 0.42), rgba(45, 42, 36, 0) 70%);
  pointer-events: none;
}

/* The book: a box standing on the shelf with its left-bottom edge on the
   baseline, turned by the shelf's yaw and tipped by its pitch. Its faces are
   placed on the box; nothing on a face is transformed by anything else. */
.library-book-object {
  position: absolute;
  left: 0;
  bottom: 0;
  width: calc(var(--book-h) * var(--spine));
  height: var(--book-h);
  transform-style: preserve-3d;
  transform-origin: 0% 100%;
  transform: rotateX(calc(var(--pitch) * -1)) rotateY(calc(var(--yaw) * -1));
  transition: transform 0.5s var(--ease-out-quint);
}

/* The spine (z = 0): a perfect-bound paperback's, flat, with the light
   falling off into the two hinges and a hairline where the cover wraps. */
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
    linear-gradient(to right, rgba(0, 0, 0, 0.28), rgba(255, 255, 255, 0.14) 24%, rgba(255, 255, 255, 0.06) 60%, rgba(0, 0, 0, 0.26)),
    var(--spine-color);
  box-shadow:
    inset 1px 0 0 rgba(255, 255, 255, 0.2),
    inset -1px 0 0 rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 0 rgba(0, 0, 0, 0.2);
  backface-visibility: hidden;
}

.library-book-spine-title {
  font-weight: 700;
  font-size: clamp(11px, calc(var(--book-h) * 0.031), 16px);
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-wrap: balance;
}

.library-book-spine-author {
  font-size: clamp(9px, calc(var(--book-h) * 0.024), 12px);
  line-height: 1.2;
  letter-spacing: 0.05em;
  color: var(--spine-ink-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The top of the book, hinged at the spine's top edge and lying back into
   the shelf: the block of pages between the two cover boards. The boards are
   the spine's own colour at either side; the pages are paper, ruled by the
   sheets' edges, and darker toward the back where the next book's shade falls. */
.library-book-top {
  position: absolute;
  left: 0;
  bottom: 100%;
  width: 100%;
  height: calc(var(--book-h) * var(--cover));
  transform-origin: 50% 100%;
  transform: rotateX(90deg);
  backface-visibility: hidden;
  background:
    linear-gradient(to top, rgba(74, 58, 36, 0) 0%, rgba(74, 58, 36, 0.3) 100%),
    repeating-linear-gradient(to right, rgba(110, 88, 58, 0.16) 0 1px, transparent 1px 3px),
    linear-gradient(to right, var(--spine-color) 0 1.5px, var(--paper) 1.5px calc(100% - 1.5px), var(--spine-color) calc(100% - 1.5px));
}

/* The front cover, hinged at the spine's right edge and standing back into
   the shelf. The artwork keeps its own proportions: the face is sized from
   them, so nothing is stretched or cropped. */
.library-book-face {
  position: absolute;
  top: 0;
  left: 100%;
  height: 100%;
  width: calc(var(--book-h) * var(--cover));
  transform-origin: 0% 50%;
  transform: rotateY(90deg);
  backface-visibility: hidden;
  overflow: hidden;
  border-radius: 0 3px 3px 0;
  background: var(--color-beige-600);

  /* The hinge in shade, a soft sheen across the laminate, and the light
     falling off along the cover as it recedes from the spine. */
  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(to right, rgba(0, 0, 0, 0.34) 0, rgba(0, 0, 0, 0) 6%),
      linear-gradient(105deg, rgba(255, 255, 255, 0.14) 0 18%, rgba(255, 255, 255, 0) 34%),
      linear-gradient(to right, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.3));
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

/* A bracket bookend: a square bracket the height of the books, drawn in the
   shelf's ink, standing on the board under the same camera as the books. The
   opening one's returns point into its group, the closing one's back at it. */
.library-bracket {
  position: absolute;
  inset: 0;
  display: block;
}

.library-bracket-shape {
  position: absolute;
  left: 0;
  bottom: 0;
  width: calc(var(--book-h) * 0.09);
  height: var(--book-h);
  transform-origin: 0% 100%;
  transform: rotateX(calc(var(--pitch) * -1));
  border: var(--stroke-md) solid var(--shelf-ink);
  border-right: 0;
  border-radius: 1px;
}

.library-bracket-close .library-bracket-shape {
  border-right: var(--stroke-md) solid var(--shelf-ink);
  border-left: 0;
}

/* The group's name, in the air above the shelf, flush with its bracket. */
.library-bracket-label {
  position: absolute;
  left: 0;
  bottom: calc(var(--book-h) + 36px);
  white-space: nowrap;
  font-size: var(--font-size-xs);
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  line-height: 1;
  color: var(--shelf-ink);
}

.library-bracket-close .library-bracket-label {
  left: auto;
  right: calc(100% - var(--book-h) * 0.09);
}

@include mixins.hover {
  /* The book comes out of the shelf along its own depth, as a hand would
     pull it, and goes back to exactly where it stood. */
  .library-book:hover .library-book-object {
    transform: rotateX(calc(var(--pitch) * -1)) rotateY(calc(var(--yaw) * -1)) translateZ(24px);
  }
}

/* The clicked book: off the shelf and turning toward the reader, the first
   beat of the opening (BookDetail.vue takes it from there). After the hover
   rule and at its specificity, so it wins while the pointer is still on it. */
.library-book.library-book-opening .library-book-object {
  transform: rotateX(calc(var(--pitch) * -1)) rotateY(calc(var(--yaw) * -1 + 16deg)) translateZ(64px);
  transition-duration: 0.45s;
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

/* Counter, the group, and the scrub line, centred under the shelf. */
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
  text-align: center;
}

.library-counter-sep {
  margin: 0 0.5em;
  opacity: 0.45;
}

.library-counter-group {
  color: var(--shelf-ink-dim);
  letter-spacing: 0.08em;
}

.library-counter-dot {
  margin: 0 0.7em;
  opacity: 0.6;
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
