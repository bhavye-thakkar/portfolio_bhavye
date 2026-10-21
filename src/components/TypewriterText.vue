<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import gsap from "gsap";

const props = defineProps<{
  titles: string[];
  /** seconds to wait before the first character, so a container can animate in first */
  delay?: number;
}>();

const TYPE = 0.08; // per character
const ERASE = 0.05; // per character, a little quicker than typing
const HOLD = 1.5; // completed title
const GAP = 0.3; // between an erase and the next title

const display = ref("");
const animating = ref(false);

/**
 * The box is sized by the longest title, not by what is currently typed, so the
 * banner and everything around it stay put for the whole loop.
 */
// t() returns "" until the translations land, and a zero-length title would make a
// zero-duration infinite timeline
const items = computed(() => props.titles.filter(Boolean));
const longest = computed(() => items.value.reduce((a, b) => (b.length > a.length ? b : a), ""));
const spoken = computed(() => items.value.join(", "));

let timeline: gsap.core.Timeline | null = null;

const stop = () => {
  timeline?.kill();
  timeline = null;
};

watch(
  items,
  () => {
    stop();
    if (!items.value.length || typeof window === "undefined") return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animating.value = false;
      display.value = items.value[0] ?? "";
      return;
    }

    animating.value = true;
    // The first title is on screen from the first paint, not typed in: a
    // banner that starts blank stays blank for as long as the page gets no
    // animation frames (a background tab, a stalled compositor), and a blank
    // box with a cursor in it reads as broken. The loop holds it, erases it,
    // types the rest, and types it back before the loop repeats.
    const first = items.value[0] ?? "";
    display.value = first;

    const tl = gsap.timeline({ repeat: -1, delay: props.delay ?? 0 });
    let at = HOLD;

    // only touch the ref when the character count actually changes, not every frame
    const drawer = (state: { characters: number }, title: string) => () => {
      const count = Math.round(state.characters);
      if (count !== display.value.length) display.value = title.slice(0, count);
    };

    items.value.forEach((title, index) => {
      const state = { characters: index === 0 ? title.length : 0 };
      const draw = drawer(state, title);

      if (index > 0) {
        tl.to(state, { characters: title.length, duration: title.length * TYPE, ease: "none", onUpdate: draw }, at);
        at += title.length * TYPE + HOLD;
      }

      tl.to(state, { characters: 0, duration: title.length * ERASE, ease: "none", onUpdate: draw }, at);
      at += title.length * ERASE + GAP;
    });

    // back to the first title, so the repeat opens on it, held
    const back = { characters: 0 };
    tl.to(back, { characters: first.length, duration: first.length * TYPE, ease: "none", onUpdate: drawer(back, first) }, at);

    timeline = tl;
  },
  { immediate: true },
);

onBeforeUnmount(stop);
</script>

<template>
  <div class="typewriter">
    <p class="typewriter-value" aria-hidden="true">{{ display }}<i class="typewriter-caret" v-if="animating"></i></p>
    <p class="typewriter-reserve" aria-hidden="true">{{ longest }}</p>
    <span class="visually-hidden">{{ spoken }}</span>
  </div>
</template>

<style scoped>
.typewriter {
  position: relative;
}

.typewriter-value {
  position: absolute;
  white-space: pre;
}

/* reserves the width of the longest title; never rendered */
.typewriter-reserve {
  visibility: hidden;
}

.typewriter-caret {
  display: inline-block;
  width: var(--stroke-md);
  height: 0.76em;
  margin-left: 0.1em;
  vertical-align: -0.03em;
  background-color: currentColor;
  opacity: 0.5;
  animation: typewriter-caret 1.15s var(--ease-smooth) infinite;
}

@keyframes typewriter-caret {
  0%,
  46% {
    opacity: 0.5;
  }
  62%,
  78% {
    opacity: 0.06;
  }
  100% {
    opacity: 0.5;
  }
}

@media (prefers-reduced-motion: reduce) {
  .typewriter-caret {
    animation: none;
    display: none;
  }
}
</style>
