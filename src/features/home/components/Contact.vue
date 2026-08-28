<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { transitions } from "../../../animations";
import { storyActive } from "../../../animations/story";
import { t } from "../../../i18n/utils/translate";
import Social from "../../../components/Social.vue";

const contactElement = ref<HTMLElement | null>(null);

// Same reason as About: while the Experience story page holds the document
// scroll these triggers are measuring a fixed layout, so they stand down.
watchEffect((onInvalidate) => {
  if (!storyActive.value && contactElement.value) {
    transitions.contact.setup(contactElement.value);
  }

  onInvalidate(() => {
    transitions.contact.destroy();
  });
});
</script>

<template>
  <div class="contact grid" ref="contactElement">
    <div class="contact-content">
      <h2 class="contact-title" v-html="t('lets-work-together')"></h2>
      <!-- What happens after they click. A contact section that only shows
           icons asks for a message without saying whether one comes back. -->
      <p class="contact-promise">{{ t("response-time") }}</p>
      <Social variant="background" />
    </div>
  </div>
</template>

<style scoped lang="scss">
.contact {
  width: 100%;
  max-width: calc(var(--svw) * 100);
  overflow: hidden;
  min-height: calc(var(--lvh) * 100);
  padding: var(--space-outer);
  padding-top: var(--space-lg);

  @include mixins.mq("md") {
    padding-top: var(--space-xxl);
  }

  &-content {
    position: relative;
    padding-top: var(--space-md);
    grid-column: 1 / 13;
    display: flex;
    flex-direction: column;
    gap: var(--space-md);

    @include mixins.mq("sm") {
      grid-column: 1 / 8;
    }

    @include mixins.mq("md") {
      gap: var(--space-xl);
      grid-column: 1 / 6;
      padding-top: var(--space-lg);
    }

    @include mixins.mq("lg") {
      grid-column: 2 / 6;
    }
  }

  /* The column's gap is `--space-xl` on desktop, which would leave this
     floating between the headline and the icons rather than reading as part
     of the invitation. Pull it up under the title. */
  &-promise {
    font-size: var(--font-size-md);
    line-height: var(--line-height-copy);
    max-width: 42ch;
    margin-top: calc(var(--space-md) * -1);

    @include mixins.mq("md") {
      margin-top: calc(var(--space-xl) * -1 + var(--space-xs));
    }
  }

  &-title {
    font-weight: 900;
    letter-spacing: 0.02em;
    font-size: var(--font-size-title-md);

    @include mixins.mq("sm") {
      font-size: var(--font-size-title-lg);
    }

    @include mixins.mq("xl") {
      font-size: var(--font-size-title-xl);
    }
  }
}
</style>
