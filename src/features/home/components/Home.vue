<script setup lang="ts">
import Layout from "../../../components/Layout.vue";
import Hero from "./Hero.vue";
import About from "./About.vue";
import Experience from "./Experience.vue";
import Projects from "./Projects.vue";
import Contact from "./Contact.vue";
import Footer from "../../../components/Footer.vue";
import { ref, onMounted, onUnmounted, watchEffect, computed, watch } from "vue";
import { three } from "../../../three";
import { animations } from "../../../animations";
import HeaderHome from "../../../components/HeaderHome.vue";
import { preloaderVisible } from "../../../composables/usePreloader";
import ScrollIcon from "../../../components/ScrollIcon.vue";
import { raycast } from "../../../three/utils/raycast";
import gsap from "gsap";
import { useAgent } from "../../../composables/useAgent";
import { experienceId, objectVisible, overlayId, projectVisible } from "../../../composables/useRouteObserver";
import { isTransitioning } from "../../../composables/useProjectTransition";
import { renderer } from "../../../three/core/renderer";
import { experiences } from "../../../content/experience";
import { sectionHeightVh } from "../../../animations/transitions/experience";
import { aboutHeightVh } from "../../../animations/transitions/about";

const introRef = ref<HTMLElement | null>(null);
const stickyObserver = ref<IntersectionObserver | null>(null);
const scrolledPastIntro = ref(false);
const projectsLoaded = ref(false);
const contactRef = ref<HTMLElement | null>(null);
const contactBottom = ref<number>(0);
const aboutSpacerRef = ref<HTMLElement | null>(null);
const experienceSpacerRef = ref<HTMLElement | null>(null);
const isHoveringObject3D = ref<boolean>(false);
const threeCanvasRef = ref<HTMLCanvasElement | null>(null);
const threeInitialized = ref<boolean>(false);
const { isTouch } = useAgent();

const handleIntersection = (entries: IntersectionObserverEntry[]) => {
  scrolledPastIntro.value = entries[0]?.isIntersecting ?? false;
};

const isStickyVisible = computed(() => {
  return scrolledPastIntro.value || !projectsLoaded.value;
});

const updateContactBottomOffset = () => {
  if (!contactRef.value) return;
  const bounding = contactRef.value.getBoundingClientRect();
  const documentBottom = document.documentElement.scrollHeight;
  const elementBottom = bounding.bottom + window.scrollY;
  // distance from bottom of document to bottom of contact section
  contactBottom.value = documentBottom - elementBottom;
};

watch([projectVisible, isTransitioning], () => {
  if (!projectVisible.value) {
    updateContactBottomOffset();
  }
});

watchEffect((onInvalidate) => {
  if (!contactRef.value || preloaderVisible.value) return;

  const resizeObserver = new ResizeObserver(updateContactBottomOffset);
  resizeObserver.observe(contactRef.value as HTMLElement);

  //const intersectionObserver = new IntersectionObserver(updateContactBottomOffset);
  //intersectionObserver.observe(contactRef.value as HTMLElement);

  onInvalidate(() => {
    resizeObserver.disconnect();
    //intersectionObserver.disconnect();
  });
});

const updateCursor = () => {
  if (isTouch.value) return;
  const hoveringBox = raycast.getHoveringBox();
  const shouldBePointer = !!hoveringBox;

  if (shouldBePointer !== isHoveringObject3D.value) {
    isHoveringObject3D.value = shouldBePointer;
    document.documentElement.style.cursor = shouldBePointer ? "pointer" : "";
  }
};

onMounted(() => {
  stickyObserver.value = new IntersectionObserver(handleIntersection);
  stickyObserver.value.observe(introRef.value as HTMLElement);

  if (threeCanvasRef.value && !threeInitialized.value) {
    three.init(threeCanvasRef.value);
    threeInitialized.value = true;
  }

  gsap.ticker.add(updateCursor);
});

onUnmounted(() => {
  stickyObserver.value?.disconnect();
  stickyObserver.value = null;

  three.destroy();

  document.documentElement.style.cursor = "";

  gsap.ticker.remove(updateCursor);
  animations.destroy();
});

const handleProjectsLoaded = () => {
  projectsLoaded.value = true;
};

watchEffect((onInvalidate) => {
  if (
    projectsLoaded &&
    threeInitialized &&
    //(projectId.value === null || isTransitioning.value) &&
    !preloaderVisible.value
  ) {
    animations.init();
  }

  onInvalidate(() => {
    animations.destroy();
  });
});

watch(
  projectVisible,
  (newVal) => {
    renderer.setIsActive(!newVal);
  },
  { immediate: true },
);

/**
 * The route transitions scale this wrapper, and its default origin is its own
 * centre, which on a ~19,000px page is nowhere near the screen: at the Projects
 * grid a 3% scale around y≈9,700 is a 240px vertical shove, so the grid slid
 * upwards under the opening sheet and the card was not where the closing
 * sheet folded back to. Pin the origin to the middle of the viewport instead.
 *
 * In a frame callback, not straight away: on the way out the overlay restores
 * the home scroll offset in its own post-flush watcher, and the origin has to
 * be measured after that, yet before the first animated frame is painted.
 */
const wrapperRef = ref<HTMLElement | null>(null);
watch(isTransitioning, (active) => {
  if (!active) return;
  requestAnimationFrame(() => {
    if (wrapperRef.value) {
      wrapperRef.value.style.transformOrigin = `50% ${Math.round(window.scrollY + window.innerHeight / 2)}px`;
    }
  });
});
</script>

<template>
  <div
    ref="wrapperRef"
    :class="[
      'home-wrapper',
      objectVisible && 'home-wrapper-inspecting',
      typeof overlayId === 'string' && isTransitioning && `home-wrapper-out`,
      typeof overlayId !== 'string' && isTransitioning && `home-wrapper-in`,
    ]"
  >
    <ScrollIcon />
    <Layout>
      <!-- The page had no `main` landmark at all: a screen reader's "skip to
           the content" had nothing to skip to, and the only <main> on the site
           was the one inside the noscript fallback. It wraps everything except
           the footer, and carries `.layout`'s own flex rules so it changes no
           geometry, the scroll offsets every ScrollTrigger is measured
           against have to stay exactly where they were. -->
      <main class="home-main">
      <div class="intro-wrapper" ref="introRef">
        <div
          class="intro-sticky"
          :class="{ 'intro-sticky-visible': isStickyVisible }"
          :style="{ '--contact-bottom': `${contactBottom}px` }"
        >
          <!-- The Experience story page borrows this exact element rather than
               spinning up a second renderer, a teleport moves the node, and a
               moved canvas keeps its WebGL context and its ResizeObserver. -->
          <Teleport to="#experience-stage" :disabled="experienceId === null">
            <canvas
              :class="['three-canvas', { 'three-canvas-contact': !isStickyVisible && experienceId === null }]"
              ref="threeCanvasRef"
            ></canvas>
          </Teleport>
          <div :class="{ 'intro-about-hidden': !isStickyVisible }">
            <About :spacer-ref="aboutSpacerRef" />
            <Experience :spacer-ref="experienceSpacerRef" />
          </div>
        </div>
        <Hero class="intro-hero" id="hero" />
        <div class="intro-wrapper-spacer"></div>
        <div
          class="about-spacer"
          ref="aboutSpacerRef"
          id="about"
          :style="{ '--span': aboutHeightVh(), '--span-landscape': aboutHeightVh(true) }"
        ></div>
        <div
          class="experience-spacer"
          ref="experienceSpacerRef"
          id="experience"
          :style="{
            '--span': sectionHeightVh(experiences.length),
            '--span-landscape': sectionHeightVh(experiences.length, true),
          }"
        ></div>
      </div>
      <Projects id="projects" @loaded="handleProjectsLoaded" />
      <div ref="contactRef" class="home-contact">
        <Contact id="contact" v-if="projectsLoaded" />
      </div>
      </main>
      <Footer :withSocial="false"></Footer>
    </Layout>
  </div>
  <HeaderHome v-if="projectsLoaded" />
</template>

<style scoped lang="scss">
/* `display: contents`, so this landmark generates NO box: the children lay
   themselves out in `.layout` exactly as they did before it existed.

   That is not a tidiness preference, it is the fix. `.intro-sticky` sits at
   `z-index: -1`, which puts every ancestor's own content layer ABOVE the HUD
   panels inside it, which is why `.intro-wrapper` already has
   `pointer-events: none`. A wrapper with a box re-created that exact bug one
   level higher: hit-testing at a certificate card returned `main`, and the
   card stopped being hoverable or clickable. A box that does not exist cannot
   swallow a pointer event. */
.home-main {
  display: contents;
}

.three-canvas {
  width: calc(var(--svw) * 100);
  height: calc(var(--lvh) * 100);
  max-height: calc(var(--lvh) * 100);
  position: relative;
  overflow: hidden;

  &-contact {
    position: absolute;
    bottom: var(--contact-bottom);
    left: 0;
    width: 100%;
    height: calc(var(--lvh) * 100);
    max-height: calc(var(--lvh) * 100);
  }
}

.home {
  &-wrapper {
    transform-origin: center center;

    /* An object panel keeps home alive underneath it, that is the point, the
       camera is pushing in on the real scene. But the page's own furniture is
       not part of that shot: at the scrim's 0.96 the black display heading
       still read through as a ghost across the copy. The canvas stays, the
       chrome steps out of the way. */
    &-inspecting {
      :deep(.intro-hero),
      :deep(.scroll-icon) {
        opacity: 0;
        pointer-events: none;
      }
    }

    :deep(.intro-hero),
    :deep(.scroll-icon) {
      transition: opacity var(--transition-route-duration) var(--transition-route-ease);
    }

    /* Ease-OUT, not the route's slow-start curve: the page steps back on the
       frames right after the click, which is what makes the click feel
       answered. 0.97 rather than 0.95, the sheet opening over it carries the
       move; the page only has to give way. */
    &-out {
      animation: home-wrapper-out var(--transition-route-duration) var(--ease-out-quint) both;
    }

    &-in {
      animation: home-wrapper-in 0.7s var(--ease-out-quint);
    }

    @keyframes home-wrapper-out {
      0% {
        transform: scale(1);
      }
      100% {
        transform: scale(0.97);
      }
    }

    @keyframes home-wrapper-in {
      0% {
        transform: scale(0.97);
      }
      100% {
        transform: scale(1);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      &-out,
      &-in {
        animation: none;
      }
    }
  }

  &-contact {
    width: 100%;
    min-height: calc(var(--lvh) * 100);
    max-height: calc(var(--lvh) * 100);
  }
}

/* Same pattern as the Experience spacer below: `aboutHeightVh` for both
   orientations, switched by the timelines' own landscape query. */
.about-spacer {
  max-height: calc(var(--lvh) * var(--span));
  min-height: calc(var(--lvh) * var(--span));

  @media (min-aspect-ratio: 1) {
    max-height: calc(var(--lvh) * var(--span-landscape));
    min-height: calc(var(--lvh) * var(--span-landscape));
  }
}

/* Height comes from `sectionHeightVh` so the spacer and the timeline are built
   from one set of numbers, adding a company to content/experience.ts lengthens
   the section rather than squeezing the existing chapters. */
.experience-spacer {
  max-height: calc(var(--lvh) * var(--span));
  min-height: calc(var(--lvh) * var(--span));

  /* The timeline's own query (utils/matchMedia), not the orientation mixin:
     the two disagree at exactly square, and one frame of disagreement is a
     close whose fractions do not fit its spacer. */
  @media (min-aspect-ratio: 1) {
    max-height: calc(var(--lvh) * var(--span-landscape));
    min-height: calc(var(--lvh) * var(--span-landscape));
  }
}

.intro-wrapper {
  width: 100%;
  display: flex;
  flex-direction: column;
  /* .intro-sticky sits at z-index:-1, so this wrapper and its in-flow spacers
     paint on top of the stage and swallowed every pointer event aimed at the
     HUD panels inside it (skills scroll, certificate links). The stage and the
     hero opt back in; the spacers stay inert. */
  pointer-events: none;

  &-spacer {
    display: none;

    @include mixins.mq("md") {
      display: block;
      height: 200px;
    }
  }
}

.intro-hero {
  pointer-events: auto;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  max-height: calc(var(--lvh) * 100);
  min-height: calc(var(--lvh) * 100);
  overflow: hidden;
}

.intro-about-hidden {
  visibility: hidden;
}

.intro-sticky {
  pointer-events: auto;
  top: 0;
  left: 0;
  width: 100%;
  max-height: calc(var(--lvh) * 100);
  min-height: calc(var(--lvh) * 100);
  overflow: hidden;
  z-index: -1;
  display: flex;
  align-items: flex-end;

  &-visible {
    position: sticky;
  }
}

.intro-sticky-content {
  width: calc(var(--svw) * 100);
  height: calc(var(--lvh) * 100);
  max-height: calc(var(--lvh) * 100);
  position: relative;
  overflow: hidden;

  &-contact {
    position: absolute;
    bottom: var(--contact-bottom);
    left: 0;
    width: 100%;
    height: calc(var(--lvh) * 100);
    max-height: calc(var(--lvh) * 100);
  }
}
</style>
