<script setup lang="ts">
import Tag from "../../../components/Tag.vue";
import Button from "../../../components/Button.vue";
import { t } from "../../../i18n/utils/translate";
import Link from "../../../components/Link.vue";
import Download from "../../../components/icons/Download.vue";
import { projectId } from "../../../composables/useRouteObserver";
import { ref, watch } from "vue";

import type { ProjectContent } from "../../../content/types";

const { content } = defineProps<{
  content: ProjectContent;
}>();

const animationKey = ref(0);

// A phone or tablet cannot run a Windows installer (owner, 2026-11-01): no
// download button and no requirements line there. iPadOS reports a Mac, so a
// "Mac" with a touch screen counts as a tablet.
const mobileOs =
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// Force animation restart when projectId changes
watch(projectId, () => {
  animationKey.value++;
});
</script>

<template>
  <div class="project-hero grid">
    <div class="project-hero-top">
      <div class="project-hero-title-wrapper">
        <h1 class="project-hero-title" :key="animationKey">
          {{ content.title }}
        </h1>
      </div>
      <div class="project-hero-tags">
        <Tag v-for="tag in content.tags" :key="tag" :variant="tag" />
      </div>
    </div>
    <p class="project-hero-description" v-html="content.description"></p>
    <div class="project-hero-buttons">
      <Link v-if="content.live" :href="content.live" external class="project-hero-button" data-cursor="arrow-external">
        <Button renderAs="div" variant="accent" class="children-unclickable" data-hoversound="hover">{{
          t("live-view")
        }}</Button>
      </Link>
      <Link v-if="content.app" :href="content.app" external class="project-hero-button" data-cursor="arrow-external">
        <Button renderAs="div" variant="border" class="children-unclickable" data-hoversound="hover">{{
          t("live-view-app")
        }}</Button>
      </Link>
      <!-- A plain anchor, not Link: `download` must not open a tab, and the
           router must not try to route to a file. -->
      <a v-if="content.apk" :href="content.apk" download class="project-hero-button" data-cursor="arrow-external">
        <Button
          renderAs="div"
          variant="border"
          class="children-unclickable project-hero-download"
          data-hoversound="hover"
        >
          <Download class="project-hero-download-icon" />
          {{ t("download-android") }}
        </Button>
      </a>
      <!-- With no website to open, the installer is the project's first action and
           takes the accent, as Live View does on a project that has one. -->
      <a v-if="content.msi && !mobileOs" :href="content.msi" download class="project-hero-button" data-cursor="arrow-external">
        <Button
          renderAs="div"
          :variant="content.live ? 'border' : 'accent'"
          class="children-unclickable project-hero-download"
          data-hoversound="hover"
        >
          <Download class="project-hero-download-icon" />
          {{ t("download-windows") }}
        </Button>
      </a>
      <Link
        v-if="content.source"
        :href="content.source"
        external
        class="project-hero-button"
        data-cursor="arrow-external"
      >
        <Button renderAs="div" variant="border" class="children-unclickable" data-hoversound="hover">{{
          t("source-code")
        }}</Button>
      </Link>
    </div>
    <p v-if="content.note && !mobileOs" class="project-hero-note">{{ content.note }}</p>
  </div>
</template>

<style scoped lang="scss">
.project-hero {
  padding: 0 var(--space-outer);
  padding-bottom: 48px;
  padding-top: calc(var(--height-header) + 24px);

  @include mixins.mq("md") {
    padding-bottom: 64px;
  }

  /* Below md the row wraps and each button grows to fill its line: a label that
     does not fit beside the others gets a full-width line of its own. Without the
     wrap, a centred row wider than a phone ran off both edges (Garba Circle's
     Live View sat at x -120 on a 390 px screen). */
  &-button {
    flex: 1 1 auto;

    @include mixins.mq("md") {
      flex: 0.5;
      width: fit-content;
    }
  }

  &-download {
    gap: var(--space-xs);

    &-icon {
      --icon-color: currentColor;
      flex: none;
      width: var(--icon-size-xs);
      height: var(--icon-size-xs);
    }
  }

  &-buttons {
    grid-row: 3;
    grid-column: 1 / 13;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    margin-top: var(--space-md);
    width: 100%;
    grid-column: 1 / 13;

    @include mixins.mq("md") {
      flex-wrap: nowrap;
      gap: var(--space-md);
      width: fit-content;
      grid-column: 1 / 6;
      grid-row: 2;
      margin-top: 0;
    }

    @include mixins.mq("lg") {
      grid-column: 2 / 6;
    }
  }

  /* Under the buttons, in their column: what the download needs, read before
     the click rather than after a failed install. */
  &-note {
    grid-row: 4;
    grid-column: 1 / 13;
    margin-top: var(--space-sm);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-copy);
    color: var(--color-text-300);
    text-align: center;
    text-wrap: pretty;

    @include mixins.mq("md") {
      grid-row: 3;
      grid-column: 1 / 6;
      text-align: left;
    }

    @include mixins.mq("lg") {
      grid-column: 2 / 6;
    }
  }

  &-video {
    grid-column: 1 / span 12;
    align-self: center;

    @include mixins.mq("md") {
      grid-column: 1 / 8;
    }

    @include mixins.mq("lg") {
      grid-column: 2 / 8;
    }
  }

  &-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-sm);
  }

  &-title {
    font-size: var(--font-size-title-lg);
    color: var(--color-text-400);
    line-height: var(--line-height-title);
    transform: translateY(0%);
    animation: project-hero-title-visible 0.5s var(--ease-smooth);

    @include mixins.mq("md") {
      font-size: var(--font-size-title-xl);
    }

    @keyframes project-hero-title-visible {
      from {
        transform: translateY(100%);
      }
      to {
        transform: translateY(0);
      }
    }

    &-wrapper {
      overflow: hidden;
    }
  }

  &-description {
    color: var(--color-text-400);
    line-height: var(--line-height-copy);
    grid-column: 1 / 13;
    align-self: center;

    @include mixins.mq("md") {
      grid-row: 1;
      grid-column: 6 / 12;
    }

    @include mixins.mq("lg") {
      grid-row: 1;
      grid-column: 7 / 12;
    }

    @include mixins.mq("xl") {
      grid-row: 1;
      grid-column: 7 / 11;
    }
  }

  &-top {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    grid-row: 1;
    align-self: top;
    grid-column: 1 / 13;

    @include mixins.mq("md") {
      grid-column: 1 / 6;
    }

    @include mixins.mq("lg") {
      grid-column: 2 / 6;
    }
  }
}
</style>
