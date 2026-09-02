import type { Box3 } from "three";

export type ClickableBox3 = Box3 & {
  onClick?: () => void;
  hoverSound?: string;
  /**
   * Which ring `Cursor.vue` shows over this object. Defaults to the dark one,
   * which is right over the hero room's cream walls and invisible over the
   * Experience stage's deep blue, so anything on that stage asks for the cyan
   * one instead. Same call the certificate cards make.
   */
  cursor?: "circle-black" | "circle-cyan";
};
