<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { transitions } from "../../../animations";
import { storyActive } from "../../../animations/story";
import BoxDescription from "./BoxDescription.vue";
import BoxServices from "./BoxServices.vue";
import BoxCertificates from "./BoxCertificates.vue";
import BoxDetails from "./BoxDetails.vue";
import ProgressCount from "./ProgressCount.vue";

const contentDescriptionRef = ref<HTMLDivElement | null>(null);
const contentServicesRef = ref<HTMLDivElement | null>(null);
const contentCertificatesRef = ref<HTMLDivElement | null>(null);
const contentDetailsRef = ref<HTMLDivElement | null>(null);
const contentProgressCountRef = ref<HTMLDivElement | null>(null);
const tlDescriptionRef = ref<gsap.core.Timeline | null>(null);
const tlServicesRef = ref<gsap.core.Timeline | null>(null);
const tlCertificatesRef = ref<gsap.core.Timeline | null>(null);
const tlDetailsRef = ref<gsap.core.Timeline | null>(null);

const props = defineProps<{
  spacerRef: HTMLElement | null;
}>();

watchEffect((onInvalidate) => {
  // The Experience story page puts this wrapper in `position: fixed` and takes
  // the document scroll, which turns every start/end here into a lie. Drop the
  // timelines while it runs; this rebuilds them when it closes.
  if (
    !storyActive.value &&
    props.spacerRef &&
    tlDescriptionRef.value &&
    contentDescriptionRef.value &&
    tlServicesRef.value &&
    contentServicesRef.value &&
    tlCertificatesRef.value &&
    contentCertificatesRef.value &&
    contentDetailsRef.value &&
    tlDetailsRef.value &&
    contentProgressCountRef.value
  ) {
    transitions.about.setup({
      about: props.spacerRef,
      contentDescription: contentDescriptionRef.value,
      tlDescription: tlDescriptionRef.value,
      contentServices: contentServicesRef.value,
      tlServices: tlServicesRef.value,
      contentCertificates: contentCertificatesRef.value,
      tlCertificates: tlCertificatesRef.value,
      contentDetails: contentDetailsRef.value,
      tlDetails: tlDetailsRef.value,
      contentProgressCount: contentProgressCountRef.value,
    });
  }

  onInvalidate(() => {
    transitions.about.destroy();
  });
});
</script>

<template>
  <div class="about-content">
    <div ref="contentDetailsRef" class="about-details">
      <BoxDetails @timeline:created="(tl: gsap.core.Timeline) => (tlDetailsRef = tl)" />
    </div>
    <div ref="contentDescriptionRef" class="about-description">
      <BoxDescription @timeline:created="(tl: gsap.core.Timeline) => (tlDescriptionRef = tl)" />
    </div>
    <div ref="contentServicesRef" class="about-services">
      <BoxServices @timeline:created="(tl: gsap.core.Timeline) => (tlServicesRef = tl)" />
    </div>
    <div ref="contentCertificatesRef" class="about-certificates">
      <BoxCertificates @timeline:created="(tl: gsap.core.Timeline) => (tlCertificatesRef = tl)" />
    </div>
    <div ref="contentProgressCountRef" class="about-progress-count">
      <ProgressCount />
    </div>
  </div>
</template>

<style scoped lang="scss">
.about {
  &-content {
    position: absolute;
    color: var(--color-text-cyan-400);
    font-family: "ProFontWindows";
    top: 0;
    width: 100%;
    padding: var(--space-outer);
    left: 50%;
    transform: translateX(-50%);
    height: calc(var(--lvh) * 100);

    --count-height: calc(max(calc((var(--lvh) - var(--svh)) * 100), 36px) + var(--space-outer));
  }

  &-details,
  &-description,
  &-services,
  &-certificates {
    display: flex;
    justify-content: center;
    align-items: center;
    will-change: transform, opacity;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;

    @include mixins.landscape {
      width: 100%;
      height: 0;
      top: 50%;
    }
  }

  &-certificates {
    /* autoAlpha in transitions/about.ts flips this back — hidden keeps the
       certificate links out of the tab order until the layer is on stage */
    opacity: 0;
    visibility: hidden;
  }

  &-progress-count {
    will-change: transform, opacity;
    position: absolute;
    bottom: 0;
    left: var(--space-outer);
    width: calc(100% - var(--space-outer) * 2);
  }
}
</style>
