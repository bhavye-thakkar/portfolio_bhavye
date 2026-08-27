import { PLACEHOLDER_IMAGE, placeholderPreview } from "../placeholder";

import type { ProjectPreview } from "../../types";

/**
 * The Projects grid, in order. Garba Circle keeps its real write-up and takes
 * the shared placeholder plate until its own artwork exists; every other row
 * is a reserved slot.
 */
export default [
  {
    title: "Garba Circle",
    slug: "garbacircle",
    thumbnail: PLACEHOLDER_IMAGE,
    description: "Navratri & Garba app",
  },
  placeholderPreview(2),
  placeholderPreview(3),
  placeholderPreview(4),
  placeholderPreview(5),
] satisfies ProjectPreview[];
