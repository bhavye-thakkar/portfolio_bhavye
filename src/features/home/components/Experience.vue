<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { Vector3 } from "three";
import gsap from "gsap";
import { transitions } from "../../../animations";
import { storyActive } from "../../../animations/story";
import { t } from "../../../i18n/utils/translate";
import AppearingText from "../../../components/AppearingText.vue";
import ProjectedElement from "../../../components/ProjectedElement.vue";
import Link from "../../../components/Link.vue";
import PinIcon from "../../../components/icons/Pin.vue";
import ArrowRightLong from "../../../components/icons/ArrowRightLong.vue";
import { experiences, chapterNumber } from "../../../content/experience";

/**
 * The Experience HUD, read as a career journal rather than a résumé.
 *
 * Two kinds of panel, and only ever one on screen. The opening card is pinned
 * to the avatar and names the journey; after that one editorial chapter card
 * per company holds the frame while the camera walks behind it. The card is the
 * door into the story page — everything about how the job actually happened
 * lives at /experience/:slug, not here.
 */

/**
 * The HUD tag hangs off this world point, just above and to one side of the
 * seated avatar's head (he is at (0, 0, 6) with his head at y 2.5).
 *
 * It has to stay close to him: the card is 400px wide and opens to the RIGHT
 * of wherever this projects to, so a point further out along +x pushes its far
 * edge off the viewport. At the establishing framing this lands about 210px
 * right of centre, which leaves the card and its connector comfortably inside
 * a 1280-wide window.
 */
const openingPoint = new Vector3(1.7, 3.15, 5.5);

const props = defineProps<{
  spacerRef: HTMLElement | null;
}>();

const openingRef = ref<HTMLDivElement | null>(null);
const chapterRefs = ref<HTMLDivElement[]>([]);
const setChapterRef = (el: unknown, index: number) => {
  if (el) chapterRefs.value[index] = el as HTMLDivElement;
};

// One reveal timeline per panel, assembled from the AppearingText children the
// same way the About panels do it.
const panelTimelines = ref<Record<string, { timeline: gsap.core.Timeline; delay: number }[]>>({});
const registerText = (key: string, timeline: gsap.core.Timeline, delay: number) => {
  const existing = panelTimelines.value[key] ?? [];
  panelTimelines.value = { ...panelTimelines.value, [key]: [...existing, { timeline, delay }] };
};

const buildPanelTimeline = (key: string) => {
  const tl = gsap.timeline({ paused: true });
  for (const item of panelTimelines.value[key] ?? []) {
    tl.add(() => {
      item.timeline.restart(true);
    }, item.delay);
  }
  return tl;
};

watchEffect((onInvalidate) => {
  const spacer = props.spacerRef;
  const opening = openingRef.value;
  const chapters = chapterRefs.value.filter(Boolean);

  // The story page takes the document scroll and puts this wrapper in
  // `position: fixed`; these triggers would be measuring nothing. They rebuild
  // when it closes.
  if (storyActive.value) return;
  if (!spacer || !opening || chapters.length !== experiences.length) return;
  // Wait until the text children have handed their timelines over, otherwise
  // the panels animate in silent.
  if (!panelTimelines.value.opening) return;

  transitions.experience.setup({
    spacer,
    opening: { element: opening, timeline: buildPanelTimeline("opening") },
    chapters: chapters.map((element, index) => ({
      element,
      timeline: buildPanelTimeline(`chapter-${index}`),
    })),
  });

  onInvalidate(() => {
    transitions.experience.destroy();
  });
});
</script>

<template>
  <div class="experience-content">
    <!-- Zero-height full-width layer centred in the viewport: the same anchor
         About uses, because camera.project() returns screen-centre offsets. -->
    <div class="experience-anchor">
      <ProjectedElement :point="openingPoint">
        <div ref="openingRef" class="experience-opening">
          <p class="experience-opening-eyebrow">{{ t("experience") }}</p>
          <div class="experience-opening-card">
            <h2 class="experience-opening-title">
              <AppearingText
                :text="t('my-journey')"
                :steps="1"
                :duration="0.4"
                @timeline:created="(tl: gsap.core.Timeline) => registerText('opening', tl, 0)"
              />
            </h2>
            <p class="experience-opening-copy">{{ t("my-journey-intro") }}</p>
            <p class="experience-opening-count">
              {{ experiences.length }} {{ experiences.length === 1 ? t("chapter") : t("chapters") }}
            </p>
          </div>
        </div>
      </ProjectedElement>
    </div>

    <div
      v-for="(entry, index) in experiences"
      :key="entry.slug"
      :ref="(el: unknown) => setChapterRef(el, index)"
      class="experience-chapter"
    >
      <Link
        :to="`/experience/${entry.slug}`"
        :class="[
          'experience-chapter-card',
          'children-unclickable',
          entry.placeholder && 'experience-chapter-card-placeholder',
        ]"
        :aria-label="t('view-experience-at', { company: entry.company })"
        data-cursor="arrow"
        data-sound="click"
        data-hoversound="hover"
      >
        <p class="experience-chapter-index" aria-hidden="true">{{ chapterNumber(index) }}</p>
        <div class="experience-chapter-body">
          <p class="experience-chapter-title">
            {{ entry.chapter }}
            <span v-if="entry.placeholder || entry.sampleStory" class="experience-chapter-slot">
              {{ entry.placeholder ? t("to-be-added") : t("sample-content") }}
            </span>
          </p>
          <h3 class="experience-chapter-company">
            <AppearingText
              :text="entry.company"
              :steps="2"
              :duration="0.5"
              @timeline:created="(tl: gsap.core.Timeline) => registerText(`chapter-${index}`, tl, 0)"
            />
          </h3>
          <p class="experience-chapter-role">{{ entry.role }}</p>

          <!-- A slot has no location or dates yet; a row of em-dashes reads as
               broken rather than as empty, so it simply is not there. -->
          <ul v-if="!entry.placeholder" class="experience-chapter-meta">
            <li class="experience-chapter-meta-place">
              <PinIcon class="experience-chapter-meta-icon" />{{ entry.location }}
            </li>
            <li>{{ entry.duration }}</li>
            <li>{{ entry.type }}</li>
          </ul>

          <p v-if="entry.statement" class="experience-chapter-statement">{{ entry.statement }}</p>

          <p class="experience-chapter-cta">
            {{ t("view-experience") }}<ArrowRightLong class="experience-chapter-cta-icon" />
          </p>
        </div>
      </Link>
    </div>
  </div>
</template>

<style scoped lang="scss">
.experience-content {
  position: absolute;
  color: var(--color-text-cyan-400);
  font-family: "ProFontWindows";
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: calc(var(--lvh) * 100);
  padding: var(--space-outer);
  pointer-events: none;

  --count-height: calc(max(calc((var(--lvh) - var(--svh)) * 100), 36px) + var(--space-outer));
}

.experience-anchor {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;

  /* Collapsed to a line through the viewport centre in landscape, which is the
     origin camera.project() measures from. Portrait ignores the projection and
     stacks the card at the bottom instead. */
  @include mixins.landscape {
    width: 100%;
    height: 0;
    top: 50%;
  }
}

/* ── opening card: pinned to the avatar while the camera holds still ─────── */
.experience-opening {
  --line-length: min(48px, calc(var(--svw) * 5));

  visibility: hidden;
  opacity: 0;
  will-change: transform, opacity;
  position: absolute;
  bottom: var(--count-height);
  left: var(--space-outer);
  width: calc(100% - var(--space-outer) * 2);
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);

  /* The card opens to the RIGHT of a projected point, so its width is what
     decides whether it clears the viewport edge. A narrower landscape is the
     tight case twice over: fewer pixels to give, and a narrower horizontal FOV
     that pushes the same world point further out. 26svw keeps the far edge
     inside a 1024-wide window and is inert above ~1385, where the fixed width
     is already the smaller of the two. */
  @include mixins.landscape {
    position: relative;
    left: 0;
    bottom: 0;
    width: 400px;
    max-width: calc(var(--svw) * 26);
    padding-left: var(--line-length);
    transform: translate(0, -50%);
  }

  @include mixins.landscape-large {
    width: 360px;
    max-width: calc(var(--svw) * 26);
  }

  &-eyebrow {
    font-size: var(--font-size-title-xs);
    font-weight: 700;
    /* Portrait stacks this over the scene rather than over the blue, and the
       desk under it is nearly the same value as #e1f5ff. The card behind the
       rest of the copy does this job; the eyebrow has to carry its own. */
    text-shadow: 0 1px 6px rgba(0, 14, 40, 0.85);

    @include mixins.landscape {
      text-shadow: none;
      font-size: var(--font-size-title-xxs);
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-xs);
    }
  }

  &-card {
    border: var(--stroke-sm) solid var(--color-cyan-400);
    border-radius: var(--radius-md);
    background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
    display: flex;
    flex-direction: column;
    gap: var(--space-xxs);
    padding: var(--space-sm) var(--space-md);
    position: relative;

    /* HUD connector back toward the avatar, same detail as the About panels */
    &::after,
    &::before {
      display: none;

      @include mixins.landscape {
        display: block;
        content: "";
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        left: calc(var(--line-length) * -1);
      }
    }

    &::after {
      width: 11px;
      height: 11px;
      background-color: var(--color-cyan-400);
      border-radius: 50%;
    }

    &::before {
      width: var(--line-length);
      height: 0;
      border-top: var(--stroke-sm) solid var(--color-cyan-400);
    }

    @include mixins.landscape {
      padding: var(--space-xs) var(--space-sm);
    }

    @include mixins.mq("md") {
      padding: var(--space-sm) var(--space-md);
    }
  }

  &-title {
    font-size: var(--font-size-title-sm);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;

    @include mixins.landscape {
      font-size: var(--font-size-title-xs);
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-sm);
    }
  }

  &-copy {
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-300);

    @include mixins.landscape {
      font-size: var(--font-size-sm);
    }
  }

  &-count {
    font-size: var(--font-size-xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    padding-top: var(--space-xxs);
  }
}

/* ── chapter card: fixed anchor, because the camera is the thing moving ──── */
.experience-chapter {
  visibility: hidden;
  opacity: 0;
  will-change: transform, opacity;
  position: absolute;
  bottom: var(--count-height);
  left: var(--space-outer);
  width: calc(100% - var(--space-outer) * 2);

  @include mixins.landscape {
    width: 540px;
    max-width: calc(var(--svw) * 44);
    bottom: calc(var(--space-outer) * 2);
  }

  @include mixins.landscape-large {
    width: 480px;
  }

  &-card {
    --hover: 0;
    pointer-events: auto;
    border: var(--stroke-sm) solid var(--color-cyan-400);
    border-radius: var(--radius-md);
    background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
    display: flex;
    align-items: stretch;
    gap: var(--space-md);
    padding: var(--space-sm) var(--space-md);
    color: inherit;
    transition:
      border-color 0.2s ease-in-out,
      box-shadow 0.2s ease-in-out;

    @include mixins.landscape {
      padding: var(--space-xs) var(--space-sm);
      gap: var(--space-sm);
    }

    @include mixins.mq("md") {
      padding: var(--space-sm) var(--space-md);
    }

    @include mixins.hover {
      &:hover {
        --hover: 1;
        border-color: var(--color-text-cyan-400);
        box-shadow: 0 0 0 1px rgba(225, 245, 255, 0.35);
      }
    }

    &-placeholder {
      border-style: dashed;
    }
  }

  /* The chapter number carries the sequence, so the copy does not have to. */
  &-index {
    font-size: var(--font-size-title-md);
    font-weight: 700;
    line-height: 0.85;
    color: var(--color-cyan-400);
    padding-right: var(--space-md);
    border-right: var(--stroke-sm) solid rgba(52, 191, 255, 0.4);
    flex: 0 0 auto;

    @include mixins.landscape {
      font-size: var(--font-size-title-sm);
      padding-right: var(--space-sm);
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-md);
    }
  }

  &-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-xxs);
    min-width: 0;
  }

  &-title {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    font-size: var(--font-size-xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-text-cyan-300);
  }

  /* An entry with no real company behind it yet says so on the card, rather
     than looking like a job that happened. */
  &-slot {
    letter-spacing: 0.14em;
    color: var(--color-cyan-400);
    border: var(--stroke-sm) dashed rgba(52, 191, 255, 0.55);
    border-radius: var(--radius-sm);
    padding: 1px var(--space-xs);
  }

  &-company {
    font-size: var(--font-size-title-xs);
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    text-wrap: balance;

    @include mixins.landscape {
      font-size: var(--font-size-title-xxs);
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-xs);
    }
  }

  &-role {
    font-size: var(--font-size-md);

    @include mixins.landscape {
      font-size: var(--font-size-sm);
    }
  }

  &-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xxs) var(--space-sm);
    list-style: none;
    margin-top: var(--space-xxs);
    font-size: var(--font-size-sm);
    color: var(--color-text-cyan-300);

    @include mixins.landscape {
      font-size: var(--font-size-xs);
    }

    li + li {
      /* A rule rather than a bullet: the row is metadata, not a list to read. */
      padding-left: var(--space-sm);
      border-left: var(--stroke-sm) solid rgba(129, 189, 216, 0.4);
    }

    &-place {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    &-icon {
      width: var(--icon-size-xxs);
      --icon-color: var(--color-text-cyan-300);
      transform: translateY(-1px);
      flex: 0 0 auto;
    }
  }

  &-statement {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-300);
    max-width: 46ch;
    margin-top: var(--space-xxs);

    @include mixins.landscape {
      font-size: var(--font-size-xs);
    }
  }

  &-cta {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-top: var(--space-xs);
    font-size: var(--font-size-sm);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    --icon-color: var(--color-cyan-400);

    @include mixins.landscape {
      font-size: var(--font-size-xs);
    }

    &-icon {
      width: var(--icon-size-sm);
      transition: transform 0.2s var(--ease-smooth);
      transform: translateX(calc(var(--hover) * 6px));
    }
  }
}

/* Reduced motion: the panels are already visible by default in the DOM sense —
   GSAP only ever moves them, so there is nothing to gate. Kill the travel. */
@media (prefers-reduced-motion: reduce) {
  .experience-opening,
  .experience-chapter {
    transition: none;
    will-change: auto;
  }

  .experience-chapter-cta-icon {
    transition: none;
  }
}
</style>
