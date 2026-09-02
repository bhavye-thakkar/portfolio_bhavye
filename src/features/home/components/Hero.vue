<script setup>
import Button from "../../../components/Button.vue";
import Banner from "../../../components/Banner.vue";
import { preloaderVisible } from "../../../composables/usePreloader";
import { t } from "../../../i18n/utils/translate";
import AppearingText from "../../../components/AppearingText.vue";
import Link from "../../../components/Link.vue";
import { roomObjects } from "../../../content/objects";
</script>

<template>
  <div class="hero">
    <div class="hero-content grid">
      <div class="hero-content-inner" id="hero-content-inner">
        <div class="hero-content-copys">
          <h1 class="hero-title">Bhavye<br />Thakkar</h1>
          <Banner
            class="hero-banner"
            :copy="t('job-title')"
            :titles="[t('job-title-ai'), t('job-title'), t('job-title-app')]"
            v-if="!preloaderVisible"
          />
        </div>
      </div>
    </div>

    <!-- ── THE 3D HOTSPOTS, FOR EVERYONE ELSE ────────────────────────────
         The orchid and the painting are clicked with a pointer against a
         WebGL canvas, which is nothing at all to a keyboard or a screen
         reader. These are the same two destinations as real links: skipped
         over silently by a mouse user, announced in the tab order, and
         drawn on screen the moment one of them takes focus. -->
    <nav class="hero-objects" :aria-label="t('in-the-room')">
      <Link
        v-for="object in roomObjects"
        :key="object.slug"
        :to="`/object/${object.slug}`"
        class="hero-objects-link"
        data-cursor="circle-black"
        data-sound="click"
        data-hoversound="hover"
        >{{ object.hotspotLabel }}</Link
      >
    </nav>
  </div>
</template>

<style scoped lang="scss">
/* Off-screen rather than `display: none` or `visibility: hidden`, both of
   which take an element out of the tab order entirely, which would leave the
   two objects reachable by mouse only. On focus it comes back on screen as a
   normal chip, so a keyboard user can see what they have landed on. */
.hero-objects {
  position: absolute;
  top: calc(var(--height-header) + var(--space-sm));
  left: var(--space-outer);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-xs);
  z-index: 1;

  &-link {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;

    &:focus-visible {
      position: relative;
      width: auto;
      height: auto;
      overflow: visible;
      clip-path: none;
      padding: var(--space-xs) var(--space-sm);
      background-color: var(--color-beige-500);
      color: var(--color-text-400);
      border: var(--stroke-md) solid var(--color-text-400);
      border-radius: var(--radius-md);
      font-size: var(--font-size-sm);
      font-weight: 700;
      outline: none;
    }
  }
}

.hero {
  max-height: calc(var(--lvh) * 100);
  height: calc(var(--lvh) * 100);
  width: 100%;
  display: flex;
  position: relative;
  overflow: hidden;

  &-content {
    align-items: center;
    justify-content: center;
    height: 46%;

    @include mixins.landscape {
      height: 100%;

      @include mixins.mq("md") {
        padding-bottom: 30%;
      }

      @include mixins.mq("lg") {
        padding-bottom: 5%;
      }
    }

    &-inner {
      transform-origin: center center;
      grid-column: 1 / 13;
      gap: var(--space-xxl);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: fit-content;
      position: relative;
      left: 50%;
      transform: translateX(-50%);

      @include mixins.landscape {
        left: 0;
        transform: translateX(0);
        grid-column: 2 / 13;
        width: fit-content;
      }
    }

    &-copys {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);

      @include mixins.mq("md") {
        gap: var(--space-md);
      }
    }

    &-button {
      width: fit-content;
    }
  }

  &-title {
    font-weight: 900;
    letter-spacing: 0.02em;
    font-size: var(--font-size-title-lg);

    @include mixins.landscape {
      font-size: var(--font-size-title-lg);
    }

    @include mixins.landscape-large {
      @include mixins.mq("sm") {
        font-size: var(--font-size-title-xl);
      }

      @include mixins.mq("xl") {
        font-size: var(--font-size-title-xxl);
      }
    }
  }

  &-banner {
    position: absolute;
    bottom: 0;
    right: -16px;
    z-index: 10;
    transform: rotate(-5deg) translate(0, 65%);

    @include mixins.mq("sm") {
      right: -24px;
      transform: rotate(-5deg) translate(0, 70%);
    }

    @include mixins.mq("lg") {
      right: -32px;
      transform: rotate(-5deg) translate(0, 80%);
    }
  }
}
</style>
