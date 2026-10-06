import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * ─── HOME HOLDS STILL WHILE A PAGE SITS OVER IT ───────────────────────────
 *
 * A project page or the library takes the document scroll while home sits
 * `position: fixed` underneath, and home's ScrollTriggers would go on
 * scrubbing to that scroll: reading to the bottom of a case study used to move
 * the hidden home page into About and Experience (weights about 0.56 and
 * 0.23), running its timelines, callbacks and monitor redraws for a page
 * nobody could see. The Experience story tears the home timelines down
 * (`storyActive`); these pages only need them paused, so the triggers are
 * disabled without reverting, which keeps home exactly as the visitor left
 * it, and re-enabled once the home scroll is back.
 *
 * One module-level list, because only one page can sit over home at a time.
 * `exceptWithin` leaves the triggers created by the page itself alive (a
 * project page's own media and text reveals).
 */
let heldTriggers: ScrollTrigger[] = [];

export const holdHome = (exceptWithin?: string) => {
  const held = ScrollTrigger.getAll().filter(
    // `enabled` exists at runtime but is missing from gsap's type definitions.
    (st) =>
      (st as ScrollTrigger & { enabled: boolean }).enabled &&
      !(exceptWithin && st.trigger instanceof Element && st.trigger.closest(exceptWithin)),
  );
  held.forEach((st) => st.disable(false));
  heldTriggers.push(...held);
};

export const releaseHome = () => {
  // ponytail: a trigger rebuilt by a resize while the page was open is new and
  // was never held; it has scrubbed along with the page and simply refreshes.
  const alive = new Set(ScrollTrigger.getAll());
  heldTriggers.filter((st) => alive.has(st)).forEach((st) => st.enable(false));
  heldTriggers = [];
  ScrollTrigger.update();
};
