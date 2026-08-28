import type { SceneKey } from "./types";

export const points = {
  landscape: {
    hero: {
      position: { x: 0, y: 6, z: 10 },
      focus: { x: 0, y: 3, z: 0 },
    },
    "about-1": {
      /**      position: { x: 0, y: 4.7, z: 14.5 },
      position: { x: 0, y: 4.3, z: 11 },
      focus: { x: 0, y: 2.5, z: 6 },
      focus: { x: 0, y: 3.25, z: 6 }, */
      position: { x: 0, y: 4.5, z: 15.5 },
      focus: { x: 0, y: 2.2, z: 6 },
    },
    "about-2": {
      //position: { x: 0, y: 4.7, z: 14.5 },
      //position: { x: 0, y: 3, z: 15.5 },
      //focus: { x: 0, y: 2.5, z: 6 },
      //focus: { x: 0, y: 1.2, z: 6 },

      position: { x: 0, y: 4.5, z: 15.5 },
      focus: { x: 0, y: 2.2, z: 6 },
    },
    /**
     * ── EXPERIENCE BEATS ─────────────────────────────────────────────────
     *
     * Three of them, and that is the whole section: one establishing shot that
     * the opening and the closing both use, and one shot per company. A beat
     * per phase means the camera only ever moves when the visitor has actually
     * moved on to the next chapter.
     *
     * THE SIGHT LINE IS THE CONSTRAINT. He sits at (0, 0, 6) facing +Z with
     * the desk in front of him, so a point in his own frame maps to world as
     * (-x, y, 6 - z) — the workstation module documents that frame. The two
     * monitors form a wall at z 7.78 spanning world x -2.40…-0.24 and
     * 0.24…2.40, and their tops (y 3.03) are ABOVE his seated head (y 2.5).
     * Any camera in front of him must therefore cross that plane either
     * outside |x| 2.40 or above y 3.03 — the old front beat did neither, which
     * is why the section used to open on the back of a monitor with the top of
     * his head poking over it.
     *
     * The focus values are not aimed at him. Each one is his head pushed a
     * fixed share of a half-frame sideways, so he lands in the part of the
     * frame the HUD card does not own: the chapter card is anchored bottom
     * LEFT in landscape, so the chapter beats put him right of centre.
     *
     *   1  three-quarter front-left, high enough to clear the monitor tops.
     *      The whole bay reads: his face, both screens, the desk and the deck.
     *      Used for the opening AND the closing — the section ends on the
     *      frame it started from.
     *   2  chapter 01, over his left shoulder: both screens readable, him on
     *      the right, the card clear of him on the left.
     *   3  chapter 02, the mirror of 2 from the other side. Same grammar,
     *      opposite hand — one deliberate change, not a new place.
     *
     * Crossing 3 → 1 for the closing is a straight line through roughly
     * (-0.8, 4.6, 6.2): a metre above the monitor tops and two above his head,
     * so the camera cranes over the desk rather than through it.
     */
    "experience-1": {
      position: { x: -6.2, y: 5.4, z: 10.0 },
      focus: { x: -0.73, y: 2.4, z: 5.27 },
    },
    "experience-2": {
      position: { x: -4.4, y: 3.8, z: 2.4 },
      focus: { x: 1.18, y: 2.25, z: 5.24 },
    },
    "experience-3": {
      position: { x: 4.6, y: 3.8, z: 2.4 },
      focus: { x: 1.17, y: 2.25, z: 7.82 },
    },
  },
  portrait: {
    hero: {
      position: { x: 0, y: 8.2, z: 16 },
      focus: { x: 0, y: 5.2, z: 0 },
    },
    "about-1": {
      //position: { x: 0, y: 5.5, z: 20 },
      //focus: { x: 0, y: 1.8, z: 6 },
      position: { x: 0, y: 4.75, z: 19.5 },
      focus: { x: 0, y: 0.8, z: 6 },
    },
    "about-2": {
      //position: { x: 0, y: 5.5, z: 20 },
      //focus: { x: 0, y: 1.8, z: 6 },
      position: { x: 0, y: 4.75, z: 19.5 },
      focus: { x: 0, y: 0.8, z: 6 },
    },
    /**
     * Portrait trades the wide office view for closer, avatar-first framings —
     * the narrow horizontal FOV can hold him plus one readable monitor, not
     * the whole desk. And the card is anchored at the BOTTOM here rather than
     * to one side, so the push is vertical: the focus is dropped below him so
     * he sits in the top third, above the copy, instead of behind it.
     *
     * Same three beats, same meanings, same clearance rule as landscape.
     */
    "experience-1": {
      position: { x: -7.4, y: 6.6, z: 13.4 },
      focus: { x: -0.3, y: 1.43, z: 6.87 },
    },
    "experience-2": {
      position: { x: -5.6, y: 4.4, z: 1.6 },
      focus: { x: -0.27, y: 1.03, z: 6.16 },
    },
    "experience-3": {
      position: { x: 5.8, y: 4.4, z: 1.6 },
      focus: { x: 0.28, y: 1.0, z: 6.17 },
    },
  },
} as const satisfies Record<
  "landscape" | "portrait",
  Partial<
    Record<
      SceneKey,
      {
        position: { x: number; y: number; z: number };
        focus: { x: number; y: number; z: number };
      }
    >
  >
>;
