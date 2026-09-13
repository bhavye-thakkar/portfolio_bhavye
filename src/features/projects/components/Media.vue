<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import gsap from "gsap";
import Notch from "../../../components/Notch.vue";
import { prefersReducedMotion, useScrollMotion } from "../composables/useScrollMotion";

const wrapperRef = ref<HTMLDivElement | null>(null);
const mediaRef = ref<HTMLVideoElement | HTMLImageElement | null>(null);
const mediaContentRef = ref<HTMLDivElement | null>(null);

export interface Props {
  type: "image" | "video";
  src: string;
  alt?: string;
  caption?: string;
  /** Still frame shown before a video has loaded, and instead of it for reduced motion. */
  poster?: string;
  /**
   * Horizontal focus, 0–100, for narrow screens. When set, below the md
   * breakpoint the tile becomes 4:5 and crops to this point, so a wide
   * composition of phone screens shows one screen at a readable size instead of
   * three at 75px each. Unset keeps the full 16:9 frame everywhere.
   */
  focus?: number;
  index: number;
}

const props = defineProps<Props>();

const reducedMotion = prefersReducedMotion();

let observer: IntersectionObserver | null = null;

/**
 * ── VIDEO PLAYS ONLY WHILE IT CAN BE SEEN ──────────────────────────────────
 *
 * `autoplay` on every clip meant every clip on the page downloaded and ran from
 * the moment the page opened, most of them off-screen. `preload="none"` plus
 * this observer loads a clip as it approaches and pauses it once it has gone.
 * Reduced motion keeps the poster and the native controls instead.
 */
onMounted(() => {
  if (props.type !== "video" || reducedMotion || !mediaRef.value || !("IntersectionObserver" in window)) return;
  const video = mediaRef.value as HTMLVideoElement;
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry?.isIntersecting) video.play().catch(() => {});
      else video.pause();
    },
    { threshold: 0.2 },
  );
  observer.observe(video);
});

onBeforeUnmount(() => observer?.disconnect());

/**
 * ── THE FRAME OPENS, THEN THE PICTURE SETTLES ──────────────────────────────
 *
 * Scrubbed on the page scroll (Lenis already smooths it), so the media arrives
 * at the speed the visitor is reading rather than on a timer:
 *
 *   · the frame opens from a slightly inset clip to its full rectangle and
 *     grows from 94% as it comes up the screen. It has finished by the time
 *     its top is a little above the middle, so it is always full size while
 *     it is actually being looked at;
 *   · inside it the picture drifts from 5% below to 5% above over the whole
 *     pass, scaled 1.12 so the drift never shows an edge. The difference in
 *     speed between the frame and the picture is the depth;
 *   · leaving, the frame gives back 3% as it goes off the top.
 *
 * clip-path and transform only: no layout, and no filters over video.
 */
useScrollMotion(wrapperRef, (wrapper) => {
  const frame = mediaContentRef.value;
  const media = mediaRef.value;
  if (!frame || !media) return;

  gsap.fromTo(
    frame,
    { clipPath: "inset(7% 5% 7% 5% round 28px)", scale: 0.94 },
    {
      clipPath: "inset(0% 0% 0% 0% round 16px)",
      scale: 1,
      ease: "none",
      scrollTrigger: { trigger: wrapper, start: "top bottom", end: "top 42%", scrub: true },
    },
  );
  gsap.fromTo(
    media,
    { yPercent: 5, scale: 1.12 },
    {
      yPercent: -5,
      scale: 1.12,
      ease: "none",
      scrollTrigger: { trigger: wrapper, start: "top bottom", end: "bottom top", scrub: true },
    },
  );
  gsap.to(frame, {
    scale: 0.97,
    ease: "none",
    immediateRender: false,
    scrollTrigger: { trigger: wrapper, start: "bottom 35%", end: "bottom top", scrub: true },
  });
});
</script>

<template>
  <div
    :class="['project-media', props.focus !== undefined && 'project-media-focus']"
    :style="props.focus !== undefined ? { '--media-focus': `${props.focus}%` } : undefined"
    ref="wrapperRef"
  >
    <div class="project-media-content" ref="mediaContentRef">
      <img
        v-if="props.type === 'image'"
        :src="props.src"
        :alt="props.alt"
        loading="lazy"
        decoding="async"
        class="project-media-image"
        ref="mediaRef"
      />
      <video
        v-else
        :src="props.src"
        :poster="props.poster"
        :aria-label="props.alt"
        :controls="reducedMotion"
        muted
        loop
        playsinline
        preload="none"
        class="project-media-video"
        ref="mediaRef"
      ></video>
      <!-- Inside the frame, so it opens with it rather than floating at the
           final corner while the frame is still inset. -->
      <div class="project-media-caption" v-if="props.caption">
        <Notch class="project-media-caption-notch project-media-caption-notch-left" />
        <Notch class="project-media-caption-notch project-media-caption-notch-top" />
        <p class="project-media-caption-copy">{{ props.caption }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project-media {
  width: 100%;
  height: 100%;
  grid-column: 1 / 13;
  max-width: 1040px;
  justify-self: center;
  position: relative;
  aspect-ratio: 16 / 9;

  @include mixins.mq("md") {
    grid-column: 2 / 12;
  }

  @include mixins.mq("lg") {
    grid-column: 3 / 11;
  }

  &-caption {
    position: absolute;
    bottom: -1px;
    right: -1px;
    background-color: var(--color-background-400);
    padding: var(--space-xxs) var(--space-sm);
    border-radius: var(--radius-md) 0 0 0;

    @include mixins.mq("lg") {
      padding: var(--space-xs) var(--space-md);
      border-radius: var(--radius-lg) 0 0 0;
    }

    &-notch {
      position: absolute;
      color: var(--color-background-400);
      --icon-color: var(--color-background-400);
      width: var(--radius-md);

      @include mixins.mq("md") {
        width: var(--radius-lg);
      }

      &-left {
        left: 0;
        bottom: 0;
        transform: translate(-100%, 0) scale(-1) rotate(90deg);
      }

      &-top {
        top: 0;
        right: 0;
        transform: translate(0, -100%) scale(-1) rotate(90deg);
      }
    }

    &-copy {
      font-size: var(--font-size-sm);
      font-weight: 700;

      @include mixins.mq("md") {
        font-size: var(--font-size-md);
      }
    }
  }

  &-image,
  &-video {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  &-focus {
    @media (max-width: 839px) {
      aspect-ratio: 4 / 5;

      .project-media-image,
      .project-media-video {
        object-position: var(--media-focus, 50%) 50%;
      }
    }
  }

  &-content {
    position: relative;
    overflow: hidden;
    border-radius: var(--radius-lg);
    background-color: var(--color-beige-500);
    width: 100%;
    height: 100%;
  }
}
</style>
