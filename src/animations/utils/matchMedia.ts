import gsap from "gsap";
import { BREAKPOINTS } from "../../utils/sizes";

export type MatchMediaConditions = {
  isMobile: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isTallLandscape: boolean;
};

export const createMatchMedia = (
  setup: (context: gsap.Context, conditions: MatchMediaConditions) => void | (() => void),
): gsap.MatchMedia => {
  const mm = gsap.matchMedia();

  mm.add(
    {
      isMobile: `(max-width: ${BREAKPOINTS.md - 1}px)`,
      isDesktop: `(min-width: ${BREAKPOINTS.md}px)`,
      isLandscape: `(min-aspect-ratio: 1)`,
      // Enough height to show the Skills and AI/ML panels stacked
      isTallLandscape: `(min-aspect-ratio: 1) and (min-height: 720px)`,
    },
    (context) => {
      const { conditions } = context;
      const cleanup = setup(context, conditions as MatchMediaConditions);
      return cleanup;
    },
  );

  return mm;
};
