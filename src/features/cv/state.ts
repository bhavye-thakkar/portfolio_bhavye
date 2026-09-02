import { computed, ref } from "vue";

/**
 * ─── THE CV'S THREE STATES ────────────────────────────────────────────────
 *
 *   closed   the envelope is shut on the desk
 *   open     the flap is up and the sheet has risen out of it and settled.
 *            This is a PHYSICAL state: it happens in the 3D scene, at desk
 *            scale, with the camera where it was. A small prompt offers to
 *            read it.
 *   reading  the readable panel is up over the scene.
 *
 * The middle one is the whole point. The first version went straight from a
 * click to a full-screen document, which meant the envelope was a button with
 * a nice animation playing behind a modal nobody could see, and the sheet read
 * as a large flat paper dropped onto the desk rather than as something that
 * came out of an envelope. Now the click opens the envelope and nothing else;
 * reading is a second, deliberate step.
 *
 * ── WHY THIS IS A MODULE REF AND NOT A ROUTE ──────────────────────────────
 *
 * `/object/:slug` and `/experience/:slug` are routes because they are pages: a
 * visitor can be sent one, a crawler should index one, and each has copy of its
 * own. The CV is neither. It is the contents of a prop in a scene, and its
 * source of truth is a PDF that already has its own URL
 * (`public/cv/`). A route for it would need a canonical, a sitemap entry, a 404
 * story and a decision about what a cold deep link does to the camera, all to
 * duplicate a file that is already directly linkable.
 *
 * It lives in its own module rather than in a component so the 3D scene can
 * import it without pulling Vue components into the scene graph.
 */
export type CvStage = "closed" | "open" | "reading";

export const cvStage = ref<CvStage>("closed");

/** The envelope is open in the scene in both of the non-closed states. */
export const cvEnvelopeOpen = computed(() => cvStage.value !== "closed");
export const cvPromptVisible = computed(() => cvStage.value === "open");
export const cvReading = computed(() => cvStage.value === "reading");

export const cv = {
  /** Clicking the prop: shut opens it, open reads it. */
  activate: () => {
    cvStage.value = cvStage.value === "closed" ? "open" : "reading";
  },
  open: () => {
    if (cvStage.value === "closed") cvStage.value = "open";
  },
  read: () => {
    cvStage.value = "reading";
  },
  /** Closing the reader leaves the sheet standing in the envelope. */
  close: () => {
    if (cvStage.value === "reading") cvStage.value = "open";
  },
  /** All the way back: the sheet slides in and the flap comes down. */
  dismiss: () => {
    cvStage.value = "closed";
  },
};
