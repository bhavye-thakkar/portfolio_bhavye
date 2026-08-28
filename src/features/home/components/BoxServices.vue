<script setup lang="ts">
import { ref, watchEffect, onBeforeUnmount } from "vue";
import gsap from "gsap";
import { t } from "../../../i18n/utils/translate";
import AppearingText from "../../../components/AppearingText.vue";
import { BREAKPOINTS } from "../../../utils/sizes";
import { Vector3 } from "three";
import ProjectedElement from "../../../components/ProjectedElement.vue";
import { skillHighlights } from "../../../content/profile";

const point = new Vector3(0.75, 2.75, 6.75);

const wrapperRef = ref<HTMLDivElement | null>(null);
const timelines = ref<{ timeline: gsap.core.Timeline; delay: number }[]>([]);
let matchMedia: gsap.MatchMedia | null = null;

const emit = defineEmits<{
  "timeline:created": [timeline: gsap.core.Timeline];
}>();

watchEffect((onInvalidate) => {
  const wrapperEl = wrapperRef.value;
  if (!wrapperEl) return;

  if (matchMedia) {
    matchMedia.revert();
    matchMedia = null;
  }

  matchMedia = gsap.matchMedia();

  matchMedia.add(
    {
      isMobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
      isDesktop: `(min-width: ${BREAKPOINTS.md}px)`,
    },
    (context) => {
      const { conditions } = context;
      const { isMobile } = conditions as { isMobile: boolean; isDesktop: boolean };

      const tl = gsap.timeline({
        paused: true,
      });

      // Only animate clipPath on desktop
      if (!isMobile) {
        tl.fromTo(
          wrapperEl,
          { clipPath: "inset(0% 100% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.4, ease: "none" },
          0,
        );
      } else {
        // On mobile, ensure clipPath is set to visible immediately
        gsap.set(wrapperEl, { clipPath: "inset(0% 0% 0% 0%)" });
      }

      for (let i = 0; i < timelines.value.length; i++) {
        const item = timelines.value[i];
        if (!item) continue;
        tl.add(() => {
          item.timeline.restart(true);
        }, item.delay + 0.25);
      }

      emit("timeline:created", tl);

      // Return cleanup function
      return () => {
        tl.kill();
      };
    },
  );

  onInvalidate(() => {
    if (matchMedia) {
      matchMedia.revert();
      matchMedia = null;
    }
  });
});

onBeforeUnmount(() => {
  if (matchMedia) {
    matchMedia.revert();
  }
});

const handleTimelineCreated = (timeline: gsap.core.Timeline, delay: number) => {
  const updatedTimelines = [...timelines.value, { timeline, delay }];
  timelines.value = updatedTimelines;
};

/**
 * One Skills card. The first five are the card's opening view — the list scrolls
 * inside the card for the rest, so the card keeps its original size.
 */
const VISIBLE_ROWS = 5;

/**
 * The list moved to `content/profile.ts` so the skills, the certificates and
 * llms.txt all come out of one file. The panel itself — its scroll container,
 * its reveal timeline, its layout — is untouched; only the source of the
 * words changed.
 */
const services = skillHighlights;

// The opening view keeps its original stagger; everything below the fold lands
// with the last visible row instead of dragging the reveal out off-screen.
const revealDelay = (index: number) => 0.15 + Math.min(index, VISIBLE_ROWS) * 0.1;

// The bottom fade is the "there is more below" cue. It has to switch off at the
// end of the list, otherwise the last row sits permanently half-faded.
const listRef = ref<HTMLDivElement | null>(null);
const isAtEnd = ref(false);

const handleListScroll = () => {
  const el = listRef.value;
  if (!el) return;
  isAtEnd.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
};
</script>

<template>
  <ProjectedElement :point="point">
    <div class="box-services">
      <div ref="wrapperRef" class="box-services-panel">
        <div class="box-services-content">
          <div class="box-services-title">
            <AppearingText
              :text="t('services')"
              :steps="1"
              :duration="0.35"
              @timeline:created="(tl: gsap.core.Timeline) => handleTimelineCreated(tl, 0)"
            />
          </div>
          <!-- data-lenis-prevent hands the wheel/touch back to the browser over
               this element, so the list scrolls without moving the page or the
               scroll-driven 3D scene behind it. -->
          <div
            ref="listRef"
            class="box-services-list"
            :class="{ 'box-services-list-end': isAtEnd }"
            data-lenis-prevent
            tabindex="0"
            role="group"
            :aria-label="t('services')"
            @scroll.passive="handleListScroll"
          >
            <div class="box-services-list-item" v-for="(service, index) in services" :key="service.name">
              <p class="box-services-list-item-name">
                <AppearingText
                  :text="service.name"
                  :steps="1"
                  :duration="0.35"
                  @timeline:created="(tl: gsap.core.Timeline) => handleTimelineCreated(tl, revealDelay(index))"
                />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </ProjectedElement>
</template>

<style scoped lang="scss">
/* Registered so the bottom-fade stop can be transitioned rather than snapped. */
@property --skills-fade {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

.box-services {
  --line-length: min(48px, calc(var(--svw) * 5));
  /* the card opens on exactly five rows; ProFontWindows resolves line-height:normal to ~1.03em */
  --row-font: var(--font-size-md);

  position: absolute;
  bottom: var(--count-height);
  width: calc(100% - var(--space-outer) * 2);
  left: var(--space-outer);

  @include mixins.landscape {
    --row-font: var(--font-size-sm);

    width: 480px;
    max-width: calc(var(--svw) * 37);
    padding-left: var(--line-length);
    position: relative;
    left: 0;
    bottom: 0;
    padding-top: 3px;
    transform: translate(0, -50%);
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  @include mixins.landscape-large {
    --row-font: var(--font-size-lg);

    width: 380px;
    max-width: calc(var(--svw) * 36);
  }

  &-panel {
    position: relative;
    will-change: clip-path;

    &::after,
    &::before {
      display: none;

      @include mixins.landscape {
        display: block;
      }
    }

    &::after {
      content: "";
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: calc(var(--line-length) * -1);
      width: 11px;
      height: 11px;
      background-color: var(--color-cyan-400);
      border-radius: 50%;
    }

    &::before {
      content: "";
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      left: calc(var(--line-length) * -1);
      height: 0;
      border-top: var(--stroke-sm) solid var(--color-cyan-400);

      @include mixins.landscape {
        width: var(--line-length);
      }
    }
  }

  &-content {
    border: var(--stroke-sm) solid var(--color-cyan-400);
    border-radius: var(--radius-md);
    background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);

    @include mixins.landscape {
      padding: var(--space-xs) var(--space-sm);
    }

    @include mixins.mq("md") {
      padding: var(--space-sm) var(--space-md);
    }
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);

    /* Only the list scrolls; the card and its title stay put. The rows inherit
       this font-size, so `1lh` here is exactly one row — deriving the height
       from a guessed line-height ratio clipped the fifth row by ~2px once
       ProFontWindows had loaded. */
    font-size: var(--row-font);
    max-height: calc(5lh + var(--space-xs) * 4);
    overflow-y: auto;
    /* stop the page from taking over once the list hits either end */
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    padding-right: var(--space-xs);

    /* Bottom fade cue. The stop is a registered custom property so it eases
       away at the end of the list instead of popping. */
    --skills-fade: 20px;

    mask-image: linear-gradient(to bottom, #000 calc(100% - var(--skills-fade)), transparent 100%);
    transition: --skills-fade 0.25s var(--ease-power2-out);

    &-end {
      --skills-fade: 0px;
    }

    /* A native scrollbar can't be made HUD-shaped, and Chrome's `thin` claims
       10px of the card's fixed width. The bottom fade is the whole cue. */
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    &:focus-visible {
      outline: var(--stroke-sm) solid var(--color-text-cyan-400);
      outline-offset: 2px;
      border-radius: var(--radius-sm);
    }

    &-item {
      display: flex;
      flex-direction: column;
      padding-left: 18px;
      position: relative;
      flex: 0 0 auto;

      &::before {
        content: "";
        position: absolute;
        left: 2px;
        top: 6px;
        width: 4px;
        height: 4px;
        background-color: var(--color-text-cyan-400);
        border-radius: 50%;
      }

      &-name {
        font-size: var(--font-size-md);

        @include mixins.landscape {
          font-size: var(--font-size-sm);
        }

        @include mixins.landscape-large {
          font-size: var(--font-size-lg);
        }
      }
    }
  }

  &-title {
    font-size: var(--font-size-title-xs);
    font-weight: 700;

    @include mixins.landscape {
      font-size: var(--font-size-title-xxs);
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-xs);
    }
  }
}
</style>
