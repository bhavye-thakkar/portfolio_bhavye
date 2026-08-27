<script setup lang="ts">
import { onMounted, ref, watchEffect } from "vue";
import { lenis } from "../composables/useScroll";
import gsap from "gsap";
import SwipeUp from "./icons/SwipeUp.vue";
import { projectId } from "../composables/useRouteObserver";

const hasScrolled = ref(false);
const isTouchDevice = ref(false);

onMounted(() => {
  isTouchDevice.value =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
});

const tick = () => {
  if (projectId.value !== null) return;
  if (lenis.value?.isScrolling) {
    hasScrolled.value = true;
  }
};

watchEffect((onInvalidate) => {
  if (hasScrolled.value) return;
  gsap.ticker.add(tick);

  onInvalidate(() => {
    gsap.ticker.remove(tick);
  });
});
</script>

<template>
  <!-- Touch only: the desktop mouse/scroll indicator was removed, the walk-away
       goodbye carries the ending there instead. -->
  <Transition name="scroll-icon">
    <div v-if="!hasScrolled && isTouchDevice" class="scroll-icon">
      <SwipeUp class="scroll-icon-swipe-up" />
    </div>
  </Transition>
</template>

<style scoped lang="scss">
.scroll-icon-enter-active,
.scroll-icon-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.scroll-icon-enter-from,
.scroll-icon-leave-to {
  opacity: 0;
}

.scroll-icon {
  position: absolute;
  top: 0;
  left: 0;
  height: calc(var(--svh) * 100);
  width: 100%;
  display: flex;
  align-items: flex-end;
  padding-bottom: var(--space-outer);
  justify-content: center;
  z-index: var(--z-index-header);
  pointer-events: none;

  * {
    pointer-events: none;
  }

  &-swipe-up {
    width: calc(var(--icon-size-md) + 4px);
    --stroke-width: var(--stroke-md);
    fill: var(--color-beige-400);

    //animation up and down ease-in-out
    animation: swipeUp 1s infinite;
    animation-direction: alternate;
    animation-timing-function: var(--ease-power2-out);

    @keyframes swipeUp {
      0% {
        transform: translateY(0);
      }
      100% {
        transform: translateY(-10px);
      }
    }
  }
}
</style>
