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
     * Experience beats. The avatar sits at (0, 0, 6) facing +Z (yaw -PI), so a
     * point measured in his own frame maps to world as (-x, y, 6 - z) — the
     * workstation module documents that frame.
     *
     *   1  establish, front-right and high, looking over the monitors
     *   2  over the right shoulder, the screens read
     *   3  over the left shoulder, where he turns for the second project
     */
    "experience-1": {
      position: { x: -7.0, y: 5.3, z: 13.2 },
      focus: { x: 0, y: 2.1, z: 7.0 },
    },
    "experience-2": {
      position: { x: -4.0, y: 4.5, z: 1.9 },
      focus: { x: 0.8, y: 2.3, z: 7.2 },
    },
    "experience-3": {
      position: { x: 4.0, y: 4.4, z: 1.8 },
      focus: { x: -0.8, y: 2.3, z: 7.2 },
    },
    /**
     * 4  high behind his head, looking down the desk at both monitors.
     *
     * All three chapter beats sit at z < 6 — behind him — which is what makes
     * them safe to cross between: any blend of two of them also lands behind
     * him, so a swing can never pass through the avatar or inside the desk the
     * way a cross to the front-facing beat 1 does.
     */
    "experience-4": {
      position: { x: 0, y: 7.2, z: 0.5 },
      focus: { x: 0, y: 2.4, z: 7.0 },
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
    // Portrait trades the wide office view for closer, avatar-first framings —
    // the narrow horizontal FOV can hold him plus one readable monitor, not
    // the whole desk.
    "experience-1": {
      position: { x: -4.5, y: 8.5, z: 14.5 },
      focus: { x: 0, y: 1.4, z: 6.2 },
    },
    "experience-2": {
      position: { x: -5.2, y: 5.6, z: 1.2 },
      focus: { x: 1.2, y: 2.3, z: 7.5 },
    },
    "experience-3": {
      position: { x: 5.2, y: 5.5, z: 1.1 },
      focus: { x: -1.2, y: 2.3, z: 7.5 },
    },
    "experience-4": {
      position: { x: 0, y: 8.6, z: -0.6 },
      focus: { x: 0, y: 2.4, z: 7.2 },
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
