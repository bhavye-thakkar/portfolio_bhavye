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
  <article
    v-if="entry"
    ref="panelRef"
    class="object-panel"
    tabindex="-1"
    :aria-labelledby="`object-title-${entry.slug}`"
  >
    <div class="object-panel-scrim" aria-hidden="true"></div>

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
.object-panel {
  position: relative;
  min-height: 100%;
  width: 100%;
  color: var(--color-text-cyan-400);
  font-family: "ProFontWindows";
  outline: none;

  /* The room behind this is warm cream, so the wash is ink rather than the
     dark blue used on the About stage, over a cream room a blue tint reads as
     a colour cast, while neutral ink reads as the lights going down.

     Portrait clears the top of the frame, landscape clears the right, which is
     the half `framedFocus` puts the object in. */
  &-scrim {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      to bottom,
      rgba(6, 12, 22, 0.06) 0%,
      rgba(6, 12, 22, 0.58) 26%,
      rgba(6, 12, 22, 0.93) 46%,
      rgba(6, 12, 22, 0.96) 100%
    );

    @include mixins.landscape {
      background: linear-gradient(
        to right,
        rgba(6, 12, 22, 0.96) 0%,
        rgba(6, 12, 22, 0.92) 40%,
        rgba(6, 12, 22, 0.5) 62%,
        rgba(6, 12, 22, 0.08) 100%
      );
    }
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

.object-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  width: fit-content;
  font-size: var(--font-size-sm);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--color-text-cyan-300);
  transition: color 0.15s ease-in-out;
  --icon-color: var(--color-text-cyan-300);

  &-icon {
    width: var(--icon-size-xs);
    transform: rotate(180deg);
    transition: transform 0.2s var(--ease-smooth);
  }

  @include mixins.hover {
    &:hover {
      color: var(--color-cyan-400);
      --icon-color: var(--color-cyan-400);

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
  color: var(--color-cyan-400);
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
  color: var(--color-text-cyan-300);
}

.object-body {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  &-label {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    padding-bottom: var(--space-md);
    border-bottom: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);
  }
}

.object-statement {
  font-size: var(--font-size-xl);
  line-height: var(--line-height-copy);
  color: var(--color-text-cyan-400);
  text-wrap: pretty;

  @include mixins.mq("md") {
    font-size: var(--font-size-title-xxs);
  }
}

.object-paragraph {
  font-size: var(--font-size-md);
  line-height: var(--line-height-copy);
  color: var(--color-text-cyan-300);
  text-wrap: pretty;
}

.object-facts {
  &-label {
    font-size: var(--font-size-sm);
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-cyan-400);
    padding-bottom: var(--space-md);
    border-bottom: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);
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
      color: var(--color-text-cyan-300);
    }

    dd {
      flex: 1 1 14rem;
      font-size: var(--font-size-md);
      color: var(--color-text-cyan-400);
    }
  }
}

.object-end {
  padding-top: var(--space-xl);
  border-top: var(--stroke-sm) solid rgba(52, 191, 255, 0.35);
}

@media (prefers-reduced-motion: reduce) {
  .object-back-icon {
    transition: none;
  }
}
</style>
