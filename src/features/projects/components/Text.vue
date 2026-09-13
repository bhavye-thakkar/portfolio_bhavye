<script setup lang="ts">
import gsap from "gsap";
import { computed, ref } from "vue";
import { useScrollMotion } from "../composables/useScrollMotion";

export interface Props {
  title?: string;
  text?: string;
}

const props = defineProps<Props>();

const rootRef = ref<HTMLElement | null>(null);

const classes = computed(() => {
  return {
    text: true,
    "text-with-title": !!props.title,
  };
});

/**
 * The heading rises out of its own line box, the copy follows a beat later.
 * Played once on arrival rather than scrubbed: a paragraph should never be
 * half transparent while somebody is reading it. The start sits low on the
 * screen (92%) so even the last block on the page is guaranteed to cross it.
 */
useScrollMotion(rootRef, (root) => {
  const line = root.querySelector(".text-title-line");
  const copy = line ? root.querySelector(".text-content") : root;
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 92%", once: true } });
  if (line) tl.from(line, { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0);
  if (copy) tl.from(copy, { y: 18, opacity: 0, duration: 0.9, ease: "expo.out" }, line ? 0.12 : 0);
});
</script>

<template>
  <div :class="classes" v-if="props.title" ref="rootRef">
    <h3 class="text-title">
      <span class="text-title-line">{{ props.title }}</span>
    </h3>
    <p class="text-content" v-html="props.text"></p>
  </div>
  <p v-else class="text" v-html="props.text" ref="rootRef"></p>
</template>

<style scoped lang="scss">
.text {
  line-height: var(--line-height-copy);
  grid-column: 1 / 13;

  @include mixins.mq("md") {
    grid-column: 3 / 11;
  }

  @include mixins.mq("lg") {
    grid-column: 4 / 10;
  }

  &-with-title {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }

  &-title {
    font-size: var(--font-size-title-sm);
    line-height: var(--line-height-title);
    text-wrap: balance;
    /* The mask the line rises out of. The padding keeps descenders inside it. */
    overflow: hidden;
    padding-bottom: 0.1em;
    margin-bottom: -0.1em;

    &-line {
      display: block;
    }
  }

  &-content {
    text-wrap: pretty;
    max-width: 68ch;

    :deep(p + p) {
      margin-top: var(--space-sm);
    }
  }
}
</style>
