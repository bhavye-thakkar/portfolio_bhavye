<script setup lang="ts">
import Header from "./components/Header.vue";
import { useTranslations } from "./i18n/composables/useTranslations";
import { usePreloader } from "./composables/usePreloader";
import Cursor from "./components/Cursor.vue";
import { useAgent } from "./composables/useAgent";
import { useHowler } from "./features/sounds/composables/useHowler";
import { useRouteObserver } from "./composables/useRouteObserver";
import { useHead } from "./composables/useHead";
import Home from "./features/home/components/Home.vue";
import Project from "./features/projects/components/Project.vue";
import { useProjectTransition } from "./composables/useProjectTransition";
import { useScroll } from "./composables/useScroll";
import { projectVisible, experienceId, experienceVisible } from "./composables/useRouteObserver";
import ExperienceDetail from "./features/experience/components/ExperienceDetail.vue";
import ProjectBackground from "./features/projects/components/ProjectBackground.vue";
import { useClickSound } from "./features/sounds/composables/useClickSounds";
//import { useHoverSound } from "./features/sounds/composables/useHoverSounds";

import { experienceClosing } from "./composables/useProjectTransition";

const { isTransitioning } = useProjectTransition();

useTranslations();
usePreloader();
useHowler();
useScroll();
useRouteObserver();
useHead();
useClickSound();
//useHoverSound();
const { isTouch } = useAgent();
</script>

<template>
  <Header />

  <!-- Experience story stage. Home teleports its live three canvas in here
       while the story is open, so the avatar on the story page is the same
       running scene rather than a second one. Declared before Home and always
       mounted, because a deep link needs the teleport target to already exist. -->
  <div
    id="experience-stage"
    class="experience-stage"
    :class="{ 'experience-stage-visible': experienceId !== null }"
    aria-hidden="true"
  ></div>

  <!-- main page -->
  <div :class="{ 'home-wrapper-projectIsReady': projectVisible || experienceVisible }">
    <Home />
  </div>

  <div
    class="experience-wrapper"
    :class="{
      'experience-wrapper-visible': experienceVisible,
      'experience-wrapper-closing': experienceClosing,
      'experience-wrapper-transitioning': isTransitioning,
    }"
  >
    <ExperienceDetail />
  </div>

  <!-- overlay page -->
  <ProjectBackground />
  <div
    class="project-wrapper"
    :class="{
      'project-wrapper-visible': projectVisible,
      'project-wrapper-transitioning': isTransitioning,
    }"
  >
    <div class="project-content">
      <Project />
    </div>
  </div>

  <Cursor v-if="!isTouch" />
</template>

<style lang="scss">
.home-wrapper-projectIsReady {
  visibility: hidden;
  position: fixed;
  inset: 0;
}

/* The live three canvas moves in here for the duration of the Experience story
   page. Fixed and full-bleed so it keeps the exact size the renderer already
   measured — no resize, no second context. */
.experience-stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: var(--z-index-experience-stage);
  visibility: hidden;
  pointer-events: none;

  &-visible {
    visibility: visible;
  }
}

.experience-wrapper {
  position: fixed;
  inset: 0;
  overflow: hidden;
  z-index: var(--z-index-layout-project);
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  /* Opacity only. A transform here would make this the containing block for
     the story page's own `position: fixed` scrim and pull it out of the
     viewport. The rise is animated on the inner column instead. */
  transition: opacity var(--transition-route-duration) var(--transition-route-ease);

  /* `relative`, not `static`: this has to leave `fixed` so it scrolls with the
     document, but z-index is ignored on a static element — and dropping it puts
     the whole story page underneath the fixed 3D stage, which is opaque. The
     page reads as blank while every DOM probe still says it is visible, because
     the stage is `pointer-events: none` and hit-testing skips what painting
     does not. */
  &-visible {
    visibility: visible;
    pointer-events: auto;
    position: relative;
    overflow: visible;
    opacity: 1;
  }

  /* Closing is a fade, not a cut. The wrapper is back to `fixed` by now, which
     would otherwise show the top of the story while it fades — so the content is
     held at the offset it was actually scrolled to. Transform lives on the inner
     column, never on an ancestor of the `fixed` scrim. */
  &-closing {
    visibility: visible;
    opacity: 0;

    .story-page-inner {
      transform: translateY(calc(var(--story-exit-scroll, 0px) * -1));
    }
  }
}

.project-wrapper {
  position: fixed; /* <-- key */
  inset: 0;
  overflow: hidden; /* new page must NOT scroll during transition */
  z-index: var(--z-index-layout-project);
  visibility: hidden;
  pointer-events: none; /* avoid interaction before fully opened */

  &-visible {
    visibility: visible;
    pointer-events: auto;
    position: static;
  }
}

.project-content {
  width: 100%;
  height: 100%;
  overflow: hidden; /* ensure no scroll container */
}
</style>
