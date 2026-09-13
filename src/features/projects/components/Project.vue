<script setup lang="ts">
import { projectId, projectVisible, recentProjectId } from "../../../composables/useRouteObserver";
import { isTransitioning, projectClosing } from "../../../composables/useProjectTransition";
import { ref, watch, watchEffect } from "vue";
import { projectModules } from "../../../content/projects";
import ProjectContent from "./ProjectContent.vue";
import Footer from "../../../components/Footer.vue";
import { locale } from "../../../i18n/store";
import { lenis } from "../../../composables/useScroll";

import type { Locale } from "../../../i18n/types";

const loading = ref(true);
const content = ref(null);
const error = ref<Error | null>(null);

const fetchProject = async (project: string | undefined) => {
  try {
    const module = await projectModules[locale.value as Locale][project as string].default;
    content.value = module;
    loading.value = false;
  } catch (err) {
    error.value = new Error(`Failed to fetch project ${project}`);
  } finally {
    loading.value = false;
  }
};

watch(
  [recentProjectId, locale],
  () => {
    if (recentProjectId.value) {
      fetchProject(recentProjectId.value);
    }
  },
  { immediate: true },
);

watch(
  [projectId, isTransitioning, locale],
  () => {
    if (!projectId.value || isTransitioning.value) return;
    lenis.value?.scrollTo(0, { immediate: true });
  },
  { immediate: true },
);

/**
 * How far the page was read, kept from Lenis's own scroll events while it is
 * open. `window.scrollY` cannot be trusted at the moment of leaving: on the
 * browser's Back button the history traversal restores home's scroll offset
 * before our route watcher runs, and clamps it to this page's height.
 */
let readTo = 0;
const trackScroll = () => {
  if (projectVisible.value && lenis.value) readTo = lenis.value.scroll;
};
watchEffect((onInvalidate) => {
  const instance = lenis.value;
  if (!instance) return;
  instance.on("scroll", trackScroll);
  onInvalidate(() => instance.off("scroll", trackScroll));
});

// `pre` flush: the offset has to be on the root before the wrapper turns
// `fixed` in the same update, or the page shows its top for one frame.
watch(projectId, (id, previous) => {
  if (previous && !id) {
    document.documentElement.style.setProperty("--project-exit-scroll", `${readTo}px`);
  }
  if (id) readTo = 0;
});
</script>

<template>
  <div
    ref="projectRef"
    :class="[
      'project',
      recentProjectId !== null && `project-${recentProjectId}`,
      isTransitioning && `project-transitioning`,
      projectVisible && `project-visible`,
    ]"
  >
    <div
      :class="[
        'project-content-wrapper',
        projectVisible && `project-content-wrapper-visible`,
        projectClosing && `project-content-wrapper-closing`,
      ]"
    >
      <ProjectContent
        v-if="content && recentProjectId && (projectVisible || projectClosing)"
        :content="content"
        :projectId="recentProjectId"
      />
      <Footer :class="['project-footer', `project-${recentProjectId}`]"></Footer>
    </div>
  </div>
</template>

<style scoped lang="scss">
.project {
  min-height: calc(var(--lvh) * 100);
  background-color: var(--color-background-300);
  max-width: calc(var(--lvw) * 100);
  overflow: hidden;

  /* The sheet behind (ProjectBackground.vue) is the background while the page
     comes and goes. An opaque page here would hide it folding back into the
     card until the route timer ran out. */
  &-transitioning {
    background-color: transparent;
  }

  &-content-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    width: 100%;
    opacity: 0;
    transition: opacity 0.4s ease-out;

    &-visible {
      opacity: 1;
    }

    /* Recedes rather than cuts: a short fade with a small lift that starts on
       the first frame, overlapping the sheet folding back into the card behind
       it, so the two read as one move. */
    &-closing {
      opacity: 0;
      transform: translateY(-16px) scale(0.99);
      transform-origin: 50% 0;
      transition:
        opacity 0.18s linear,
        transform 0.4s var(--ease-out-quint);
    }
  }

  &-footer {
    position: relative;
    margin-top: auto;
    color: var(--color-text-400);
  }

  ::selection {
    background: var(--color-accent-400);
    color: var(--color-accent-text-400);
    text-shadow: none;
  }

  ::-moz-selection {
    background: var(--color-accent-400);
    color: var(--color-accent-text-400);
    text-shadow: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .project-content-wrapper-closing {
    transform: none;
  }
}
</style>
