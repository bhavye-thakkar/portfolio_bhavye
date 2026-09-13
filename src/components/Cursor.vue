<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue";
import { damp } from "../utils/math";
import gsap from "gsap";
import ArrowRightLong from "./icons/ArrowRightLong.vue";
import { path } from "../composables/useRouteObserver";
import { raycast } from "../three/utils/raycast";
import { projectId } from "../composables/useRouteObserver";
import { isTransitioning } from "../composables/useProjectTransition";

const cursorWrapperRef = ref<HTMLElement | null>(null);
const cursorScaleRef = ref<HTMLElement | null>(null);
const mouseX = ref(0);
const mouseY = ref(0);
const currentX = ref(0);
const currentY = ref(0);
const isVisible = ref(false);
const cursorType = ref<"circle-black" | "arrow" | "arrow-external" | "circle-white" | "circle-cyan" | null>(null);
const detectedType = ref<"circle-black" | "arrow" | "arrow-external" | "circle-white" | "circle-cyan" | null>(null);

/**
 * 0.22 per 60fps frame, time-corrected. The old 0.1 per FRAME trailed the
 * pointer by ~150ms at 60Hz, twice as far at 30fps and half as far on a 144Hz
 * screen, so the disc felt heavier the slower the page ran. 0.22 keeps a little
 * glide without reading as lag.
 */
const followSpeed = 0.22;
const pressed = ref(false);
let lastTransform = "";
let lastScale = -1;

const tick = () => {
  const delta = Math.min(gsap.ticker.deltaRatio(), 4);
  currentX.value = damp(currentX.value, mouseX.value, followSpeed, delta);
  currentY.value = damp(currentY.value, mouseY.value, followSpeed, delta);

  const hoveringBox = raycast.getHoveringBox();

  if (hoveringBox) {
    if (!isVisible.value) {
      isVisible.value = true;
      currentX.value = mouseX.value;
      currentY.value = mouseY.value;
    }
    cursorType.value = hoveringBox.cursor ?? "circle-black";
  } else if (detectedType.value) {
    if (!isVisible.value) {
      isVisible.value = true;
      currentX.value = mouseX.value;
      currentY.value = mouseY.value;
    }
    cursorType.value = detectedType.value;
  } else {
    isVisible.value = false;
    cursorType.value = null;
  }

  // Style writes only when something changed: this runs every frame, and an
  // unchanged transform string still costs a style recalc.
  const transform = `translate(${currentX.value.toFixed(1)}px, ${currentY.value.toFixed(1)}px)`;
  if (cursorWrapperRef.value && transform !== lastTransform) {
    cursorWrapperRef.value.style.transform = transform;
    lastTransform = transform;
  }

  // Press feedback: the disc tightens the instant the button goes down, so a
  // click reads as registered before any route transition has started.
  const scale = isVisible.value ? (pressed.value ? 0.8 : 1) : 0;
  if (cursorScaleRef.value && scale !== lastScale) {
    cursorScaleRef.value.style.transform = `scale(${scale})`;
    lastScale = scale;
  }
};

const handleDown = (e: MouseEvent) => {
  if (e.button === 0) pressed.value = true;
};

const handleUp = () => {
  pressed.value = false;
};

const checkIfHasCursorAttribute = (
  element: Element | null,
): "circle-black" | "arrow" | "arrow-external" | "circle-white" | "circle-cyan" | null => {
  if (!element) return null;
  if (element instanceof HTMLElement) {
    const cursor = element.dataset.cursor;
    if (cursor === "circle-black" ||
      cursor === "arrow" ||
      cursor === "arrow-external" ||
      cursor === "circle-white" ||
      cursor === "circle-cyan") {
      return cursor;
    }
  }
  return checkIfHasCursorAttribute(element.parentElement);
};

/**
 * ── WHAT IS UNDER A POINTER THAT HAS NOT MOVED ────────────────────────────
 *
 * The type used to be read only on mousemove, so it went stale whenever the
 * page moved under a still pointer: after clicking a project card the orange
 * arrow disc stayed on the project page until the mouse was nudged, and a wheel
 * scroll carried the previous hover state across whatever scrolled past.
 * Scroll and route changes now ask the document again, at most once a frame.
 */
let hasPointer = false;
let redetectQueued = false;
let routeTimer: ReturnType<typeof setTimeout> | null = null;

const handleMouseMove = (e: MouseEvent) => {
  hasPointer = true;
  mouseX.value = e.clientX;
  mouseY.value = e.clientY;
  detectedType.value = checkIfHasCursorAttribute(e.target as Element);
};

const redetect = () => {
  redetectQueued = false;
  if (!hasPointer || isTransitioning.value) return;
  detectedType.value = checkIfHasCursorAttribute(document.elementFromPoint(mouseX.value, mouseY.value));
};

const queueRedetect = () => {
  if (redetectQueued) return;
  redetectQueued = true;
  requestAnimationFrame(redetect);
};

/**
 * Scroll waits for the page to settle before asking again. A hit test every
 * frame of a fast wheel flick is a style recalc per frame for a cursor nobody
 * is looking at, and browsers only update :hover once scrolling stops anyway.
 */
let scrollTimer: ReturnType<typeof setTimeout> | null = null;
const handleScroll = () => {
  if (scrollTimer) clearTimeout(scrollTimer);
  scrollTimer = setTimeout(queueRedetect, 120);
};

onMounted(() => {
  // Initialize position to center of screen
  mouseX.value = window.innerWidth / 2;
  mouseY.value = window.innerHeight / 2;
  currentX.value = mouseX.value;
  currentY.value = mouseY.value;

  window.addEventListener("mousemove", handleMouseMove);
  window.addEventListener("mousedown", handleDown);
  window.addEventListener("mouseup", handleUp);
  // A press that ends outside the window, or is taken over by a drag, never
  // delivers a mouseup here and would leave the disc shrunk.
  window.addEventListener("pointercancel", handleUp);
  window.addEventListener("blur", handleUp);
  window.addEventListener("scroll", handleScroll, { passive: true });
  gsap.ticker.add(tick);
});

// A route change swaps what is under the pointer: drop the old type now, and
// look again once the incoming page has replaced the outgoing one. Asking
// mid-transition finds the card that was just clicked, still in the document
// under the opening sheet, and brings its arrow back for a frame or two.
watch(
  () => path.value,
  () => {
    isVisible.value = false;
    cursorType.value = null;
    detectedType.value = null;
    if (routeTimer) clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      if (!isTransitioning.value) queueRedetect();
    }, 60);
  },
);

watch(isTransitioning, (active) => {
  if (!active) queueRedetect();
});

onUnmounted(() => {
  window.removeEventListener("mousemove", handleMouseMove);
  window.removeEventListener("mousedown", handleDown);
  window.removeEventListener("mouseup", handleUp);
  window.removeEventListener("pointercancel", handleUp);
  window.removeEventListener("blur", handleUp);
  window.removeEventListener("scroll", handleScroll);
  if (routeTimer) clearTimeout(routeTimer);
  if (scrollTimer) clearTimeout(scrollTimer);
  gsap.ticker.remove(tick);
});
</script>

<template>
  <div ref="cursorWrapperRef" class="cursor-wrapper" :class="{ [`project-${projectId}`]: projectId !== null }">
    <div ref="cursorScaleRef" class="cursor-scale">
      <div class="cursor cursor-circle-black" :class="{ 'cursor-active': cursorType === 'circle-black' }" />
      <div class="cursor cursor-circle-white" :class="{ 'cursor-active': cursorType === 'circle-white' }" />
      <div class="cursor cursor-circle-cyan" :class="{ 'cursor-active': cursorType === 'circle-cyan' }" />
      <div class="cursor cursor-arrow" :class="{ 'cursor-active': cursorType === 'arrow' }">
        <ArrowRightLong class="cursor-arrow-icon" />
      </div>
      <div class="cursor cursor-arrow-external" :class="{ 'cursor-active': cursorType === 'arrow-external' }">
        <ArrowRightLong class="cursor-arrow-external-icon" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.cursor-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 9999;
  will-change: transform;
  display: none;

  // Hide cursor on touch devices
  @include mixins.hover {
    display: block;
  }
}

.cursor-scale {
  position: relative;
  transform-origin: center;
  will-change: transform;
  transition: transform 0.22s var(--ease-out-quint);
}

.cursor {
  position: absolute;
  top: 0;
  left: 0;
  transform: translate(-50%, -50%);
  opacity: 0;
  transition: opacity 0.1s ease-in-out;

  &-active {
    opacity: 1;
  }

  &-circle-black {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 4px solid var(--color-text-400);
  }

  &-circle-white {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 4px solid var(--color-white-400);
  }

  /* The certificate cards' cursor. They are cold glass panels on the dark
     stage, and the orange `arrow-external` disc that used to sit on them was
     the site's CTA colour landing in the middle of the hologram HUD. A ring in
     the same cyan the cards are drawn in reads as part of the scanner rather
     than as a sticker on top of it. */
  &-circle-cyan {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 4px solid var(--color-cyan-400);
    box-shadow: 0 0 10px rgba(52, 191, 255, 0.55);
  }

  &-arrow {
    width: 54px;
    height: 54px;
    transition:
      background-color 0.1s ease-in-out,
      opacity 0.1s ease-in-out;
    background-color: var(--color-accent-400, var(--color-orange-400));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    //border: var(--stroke-md) solid var(--color-white-400);

    &-icon {
      color: var(--color-accent-text-400, var(--color-white-400));
      --icon-color: var(--color-accent-text-400, var(--color-white-400));
      width: 24px;
    }
  }

  &-arrow-external {
    width: 54px;
    height: 54px;
    transition:
      background-color 0.1s ease-in-out,
      opacity 0.1s ease-in-out;
    background-color: var(--color-accent-400, var(--color-orange-400));
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    //border: var(--stroke-md) solid var(--color-white-400);

    &-icon {
      color: var(--color-accent-text-400, var(--color-white-400));
      --icon-color: var(--color-accent-text-400, var(--color-white-400));
      width: 24px;
      transform: rotate(-45deg);
    }
  }
}
</style>
