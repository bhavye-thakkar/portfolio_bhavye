import placeholderImage from "../../assets/thumbnails/placeholder.svg";

import type { ProjectContent, ProjectPreview } from "../types";

/**
 * ─── PROJECT PLACEHOLDERS ─────────────────────────────────────────────────
 *
 * Every project except Garba Circle is a reserved slot right now: the card,
 * the hover, the open/close transition and the detail layout are all live, and
 * only the content is pending. One shared plate stands in for the artwork so a
 * slot reads as deliberate rather than as a card that failed to load.
 *
 * Nothing here names a real company, product or person, that is the point.
 * To make a slot real: drop a file into `en/` named for the slug, write the
 * content the way `garbacircle.ts` does, and swap its row in `previews/en.ts`.
 *
 * The real write-ups the theme shipped with are parked in `_unused/`, outside
 * the `./en/*.ts` glob, so they are out of the bundle but not lost.
 */

export const PLACEHOLDER_IMAGE = placeholderImage;

/** "02", "03", …, matches the chapter numbering used across the site. */
const pad = (index: number) => String(index).padStart(2, "0");

export const placeholderSlug = (index: number) => `project-${pad(index)}`;

/**
 * The card in the Projects grid. `thumbnail` is 16:9 and the card crops with
 * `object-fit: cover`, so the plate lands unstretched at every breakpoint.
 */
export const placeholderPreview = (index: number): ProjectPreview => ({
  title: `Project ${pad(index)}`,
  slug: placeholderSlug(index),
  thumbnail: placeholderImage,
  description: "Case study coming soon",
});

/**
 * The detail page. One media block rather than a gallery of the same plate
 * repeated six times, a single frame reads as "not published yet", where a
 * stack of identical images reads as broken.
 *
 * `tags` is deliberately empty: a stack this project does not have yet would
 * be an invented claim, and the tag row simply does not render without one.
 */
export const placeholderProject = (index: number): ProjectContent => ({
  title: `Project ${pad(index)}`,
  theme: "light",
  tags: [],
  videoBorder: false,
  description:
    "This slot is reserved for a case study that has not been written yet.<br/><br/>The card, the opening transition and this layout are all live, only the words and the artwork are still to come.",
  components: [
    {
      type: "media",
      props: {
        type: "image",
        src: placeholderImage,
        alt: `Project ${pad(index)}, artwork pending`,
        caption: "Artwork pending",
      },
    },
  ],
});
