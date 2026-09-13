<script setup lang="ts">
import gsap from "gsap";
import { computed, ref } from "vue";
import { useScrollMotion } from "../composables/useScrollMotion";

export interface Props {
  title?: string;
  items: string[];
  size?: "sm" | "md" | "lg";
  /**
   * `2` lays the items out as a two-column feature list from md up, each item
   * under a hairline rule instead of a bullet. Items can lead with a
   * `<strong>` name, which is what that layout is for.
   */
  columns?: 1 | 2;
}

const props = defineProps<Props>();

const rootRef = ref<HTMLElement | null>(null);

const classes = computed(() => {
  return ["list", `list-size-${props.size ?? "md"}`, props.columns === 2 && "list-columns"];
});

/**
 * A different entrance from the prose blocks on purpose: the items come in
 * from the left one after another, 70ms apart, the way the eye reads down a
 * list. Played once, never scrubbed.
 */
useScrollMotion(rootRef, (root) => {
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 90%", once: true } });
  const line = root.querySelector(".list-title-line");
  if (line) tl.from(line, { yPercent: 110, duration: 0.9, ease: "expo.out" }, 0);
  tl.from(root.querySelectorAll(".list-item"), { x: -18, opacity: 0, duration: 0.8, ease: "expo.out", stagger: 0.07 }, line ? 0.1 : 0);
});
</script>

<template>
  <div :class="classes" ref="rootRef">
    <h3 v-if="props.title" class="list-title">
      <span class="list-title-line">{{ props.title }}</span>
    </h3>
    <ul class="list-items">
      <li v-for="item in props.items" :key="item" class="list-item" v-html="item"></li>
    </ul>
  </div>
</template>

<style scoped lang="scss">
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 100%;
  grid-column: 1 / 13;

  &-size {
    &-sm {
      @include mixins.mq("md") {
        grid-column: 4 / 10;
      }

      @include mixins.mq("lg") {
        grid-column: 6 / 8;
      }
    }

    &-md {
      @include mixins.mq("md") {
        grid-column: 3 / 11;
      }

      @include mixins.mq("lg") {
        grid-column: 4 / 10;
      }
    }

    &-lg {
      @include mixins.mq("md") {
        grid-column: 3 / 11;
      }

      @include mixins.mq("lg") {
        grid-column: 2 / 12;
      }
    }
  }

  &-title {
    font-size: var(--font-size-title-sm);
    line-height: var(--line-height-title);
    overflow: hidden;
    padding-bottom: 0.1em;
    margin-bottom: -0.1em;

    &-line {
      display: block;
    }
  }

  &-items {
    list-style-type: disc;
    padding-left: 1.4em;
  }

  &-item {
    padding: 6px 0;
    line-height: var(--line-height-copy);
  }

  &-columns {
    .list-items {
      list-style: none;
      padding-left: 0;
      display: grid;
      grid-template-columns: 1fr;
      column-gap: var(--space-xl);

      @include mixins.mq("md") {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    .list-item {
      padding: var(--space-md) 0;
      border-top: var(--stroke-sm) solid var(--color-grayscale-500);
      color: var(--color-text-300);
      text-wrap: pretty;

      :deep(strong) {
        display: block;
        margin-bottom: var(--space-xxs);
        color: var(--color-text-400);
        font-weight: 700;
      }
    }
  }
}
</style>
