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
import { projectVisible, experienceId, experienceVisible, objectId, objectVisible, notFound } from "./composables/useRouteObserver";
import ObjectDetail from "./features/objects/components/ObjectDetail.vue";
import NotFound from "./components/NotFound.vue";
import ExperienceDetail from "./features/experience/components/ExperienceDetail.vue";
import CvPanel from "./features/cv/components/CvPanel.vue";
import CvPrompt from "./features/cv/components/CvPrompt.vue";
import { cvReading } from "./features/cv/state";
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
  <!-- The object panels get NO site header. They are a label beside an exhibit,
       not a page: the "get in touch" call to action, the sound toggle and a
       second back button on top of the panel's own were three pieces of site
       chrome competing with the one thing the visitor opened. The panel carries
       its own back link, Escape closes it, and so does the browser's own Back. -->
  <Header v-if="objectId === null" />

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

  <!-- Object panel. Not an "overlay page" like the two below: home stays live
       and un-fixed underneath it, and the 3D camera pushes in on the object
       being read about. -->
  <!--
    `data-lenis-prevent` is load-bearing, not decoration. Lenis takes wheel and
    touch events off `window` and calls preventDefault on them, including
    while it is stopped, so the panel's own `overflow-y: auto` never saw a
    single one and the content below the fold was unreachable. This attribute
    is Lenis's documented opt-out for a nested scroller: the event is left
    alone entirely for anything inside this element.
  -->
  <!--
    `data-scene-blocker` is STATIC, not bound to `objectVisible`.

    Bound, it was removed in the same microtask flush the closing click
    triggers, element handlers run first, Vue patches the DOM at the
    checkpoint between listeners, and by the time the scene's window-level
    click handler ran the back link was no longer inside a blocker. The click
    that closed the panel then raycast into the room behind it: from the
    painting's close-up the orchid's box projects over the top-left, so
    "back" landed on /object/orchid.

    The wrapper is `pointer-events: none` while hidden, so nothing can land
    inside it anyway, the attribute costs nothing when the panel is closed.
  -->
  <div
    class="object-wrapper"
    :class="{ 'object-wrapper-visible': objectVisible }"
    data-scene-blocker
    data-lenis-prevent
  >
    <ObjectDetail />
  </div>

  <!-- The CV that comes out of the desk envelope. Same shape as the object
       panel above and for the same reason: home stays live and un-fixed
       underneath, so there is no scroll to save and nothing to rebuild.

       `data-scene-blocker` and `data-lenis-prevent` are load-bearing for the
       same two reasons documented on the object wrapper, the first stops the
       pointer hovering and clicking the envelope straight through the sheet,
       the second is Lenis's opt-out so this panel's own scroller actually
       receives a wheel event. Both are STATIC: bound, they would be removed in
       the same microtask flush as the closing click.

       No `<Header>` in here. The one at the top of this file is the only
       navbar the site has, and it stays exactly where it is. -->
  <div
    class="cv-wrapper"
    :class="{ 'cv-wrapper-visible': cvReading }"
    data-scene-blocker
    data-lenis-prevent
  >
    <CvPanel v-if="cvReading" />
  </div>

  <!-- The bar that appears while the envelope is open in the scene. Always
       mounted: it is also where the CV store is wired to the scene graph. -->
  <CvPrompt />

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

  <!-- Unknown URL: a real dead end rather than the home page served at the
       wrong address, which search engines read as a soft 404. -->
  <NotFound v-if="notFound" />

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
   measured, no resize, no second context. */
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
     document, but z-index is ignored on a static element, and dropping it puts
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
     would otherwise show the top of the story while it fades, so the content is
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

/* The object panel's shell. `fixed` with its own scroll, never `static` and
   never in flow: home keeps the document scroll the whole time it is open, so
   there is nothing to save and nothing to restore when it closes.

   `visibility` rather than `display` so the fade actually runs, and
   `overflow-y: auto` so long copy scrolls inside the panel instead of moving
   the page, and therefore the camera, behind it. */
.object-wrapper {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  z-index: var(--z-index-layout-project);
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity var(--transition-route-duration) var(--transition-route-ease),
    visibility 0s linear var(--transition-route-duration);

  .object-panel-inner {
    transform: translateY(24px);
    transition: transform 0.7s var(--transition-route-ease);
  }

  &-visible {
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
    transition:
      opacity var(--transition-route-duration) var(--transition-route-ease),
      visibility 0s;

    .object-panel-inner {
      transform: translateY(0);
    }
  }
}

/* The CV sheet. Its own scroller, the CV is longer than a viewport on every
   size, and the page behind it must not move while it is being read. */
.cv-wrapper {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 0 var(--space-outer);
  z-index: var(--z-index-cv);
  visibility: hidden;
  pointer-events: none;
  opacity: 0;
  transition:
    opacity var(--transition-route-duration) var(--transition-route-ease),
    visibility 0s linear var(--transition-route-duration);

  .cv-sheet {
    transform: translateY(28px);
    transition: transform 0.7s var(--transition-route-ease);
  }

  &-visible {
    visibility: visible;
    pointer-events: auto;
    opacity: 1;
    transition:
      opacity var(--transition-route-duration) var(--transition-route-ease),
      visibility 0s;

    .cv-sheet {
      transform: translateY(0);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .object-wrapper,
  .object-wrapper .object-panel-inner,
  .cv-wrapper,
  .cv-wrapper .cv-sheet {
    transition-duration: 0.01s;
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
