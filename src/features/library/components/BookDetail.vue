<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import Breadcrumbs from "../../../components/Breadcrumbs.vue";
import ArrowRight from "../../../components/icons/ArrowRight.vue";
import { t } from "../../../i18n/utils/translate";
import { bookBySlug, shelfOf, coverSrc, coverSrcset } from "../../../content/library";
import { bookId, recentBookId } from "../../../composables/useRouteObserver";
import { useRouter } from "../../../composables/useRouter";
import { useFirstRoute } from "../../../composables/useFirstRoute";
import { lenis } from "../../../composables/useScroll";
import { createScrollOwner } from "../../../composables/useScrollOwner";

/**
 * ─── /library/:slug ───────────────────────────────────────────────────────
 *
 * One book, turned over and opened. A layer over the shelves (which hold
 * still and go `inert` underneath, see Library.vue), not a page that replaces
 * them, so closing is a fade and the shelves are exactly where they were.
 *
 * Built the way the object pages are, and for the same reasons (ObjectDetail.vue):
 *   · the wrapper in App.vue is its own scroller and carries
 *     `data-lenis-prevent` and `data-scene-blocker`;
 *   · Lenis is stopped while it is up, and the scroller cancels the two
 *     boundary touches iOS would otherwise hand to the page (useScrollOwner);
 *   · focus moves here on open, Escape closes, the browser's Back closes.
 *
 * ── THE OPENING ───────────────────────────────────────────────────────────
 *
 * The clicked book comes off the shelf toward the reader (Library.vue,
 * `openingSlug`) while this page fades in over it. The book on this page is a
 * box of its own: a block of pages with the title page typeset on it, and the
 * front cover board hinged on its left edge, the spine. It arrives turned a
 * little away and settles square; then, once the page has faded in, the cover
 * swings open on the spine toward the reader and uncovers the title page.
 * Opened to a little past sixty degrees rather than flat: the board stays
 * inside the book's own footprint, so nothing has to be laid out around it,
 * and the artwork is still in view, foreshortened, the way a book held open
 * toward you is. Three transforms and two opacities, all CSS transitions
 * (`.book-object-open`), one timer, nothing that can pile up on reopening.
 * Reduced motion: the book is simply there, closed.
 *
 * Nothing on this page is written about the person. The description is a
 * factual line about the book; the note is the owner's to write, and until
 * it is, the page says so rather than inventing one.
 */

const router = useRouter();
const { isFirstRoute } = useFirstRoute();

// `recentBookId`, so the copy stays while the panel fades out.
const entry = computed(() => bookBySlug(recentBookId.value ?? ""));
const shelf = computed(() => (entry.value ? shelfOf(entry.value.slug) : undefined));

const panelRef = ref<HTMLElement | null>(null);
const scroll = createScrollOwner();

/** The cover is open. Set a beat after the page has faded in; cleared the moment it closes. */
const opened = ref(false);
/** After the route fade (App.vue, 0.5s) has mostly run, so the swing is seen on a settled page. */
const OPEN_AFTER_MS = 380;
let openTimer: ReturnType<typeof setTimeout> | null = null;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const close = () => {
  // Opened cold, there is nothing behind this page: it becomes the library in
  // place (replace, not push: a pushed /library left this book one step back,
  // and the header's own back button reopened the book just closed).
  if (isFirstRoute.value) router.replace("/library");
  else router.back();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  close();
};

watch(
  bookId,
  async (id) => {
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    if (id) {
      opened.value = false;
      lenis.value?.stop();
      await nextTick();
      if (bookId.value !== id) return;
      window.addEventListener("keydown", handleKeydown);
      scroll.own(panelRef.value?.parentElement ?? null);
      panelRef.value?.focus({ preventScroll: true });
      if (!reducedMotion()) {
        openTimer = setTimeout(() => {
          openTimer = null;
          opened.value = bookId.value === id;
        }, OPEN_AFTER_MS);
      }
      return;
    }
    opened.value = false;
    window.removeEventListener("keydown", handleKeydown);
    scroll.release();
    lenis.value?.start();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (openTimer) clearTimeout(openTimer);
  window.removeEventListener("keydown", handleKeydown);
  scroll.release();
});
</script>

<template>
  <article v-if="entry" ref="panelRef" class="book-page" tabindex="-1" :aria-labelledby="`book-title-${entry.slug}`">
    <div class="book-page-inner">
      <!-- The way back is the site header's own back button, which sits right
           above this and is labelled "Back to the library"; a second arrow
           here read as a stray symbol. The breadcrumb stays: it is the page's
           place in the site, for a reader and for a crawler. -->
      <Breadcrumbs
        class="book-breadcrumbs"
        variant="light"
        :trail="[
          { label: t('home'), to: '/' },
          { label: t('library'), to: '/library' },
        ]"
        :current="entry.title"
      />

      <div class="book-layout">
        <figure class="book-figure">
          <span
            class="book-object"
            :class="{ 'book-object-open': opened }"
            :style="{ '--cover-ratio': entry.cover.width / entry.cover.height }"
          >
            <!-- The block of pages, with the title page on top of it. -->
            <span class="book-pages" aria-hidden="true">
              <span class="book-leaf">
                <span class="book-leaf-title">{{ entry.title }}</span>
                <span class="book-leaf-author">{{ entry.author }}</span>
                <span class="book-leaf-year">{{ entry.year }}</span>
              </span>
            </span>
            <!-- The front cover board, hinged on the spine. Artwork outside, paper inside. -->
            <span class="book-board">
              <img
                class="book-cover"
                :src="coverSrc(entry.slug, 480)"
                :srcset="coverSrcset(entry.slug)"
                sizes="(orientation: portrait) 46vw, 30vw"
                :width="entry.cover.width"
                :height="entry.cover.height"
                :alt="`Cover of ${entry.title} by ${entry.author}`"
                decoding="async"
              />
              <span class="book-board-inside" aria-hidden="true"></span>
            </span>
          </span>
        </figure>

        <div class="book-text">
          <header class="book-masthead">
            <p v-if="shelf" class="book-eyebrow">{{ shelf.title }}</p>
            <h1 :id="`book-title-${entry.slug}`" class="book-title">{{ entry.title }}</h1>
            <p class="book-author">{{ entry.author }}</p>
          </header>

          <dl class="book-facts">
            <div class="book-facts-item">
              <dt>{{ t("published") }}</dt>
              <dd>{{ entry.year }}</dd>
            </div>
            <div v-if="entry.series" class="book-facts-item">
              <dt>{{ t("series") }}</dt>
              <dd>
                {{ entry.series.name }},
                {{ entry.series.of ? t("book-n-of-m", { n: entry.series.volume, m: entry.series.of }) : t("book-n", { n: entry.series.volume }) }}
              </dd>
            </div>
            <div class="book-facts-item">
              <dt>{{ t("length") }}</dt>
              <dd>{{ t("about-n-pages", { n: entry.pages }) }}</dd>
            </div>
            <div v-if="shelf" class="book-facts-item">
              <dt>{{ t("group") }}</dt>
              <dd>{{ shelf.title }}</dd>
            </div>
          </dl>

          <p class="book-description">{{ entry.description }}</p>

          <section class="book-note" :aria-label="t('note')">
            <p class="book-note-label">{{ t("note") }}</p>
            <p v-if="entry.personalNote" class="book-note-body">{{ entry.personalNote }}</p>
            <p v-else class="book-note-placeholder">{{ t("note-placeholder") }}</p>
          </section>

          <footer class="book-end">
            <!-- A real link for the crawler and the middle click, but a click
                 goes back through history rather than pushing /library on top. -->
            <a href="/library" class="book-back" data-cursor="circle-black" data-sound="click" data-hoversound="hover" @click.prevent="close">
              <ArrowRight class="book-back-icon" />
              <span>{{ t("back-to-the-library") }}</span>
            </a>
          </footer>
        </div>
      </div>
    </div>
  </article>
</template>

<style scoped lang="scss">
.book-page {
  --page-ink: var(--color-text-400);
  --page-ink-dim: var(--color-text-300);
  --page-rule: var(--color-beige-700);

  position: relative;
  min-height: 100%;
  width: 100%;
  background: var(--color-background-400);
  color: var(--page-ink);
  outline: none;
}

.book-page-inner {
  width: 100%;
  max-width: var(--breakpoint-xxxl);
  margin: 0 auto;
  padding: calc(var(--height-header) + var(--space-sm)) var(--space-outer) var(--space-xxxl);
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

.book-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  width: fit-content;
  font-size: var(--font-size-sm);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--page-ink-dim);
  transition: color 0.15s ease-in-out;
  --icon-color: var(--page-ink-dim);

  &-icon {
    width: var(--icon-size-xs);
    transform: rotate(180deg);
    transition: transform 0.2s var(--ease-smooth);
  }

  @include mixins.hover {
    &:hover {
      color: var(--page-ink);
      --icon-color: var(--page-ink);

      .book-back-icon {
        transform: rotate(180deg) translateX(4px);
      }
    }
  }
}

.book-layout {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);

  @include mixins.landscape {
    @include mixins.mq("md") {
      flex-direction: row;
      align-items: flex-start;
      gap: var(--space-xxxl);
    }
  }
}

/* The camera the book is seen with: one perspective for the whole figure, a
   little to the left of centre so the opening cover comes toward the reader. */
.book-figure {
  margin: 0;
  display: flex;
  justify-content: center;
  padding: var(--space-md) 0 var(--space-lg);
  perspective: 1400px;
  perspective-origin: 30% 50%;

  @include mixins.landscape {
    @include mixins.mq("md") {
      flex: 0 0 34%;
      justify-content: flex-end;
      position: sticky;
      top: calc(var(--height-header) + var(--space-xl));
    }
  }
}

/* The book: a block of pages and a cover board, in one 3D space. No filter
   and no blend mode anywhere on it or its parents: either flattens the space.
   The contact shadows are box-shadows on the two parts instead. It arrives
   turned a little away and settles square as the cover opens. */
.book-object {
  --book-w: min(46vw, 240px);
  --paper: #f3ecdf;
  --ease-open: cubic-bezier(0.65, 0, 0.35, 1);

  position: relative;
  display: block;
  width: var(--book-w);
  aspect-ratio: var(--cover-ratio, 0.65);
  transform-style: preserve-3d;
  transform: rotateY(-14deg);
  transition: transform 0.7s var(--ease-out-quint);

  @include mixins.mq("md") {
    --book-w: min(30vw, 320px);
  }

  &-open {
    transform: rotateY(0deg);
  }
}

/* The page block: paper, with the sheets' edges showing on the right and the
   bottom, and the shadow the whole book throws on the page. */
.book-pages {
  position: absolute;
  inset: 0;
  border-radius: 3px 6px 6px 3px;
  background: var(--paper);
  box-shadow:
    0 24px 22px rgba(45, 42, 36, 0.24),
    0 2px 3px rgba(45, 42, 36, 0.14);
  overflow: hidden;

  /* the edges of the sheets, stacked */
  &::after {
    content: "";
    position: absolute;
    top: 3%;
    bottom: 0;
    right: 0;
    width: 5px;
    background: repeating-linear-gradient(to bottom, #f7f1e6 0 1px, #d9d0c1 1px 2px);
    pointer-events: none;
  }

  /* the shade the open cover throws across the page from the hinge */
  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(to right, rgba(45, 42, 36, 0.28), rgba(45, 42, 36, 0.06) 45%, rgba(45, 42, 36, 0) 70%);
    opacity: 0;
    transition: opacity 0.9s var(--ease-open) 0.25s;
    pointer-events: none;
  }
}

.book-object-open .book-pages::before {
  opacity: 1;
}

/* The title page (a leaf, not .book-page, which is the article), typeset on the block: the part the open cover uncovers is
   its right-hand side, so the type sits toward it. */
.book-leaf {
  position: absolute;
  inset: 12% 8% 12% 30%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7em;
  text-align: center;
  color: var(--page-ink);
  font-size: calc(var(--book-w) * 0.052);
  line-height: 1.2;
  opacity: 0;
  transition: opacity 0.5s ease 0.55s;

  &-title {
    font-weight: 900;
    letter-spacing: 0.02em;
    text-wrap: balance;
  }

  &-author {
    font-size: 0.78em;
    color: var(--page-ink-dim);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  &-year {
    margin-top: 0.6em;
    font-size: 0.7em;
    color: var(--page-ink-dim);
    letter-spacing: 0.1em;
  }
}

.book-object-open .book-leaf {
  opacity: 1;
}

/* The front cover board, hinged on its left edge. Closed it lies on the
   pages; open it stands off them at 62 degrees, toward the reader. The
   closing transition is the shorter one: it runs while the page fades out. */
.book-board {
  position: absolute;
  inset: 0;
  border-radius: 3px 6px 6px 3px;
  transform-origin: 0% 50%;
  transform-style: preserve-3d;
  transform: rotateY(0deg);
  transition: transform 0.45s ease-in;
  box-shadow: 0 2px 3px rgba(45, 42, 36, 0.14);

  /* the spine's shade across the hinge edge of the artwork */
  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 7%;
    border-radius: 3px 0 0 3px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.26), rgba(0, 0, 0, 0.05) 60%, rgba(255, 255, 255, 0.08));
    backface-visibility: hidden;
    pointer-events: none;
    z-index: 1;
  }
}

.book-object-open .book-board {
  transform: rotateY(-62deg);
  transition: transform 0.9s var(--ease-open) 0.25s;
  box-shadow: -14px 8px 22px rgba(45, 42, 36, 0.2);
}

.book-cover {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: inherit;
  background: var(--color-beige-600);
  backface-visibility: hidden;
}

/* The inside of the board: paper, a little shaded toward the hinge. Only ever
   seen past ninety degrees, so it is there for correctness, not for show. */
.book-board-inside {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(to right, rgba(45, 42, 36, 0.16), rgba(45, 42, 36, 0) 30%), var(--paper);
  transform: rotateY(180deg);
  backface-visibility: hidden;
}

.book-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
  max-width: 62ch;
}

.book-masthead {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.book-eyebrow {
  font-size: var(--font-size-xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--page-ink-dim);
}

.book-title {
  font-size: var(--font-size-title-md);
  font-weight: 900;
  line-height: var(--line-height-title);
  letter-spacing: 0.01em;
  text-wrap: balance;

  @include mixins.mq("md") {
    font-size: var(--font-size-title-lg);
  }
}

.book-author {
  font-size: var(--font-size-lg);
  color: var(--page-ink-dim);
}

.book-facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: var(--stroke-sm) solid var(--page-rule);

  &-item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs) var(--space-md);

    dt {
      flex: 0 0 auto;
      min-width: 8rem;
      font-size: var(--font-size-xs);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--page-ink-dim);
    }

    dd {
      flex: 1 1 14rem;
      font-size: var(--font-size-md);
    }
  }
}

.book-description {
  font-size: var(--font-size-lg);
  line-height: 1.45;
  text-wrap: pretty;

  @include mixins.mq("md") {
    font-size: var(--font-size-xl);
  }
}

.book-note {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  padding-top: var(--space-md);
  border-top: var(--stroke-sm) solid var(--page-rule);

  &-label {
    font-size: var(--font-size-xs);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--page-ink-dim);
  }

  &-body {
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    text-wrap: pretty;
  }

  &-placeholder {
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    color: var(--page-ink-dim);
  }
}

.book-end {
  padding-top: var(--space-md);
  border-top: var(--stroke-sm) solid var(--page-rule);
}

@media (prefers-reduced-motion: reduce) {
  .book-back-icon,
  .book-object,
  .book-board,
  .book-pages::before,
  .book-leaf {
    transition: none;
  }

  /* Simply there, closed and square. */
  .book-object {
    transform: none;
  }
}
</style>
