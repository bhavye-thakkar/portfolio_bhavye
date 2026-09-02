<script setup lang="ts">
import { t } from "../../../i18n/utils/translate";
import { chapterNumber, isDraft } from "../../../content/experience";

import type { StoryChapter } from "../../../content/experience";

const props = defineProps<{
  chapter: StoryChapter;
  index: number;
  isActive: boolean;
}>();
</script>

<template>
  <li :class="['chapter', { 'chapter-active': props.isActive }]" :data-index="props.index">
    <p class="chapter-number" aria-hidden="true">{{ chapterNumber(props.index) }}</p>
    <div class="chapter-body">
      <h2 class="chapter-label">{{ props.chapter.label }}</h2>

      <template v-if="isDraft(props.chapter)">
        <div class="chapter-draft">
          <p class="chapter-draft-tag">{{ t("draft") }}</p>
          <p class="chapter-draft-prompt">{{ props.chapter.prompt }}</p>
        </div>
      </template>

      <template v-else>
        <p v-if="props.chapter.headline" class="chapter-headline">{{ props.chapter.headline }}</p>
        <p v-for="(paragraph, i) in props.chapter.body" :key="i" class="chapter-paragraph">
          {{ paragraph }}
        </p>
      </template>

      <p v-if="props.chapter.meta" class="chapter-meta">{{ props.chapter.meta }}</p>
    </div>
  </li>
</template>

<style scoped lang="scss">
.chapter {
  display: flex;
  gap: var(--space-md);
  align-items: flex-start;
  padding: var(--space-xxl) 0;

  @include mixins.mq("md") {
    gap: var(--space-lg);
    padding: 22vh 0;
  }

  /* The number is the only thing that reacts to the chapter becoming active -
     the copy must never depend on a class to be readable. */
  &-number {
    font-size: var(--font-size-title-sm);
    line-height: 0.8;
    font-weight: 700;
    color: var(--color-text-cyan-300);
    opacity: 0.55;
    flex: 0 0 auto;
    width: 2.6ch;
    transition:
      color 0.5s var(--ease-smooth),
      opacity 0.5s var(--ease-smooth);

    @include mixins.mq("md") {
      font-size: var(--font-size-title-md);
    }
  }

  &-active &-number {
    color: var(--color-cyan-400);
    opacity: 1;
  }

  &-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    min-width: 0;
  }

  &-label {
    font-size: var(--font-size-title-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-text-cyan-400);

    @include mixins.mq("md") {
      font-size: var(--font-size-title-sm);
    }
  }

  &-headline {
    font-size: var(--font-size-lg);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-400);
    text-wrap: balance;
    max-width: 32ch;

    @include mixins.mq("md") {
      font-size: var(--font-size-xxl);
    }
  }

  &-paragraph {
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-300);
    max-width: 62ch;
    text-wrap: pretty;
  }

  &-meta {
    font-size: var(--font-size-xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-text-cyan-300);
    padding-top: var(--space-xxs);
  }

  /* An unwritten chapter is a slot, not a blank. It says what belongs here so
     the page is honest about being half-finished instead of inventing a life. */
  &-draft {
    border: var(--stroke-sm) dashed rgba(129, 189, 216, 0.5);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-xxs);
    max-width: 46ch;

    &-tag {
      font-size: var(--font-size-xs);
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--color-cyan-400);
    }

    &-prompt {
      font-size: var(--font-size-md);
      line-height: var(--line-height-copy);
      color: var(--color-text-cyan-300);
    }
  }
}
</style>
