<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { t } from "../../../i18n/utils/translate";
import { cv, cvReading } from "../state";
import { lenis } from "../../../composables/useScroll";
import { cvFile, cvHeader, cvSections } from "../../../content/cv";
import Plus from "../../../components/icons/Plus.vue";

/**
 * ─── THE CV SHEET ─────────────────────────────────────────────────────────
 *
 * What comes out of the envelope. It is a transcription of the owner's own
 * PDF, same sections, same order, same two-column shape, same words, so a
 * visitor who reads it here and a visitor who downloads the file get the same
 * document. `content/cv.ts` is the only source; nothing on this page is
 * written for it.
 *
 * ── IT IS BUILT LIKE `ObjectDetail`, NOT LIKE A PAGE ──────────────────────
 *
 * A layer over a home page that stays live underneath: nothing is replaced, so
 * nothing has to be rebuilt, and closing is a flag. Four things have to be
 * handled, split between this file and `App.vue`:
 *
 *   · Lenis is stopped, so a wheel over the sheet cannot scroll the section
 *     behind it and drag the X-ray timeline while the CV is up. The wrapper
 *     also carries `data-lenis-prevent`, because stopping Lenis is not enough
 *     - it still swallows wheel events, and without the attribute this panel's
 *     own `overflow-y: auto` would never receive one and everything below the
 *     fold would be unreachable.
 *   · `data-scene-blocker`, or the pointer keeps hovering and clicking scene
 *     objects straight through the sheet, including the envelope that opened
 *     it.
 *   · Focus moves here on open and Escape closes it, because it is modal.
 *   · NO second header. `App.vue` mounts exactly one `<Header>`; this covers it
 *     (see `--z-index-cv`) rather than adding another.
 */

const panelRef = ref<HTMLElement | null>(null);

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  cv.close();
};

watch(
  cvReading,
  async (isReading) => {
    if (isReading) {
      lenis.value?.stop();
      window.addEventListener("keydown", handleKeydown);
      await nextTick();
      panelRef.value?.focus({ preventScroll: true });
      return;
    }

    window.removeEventListener("keydown", handleKeydown);
    lenis.value?.start();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
  lenis.value?.start();
});
</script>

<template>
  <article ref="panelRef" class="cv-panel" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="cv-title">
    <div class="cv-scrim" aria-hidden="true"></div>

    <div class="cv-sheet">
      <button type="button" class="cv-close" :aria-label="t('close-cv')" data-sound="click" @click="cv.close()">
        <Plus class="cv-close-icon" />
      </button>

      <header class="cv-masthead">
        <h1 id="cv-title" class="cv-name">{{ cvHeader.name }}</h1>
        <p class="cv-role">{{ cvHeader.role }}</p>
      </header>

      <!-- Contact is a labelled row of its own in the PDF, above the first
           rule, so it is one here too rather than being folded into the
           masthead. -->
      <section class="cv-row">
        <p class="cv-row-label">{{ t("cv-contact") }}</p>
        <!-- Two columns, grouped rather than flowed: the PDF stacks Email
             above Portfolio on the left and puts Address on its own on the
             right. Flowing six cells into a 2 x 3 grid instead put Address
             beside Email and left the URL in a half-width cell, where it broke
             mid-domain. -->
        <div class="cv-row-body cv-contact">
          <div>
            <p>
              <strong>{{ t("cv-email") }}</strong>
              <a :href="`mailto:${cvHeader.email}`">{{ cvHeader.email }}</a>
            </p>
            <p>
              <strong>{{ t("cv-portfolio") }}</strong>
              <a :href="cvHeader.portfolio" target="_blank" rel="noopener noreferrer">{{ cvHeader.portfolio }}</a>
            </p>
          </div>
          <div>
            <p>
              <strong>{{ t("cv-address") }}</strong>
              <span>{{ cvHeader.address }}</span>
            </p>
          </div>
        </div>
      </section>

      <section v-for="section in cvSections" :key="section.label" class="cv-row">
        <p class="cv-row-label">{{ section.label }}</p>
        <div class="cv-row-body" :class="{ 'cv-row-body-two-up': section.columns === 2 }">
          <div v-for="entry in section.entries" :key="entry.title" class="cv-entry">
            <p class="cv-entry-title">{{ entry.title }}</p>
            <p v-if="entry.subtitle" class="cv-entry-sub">{{ entry.subtitle }}</p>
            <p v-if="entry.note" class="cv-entry-note">{{ entry.note }}</p>
            <ul v-if="entry.bullets?.length" class="cv-bullets">
              <li v-for="bullet in entry.bullets" :key="bullet">{{ bullet }}</li>
            </ul>
          </div>
        </div>
      </section>

      <footer class="cv-end">
        <!-- Straight at the PDF this page was transcribed from, so the reader
             and the download can never be two different documents. -->
        <a
          class="cv-action"
          :href="cvFile"
          target="_blank"
          rel="noopener noreferrer"
          data-sound="click"
          data-hoversound="hover"
        >
          {{ t("open-full-cv") }}
        </a>
        <!-- Back to the DESK, not to nothing: closing the reader leaves the
             sheet standing in the envelope where the visitor left it. -->
        <button type="button" class="cv-action cv-action-ghost" data-sound="click" @click="cv.close()">
          {{ t("back-to-the-desk") }}
        </button>
      </footer>
    </div>
  </article>
</template>

<style scoped lang="scss">
.cv-panel {
  position: relative;
  min-height: 100%;
  width: 100%;
  outline: none;
  font-family: "ProFontWindows";
}

/* Ink rather than blue: the section behind this is already deep blue, and a
   blue wash over a blue stage reads as the contrast dropping rather than as
   the lights going down.

   Nearly opaque at the TOP specifically. The panel sits above the header (see
   --z-index-cv), so the navbar is inert while this is up, but at 0.72 the
   orange "get in touch" pill still showed through as a dimmed smear beside the
   sheet, which reads as chrome the visitor is meant to be able to use. */
.cv-scrim {
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(120% 90% at 50% 0%, rgba(4, 10, 20, 0.93) 0%, rgba(4, 10, 20, 0.96) 70%);
}

/* The document. Paper-coloured on purpose, this is the sheet that came out of
   the envelope, so it is the one surface on the site that is not HUD. */
.cv-sheet {
  position: relative;
  width: 100%;
  max-width: 52rem;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg) var(--space-xxl);
  display: flex;
  flex-direction: column;
  background: #fdfcfa;
  color: #1c1c1c;
  border-radius: var(--radius-md);
  box-shadow:
    0 0 0 1px rgba(52, 191, 255, 0.35),
    0 30px 90px rgba(2, 8, 18, 0.55);

  @include mixins.landscape {
    margin: var(--space-xl) auto var(--space-xxl);
    padding: var(--space-xxl) var(--space-xxl) var(--space-xl);
  }
}

.cv-close {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: var(--stroke-sm) solid rgba(28, 28, 28, 0.25);
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition:
    border-color 0.18s ease-in-out,
    background-color 0.18s ease-in-out;
  --icon-color: #1c1c1c;

  /* The site has no dedicated close glyph; a plus turned 45deg is one, and it
     is already the icon every other dismiss on the page uses. */
  &-icon {
    width: 0.7rem;
    transform: rotate(45deg);
  }

  @include mixins.hover {
    &:hover {
      border-color: var(--color-cyan-400);
      background: #ffffff;
    }
  }
}

/* ── masthead: name left, role right, the way the document sets it ───────── */
.cv-masthead {
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  padding-bottom: var(--space-lg);
  padding-right: 2.5rem;

  @include mixins.landscape {
    flex-direction: row;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-lg);
  }
}

.cv-name {
  font-size: var(--font-size-title-sm);
  font-weight: 700;
  letter-spacing: 0.01em;
}

.cv-role {
  font-size: var(--font-size-md);
  font-weight: 700;
  /* The PDF letterspaces this line hard, and it is the one flourish in an
     otherwise plain document. */
  letter-spacing: 0.28em;
  text-transform: uppercase;
}

/* ── the body: a label column and a content column, ruled off from one another
      the way the document is ───────────────────────────────────────────── */
.cv-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-xs);
  padding: var(--space-md) 0;
  border-top: 1px solid rgba(28, 28, 28, 0.55);

  @include mixins.landscape {
    grid-template-columns: 11rem 1fr;
    gap: var(--space-lg);
    padding: var(--space-lg) 0;
  }

  &-label {
    font-size: var(--font-size-xs);
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    line-height: 1.35;
  }

  &-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    min-width: 0;

    /* Certificates are set two-up in the document. Below `md` they stack, or a
       four-word certificate name becomes four lines. */
    &-two-up {
      @include mixins.mq("md") {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-md) var(--space-lg);
      }
    }
  }
}

.cv-contact {
  gap: var(--space-xxs);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-copy);

  > div {
    display: flex;
    flex-direction: column;
    gap: var(--space-xxs);
    min-width: 0;
  }

  strong {
    font-weight: 700;
    margin-right: var(--space-xs);
  }

  a {
    color: #1b6f9c;
    text-decoration: underline;
    text-underline-offset: 2px;
    /* Long URLs must not push the sheet wider than the phone. */
    overflow-wrap: anywhere;
  }

  /* The left column takes the wider share: it carries an email address and a
     URL, the right one carries two words. */
  @include mixins.landscape {
    display: grid;
    grid-template-columns: 1.45fr 1fr;
    gap: var(--space-xxs) var(--space-lg);
  }
}

.cv-entry {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  &-title {
    font-size: var(--font-size-sm);
    font-weight: 700;
    line-height: var(--line-height-copy);
    text-wrap: balance;
  }

  &-sub,
  &-note {
    font-size: var(--font-size-sm);
    line-height: var(--line-height-copy);
    color: #3a3a3a;
  }

  &-note {
    padding-top: var(--space-xxs);
  }
}

.cv-bullets {
  margin: var(--space-xs) 0 0;
  padding-left: 1.1rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-xxs);
  font-size: var(--font-size-sm);
  line-height: var(--line-height-copy);
  color: #2a2a2a;

  li {
    list-style: disc;
  }
}

.cv-end {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  padding-top: var(--space-lg);
  border-top: 1px solid rgba(28, 28, 28, 0.55);
}

.cv-action {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-md);
  border-radius: var(--radius-sm);
  border: var(--stroke-sm) solid #1b6f9c;
  background: #1b6f9c;
  color: #ffffff;
  font-size: var(--font-size-sm);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background-color 0.18s ease-in-out,
    color 0.18s ease-in-out;

  &-ghost {
    background: transparent;
    color: #1b6f9c;
  }

  @include mixins.hover {
    &:hover {
      background: #1c1c1c;
      border-color: #1c1c1c;
      color: #ffffff;
    }
  }
}
</style>
