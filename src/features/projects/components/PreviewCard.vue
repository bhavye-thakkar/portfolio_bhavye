<script setup lang="ts">
import Link from "../../../components/Link.vue";
import Notch from "../../../components/Notch.vue";
import ArrowRightLong from "../../../components/icons/ArrowRightLong.vue";
import gsap from "gsap";
import { onMounted, onUnmounted, ref } from "vue";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ButtonRound from "../../../components/ButtonRound.vue";
import { t } from "../../../i18n/utils/translate";
import { social } from "../../../content/social";
import Plus from "../../../components/icons/Plus.vue";

import type { ProjectPreview } from "../../../content/types";

const tlRef = ref<gsap.core.Timeline | null>(null);
const wrapperRef = ref<HTMLDivElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);

const props = defineProps<{
  preview?: ProjectPreview;
}>();

onMounted(async () => {
  if (
    !wrapperRef.value ||
    ScrollTrigger.isInViewport(wrapperRef.value) ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  // The card settles into place as it arrives rather than popping from 80%:
  // a smaller start, a longer exponential tail, and the artwork travelling a
  // little further than its frame so the two read as layers.
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: wrapperRef.value,
      start: "top bottom-=8%",
    },
  });
  tl.fromTo(wrapperRef.value, { scale: 0.92, y: 24 }, { scale: 1, y: 0, duration: 0.9, ease: "expo.out" }, 0);
  tl.fromTo(imageRef.value, { scale: 1.14 }, { scale: 1, duration: 1.1, ease: "expo.out" }, 0);

  tlRef.value = tl;
});

/**
 * Hover parallax: the artwork drifts a few pixels against the pointer inside
 * its frame. Written as two custom properties, so the transform itself stays
 * in CSS with the hover scale and one transition covers both.
 */
const handlePointerMove = (event: PointerEvent) => {
  if (event.pointerType !== "mouse" || !wrapperRef.value) return;
  const rect = wrapperRef.value.getBoundingClientRect();
  wrapperRef.value.style.setProperty("--mx", ((event.clientX - rect.left) / rect.width - 0.5).toFixed(3));
  wrapperRef.value.style.setProperty("--my", ((event.clientY - rect.top) / rect.height - 0.5).toFixed(3));
};

const handlePointerLeave = () => {
  wrapperRef.value?.style.setProperty("--mx", "0");
  wrapperRef.value?.style.setProperty("--my", "0");
};

onUnmounted(() => {
  if (tlRef.value) {
    tlRef.value.kill();
    tlRef.value = null;
  }
});
</script>

<template>
  <Link
    class="preview-card children-unclickable"
    :to="`/project/${props.preview.slug}`"
    :aria-label="t('switch-to-project', { project: props.preview.title })"
    data-cursor="arrow"
    data-sound="click"
    data-hoversound="hover"
    v-if="props.preview"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <div class="preview-card-top" ref="wrapperRef">
      <div class="preview-card-image-wrapper">
        <div class="preview-card-image-container">
          <img :src="props.preview.thumbnail" :alt="props.preview.title" class="preview-card-image" ref="imageRef" />
        </div>
      </div>
      <div class="preview-card-overlay">
        <div class="preview-card-edge">
          <ButtonRound class="preview-card-button" variant="accent" renderAs="div">
            <ArrowRightLong class="preview-card-button-arrow" />
          </ButtonRound>
        </div>
        <Notch class="preview-card-notch preview-card-notch-left" />
        <Notch class="preview-card-notch preview-card-notch-right" />
      </div>
    </div>
    <div class="preview-card-content">
      <div class="preview-card-copys">
        <h3 class="preview-card-title">{{ props.preview.title }}</h3>
        <p class="preview-card-description">{{ props.preview.description }}</p>
      </div>
    </div>
  </Link>

  <Link
    v-else
    class="preview-card children-unclickable"
    data-cursor="arrow-external"
    data-hoversound="hover"
    external
    :href="social[0].url"
  >
    <div class="preview-card-top preview-card-top-empty">
      <Plus class="preview-card-top-empty-icon" />
    </div>
    <div class="preview-card-content">
      <div class="preview-card-copys">
        <h3 class="preview-card-title">{{ t("start-a-new-project") }}</h3>
      </div>
    </div>
  </Link>
</template>

<style scoped lang="scss">
.preview-card {
  --hover: 0;
  position: relative;
  border-radius: var(--radius-xl);
  z-index: var(--z-index-layout);
  transition: scale 0.2s var(--ease-out-quint);

  &::after {
    content: "";
    position: absolute;
    top: -8px;
    left: -8px;
    width: calc(100% + 16px);
    height: calc(100% + 16px);
    background-color: var(--color-grayscale-400);
    border-radius: var(--radius-xl);
    z-index: -1;
    opacity: 0;
    transform: scale(0.985);
    pointer-events: none;
    transition:
      opacity 0.2s ease-out,
      transform 0.45s var(--ease-out-quint);
  }

  @include mixins.hover {
    &:hover {
      --hover: 1;

      &::after {
        opacity: 1;
        transform: scale(1);
      }
    }
  }

  /* Press: the card gives a little under the pointer on the down-stroke, so
     the click is acknowledged before the page has started to open. On the link
     itself, not on `-top`: the entrance tween below writes an inline
     `scale: none` on `-top`, which silently beat this rule. */
  &:active {
    scale: 0.98;
  }

  &-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    padding-top: var(--space-xs);
  }

  &-overlay {
    @include mixins.hover {
      display: none;
    }
  }

  &-notch {
    position: absolute;
    color: var(--color-beige-400);
    --icon-color: var(--color-beige-400);
    transform: scale(-1) rotate(90deg);
    height: var(--radius-lg);

    &-left {
      bottom: 0;
      right: 50px;
    }

    &-right {
      bottom: 50px;
      right: 0;
    }
  }

  &-edge {
    position: absolute;
    bottom: -1px;
    right: -1px;
    background-color: var(--color-beige-400);
    padding-left: 6px;
    padding-top: 6px;
    border-radius: 32px 0 0 0;
    padding-right: 1px;
    padding-bottom: 1px;
  }

  &-button {
    &-arrow {
      transition: transform 0.35s var(--ease-out-quint);
      width: 100%;
      transform: rotate(calc(var(--hover) * -45deg));
    }
  }

  &-image {
    width: 100%;
    height: 100%;
    object-fit: cover;

    /* Scale on hover plus a few pixels of drift against the pointer (--mx/--my
       from the script). Exponential ease-out: it answers on the first frames
       and settles softly, instead of the old 0.1s linear-ish snap. */
    &-container {
      transition: transform 0.6s var(--ease-out-quint);
      transform: translate3d(calc(var(--mx, 0) * var(--hover) * -10px), calc(var(--my, 0) * var(--hover) * -8px), 0)
        scale(calc(1 + var(--hover) * 0.045));
      aspect-ratio: 16/9;
    }

    &-wrapper {
      border-radius: var(--radius-lg);
      overflow: hidden;
      background-color: var(--color-beige-500);
    }
  }

  &-top {
    position: relative;
    width: 100%;
    aspect-ratio: 16/9;

    &-empty {
      border: 4px dashed var(--color-grayscale-500);
      border-radius: var(--radius-lg);
      background-color: var(--color-grayscale-400);
      display: flex;
      align-items: center;
      justify-content: center;

      &-icon {
        width: var(--icon-size-lg);
        color: var(--color-text-300);
        --icon-color: var(--color-text-300);
        --stroke-width: 4px;
      }
    }
  }

  &-copys {
    display: flex;
    flex-direction: column;
  }

  &-title {
    font-size: var(--font-size-title-xs);
    font-weight: 700;
    color: var(--color-text-400);
  }

  &-description {
    font-size: var(--font-size-md);
    color: var(--color-text-300);
    font-weight: 500;
  }
}
@media (prefers-reduced-motion: reduce) {
  .preview-card-image-container {
    transform: none;
    transition: none;
  }

  .preview-card {
    transition: none;
  }
}
</style>
