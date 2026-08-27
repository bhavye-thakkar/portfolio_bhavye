import { ref, watchEffect } from "vue";
import { lenis } from "./useScroll";
import { sizes } from "../utils/sizes";

export const useHeaderTheme = ({
  onUpdate,
}: {
  onUpdate?: (element: HTMLElement | null, boundingClientRect: DOMRect | null, hasScrolledIntoView: boolean) => void;
} = {}) => {
  let aboutElement: HTMLElement | null = null;
  let experienceElement: HTMLElement | null = null;
  const isDarkTheme = ref(false);
  const hasScrolledIntoView = ref(false);

  const handleScroll = () => {
    if (!aboutElement) {
      aboutElement = typeof window !== "undefined" ? document.querySelector("#about") : null;
    }
    if (!experienceElement) {
      experienceElement = typeof window !== "undefined" ? document.querySelector("#experience") : null;
    }

    if (aboutElement) {
      const aboutBounding = aboutElement.getBoundingClientRect();
      const isLandscape = sizes.isLandscape;
      const isScrolledIntoView = aboutBounding.top - (isLandscape ? sizes.height * 0.225 : 0) < 0;
      // The dark 3D stage now runs through the Experience section, so the
      // header keeps its dark treatment until that spacer's end.
      const darkEnd = experienceElement ?? aboutElement;
      const isScrolledPast = darkEnd.getBoundingClientRect().bottom - 36 < 0;

      hasScrolledIntoView.value = isScrolledIntoView;
      isDarkTheme.value = isScrolledIntoView && !isScrolledPast;

      if (typeof onUpdate === "function") {
        onUpdate(aboutElement, aboutBounding, isScrolledIntoView);
      }
    }
  };

  watchEffect((onInvalidate) => {
    if (lenis.value) {
      lenis.value.on("scroll", handleScroll);
    }

    onInvalidate(() => {
      if (lenis.value) {
        lenis.value.off("scroll", handleScroll);
      }
    });
  });

  return {
    isDarkTheme,
    hasScrolledIntoView,
  };
};
