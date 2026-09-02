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
     * (-x, y, 6 - z), the workstation module documents that frame. The two
     * monitors form a wall at z 7.78 spanning world x -2.40…-0.24 and
     * 0.24…2.40, and their tops (y 3.03) are ABOVE his seated head (y 2.5).
     * Any camera in front of him must therefore cross that plane either
     * outside |x| 2.40 or above y 3.03, the old front beat did neither, which
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
     *      Used for the opening AND the closing, the section ends on the
     *      frame it started from.
     *   2  chapter 01, over his left shoulder: both screens readable, him on
     *      the right, the card clear of him on the left.
     *   3  chapter 02, the SAME shoulder as 2, raised: 3.8 up becomes 4.6,
     *      looking further down over him. One deliberate change, and it is a
     *      lift rather than a step around. It stays at roughly 2's distance
     *      on purpose, pushing in instead cropped the left monitor out of
     *      frame, and both screens readable is the whole point of the shot.
     *
     * ── BEAT 3 WAS THE MIRROR OF 2, AND THAT IS WHAT MADE IT CIRCLE ──
     *
     * It used to sit at x +4.6, the far side of the room from beat 2's -4.4.
     * Measured as bearings around him the four beats ran -62° → -132° → +130°
     * → -62°: about 335° of travel, a lap in all but name. Mirroring the
     * framing is good grammar for one CUT, but these are scrubbed, and a
     * nine-unit lateral sweep across his back with the desk as the pivot is
     * just an orbit, the room appeared to spin rather than the visitor to
     * move through it.
     *
     * Both chapter beats now sit on the same bearing (~-131°) and differ in
     * HEIGHT, so the camera runs out and back along one arc instead of
     * round a loop: -62° → -132° → -131° → -62°, and the two long moves
     * retrace each other. Keep any future beat on the -X side for the same
     * reason; what separates the chapters is elevation, not which hand.
     *
     * Crossing 3 → 1 for the closing is a straight line through roughly
     * (-0.8, 4.6, 6.2): a metre above the monitor tops and two above his head,
     * so the camera cranes over the desk rather than through it.
     */
    /**
     * -7.0/5.6 rather than the old -6.2/5.4: the sight line to him used to
     * pass the near monitor's edge at |x| 2.76, clear by rule, but the
     * panel's back still owned the middle third of the frame and hid the
     * whole desk surface. From here the line crosses the monitor plane at
     * |x| ≈ 4, so the shot reads desk-first: his face, the key field, both
     * stands and the deck.
     */
    "experience-1": {
      position: { x: -7.0, y: 5.6, z: 10.0 },
      focus: { x: -0.73, y: 2.4, z: 5.27 },
    },
    "experience-2": {
      position: { x: -4.4, y: 3.8, z: 2.4 },
      focus: { x: 1.18, y: 2.25, z: 5.24 },
    },
    "experience-3": {
      position: { x: -4.0, y: 4.6, z: 2.8 },
      focus: { x: 1.14, y: 2.25, z: 4.99 },
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
     * Portrait trades the wide office view for closer, avatar-first framings -
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
      position: { x: -5.2, y: 5.3, z: 2.2 },
      focus: { x: -0.44, y: 1.17, z: 6.05 },
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
