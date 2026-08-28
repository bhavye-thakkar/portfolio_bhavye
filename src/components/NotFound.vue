<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import Link from "./Link.vue";
import ArrowRight from "./icons/ArrowRight.vue";
import ArrowRightLong from "./icons/ArrowRightLong.vue";
import { t } from "../i18n/utils/translate";

/**
 * ─── 404 ──────────────────────────────────────────────────────────────────
 *
 * Same world as the x-ray figure: a cold holographic panel with a raster over
 * it, sitting on the site's deep blue rather than on a white error page.
 *
 * The pointer drives it. A scanner light follows the cursor across the panel
 * and the numerals lean a degree or two toward it, so a page that exists to
 * say "there is nothing here" still has something to look at and something
 * that responds. Both come off ONE pointermove handler writing two CSS
 * variables — no per-frame loop, no reflow: the compositor does the work
 * because only `transform` and a gradient position change.
 *
 * `pointer: fine` gates the lean. On touch there is no cursor to follow, so
 * the panel simply sits still rather than reacting to taps.
 */

const panel = ref<HTMLElement | null>(null);

const handlePointer = (event: PointerEvent) => {
  const element = panel.value;
  if (!element) return;

  const bounds = element.getBoundingClientRect();
  // 0..1 across the panel, clamped so the light parks at the edge rather than
  // flying off when the pointer leaves
  const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
  const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

  element.style.setProperty("--px", String(x));
  element.style.setProperty("--py", String(y));
};

onMounted(() => {
  window.addEventListener("pointermove", handlePointer, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", handlePointer);
});
</script>

<template>
  <main class="notfound">
    <div ref="panel" class="notfound-panel">
      <div class="notfound-scan" aria-hidden="true"></div>

      <p class="notfound-eyebrow">Error 404</p>
      <h1 class="notfound-code" aria-hidden="true">404</h1>
      <h2 class="notfound-title">Signal lost</h2>
      <p class="notfound-copy">
        There is no page at this address. It may have moved, or the link that brought you here may have been
        mistyped.
      </p>

      <nav class="notfound-links" aria-label="Go to">
        <Link to="/" class="notfound-primary" data-cursor="arrow" data-sound="click" data-hoversound="hover">
          <ArrowRight class="notfound-primary-icon" />
          <span>Back to the portfolio</span>
        </Link>

        <ul class="notfound-secondary">
          <li>
            <Link to="/#about" data-cursor="circle-white" data-sound="click">About<ArrowRightLong class="notfound-secondary-icon" /></Link>
          </li>
          <li>
            <Link to="/#experience" data-cursor="circle-white" data-sound="click">Experience<ArrowRightLong class="notfound-secondary-icon" /></Link>
          </li>
          <li>
            <Link to="/#projects" data-cursor="circle-white" data-sound="click">Projects<ArrowRightLong class="notfound-secondary-icon" /></Link>
          </li>
          <li>
            <Link to="/#contact" data-cursor="circle-white" data-sound="click">{{ t("contact") }}<ArrowRightLong class="notfound-secondary-icon" /></Link>
          </li>
        </ul>
      </nav>
    </div>
  </main>
</template>

<style scoped lang="scss">
.notfound {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-layout-project);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-outer);
  background:
    radial-gradient(circle at 50% 40%, rgba(0, 60, 130, 0.55), transparent 60%),
    var(--color-dark-blue-600, #001033);
  color: var(--color-text-cyan-400);
  font-family: "ProFontWindows";
  overflow-y: auto;

  &-panel {
    --px: 0.5;
    --py: 0.5;
    position: relative;
    isolation: isolate;
    overflow: hidden;
    width: 100%;
    max-width: 620px;
    padding: var(--space-lg) var(--space-md);
    border: var(--stroke-sm) solid var(--color-cyan-400);
    border-radius: var(--radius-lg);
    background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
    box-shadow:
      inset 0 1px 0 rgba(190, 235, 255, 0.35),
      inset 0 0 26px rgba(52, 191, 255, 0.14),
      0 0 60px rgba(0, 40, 90, 0.6);

    @include mixins.landscape {
      padding: var(--space-lg);
    }

    /* the raster, matching the certificate panels */
    &::before {
      content: "";
      position: absolute;
      inset: 0;
      z-index: -2;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        rgba(120, 220, 255, 0.07) 0px,
        rgba(120, 220, 255, 0.07) 1px,
        transparent 1px,
        transparent 3px
      );
    }
  }

  /* The scanner. Follows the pointer; on a device without one it just sits in
     the middle of the panel, which is a perfectly good still. */
  &-scan {
    position: absolute;
    inset: -30%;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(
      circle at calc(var(--px) * 100%) calc(var(--py) * 100%),
      rgba(120, 220, 255, 0.28) 0%,
      rgba(52, 191, 255, 0.1) 22%,
      transparent 46%
    );
    transition: background-position 0.2s linear;
  }

  &-eyebrow {
    font-size: var(--font-size-xs);
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
  }

  &-code {
    font-size: clamp(72px, 18vw, 148px);
    line-height: 0.9;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: rgba(190, 235, 255, 0.9);
    text-shadow: 0 0 26px rgba(52, 191, 255, 0.55);
    margin: var(--space-xs) 0 var(--space-sm);

    /* the lean — a couple of degrees toward the cursor, no more */
    @media (pointer: fine) {
      transform: perspective(700px) rotateY(calc((var(--px) - 0.5) * 10deg))
        rotateX(calc((var(--py) - 0.5) * -8deg));
      transition: transform 0.25s var(--ease-smooth, ease-out);
    }
  }

  &-title {
    font-size: var(--font-size-title-sm);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  &-copy {
    margin-top: var(--space-xs);
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    color: var(--color-text-cyan-300);
    max-width: 46ch;
  }

  &-links {
    margin-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  &-primary {
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    align-self: flex-start;
    padding: var(--space-xs) var(--space-md);
    border: var(--stroke-sm) solid var(--color-cyan-400);
    border-radius: var(--radius-md);
    background: rgba(52, 191, 255, 0.12);
    color: var(--color-text-cyan-400);
    font-size: var(--font-size-sm);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    --icon-color: var(--color-text-cyan-400);
    transition:
      background-color 0.15s ease-in-out,
      box-shadow 0.15s ease-in-out;

    &-icon {
      width: var(--icon-size-sm);
      transform: rotate(180deg);
    }

    @include mixins.hover {
      &:hover {
        background: rgba(52, 191, 255, 0.24);
        box-shadow: 0 0 18px rgba(52, 191, 255, 0.45);
      }
    }
  }

  /* Internal links out of the dead end — a 404 that only offers "home" makes
     the visitor start over; these drop them at the section they wanted. */
  &-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xs) var(--space-md);
    list-style: none;
    font-size: var(--font-size-sm);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    --icon-color: var(--color-cyan-400);

    a {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xxs);
    }

    &-icon {
      width: var(--icon-size-xs, 14px);
      transition: transform 0.15s ease-in-out;
    }

    a:hover &-icon {
      transform: translateX(3px);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .notfound-code,
  .notfound-scan {
    transition: none;
    transform: none;
  }
}
</style>
