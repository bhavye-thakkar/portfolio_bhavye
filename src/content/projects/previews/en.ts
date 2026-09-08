import { placeholderPreview } from "../placeholder";
import garbacircleArtwork from "../../../assets/thumbnails/garbacircle.webp";

import type { ProjectPreview } from "../../types";

/**
 * The Projects grid, in order. Garba Circle is the one real row: its own key
 * art and its own write-up. Every other row is a reserved slot on the shared
 * placeholder plate.
 */
export default [
  {
    title: "Garba Circle",
    slug: "garbacircle",
    thumbnail: garbacircleArtwork,
    description: "Navratri & Garba app",
  },
  placeholderPreview(2),
  placeholderPreview(3),
  placeholderPreview(4),
  placeholderPreview(5),
] satisfies ProjectPreview[];
