<script setup lang="ts">
import Social from "./Social.vue";
import NotchSection from "./NotchSection.vue";
import ButtonRound from "./ButtonRound.vue";
import { lenis } from "../composables/useScroll";
import ArrowRightLong from "./icons/ArrowRightLong.vue";

interface Props {
  withSocial?: boolean;
}

const handleBackToTop = () => {
  if (!lenis.value) return;
  lenis.value.scrollTo(0);
};

const { withSocial = true } = defineProps<Props>();
</script>

<template>
  <footer class="footer">
    <NotchSection class="footer-notch" />
    <div class="footer-content">
      <!-- `v-if` on the wrapper, not on `Social` inside it. Home passes
           `withSocial: false`, and an empty flex child still took its share of
           the column's gap. -->
      <div v-if="withSocial" class="footer-top">
        <Social />
      </div>

      <!--
        ── ONE ROW, IN FLOW ──────────────────────────────────────────────────

        Credits on the left, back-to-top on the right, at every size. The
        button used to be `position: absolute` centred over the content, which
        put it directly on top of the copyright line the moment the social row
        above it was absent (which is every page except a project). Two
        elements in a flex row with a gap between them cannot overlap, so the
        fix is the layout rather than a nudge that has to be re-tuned per
        breakpoint.
      -->
      <div class="footer-bar">
        <p class="footer-credits">© {{ new Date().getFullYear() }} Bhavye Thakkar</p>

        <div
          class="footer-back-to-top"
          tabindex="0"
          role="button"
          aria-label="Back to top"
          @click="handleBackToTop"
          @keydown.enter="handleBackToTop"
          data-cursor="circle-white"
          data-sound="click"
        >
          <ButtonRound renderAs="div" variant="border" class="children-unclickable" data-hoversound="hover">
            <ArrowRightLong class="footer-back-to-top-icon" />
          </ButtonRound>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped lang="scss">
.footer {
  background: var(--color-background-300, var(--color-beige-400));
  width: 100%;
  display: flex;
  justify-content: center;
  position: relative;

  &-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xl);
    width: 100%;
    max-width: calc(var(--breakpoint-xxxl));
    padding: calc(var(--space-outer) + var(--space-sm)) var(--space-outer);
    /* Clears the home indicator on a phone without adding a gap on anything
       that has no inset to clear. */
    padding-bottom: max(calc(var(--space-outer) + var(--space-sm)), calc(env(safe-area-inset-bottom) + var(--space-md)));
  }

  &-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* The floor on the gap is what guarantees the two never touch, even at
       320px where the copyright line is at its widest relative to the row. */
    gap: var(--space-lg);
    width: 100%;
  }

  &-back-to-top {
    cursor: pointer;
    flex: 0 0 auto;

    &-icon {
      transform: rotate(-90deg);
    }
  }

  &-top {
    display: flex;
    flex-direction: column;
    width: 100%;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-xl);

    @include mixins.mq("md") {
      gap: var(--space-md);
      flex-direction: row;
    }
  }

  &-credits {
    font-size: var(--font-size-sm);
    /* Wrapping is fine, overlapping is not: the row grows and the button stays
       beside it. */
    min-width: 0;
  }

  &-notch {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateY(-100%);
    color: var(--color-background-300, var(--color-beige-400));
    --icon-color: var(--color-background-300, var(--color-beige-400));
  }
}
</style>
