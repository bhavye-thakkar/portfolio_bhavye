<script setup lang="ts">
import { ref, computed, watchEffect, onBeforeUnmount, onMounted } from "vue";
import gsap from "gsap";
import { t } from "../../../i18n/utils/translate";
import AppearingText from "../../../components/AppearingText.vue";
import { BREAKPOINTS } from "../../../utils/sizes";
import { Vector3 } from "three";
import ProjectedElement from "../../../components/ProjectedElement.vue";
import ArrowRightLong from "../../../components/icons/ArrowRightLong.vue";
import { certificates } from "../../../content/profile";

// Same z-plane as the other about panels, vertically centred on the avatar
const pointLeft = new Vector3(-0.9, 2.37, 6.75);
const pointRight = new Vector3(0.75, 2.37, 6.75);

/**
 * ─── CERTIFICATE LINKS ────────────────────────────────────────────────────
 * The cards, their URLs and their years live in `content/profile.ts`, the
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

// A linked card renders as <a>, an unlinked one as <div>, keeps the markup
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
          // `--scan` rides the same tween as the clip-path, so the bright
          // leading line is always exactly at the wipe's edge. Two tweens
          // with their own eases would drift apart and read as a glow
          // chasing the card rather than as one scan across it.
          tl.fromTo(
            cards,
            { opacity: 0, y: 12, clipPath: "inset(0% 100% 0% 0%)", "--scan": 0 },
            {
              opacity: 1,
              y: 0,
              clipPath: "inset(0% 0% 0% 0%)",
              "--scan": 1,
              duration: 0.35,
              ease: "power1.out",
              stagger: 0.09,
            },
            0,
          );
        }
      } else {
        if (cards.length > 0) {
          gsap.set(cards, { opacity: 1, y: 0, clipPath: "inset(0% 0% 0% 0%)", "--scan": 1 });
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
          :data-cursor="certificate.url ? 'circle-cyan' : undefined"
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
              :alt="`${certificate.organisation}, ${certificate.name}`"
              loading="lazy"
            />
          </div>
          <!-- Not the shared accent button any more: that variant is filled
               with `--color-orange-400`, which is the site's CTA colour and
               reads as a warm sticker on a cold holographic card. This is a
               plain span the card styles itself. -->
          <span v-if="certificate.url" class="box-certificates-item-go" aria-hidden="true">
            <ArrowRightLong class="box-certificates-item-go-arrow" />
          </span>
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
          :data-cursor="certificate.url ? 'circle-cyan' : undefined"
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
              :alt="`${certificate.organisation}, ${certificate.name}`"
              loading="lazy"
            />
          </div>
          <!-- Not the shared accent button any more: that variant is filled
               with `--color-orange-400`, which is the site's CTA colour and
               reads as a warm sticker on a cold holographic card. This is a
               plain span the card styles itself. -->
          <span v-if="certificate.url" class="box-certificates-item-go" aria-hidden="true">
            <ArrowRightLong class="box-certificates-item-go-arrow" />
          </span>
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

    /**
     * ── THE PANEL ITSELF ──────────────────────────────────────────────────
     *
     * Same world as the x-ray figure standing next to it: a pane of cold
     * glass with a scanline raster across it and light caught along its top
     * edge. Three layers, all cheap:
     *
     *   background   the existing hologram gradient, unchanged
     *   ::before     the raster + the edge illumination, always on
     *   ::after      a single bright line that sweeps the card on entrance
     *
     * The raster is 3px-pitch and 7% alpha on purpose. Anything denser
     * moirés against the card's own text at small sizes, and anything
     * brighter turns a readable panel into a screensaver.
     */
    &-inner {
      --scan: 1;
      position: relative;
      isolation: isolate;
      overflow: hidden;
      will-change: transform, opacity, clip-path;
      border: var(--stroke-sm) solid var(--color-cyan-400);
      border-radius: var(--radius-md);
      background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
      box-shadow:
        inset 0 1px 0 rgba(190, 235, 255, 0.35),
        inset 0 0 18px rgba(52, 191, 255, 0.14);
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

      /* raster + top-edge illumination */
      &::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        pointer-events: none;
        background:
          linear-gradient(to bottom, rgba(120, 220, 255, 0.16) 0%, transparent 38%),
          repeating-linear-gradient(
            to bottom,
            rgba(120, 220, 255, 0.07) 0px,
            rgba(120, 220, 255, 0.07) 1px,
            transparent 1px,
            transparent 3px
          );
      }

      /* The reveal's leading edge. `--scan` is tweened 0 -> 1 by the same
         timeline that runs the clip-path, so the line rides the wipe instead
         of being a second animation with its own timing to drift out of. */
      &::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: -1;
        width: 42px;
        pointer-events: none;
        left: calc(var(--scan) * 100%);
        transform: translateX(-100%);
        background: linear-gradient(to right, rgba(120, 220, 255, 0) 0%, rgba(150, 235, 255, 0.55) 100%);
        opacity: calc(1 - var(--scan));
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
           `!important`, that is what outranks the inline declaration. */
        scale: calc(1 + var(--hover) * 0.02) !important;
        border-color: color-mix(in srgb, var(--color-text-cyan-400) calc(var(--hover) * 100%), var(--color-cyan-400));
        transition:
          scale 0.1s ease-in-out,
          border-color 0.1s ease-in-out;
      }

      /* Press reads instantly and releases on its own, the new tab opens on
         click, so nothing here delays the navigation. */
      &:active .box-certificates-item-inner {
        scale: 0.985 !important;
        transition-duration: 0.06s;
      }

      /* The scanner pass. It reuses the entrance sweep's own element rather
         than adding a second one: once the card has settled `--scan` is 1, so
         that pseudo is parked at the right edge at zero opacity and is free.
         A running animation outranks the declared `left` / `opacity`, so the
         same bright line simply walks the card again while it is hovered. */
      @include mixins.hover {
        &:hover .box-certificates-item-inner::after {
          animation: certificate-scan 1.6s var(--ease-smooth) infinite;
        }
      }
    }

    /* The "this opens something" badge. It used to be the shared accent
       button, an orange disc, the site's CTA colour, sitting on a cyan
       hologram. Now it is an illuminated ring cut from the same glass as the
       card: transparent centre, lit rim, cyan arrow.

       Lives on the unclipped link wrapper so the card's entrance clip-path
       cannot crop it. */
    &-go {
      position: absolute;
      right: 6px;
      bottom: 6px;
      pointer-events: none;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 7px;
      border-radius: 50%;
      background: radial-gradient(circle at 50% 35%, rgba(52, 191, 255, 0.28), rgba(0, 40, 90, 0.4));
      border: var(--stroke-sm) solid var(--color-cyan-400);
      box-shadow:
        0 0 0 1px rgba(52, 191, 255, 0.18),
        0 0 12px rgba(52, 191, 255, calc(0.25 + var(--hover) * 0.45));
      --icon-color: var(--color-text-cyan-400);
      transition:
        opacity 0.1s ease-in-out,
        scale 0.1s ease-in-out,
        box-shadow 0.15s ease-in-out,
        background-color 0.15s ease-in-out;

      /* Touch has no hover, so the badge stays put and does the signalling on
         its own, same trade the project preview cards make. */
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

@keyframes certificate-scan {
  from {
    left: 0%;
    opacity: 0;
  }
  30% {
    opacity: 0.7;
  }
  to {
    left: 100%;
    opacity: 0;
  }
}

/* A hover that repeats forever is the one animation on this page a visitor
   cannot escape by scrolling past it. */
@media (prefers-reduced-motion: reduce) {
  .box-certificates-item-linked:hover .box-certificates-item-inner::after {
    animation: none;
  }
}
</style>
