<script setup lang="ts">
import { computed, nextTick, ref, watch, onBeforeUnmount } from "vue";
import { t } from "../../../i18n/utils/translate";
import Link from "../../../components/Link.vue";
import ArrowRight from "../../../components/icons/ArrowRight.vue";
import Breadcrumbs from "../../../components/Breadcrumbs.vue";
import { objectBySlug } from "../../../content/objects";
import { objectId, recentObjectId } from "../../../composables/useRouteObserver";
import { useRouter } from "../../../composables/useRouter";
import { useFirstRoute } from "../../../composables/useFirstRoute";
import { lenis } from "../../../composables/useScroll";
import { inspect } from "../../../animations/inspect";

/**
 * ─── THE OBJECT PANEL ─────────────────────────────────────────────────────
 *
 * `/object/orchid` and `/object/starry-night`. The camera walks up to the
 * thing in the room and this reads over the top of it, a label beside an
 * exhibit rather than a page that replaced one.
 *
 * That is the whole reason it is built differently from the project and story
 * pages. Those REPLACE home: it goes fixed and hidden, they take the document
 * scroll, and closing means putting the scroll back. This one is a layer over
 * a home page that never moves. Nothing is torn down, so nothing has to be
 * rebuilt, and closing is a camera move and a class.
 *
 * Three things have to be handled because home is still live underneath:
 *
 *   · Lenis is stopped, so a wheel over the panel cannot scroll the page
 *     behind it and drag the camera off the object mid-read. The wrapper also
 *     carries `data-lenis-prevent` (see App.vue), stopping Lenis is not
 *     enough, it still swallows the wheel, and without that attribute the
 *     panel's own scroll never receives one.
 *   · The camera pose is re-read from the live scene every frame rather than
 *     tweened to a value captured on open, see `animations/inspect.ts`.
 *   · The wrapper is marked `data-scene-blocker`, or the pointer keeps
 *     hovering, and clicking, scene objects straight through the copy.
 *   · The panel takes focus on open and Escape closes it, because visually it
 *     is modal even though it is a real URL.
 */

const router = useRouter();
const { isFirstRoute } = useFirstRoute();

// `recentObjectId` rather than `objectId`, so the copy is still there to read
// during the closing fade instead of blanking on the first frame of it.
const entry = computed(() => objectBySlug(recentObjectId.value ?? ""));

const panelRef = ref<HTMLElement | null>(null);

const close = () => {
  if (isFirstRoute.value) router.push("/");
  else router.back();
};

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key !== "Escape") return;
  close();
};

watch(
  objectId,
  async (id) => {
    if (id) {
      // No unknown-slug guard here on purpose: `objectId` is already null for
      // a slug that does not exist, so this only ever runs for a real object
      // and `/object/nonsense` reaches the 404 page instead of being quietly
      // replaced with the home page.
      lenis.value?.stop();
      inspect.enter(id);
      window.addEventListener("keydown", handleKeydown);

      // The panel is what the visitor is now reading; leaving focus on the
      // orchid's mirror link behind it means the next Tab walks the home page.
      await nextTick();
      panelRef.value?.focus({ preventScroll: true });
      return;
    }

    window.removeEventListener("keydown", handleKeydown);
    inspect.exit();
    lenis.value?.start();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <!-- The theme class is the whole of what makes these two pages feel like
       different rooms: same structure, same rhythm, its own palette and its own
       light. See the note at the top of the style block. -->
  <article
    v-if="entry"
    ref="panelRef"
    class="object-panel"
    :class="`object-panel-${entry.slug}`"
    tabindex="-1"
    :aria-labelledby="`object-title-${entry.slug}`"
  >
    <div class="object-panel-scrim" aria-hidden="true"></div>
    <!-- The atmosphere layer. Empty on purpose: what it paints is entirely a
         theme's business, and for the object that has none it paints nothing. -->
    <div class="object-panel-air" aria-hidden="true"></div>

    <div class="object-panel-inner">
      <!-- Top-left, above the title block rather than inside it: this is the
           ONLY way out that is drawn on screen, because App.vue does not mount
           the site header on an object route. Escape and the browser's Back
           also close the panel. -->
      <div class="object-topbar">
        <Link to="/" class="object-back" data-cursor="circle-cyan" data-sound="click" data-hoversound="hover">
          <ArrowRight class="object-back-icon" />
          <span>{{ t("back-to-the-room") }}</span>
        </Link>

        <Breadcrumbs class="object-breadcrumbs" :trail="[{ label: t('home'), to: '/' }]" :current="entry.title" />
      </div>

      <header class="object-masthead">
        <p class="object-eyebrow">{{ entry.eyebrow }}</p>
        <h1 :id="`object-title-${entry.slug}`" class="object-title">{{ entry.title }}</h1>
        <p class="object-subtitle">{{ entry.subtitle }}</p>
      </header>

      <div class="object-body">
        <p class="object-body-label">{{ t("why-this-is-here") }}</p>
        <p class="object-statement">{{ entry.statement }}</p>
        <p v-for="(paragraph, index) in entry.body" :key="index" class="object-paragraph">{{ paragraph }}</p>
      </div>

      <section class="object-facts" :aria-label="t('object-details')">
        <p class="object-facts-label">{{ t("object-details") }}</p>
        <dl>
          <div v-for="fact in entry.facts" :key="fact.label" class="object-facts-item">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </div>
        </dl>
      </section>

      <footer class="object-end">
        <Link to="/" class="object-back" data-cursor="circle-cyan" data-sound="click" data-hoversound="hover">
          <ArrowRight class="object-back-icon" />
          <span>{{ t("back-to-the-room") }}</span>
        </Link>
      </footer>
    </div>
  </article>
</template>


<style scoped lang="scss">
/**
 * ─── TWO OBJECTS, TWO ATMOSPHERES ─────────────────────────────────────────
 *
 * This panel used to be the site's HUD: ProFontWindows, cyan rules, cyan
 * labels, an ink-blue wash. That is the X-ray's voice, and borrowing it made
 * a flower on a shelf and a painting on a wall read as two more readouts in a
 * technical sequence. They are the only two things in the room that are here
 * for a reason that is not work, so they get their own light.
 *
 * The structure does NOT change, and deliberately: eyebrow, title, statement,
 * body, facts, back link, the same rhythm the project pages use, because a
 * visitor arriving from a case study should recognise where they are. Only the
 * palette, the type and the air change, and all three come out of the tokens
 * below. Adding a third object means adding one theme block, nothing else.
 *
 *   ORCHID        warm, low, botanical. A greenhouse at the end of the day:
 *                 near-black brown rather than blue, and a soft gold that
 *                 reads as light through a window rather than as a UI accent.
 *   STARRY NIGHT  prussian blue and the painting's own chrome yellow, with a
 *                 drift of stars behind the copy. Deep, not technical: no
 *                 grid, no scan line, nothing that glows.
 *
 * Neither uses the monospace face and neither uses cyan. That is the whole
 * separation from the X-ray, and it is why the tokens exist rather than being
 * spot-overridden further down.
 */
.object-panel {
  /* Defaults are the orchid's, so a new object without a theme block lands
     somewhere warm and readable rather than somewhere unstyled. */
  --panel-veil: 26 21 18;
  --panel-ink: #f4ede3;
  --panel-ink-dim: #c6b6a4;
  --panel-accent: #e0b57f;
  --panel-rule: rgba(224, 181, 127, 0.32);
  --panel-face: "Urbanist", system-ui, sans-serif;

  position: relative;
  min-height: 100%;
  width: 100%;
  color: var(--panel-ink);
  font-family: var(--panel-face);
  outline: none;

  /**
   * Portrait clears the top of the frame, landscape clears the right, which is
   * the half `framedFocus` puts the object in.
   *
   * `--panel-vignette` is the second layer, and it is what stops the clear half
   * being the ROOM: past the object the hero shot is a bright cream wall, and a
   * page that is meant to feel like a night sky cannot have one of those in the
   * corner. A theme that wants the room left alone simply does not set it.
   * The centre follows the object, so there is one value per orientation.
   */
  &-scrim {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image:
      var(--panel-vignette-portrait, none),
      linear-gradient(
        to bottom,
        rgb(var(--panel-veil) / 0.06) 0%,
        rgb(var(--panel-veil) / 0.58) 26%,
        rgb(var(--panel-veil) / 0.93) 46%,
        rgb(var(--panel-veil) / 0.96) 100%
      );

    @include mixins.landscape {
      background-image:
        var(--panel-vignette, none),
        linear-gradient(
          to right,
          rgb(var(--panel-veil) / 0.96) 0%,
          rgb(var(--panel-veil) / 0.92) 40%,
          rgb(var(--panel-veil) / 0.5) 62%,
          rgb(var(--panel-veil) / 0.08) 100%
        );
    }
  }

  &-air {
    position: fixed;
    inset: 0;
    pointer-events: none;
  }

  &-inner {
    position: relative;
    width: 100%;
    max-width: var(--breakpoint-xxxl);
    margin: 0 auto;
    padding: 0 var(--space-outer) var(--space-xxxl);
    display: flex;
    flex-direction: column;
    gap: var(--space-xxl);

    @include mixins.landscape {
      max-width: 46rem;
      margin: 0;
      padding-left: max(var(--space-outer), calc((100vw - var(--breakpoint-xxxl)) / 2 + var(--space-outer)));
    }
  }
}

/**
 * ── THE ORCHID ────────────────────────────────────────────────────────────
 *
 * One low warm light coming in from where the shelf is, and nothing else. The
 * gradient is enormous and very soft on purpose: a tight one reads as a spot
 * lamp pointed at an exhibit, and this page is about something that was simply
 * in the room.
 */
.object-panel-orchid {
  --panel-veil: 26 21 18;
  --panel-ink: #f4ede3;
  --panel-ink-dim: #c6b6a4;
  --panel-accent: #e0b57f;
  --panel-rule: rgba(224, 181, 127, 0.32);
  /* Gentle: the shelf light is the point of this one, so the corners come down
     just enough to stop the wall behind it reading as daylight. */
  --panel-vignette: radial-gradient(64% 70% at 80% 54%, rgb(26 21 18 / 0) 0%, rgb(26 21 18 / 0.34) 100%);
  --panel-vignette-portrait: radial-gradient(78% 46% at 50% 24%, rgb(26 21 18 / 0) 0%, rgb(26 21 18 / 0.34) 100%);

  .object-panel-air {
    background: radial-gradient(
      120% 80% at 82% 18%,
      rgba(255, 214, 158, 0.16) 0%,
      rgba(255, 196, 140, 0.06) 38%,
      rgba(255, 196, 140, 0) 72%
    );
  }
}

/**
 * ── THE STARRY NIGHT ──────────────────────────────────────────────────────
 *
 * Prussian blue, the painting's chrome yellow, and stars.
 *
 * The stars are two tiled radial-gradient layers rather than elements: a few
 * hundred dots as DOM nodes is a scroll cost on a page whose whole job is to
 * be scrolled through, and this is one paint. They are dim, they are not the
 * same size, and the two layers drift at different speeds so the field has
 * depth. Very slow: at 190s a pass they are never seen to move, only noticed
 * to have moved, which is the difference between a night sky and a screensaver.
 */
.object-panel-starry-night {
  --panel-veil: 9 14 40;
  --panel-ink: #eef2ff;
  --panel-ink-dim: #a9b7d9;
  --panel-accent: #eac86a;
  --panel-rule: rgba(234, 200, 106, 0.3);
  /* Stronger than the orchid's. Everything except the canvas goes to night;
     the painting is left alone and becomes the only lit thing in the frame,
     which is the whole composition. */
  --panel-vignette: radial-gradient(56% 62% at 79% 52%, rgb(9 14 40 / 0) 0%, rgb(9 14 40 / 0.62) 100%);
  --panel-vignette-portrait: radial-gradient(72% 40% at 50% 24%, rgb(9 14 40 / 0) 0%, rgb(9 14 40 / 0.62) 100%);

  .object-panel-air {
    background-image:
      radial-gradient(1.6px 1.6px at 18% 22%, rgba(255, 248, 220, 0.55), transparent 60%),
      radial-gradient(1.2px 1.2px at 62% 12%, rgba(226, 236, 255, 0.42), transparent 60%),
      radial-gradient(1.8px 1.8px at 84% 46%, rgba(255, 244, 205, 0.5), transparent 60%),
      radial-gradient(1.1px 1.1px at 34% 68%, rgba(226, 236, 255, 0.36), transparent 60%),
      radial-gradient(1.5px 1.5px at 8% 84%, rgba(255, 248, 220, 0.4), transparent 60%),
      radial-gradient(1.2px 1.2px at 72% 88%, rgba(226, 236, 255, 0.34), transparent 60%),
      /* the one warm swell the sky turns around, well off the copy column */
        radial-gradient(60% 46% at 88% 26%, rgba(234, 200, 106, 0.1) 0%, rgba(234, 200, 106, 0) 70%);
    background-size:
      420px 420px,
      420px 420px,
      420px 420px,
      680px 680px,
      680px 680px,
      680px 680px,
      100% 100%;
    animation: object-stars 190s linear infinite;
  }
}

@keyframes object-stars {
  to {
    background-position:
      420px 210px,
      420px 210px,
      420px 210px,
      -680px 340px,
      -680px 340px,
      -680px 340px,
      0 0;
  }
}

.object-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  width: fit-content;
  font-size: var(--font-size-sm);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--panel-ink-dim);
  transition: color 0.15s ease-in-out;
  --icon-color: var(--panel-ink-dim);

  &-icon {
    width: var(--icon-size-xs);
    transform: rotate(180deg);
    transition: transform 0.2s var(--ease-smooth);
  }

  @include mixins.hover {
    &:hover {
      color: var(--panel-accent);
      --icon-color: var(--panel-accent);

      .object-back-icon {
        transform: rotate(180deg) translateX(4px);
      }
    }
  }
}

/* The control bar, pinned to the top-left of the panel in both orientations.
   Out of the masthead's flow so the portrait offset that keeps the copy clear
   of the object does not push the only way out a third of the way down. */
.object-topbar {
  padding-top: var(--space-lg);
}

/* Under the back link with real air between them: a control, then a location -
   two separate things rather than one stacked block. */
.object-breadcrumbs {
  margin-top: var(--space-md);
}

.object-masthead {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  /* Portrait holds the copy under the clear top band so the object keeps the
     opening frame to itself. The topbar above is exempt, it is a control, not
     copy. */
  padding-top: 16vh;

  @include mixins.landscape {
    padding-top: 0;
  }
}

.object-eyebrow {
  font-size: var(--font-size-sm);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--panel-accent);
}

.object-title {
  font-size: var(--font-size-title-lg);
  font-weight: 700;
  line-height: var(--line-height-title);
  letter-spacing: -0.01em;
  text-wrap: balance;

  @include mixins.mq("md") {
    font-size: var(--font-size-title-xl);
  }
}

.object-subtitle {
  font-size: var(--font-size-lg);
  color: var(--panel-ink-dim);
}

.object-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  &-label {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--panel-accent);
    padding-bottom: var(--space-md);
    border-bottom: var(--stroke-sm) solid var(--panel-rule);
  }
}

/* The one line that is the answer, set large and light. Both of these pages
   are writing before they are documentation, so the statement gets the
   generous measure and leading of a pull quote rather than the tight setting
   the HUD panels use. */
.object-statement {
  font-size: var(--font-size-xl);
  font-weight: 400;
  line-height: 1.42;
  letter-spacing: -0.005em;
  color: var(--panel-ink);
  max-width: 34ch;
  text-wrap: pretty;

  @include mixins.mq("md") {
    font-size: var(--font-size-title-xxs);
  }
}

.object-paragraph {
  font-size: var(--font-size-md);
  line-height: var(--line-height-copy);
  color: var(--panel-ink-dim);
  max-width: 62ch;
  text-wrap: pretty;
}

.object-facts {
  &-label {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--panel-accent);
    padding-bottom: var(--space-md);
    border-bottom: var(--stroke-sm) solid var(--panel-rule);
    margin-bottom: var(--space-md);
  }

  dl {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }

  &-item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--space-xs) var(--space-md);

    dt {
      flex: 0 0 auto;
      min-width: 9rem;
      font-size: var(--font-size-xs);
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: var(--panel-ink-dim);
    }

    dd {
      flex: 1 1 14rem;
      font-size: var(--font-size-md);
      color: var(--panel-ink);
    }
  }
}

.object-end {
  padding-top: var(--space-xl);
  border-top: var(--stroke-sm) solid var(--panel-rule);
}

@media (prefers-reduced-motion: reduce) {
  .object-back-icon {
    transition: none;
  }

  .object-panel-air {
    animation: none;
  }
}
</style>
