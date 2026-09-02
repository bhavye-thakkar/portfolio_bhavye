<script setup lang="ts">
import Link from "./Link.vue";

/**
 * The trail into a detail page. Two jobs:
 *
 *  · A visitor who arrived on `/project/garbacircle` from a search result has
 *    no idea what the rest of the site is. "Home / Projects / Garba Circle"
 *    tells them, and both earlier steps are real links out.
 *  · It gives the page internal links back up its own hierarchy, which is the
 *    signal a crawler uses to work out that the detail pages belong to the
 *    home page rather than floating on their own.
 *
 * The matching `BreadcrumbList` structured data is emitted from
 * `composables/useHead.ts`, one source, so the markup and the schema cannot
 * disagree about where the visitor is.
 */
defineProps<{
  /** Ancestors, nearest last. The current page is passed separately. */
  trail: { label: string; to: string }[];
  current: string;
  variant?: "light" | "dark";
}>();
</script>

<template>
  <nav class="breadcrumbs" :class="`breadcrumbs-${variant ?? 'dark'}`" aria-label="Breadcrumb">
    <ol>
      <li v-for="step in trail" :key="step.to">
        <Link :to="step.to" data-cursor="circle-white" data-sound="click">{{ step.label }}</Link>
        <span class="breadcrumbs-sep" aria-hidden="true">/</span>
      </li>
      <li>
        <span aria-current="page">{{ current }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped lang="scss">
.breadcrumbs {
  font-size: var(--font-size-xs);
  letter-spacing: 0.14em;
  text-transform: uppercase;

  ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs);
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    min-width: 0;
  }

  &-sep {
    opacity: 0.5;
  }

  a {
    text-decoration: none;
    transition: opacity 0.15s ease-in-out;
    opacity: 0.75;

    @include mixins.hover {
      &:hover {
        opacity: 1;
        text-decoration: underline;
      }
    }
  }

  /* On the story page, over the 3D stage */
  &-dark {
    color: var(--color-text-cyan-300);

    [aria-current] {
      color: var(--color-text-cyan-400);
    }
  }

  /* On a project page, over the light layout */
  &-light {
    color: var(--color-text-400);
    opacity: 0.8;
  }
}
</style>
