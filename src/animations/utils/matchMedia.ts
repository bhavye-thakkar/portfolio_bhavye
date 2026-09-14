import gsap from "gsap";
import { BREAKPOINTS } from "../../utils/sizes";

/**
 * ── PHONES SCROLL THROUGH THE 3D SECTIONS FASTER ──────────────────────────
 *
 * Share of the laptop scroll length that About and Experience take on a
 * portrait screen. The owner, 2026-09-14: "in phone the overall scroll
 * animation is slow". Both sections are sized in lvh, so a 844px phone
 * scrolled ~19 screens of choreography, and a thumb covers far less of it per
 * swipe than a trackpad does. Only the scrubbed part scales: the 100vh
 * hand-overs between sections are the sticky stage physically arriving and
 * leaving and stay one screen. Every timeline inside is a fraction of its
 * range, so the order and overlap of every beat is unchanged, it just takes
 * less thumb.
 *
 * Portrait is `!isLandscape` below, the same split the spacer CSS uses.
 */
export const PORTRAIT_PACE = 0.6;

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
