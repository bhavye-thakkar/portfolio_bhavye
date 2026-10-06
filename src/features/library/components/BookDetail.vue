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
 * One book, turned over. A layer over the shelves (which hold still and go
 * `inert` underneath, see Library.vue), not a page that replaces them, so
 * closing is a fade and the shelves are exactly where they were.
 *
 * Built the way the object pages are, and for the same reasons (ObjectDetail.vue):
 *   · the wrapper in App.vue is its own scroller and carries
 *     `data-lenis-prevent` and `data-scene-blocker`;
 *   · Lenis is stopped while it is up, and the scroller cancels the two
 *     boundary touches iOS would otherwise hand to the page (useScrollOwner);
 *   · focus moves here on open, Escape closes, the browser's Back closes.
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

const close = () => {
  if (isFirstRoute.value) router.push("/library");
  else router.back();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  close();
};

watch(
  bookId,
  async (id) => {
    if (id) {
      lenis.value?.stop();
      await nextTick();
      if (bookId.value !== id) return;
      window.addEventListener("keydown", handleKeydown);
      scroll.own(panelRef.value?.parentElement ?? null);
      panelRef.value?.focus({ preventScroll: true });
      return;
    }
    window.removeEventListener("keydown", handleKeydown);
    scroll.release();
    lenis.value?.start();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  scroll.release();
});
</script>

<template>
  <article v-if="entry" ref="panelRef" class="book-page" tabindex="-1" :aria-labelledby="`book-title-${entry.slug}`">
    <div class="book-page-inner">
      <div class="book-topbar">
        <!-- A real link for the crawler and the middle click, but a click goes
             back through history rather than pushing /library on top: pushing
             left the book as the next entry back, so the site header's own
             Back button reopened the book just closed. -->
        <a href="/library" class="book-back" data-cursor="circle-black" data-sound="click" data-hoversound="hover" @click.prevent="close">
          <ArrowRight class="book-back-icon" />
          <span>{{ t("back-to-the-library") }}</span>
        </a>
        <Breadcrumbs
          class="book-breadcrumbs"
          variant="light"
          :trail="[
            { label: t('home'), to: '/' },
            { label: t('library'), to: '/library' },
          ]"
          :current="entry.title"
        />
      </div>

      <div class="book-layout">
        <figure class="book-figure">
          <span class="book-object">
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

.book-topbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
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

.book-figure {
  margin: 0;
  display: flex;
  justify-content: center;
  padding: var(--space-md) 0 var(--space-lg);

  @include mixins.landscape {
    @include mixins.mq("md") {
      flex: 0 0 34%;
      justify-content: flex-end;
      position: sticky;
      top: calc(var(--height-header) + var(--space-xl));
    }
  }
}

/* The same object as on the shelf, at reading size. */
.book-object {
  position: relative;
  display: block;
  width: min(46vw, 240px);
  filter: drop-shadow(0 24px 22px rgba(45, 42, 36, 0.24)) drop-shadow(0 2px 3px rgba(45, 42, 36, 0.14));

  @include mixins.mq("md") {
    width: min(30vw, 320px);
  }

  &::before {
    content: "";
    position: absolute;
    inset: 0 auto 0 0;
    width: 7%;
    border-radius: 3px 0 0 3px;
    background: linear-gradient(to right, rgba(0, 0, 0, 0.28), rgba(0, 0, 0, 0.06) 60%, rgba(255, 255, 255, 0.08));
    mix-blend-mode: multiply;
    pointer-events: none;
  }

  &::after {
    content: "";
    position: absolute;
    top: 3%;
    bottom: 2%;
    right: -4px;
    width: 4px;
    border-radius: 0 2px 2px 0;
    background: repeating-linear-gradient(to bottom, #f7f1e6 0 1px, #d9d0c1 1px 2px);
    pointer-events: none;
  }
}

.book-cover {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 3px 6px 6px 3px;
  background: var(--color-beige-600);
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
  .book-back-icon {
    transition: none;
  }
}
</style>
