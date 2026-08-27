<script setup lang="ts">
import { computed, nextTick, ref, watch, onBeforeUnmount } from "vue";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { t } from "../../../i18n/utils/translate";
import Link from "../../../components/Link.vue";
import ArrowRight from "../../../components/icons/ArrowRight.vue";
import ArrowRightLong from "../../../components/icons/ArrowRightLong.vue";
import PinIcon from "../../../components/icons/Pin.vue";
import StoryChapterItem from "./StoryChapter.vue";
import { experiences, experienceBySlug, chapterNumber } from "../../../content/experience";
import { experienceId, experienceVisible, recentExperienceId } from "../../../composables/useRouteObserver";
import { isTransitioning } from "../../../composables/useProjectTransition";
import { lenis } from "../../../composables/useScroll";
import { useRouter } from "../../../composables/useRouter";
import { story } from "../../../animations/story";
import { sizes } from "../../../utils/sizes";

/**
 * ─── THE EXPERIENCE STORY PAGE ────────────────────────────────────────────
 *
 * Same overlay mechanics as a project page — home goes fixed, this takes the
 * document scroll, the header swaps in its back button — but where a project
 * shows a gallery, this shows the six beats of how the job happened.
 *
 * The 3D stage is not a screenshot behind glass: Home teleports the live canvas
 * into this page's stage element, so the avatar you scrolled past is the same
 * avatar standing here, re-posed per chapter by `animations/story`.
 */

const router = useRouter();

const entry = computed(() => experienceBySlug(recentExperienceId.value ?? ""));

const nextEntry = computed(() => {
  const list = experiences;
  if (list.length < 2 || !entry.value) return null;
  const index = list.findIndex((item) => item.slug === entry.value!.slug);
  return list[(index + 1) % list.length] ?? null;
});

const entryIndex = computed(() => experiences.findIndex((item) => item.slug === entry.value?.slug));

const activeChapter = ref(0);
const chapterElements = ref<HTMLElement[]>([]);
const setChapterRef = (el: unknown, index: number) => {
  if (el) chapterElements.value[index] = (el as { $el?: HTMLElement }).$el ?? (el as HTMLElement);
};

let observer: IntersectionObserver | null = null;
let wasLandscape = sizes.isLandscape;

const chapterKey = (index: number) => entry.value?.story[index]?.key ?? "discovery";

/**
 * Lenis owns the scroll, so `scrollIntoView({ behavior: "smooth" })` would be
 * overridden on the next frame and land somewhere else.
 */
const jumpToChapter = (index: number) => {
  const element = chapterElements.value[index];
  if (!element) return;
  const offset = -(window.innerHeight - element.offsetHeight) / 2;
  if (lenis.value) lenis.value.scrollTo(element, { offset });
  else element.scrollIntoView({ block: "center" });
};

const teardownObserver = () => {
  observer?.disconnect();
  observer = null;
};

const handleResize = () => {
  if (sizes.isLandscape === wasLandscape) return;
  wasLandscape = sizes.isLandscape;
  story.reframe(chapterKey(activeChapter.value));
};

/**
 * One observer over the chapters, firing on the viewport's middle band. Scrub
 * would have been the reflex, but the story reads as discrete chapters and a
 * tweened pose per chapter survives a fast flick where a scrub just smears.
 */
const setupObserver = () => {
  teardownObserver();
  const elements = chapterElements.value.filter(Boolean);
  if (!elements.length) return;

  observer = new IntersectionObserver(
    (entries) => {
      for (const record of entries) {
        if (!record.isIntersecting) continue;
        const index = Number((record.target as HTMLElement).dataset.index ?? 0);
        if (index === activeChapter.value) continue;
        activeChapter.value = index;
        story.goTo(chapterKey(index));
      }
    },
    { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
  );

  elements.forEach((element) => observer?.observe(element));
};

// Enter and leave story mode with the route, not with the transition, so the
// stage is already set while the page is still fading in.
let returnScroll = 0;

watch(
  experienceId,
  async (id) => {
    if (id) {
      // An unknown slug would otherwise render an empty overlay over the stage
      // with no way out of it.
      if (!experienceBySlug(id)) {
        router.replace("/");
        return;
      }

      activeChapter.value = 0;
      wasLandscape = sizes.isLandscape;
      sizes.off("resize", handleResize);
      sizes.on("resize", handleResize);

      // Story to story — the next-chapter link, which replaces the route
      // without ever passing through null. Nothing else fires for it, so the
      // pose, the scroll and the observer are reset by hand and the scroll to
      // go back to stays whatever the first entry recorded.
      if (story.getIsActive()) {
        story.goTo("discovery");
        lenis.value?.scrollTo(0, { immediate: true, force: true });
        await nextTick();
        setupObserver();
        return;
      }

      // window.scrollY, not lenis.scroll: Lenis drives the real window scroll,
      // and its own smoothed value is not settled at the moment of the click.
      returnScroll = window.scrollY;
      story.enter("discovery");
      return;
    }

    if (!story.getIsActive()) return;

    // Hand the closing fade the offset the story was actually read to, so it
    // dissolves from where the visitor was rather than snapping to the top.
    document.documentElement.style.setProperty("--story-exit-scroll", `${window.scrollY}px`);

    teardownObserver();
    sizes.off("resize", handleResize);
    story.exit();

    // The home sections rebuild their timelines on this flush and the wrapper
    // leaves `position: fixed` with it; both have to land before ScrollTrigger
    // measures anything or the whole page ends up anchored to nothing.
    await nextTick();
    ScrollTrigger.refresh();

    // A visitor who deep-linked here has no scroll to go back to, so put them
    // where the story would have started.
    const section = document.querySelector("#experience");
    const restore = returnScroll > 0 ? returnScroll : (section?.getBoundingClientRect().top ?? 0) + window.scrollY;

    lenis.value?.scrollTo(restore, { immediate: true, force: true });
    window.scrollTo(0, restore);
  },
  { immediate: true },
);

// Wait for the transition to settle before taking the scroll — moving it while
// home is still in flow would scroll the home page instead.
watch(
  [experienceVisible, isTransitioning],
  async () => {
    if (!experienceVisible.value) return;
    lenis.value?.scrollTo(0, { immediate: true });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    setupObserver();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  teardownObserver();
  sizes.off("resize", handleResize);
});
</script>

<template>
  <article v-if="entry" class="story-page">
    <div class="story-page-scrim" aria-hidden="true"></div>

    <div class="story-page-inner">
      <header class="story-masthead">
        <Link to="/" class="story-back" data-cursor="arrow" data-sound="click" data-hoversound="hover">
          <ArrowRight class="story-back-icon" />
          <span>{{ t("experience") }}</span>
        </Link>

        <p class="story-masthead-eyebrow">
          {{ chapterNumber(entryIndex) }} — {{ entry.chapter }}
        </p>
        <p v-if="entry.placeholder || entry.sampleStory" class="story-masthead-slot">
          {{ entry.placeholder ? t("to-be-added") : t("sample-content") }}
        </p>
        <h1 class="story-masthead-company">{{ entry.company }}</h1>
        <p class="story-masthead-role">{{ entry.role }}</p>

        <dl v-if="!entry.placeholder" class="story-masthead-meta">
          <div class="story-masthead-meta-item">
            <dt>{{ t("location") }}</dt>
            <dd><PinIcon class="story-masthead-meta-icon" />{{ entry.location }}</dd>
          </div>
          <div class="story-masthead-meta-item">
            <dt>{{ t("dates") }}</dt>
            <dd>{{ entry.duration }}</dd>
          </div>
          <div class="story-masthead-meta-item">
            <dt>{{ t("type") }}</dt>
            <dd>{{ entry.type }}</dd>
          </div>
        </dl>

        <p v-if="entry.statement" class="story-masthead-statement">{{ entry.statement }}</p>
      </header>

      <div class="story-body">
        <nav class="story-rail" :aria-label="t('how-i-got-there')">
          <ol>
            <li v-for="(chapter, index) in entry.story" :key="chapter.key">
              <button
                type="button"
                :class="['story-rail-item', { 'story-rail-item-active': index === activeChapter }]"
                :aria-current="index === activeChapter ? 'step' : undefined"
                data-cursor="circle-white"
                data-sound="click"
                @click="jumpToChapter(index)"
              >
                <span class="story-rail-number">{{ chapterNumber(index) }}</span>
                <span class="story-rail-label">{{ chapter.label }}</span>
              </button>
            </li>
          </ol>
        </nav>

        <div class="story-column">
          <p class="story-column-title">{{ t("how-i-got-there") }}</p>
          <ol class="story-chapters">
            <StoryChapterItem
              v-for="(chapter, index) in entry.story"
              :key="chapter.key"
              :ref="(el: unknown) => setChapterRef(el, index)"
              :chapter="chapter"
              :index="index"
              :is-active="index === activeChapter"
            />
          </ol>
        </div>
      </div>

      <footer class="story-end">
        <Link
          v-if="nextEntry"
          :to="`/experience/${nextEntry.slug}`"
          replace
          class="story-end-next"
          data-cursor="arrow"
          data-sound="click"
          data-hoversound="hover"
        >
          <span class="story-end-next-label">{{ t("next-chapter") }}</span>
          <span class="story-end-next-company">{{ nextEntry.company }}</span>
          <ArrowRightLong class="story-end-next-icon" />
        </Link>

        <Link to="/" class="story-back" data-cursor="arrow" data-sound="click" data-hoversound="hover">
          <ArrowRight class="story-back-icon" />
          <span>{{ t("back-to-experience") }}</span>
        </Link>
      </footer>
    </div>
  </article>
</template>

<style scoped lang="scss">
.story-page {
  position: relative;
  min-height: calc(var(--lvh) * 100);
  width: 100%;
  color: var(--color-text-cyan-400);
  font-family: "ProFontWindows";

  /* Readability wash over the live 3D stage. Portrait keeps the top of the
     frame clear so the avatar is never buried; landscape clears the right,
     which is where the story camera parks him. */
  &-scrim {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(0, 14, 40, 0.1) 0%,
      rgba(0, 14, 40, 0.62) 24%,
      rgba(0, 14, 40, 0.94) 44%,
      rgba(0, 14, 40, 0.96) 100%
    );

    @include mixins.landscape {
      background: linear-gradient(
        to right,
        rgba(0, 14, 40, 0.95) 0%,
        rgba(0, 14, 40, 0.92) 44%,
        rgba(0, 14, 40, 0.45) 66%,
        rgba(0, 14, 40, 0.12) 100%
      );
    }
  }

  &-inner {
    position: relative;
    width: 100%;
    max-width: var(--breakpoint-xxxl);
    margin: 0 auto;
    padding: 0 var(--space-outer);
  }
}

/* ── back link, used at both ends of the page ─────────────────────────────── */
.story-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  width: fit-content;
  font-size: var(--font-size-sm);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-cyan-300);
  transition: color 0.15s ease-in-out;
  --icon-color: var(--color-text-cyan-300);

  &-icon {
    width: var(--icon-size-xs);
    transform: rotate(180deg);
    transition: transform 0.2s var(--ease-smooth);
  }

  @include mixins.hover {
    &:hover {
      color: var(--color-cyan-400);
      --icon-color: var(--color-cyan-400);

      .story-back-icon {
        transform: rotate(180deg) translateX(4px);
      }
    }
  }
}

/* ── masthead ─────────────────────────────────────────────────────────────── */
.story-masthead {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  /* Portrait scrolls the copy in under the clear top band, so the avatar has
     the opening frame to himself. */
  padding-top: calc(var(--height-header) + 30vh);
  padding-bottom: var(--space-xxl);
  max-width: 46ch;

  @include mixins.landscape {
    padding-top: calc(var(--height-header) + var(--space-xxl));
    padding-bottom: 14vh;
    max-width: 44%;
  }

  /* Same left edge as the chapter column below, so the rail reads as one
     margin running the length of the page rather than the body being
     accidentally indented past the title. */
  @include mixins.mq("lg") {
    margin-left: calc(190px + var(--space-xxl));
  }

  &-eyebrow {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    padding-top: var(--space-xxl);
  }

  /* Says plainly that this entry is an empty slot rather than a job. */
  &-slot {
    width: fit-content;
    font-size: var(--font-size-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-text-cyan-300);
    border: var(--stroke-sm) dashed rgba(129, 189, 216, 0.5);
    border-radius: var(--radius-sm);
    padding: 2px var(--space-xs);
  }

  &-company {
    font-size: var(--font-size-title-lg);
    font-weight: 700;
    line-height: var(--line-height-title);
    letter-spacing: -0.01em;
    text-wrap: balance;

    @include mixins.mq("md") {
      font-size: var(--font-size-title-xl);
    }
  }

  &-role {
    font-size: var(--font-size-xl);
    color: var(--color-text-cyan-400);
  }

  &-meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-md) var(--space-xl);
    margin-top: var(--space-md);
    padding-top: var(--space-md);
    border-top: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);

    &-item {
      display: flex;
      flex-direction: column;
      gap: var(--space-xxs);
    }

    dt {
      font-size: var(--font-size-xs);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-text-cyan-300);
    }

    dd {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-size-md);
      color: var(--color-text-cyan-400);
    }

    &-icon {
      width: var(--icon-size-xxs);
      --icon-color: var(--color-cyan-400);
      flex: 0 0 auto;
    }
  }

  &-statement {
    font-size: var(--font-size-lg);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-300);
    margin-top: var(--space-sm);
    text-wrap: pretty;
  }
}

/* ── the seven beats ──────────────────────────────────────────────────────── */
.story-body {
  display: flex;
  align-items: flex-start;
  gap: var(--space-xxl);
}

.story-rail {
  display: none;

  /* The rail is a progress indicator first and a jump list second, so it only
     appears where there is room for it to be both. */
  @include mixins.mq("lg") {
    display: block;
    position: sticky;
    top: calc(var(--height-header) + var(--space-xxl));
    flex: 0 0 auto;
    width: 190px;
    padding-top: 22vh;
  }

  ol {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  &-item {
    pointer-events: auto;
    display: flex;
    align-items: baseline;
    gap: var(--space-xs);
    background: none;
    border: none;
    border-left: var(--stroke-sm) solid rgba(129, 189, 216, 0.3);
    padding: var(--space-xxs) 0 var(--space-xxs) var(--space-sm);
    width: 100%;
    text-align: left;
    color: var(--color-text-cyan-300);
    transition:
      color 0.25s ease-in-out,
      border-color 0.25s ease-in-out;

    &-active {
      color: var(--color-cyan-400);
      border-color: var(--color-cyan-400);
    }

    @include mixins.hover {
      &:hover {
        color: var(--color-text-cyan-400);
      }
    }
  }

  &-number {
    font-size: var(--font-size-xs);
    letter-spacing: 0.1em;
  }

  &-label {
    font-size: var(--font-size-sm);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
}

.story-column {
  flex: 1 1 auto;
  min-width: 0;

  @include mixins.landscape {
    max-width: 52%;
  }

  @include mixins.mq("lg") {
    max-width: 46%;
  }

  &-title {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    padding-bottom: var(--space-md);
    border-bottom: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);
  }
}

.story-chapters {
  list-style: none;
}

/* ── end ──────────────────────────────────────────────────────────────────── */
.story-end {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-xxl) 0 calc(var(--space-xxxl) * 2);
  border-top: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);

  @include mixins.landscape {
    max-width: 52%;
  }

  @include mixins.mq("lg") {
    margin-left: calc(190px + var(--space-xxl));
    max-width: 46%;
  }

  &-next {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    width: fit-content;
    color: var(--color-text-cyan-400);
    --icon-color: var(--color-cyan-400);
    transition: color 0.15s ease-in-out;

    &-label {
      font-size: var(--font-size-xs);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--color-text-cyan-300);
    }

    &-company {
      font-size: var(--font-size-title-xs);
      font-weight: 700;
    }

    &-icon {
      width: var(--icon-size-sm);
      transition: transform 0.2s var(--ease-smooth);
    }

    @include mixins.hover {
      &:hover &-icon {
        transform: translateX(6px);
      }
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .story-back-icon,
  .story-end-next-icon {
    transition: none;
  }
}
</style>
