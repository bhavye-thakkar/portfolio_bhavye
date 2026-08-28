<script setup lang="ts">
import { ref, computed, watchEffect, onBeforeUnmount, onMounted } from "vue";
import gsap from "gsap";
import { t } from "../../../i18n/utils/translate";
import AppearingText from "../../../components/AppearingText.vue";
import { BREAKPOINTS } from "../../../utils/sizes";
import { Vector3 } from "three";
import ProjectedElement from "../../../components/ProjectedElement.vue";
import ButtonRound from "../../../components/ButtonRound.vue";
import ArrowRightLong from "../../../components/icons/ArrowRightLong.vue";
import { certificates } from "../../../content/profile";

// Same z-plane as the other about panels, vertically centred on the avatar
const pointLeft = new Vector3(-0.9, 2.37, 6.75);
const pointRight = new Vector3(0.75, 2.37, 6.75);

/**
 * ─── CERTIFICATE LINKS ────────────────────────────────────────────────────
 * The cards, their URLs and their years live in `content/profile.ts` — the
 * five below are the real destinations the portfolio publishes, not stand-ins.
 * A card with a `url` renders as an `<a>` that opens in a new tab; a card with
 * an empty `url` stays a plain, non-clickable HUD card, so an entry whose link
 * is not public yet is still safe to ship.
 *
 * Drop a file in `src/assets/images/certificates/` and set `image` to its
 * import to show a preview inside the card. Entries without one keep the
 * plain HUD treatment.
 */
type Certificate = (typeof certificates)[number];

// A linked card renders as <a>, an unlinked one as <div> — keeps the markup
// honest so screen readers never announce a dead link.
const cardTag = (certificate: Certificate) => (certificate.url ? "a" : "div");

const cardLabel = (certificate: Certificate) =>
  certificate.url
    ? t("view-certificate", { name: certificate.name, organisation: certificate.organisation })
    : undefined;

const SPLIT = 3;

const isLandscape = ref(true);
let landscapeQuery: MediaQueryList | null = null;

const handleOrientation = () => {
  isLandscape.value = landscapeQuery?.matches ?? true;
};

onMounted(() => {
  landscapeQuery = window.matchMedia("(orientation: landscape)");
  handleOrientation();
  landscapeQuery.addEventListener("change", handleOrientation);
});

onBeforeUnmount(() => {
  landscapeQuery?.removeEventListener("change", handleOrientation);
  landscapeQuery = null;
});

// Portrait stacks every card in a single column, landscape flanks the avatar
const primary = computed(() => (isLandscape.value ? certificates.slice(0, SPLIT) : certificates));
const secondary = computed(() => (isLandscape.value ? certificates.slice(SPLIT) : []));

const wrapperRef = ref<HTMLDivElement | null>(null);
const wrapperSecondaryRef = ref<HTMLDivElement | null>(null);
const cardRefs = ref<HTMLDivElement[]>([]);
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

      const cards = cardRefs.value.filter((card) => !!card);

      if (!isMobile) {
        // Cards settle in one after another, same restraint as the other panels
        if (cards.length > 0) {
          tl.fromTo(
            cards,
            { opacity: 0, y: 12, clipPath: "inset(0% 100% 0% 0%)" },
            {
              opacity: 1,
              y: 0,
              clipPath: "inset(0% 0% 0% 0%)",
              duration: 0.35,
              ease: "power1.out",
              stagger: 0.09,
            },
            0,
          );
        }
      } else {
        if (cards.length > 0) {
          gsap.set(cards, { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)" });
        }
      }

      for (let i = 0; i < timelines.value.length; i++) {
        const item = timelines.value[i];
        if (!item) continue;
        tl.add(() => {
          item.timeline.restart(true);
        }, item.delay + 0.2);
      }

      emit("timeline:created", tl);

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

const setCardRef = (el: unknown, index: number) => {
  if (el) cardRefs.value[index] = el as HTMLDivElement;
};
</script>

<template>
  <ProjectedElement :point="pointLeft">
    <div ref="wrapperRef" class="box-certificates box-certificates-primary">
      <div class="box-certificates-title">
        <AppearingText
          :text="t('certificates')"
          :steps="1"
          :duration="0.35"
          @timeline:created="(tl: gsap.core.Timeline) => handleTimelineCreated(tl, 0)"
        />
      </div>
      <div class="box-certificates-list">
        <component
          :is="cardTag(certificate)"
          v-for="(certificate, index) in primary"
          :key="certificate.name"
          class="box-certificates-item"
          :class="{ 'box-certificates-item-linked': !!certificate.url }"
          :href="certificate.url || undefined"
          :target="certificate.url ? '_blank' : undefined"
          :rel="certificate.url ? 'noopener noreferrer' : undefined"
          :aria-label="cardLabel(certificate)"
          :data-cursor="certificate.url ? 'arrow-external' : undefined"
          :data-sound="certificate.url ? 'click' : undefined"
          :data-hoversound="certificate.url ? 'hover' : undefined"
        >
          <div class="box-certificates-item-inner" :ref="(el: unknown) => setCardRef(el, index)">
            <div class="box-certificates-item-head">
              <p class="box-certificates-item-organisation">{{ certificate.organisation }}</p>
              <p class="box-certificates-item-year">{{ certificate.year }}</p>
            </div>
            <p v-if="certificate.note" class="box-certificates-item-note">{{ certificate.note }}</p>
            <p class="box-certificates-item-name">{{ certificate.name }}</p>
            <img
              v-if="certificate.image"
              class="box-certificates-item-image"
              :src="certificate.image"
              :alt="`${certificate.organisation} — ${certificate.name}`"
              loading="lazy"
            />
          </div>
          <ButtonRound
            v-if="certificate.url"
            class="box-certificates-item-go"
            variant="accent"
            renderAs="div"
            size="sm"
          >
            <ArrowRightLong class="box-certificates-item-go-arrow" />
          </ButtonRound>
        </component>
      </div>
    </div>
  </ProjectedElement>
  <ProjectedElement v-if="secondary.length > 0" :point="pointRight">
    <div ref="wrapperSecondaryRef" class="box-certificates box-certificates-secondary">
      <div class="box-certificates-list">
        <component
          :is="cardTag(certificate)"
          v-for="(certificate, index) in secondary"
          :key="certificate.name"
          class="box-certificates-item"
          :class="{ 'box-certificates-item-linked': !!certificate.url }"
          :href="certificate.url || undefined"
          :target="certificate.url ? '_blank' : undefined"
          :rel="certificate.url ? 'noopener noreferrer' : undefined"
          :aria-label="cardLabel(certificate)"
          :data-cursor="certificate.url ? 'arrow-external' : undefined"
          :data-sound="certificate.url ? 'click' : undefined"
          :data-hoversound="certificate.url ? 'hover' : undefined"
        >
          <div class="box-certificates-item-inner" :ref="(el: unknown) => setCardRef(el, SPLIT + index)">
            <div class="box-certificates-item-head">
              <p class="box-certificates-item-organisation">{{ certificate.organisation }}</p>
              <p class="box-certificates-item-year">{{ certificate.year }}</p>
            </div>
            <p v-if="certificate.note" class="box-certificates-item-note">{{ certificate.note }}</p>
            <p class="box-certificates-item-name">{{ certificate.name }}</p>
            <img
              v-if="certificate.image"
              class="box-certificates-item-image"
              :src="certificate.image"
              :alt="`${certificate.organisation} — ${certificate.name}`"
              loading="lazy"
            />
          </div>
          <ButtonRound
            v-if="certificate.url"
            class="box-certificates-item-go"
            variant="accent"
            renderAs="div"
            size="sm"
          >
            <ArrowRightLong class="box-certificates-item-go-arrow" />
          </ButtonRound>
        </component>
      </div>
    </div>
  </ProjectedElement>
</template>

<style scoped lang="scss">
.box-certificates {
  --line-length: min(48px, calc(var(--svw) * 5));

  position: absolute;
  bottom: var(--count-height);
  width: calc(100% - var(--space-outer) * 2);
  left: var(--space-outer);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);

  @include mixins.landscape {
    position: relative;
    left: 0;
    bottom: 0;
    width: 480px;
    max-width: calc(var(--svw) * 37);
  }

  @include mixins.landscape-large {
    width: 380px;
    max-width: calc(var(--svw) * 36);
  }

  &-primary {
    @include mixins.landscape {
      padding-right: var(--line-length);
      transform: translate(-100%, -50%);
      align-items: flex-end;
    }
  }

  &-secondary {
    display: none;

    @include mixins.landscape {
      display: flex;
      padding-left: var(--line-length);
      transform: translate(0, -50%);
    }
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    width: 100%;
    position: relative;

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
      width: var(--line-length);
      height: 0;
      border-top: var(--stroke-sm) solid var(--color-cyan-400);
    }
  }

  &-primary &-list {
    &::after,
    &::before {
      right: calc(var(--line-length) * -1);
    }
  }

  &-secondary &-list {
    &::after,
    &::before {
      left: calc(var(--line-length) * -1);
    }
  }

  &-title {
    font-size: var(--font-size-title-xs);
    font-weight: 700;
    padding-left: var(--space-md);

    @include mixins.landscape {
      /* Out of flow so the group centres on the cards, keeping both HUD
         connectors level with the projected anchor */
      position: absolute;
      bottom: calc(100% + var(--space-xs));
      right: var(--line-length);
      font-size: var(--font-size-title-xxs);
      padding-left: 0;
    }

    @include mixins.landscape-large {
      font-size: var(--font-size-title-xs);
    }
  }

  /* The card visuals live on `-inner`, which is what GSAP wipes in with a
     clip-path. `-item` is the bare link around it: unclipped, so it can draw
     the hover plate outside the card the way the project cards do. */
  &-item {
    --hover: 0;
    position: relative;
    z-index: 0;
    display: block;

    &-inner {
      will-change: transform, opacity, clip-path;
      border: var(--stroke-sm) solid var(--color-cyan-400);
      border-radius: var(--radius-md);
      background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
      display: flex;
      flex-direction: column;
      gap: var(--space-xxs);
      padding: var(--space-sm) var(--space-md);

      @include mixins.landscape {
        padding: var(--space-xs) var(--space-sm);
      }

      @include mixins.mq("md") {
        padding: var(--space-sm) var(--space-md);
      }
    }

    /* Same hover shape as the project preview cards: a plate slides in behind
       the card and the card itself takes a small step up in scale. Cyan rather
       than beige, because this one sits on the hologram HUD. */
    &-linked {
      cursor: pointer;
      color: inherit;
      text-decoration: none;

      &::after {
        content: "";
        position: absolute;
        top: -6px;
        left: -6px;
        width: calc(100% + 12px);
        height: calc(100% + 12px);
        border-radius: var(--radius-lg);
        background-color: rgba(52, 191, 255, 0.2);
        box-shadow: 0 0 0 var(--stroke-sm) rgba(52, 191, 255, 0.55);
        z-index: -1;
        opacity: var(--hover);
        pointer-events: none;
        transition: opacity 0.1s ease-in-out;
      }

      @include mixins.hover {
        &:hover {
          --hover: 1;
        }
      }

      &:focus-visible {
        --hover: 1;
        outline: none;

        /* Forced-colors drops backgrounds and shadows, which would leave these
           links with no visible focus ring at all. */
        @media (forced-colors: active) {
          outline: var(--stroke-md) solid;
          outline-offset: 2px;
        }
      }

      .box-certificates-item-inner {
        /* GSAP owns `transform` here and parks `scale: none` inline alongside
           it, so the hover step uses the independent `scale` property with
           `!important` — that is what outranks the inline declaration. */
        scale: calc(1 + var(--hover) * 0.02) !important;
        border-color: color-mix(in srgb, var(--color-text-cyan-400) calc(var(--hover) * 100%), var(--color-cyan-400));
        transition:
          scale 0.1s ease-in-out,
          border-color 0.1s ease-in-out;
      }

      /* Press reads instantly and releases on its own — the new tab opens on
         click, so nothing here delays the navigation. */
      &:active .box-certificates-item-inner {
        scale: 0.985 !important;
        transition-duration: 0.06s;
      }
    }

    /* The accent arrow badge from the project cards — it is what says "this
       opens something". Lives on the unclipped link wrapper so the card's
       entrance clip-path cannot crop it. */
    &-go {
      position: absolute;
      right: 6px;
      bottom: 6px;
      pointer-events: none;
      transition:
        opacity 0.1s ease-in-out,
        scale 0.1s ease-in-out;

      /* Touch has no hover, so the badge stays put and does the signalling on
         its own — same trade the project preview cards make. */
      opacity: 1;
      scale: 1;

      @include mixins.hover {
        opacity: var(--hover);
        scale: calc(0.8 + var(--hover) * 0.2);
      }

      &-arrow {
        width: 100%;
        transition: transform 0.1s ease-in-out;
        transform: rotate(calc(var(--hover) * -45deg));
      }
    }

    &-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-sm);
    }

    &-organisation {
      font-size: var(--font-size-md);
      font-weight: 700;

      @include mixins.landscape {
        font-size: var(--font-size-sm);
      }

      @include mixins.landscape-large {
        font-size: var(--font-size-md);
      }
    }

    &-year {
      color: var(--color-cyan-400);
      font-size: var(--font-size-sm);
      white-space: nowrap;

      @include mixins.landscape {
        font-size: var(--font-size-xs);
      }

      @include mixins.landscape-large {
        font-size: var(--font-size-sm);
      }
    }

    &-note {
      color: var(--color-text-cyan-300);
      font-size: var(--font-size-sm);

      @include mixins.landscape {
        font-size: var(--font-size-xs);
      }

      @include mixins.landscape-large {
        font-size: var(--font-size-sm);
      }
    }

    &-name {
      font-size: var(--font-size-md);

      @include mixins.landscape {
        font-size: var(--font-size-sm);
      }

      @include mixins.landscape-large {
        font-size: var(--font-size-md);
      }
    }

    &-image {
      margin-top: var(--space-xxs);
      width: 100%;
      height: auto;
      display: block;
      border-radius: var(--radius-sm);
      border: var(--stroke-sm) solid var(--color-cyan-500);
    }
  }
}
</style>
