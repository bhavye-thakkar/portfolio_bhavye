<script setup lang="ts">
import { computed } from "vue";
import Link from "./Link.vue";
import { t } from "../i18n/utils/translate";
import { portfolioLinks } from "../content/profile";

/**
 * The other addresses this portfolio lives at.
 *
 * Two tiers, not one list of five, because they are not five equal things: the
 * first is the live portfolio the CV prints and the rest are other builds. A
 * flat row would make the primary one impossible to pick out, and five full
 * URLs stacked in the Contact section would read as a link dump.
 *
 * `portfolioLinks` in `content/profile.ts` is the only place the addresses
 * exist. `Link` sets `rel="noopener noreferrer"` and `target="_blank"` for
 * anything marked `external`.
 */
const primary = computed(() => portfolioLinks.find((item) => "primary" in item && item.primary));
const others = computed(() => portfolioLinks.filter((item) => !("primary" in item && item.primary)));
</script>

<template>
  <div class="portfolio-links">
    <div v-if="primary" class="portfolio-links-group">
      <p class="portfolio-links-label">{{ t("portfolio") }}</p>
      <Link
        external
        :href="primary.url"
        class="portfolio-links-item portfolio-links-item-primary"
        data-cursor="circle-white"
        data-sound="click"
        data-hoversound="hover"
      >
        {{ primary.label }}
      </Link>
    </div>

    <div class="portfolio-links-group">
      <p class="portfolio-links-label">{{ t("other-websites") }}</p>
      <ul class="portfolio-links-list">
        <li v-for="item in others" :key="item.url">
          <Link
            external
            :href="item.url"
            class="portfolio-links-item"
            data-cursor="circle-white"
            data-sound="click"
            data-hoversound="hover"
          >
            {{ item.label }}
          </Link>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
.portfolio-links {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);

  @include mixins.landscape {
    flex-direction: row;
    gap: var(--space-xxl);
  }

  &-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
    min-width: 0;
  }

  &-label {
    font-size: var(--font-size-xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.62;
  }

  &-list {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-xxs) var(--space-md);
  }

  &-item {
    font-size: var(--font-size-sm);
    /* The host is the label, so it must not wrap mid-domain on a phone. */
    white-space: nowrap;
    border-bottom: var(--stroke-sm) solid currentColor;
    padding-bottom: 1px;
    opacity: 0.78;
    transition: opacity 0.18s ease-in-out;

    &-primary {
      font-size: var(--font-size-md);
      opacity: 1;
    }

    @include mixins.hover {
      &:hover {
        opacity: 1;
      }
    }
  }
}
</style>
