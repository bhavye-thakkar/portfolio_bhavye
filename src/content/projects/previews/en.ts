import { placeholderPreview } from "../placeholder";
import garbacircleArtwork from "../../../assets/thumbnails/garbacircle.webp";

import type { ProjectPreview } from "../../types";

/**
 * The Projects grid, in order. Garba Circle is the one real row: its own key
 * art and its own write-up. Every other row is a reserved slot on the shared
 * placeholder plate.
 *
 * Two rows only, on the owner's instruction (2026-09-10). Slots 3 to 5 are
 * commented out, not deleted, and the matching slugs are commented out of
 * `../index.ts` too, restoring one means uncommenting it in BOTH files.
 */
export default [
  {
    title: "Garba Circle",
    slug: "garbacircle",
    thumbnail: garbacircleArtwork,
    description: "Navratri & Garba app",
  },
  placeholderPreview(2),
  // placeholderPreview(3),
  // placeholderPreview(4),
  // placeholderPreview(5),
] satisfies ProjectPreview[];
