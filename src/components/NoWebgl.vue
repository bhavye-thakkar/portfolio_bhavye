<script setup lang="ts">
import { t } from "../i18n/utils/translate";

/**
 * ─── WHAT THE PAGE SAYS WHEN IT CANNOT DRAW ───────────────────────────────
 *
 * Mounted only when the browser refuses a WebGL context (see `webglAvailable`
 * in three/core/renderer.ts). Without it the site is a beige page with text
 * floating where a room should be, and nothing tells the visitor, or the
 * owner, that the browser is the reason: this was found on the owner's own
 * Chrome, which had switched its GPU off after two GPU-process crashes.
 *
 * A bar, not a modal: the HTML half of the site (projects, experience copy,
 * contact) still works and should stay reachable.
 *
 * ponytail: words only. A static render of the room behind the hero would
 * make this page look designed rather than explained; add when it matters.
 */
</script>

<template>
  <aside class="no-webgl" role="status">
    <p class="no-webgl-title">{{ t("no-webgl-title") }}</p>
    <p class="no-webgl-body">{{ t("no-webgl-body") }}</p>
  </aside>
</template>

<style scoped lang="scss">
/* Bottom-centre and fixed, the same seat as the CV prompt, which can never be
   up at the same time: it takes a click on the 3D scene to raise it. Below the
   preloader, so the wipe uncovers it with the rest of the page. */
.no-webgl {
  position: fixed;
  left: 50%;
  bottom: calc(var(--space-outer) + max(calc((var(--lvh) - var(--svh)) * 100), 0px));
  transform: translateX(-50%);
  z-index: var(--z-index-header);
  width: max-content;
  max-width: min(calc(100% - var(--space-outer) * 2), 60ch);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md);
  background-color: var(--color-text-400);
  color: var(--color-beige-400);
  text-align: center;
  text-wrap: balance;

  &-title {
    font-size: var(--font-size-md);
    font-weight: 700;
    line-height: var(--line-height-title);
  }

  &-body {
    margin-top: var(--space-xxs);
    font-size: var(--font-size-sm);
    line-height: var(--line-height-copy);
    opacity: 0.85;
  }
}
</style>
