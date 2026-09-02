<script setup lang="ts">
import { watch } from "vue";
import { t } from "../../../i18n/utils/translate";
import { cv, cvEnvelopeOpen, cvPromptVisible } from "../state";
import { setEnvelopesOpen } from "../../../three/objects/envelope";

/**
 * ─── THE BAR THAT APPEARS WHILE THE ENVELOPE IS OPEN ──────────────────────
 *
 * The middle state needs an affordance or it is a dead end: the sheet is
 * standing out of the envelope on the desk and there is nothing to say the
 * visitor can read it, or put it back.
 *
 * It is a bar rather than a label projected next to the prop, because there are
 * two envelopes in two different scenes with two different cameras, and a
 * fixed bar is the same in both and the same on a phone. It is also the only
 * piece of chrome in the interaction, which is the point: the click on the prop
 * does the 3D, this does the words.
 *
 * ── AND IT OWNS THE HAND-OVER TO THE SCENE ────────────────────────────────
 *
 * This component is always mounted, so it is where the store meets the scene
 * graph: one watcher drives every envelope's opening animation off
 * `cvEnvelopeOpen`. The reader used to do that, which meant the animation only
 * ran while a modal was covering it.
 */
watch(
  cvEnvelopeOpen,
  (isOpen) => {
    setEnvelopesOpen(isOpen ? 1 : 0, isOpen ? 0.95 : 0.6);
  },
  { immediate: true },
);
</script>

<template>
  <Transition name="cv-prompt">
    <div v-if="cvPromptVisible" class="cv-prompt" data-scene-blocker>
      <p class="cv-prompt-label">{{ t("cv-in-the-envelope") }}</p>
      <div class="cv-prompt-actions">
        <button type="button" class="cv-prompt-button" data-sound="click" data-hoversound="hover" @click="cv.read()">
          {{ t("read-the-cv") }}
        </button>
        <button
          type="button"
          class="cv-prompt-button cv-prompt-button-ghost"
          data-sound="click"
          @click="cv.dismiss()"
        >
          {{ t("put-it-back") }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
/* Bottom-centre, clear of the Experience chapter card (bottom-left) and of the
   scroll counter. Fixed, so it reads the same in the hero room and in the
   office, and so a phone gets it above the thumb rather than beside it. */
.cv-prompt {
  position: fixed;
  left: 50%;
  bottom: calc(var(--space-outer) + max(calc((var(--lvh) - var(--svh)) * 100), 0px));
  transform: translateX(-50%);
  z-index: var(--z-index-header);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border: var(--stroke-sm) solid var(--color-cyan-400);
  border-radius: var(--radius-md);
  background: linear-gradient(to bottom, var(--color-hologram-top) 0%, var(--color-hologram-bottom) 100%);
  backdrop-filter: blur(6px);
  font-family: "ProFontWindows";
  color: var(--color-text-cyan-400);
  pointer-events: auto;
  max-width: calc(100% - var(--space-outer) * 2);

  @include mixins.landscape {
    flex-direction: row;
    align-items: center;
    gap: var(--space-md);
  }

  &-label {
    font-size: var(--font-size-xs);
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    text-align: center;
  }

  &-actions {
    display: flex;
    gap: var(--space-xs);
  }

  &-button {
    padding: var(--space-xxs) var(--space-sm);
    border-radius: var(--radius-sm);
    border: var(--stroke-sm) solid var(--color-cyan-400);
    background: var(--color-cyan-400);
    color: #041020;
    font-family: inherit;
    font-size: var(--font-size-sm);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background-color 0.18s ease-in-out,
      color 0.18s ease-in-out;

    &-ghost {
      background: transparent;
      color: var(--color-text-cyan-400);
    }

    @include mixins.hover {
      &:hover {
        background: var(--color-text-cyan-400);
        border-color: var(--color-text-cyan-400);
        color: #041020;
      }
    }
  }
}

.cv-prompt-enter-active,
.cv-prompt-leave-active {
  transition:
    opacity 0.28s var(--ease-smooth),
    transform 0.28s var(--ease-smooth);
}

.cv-prompt-enter-from,
.cv-prompt-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}

@media (prefers-reduced-motion: reduce) {
  .cv-prompt-enter-active,
  .cv-prompt-leave-active {
    transition-duration: 0.01s;
  }
}
</style>
