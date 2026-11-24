import garbacircleArtwork from "../../../assets/thumbnails/garbacircle.webp";
import mondayArtwork from "../../../assets/thumbnails/monday.webp";

import type { ProjectPreview } from "../../types";

/**
 * The Projects grid, in order: two written-up projects, each with its own key
 * art and case study.
 *
 * Two rows only, on the owner's instruction (2026-09-10). Monday took slot 2 on
 * 2026-10-29. Slots 3 to 5 are reserved placeholders, commented out here and in
 * `../index.ts`; restoring one means uncommenting it in BOTH files and importing
 * `placeholderPreview` from "../placeholder" again.
 */
export default [
  {
    title: "Garba Circle",
    slug: "garbacircle",
    thumbnail: garbacircleArtwork,
    description: "Navratri & Garba app",
    // Every claim is on the case study page: the APK, the product copy, and
    // the three tags.
    summary:
      "Garba Circle, an Android app for Navratri: discover garba grounds, build your team and compete. Built with Flutter, Node.js and PostgreSQL.",
  },
  {
    title: "Monday",
    slug: "monday",
    thumbnail: mondayArtwork,
    description: "AI assistant for Windows",
    share: "/meta/monday.jpg",
    // The case study's first paragraph and its tags, nothing beyond them.
    summary:
      "Monday, a local-first AI assistant for Windows that works the PC from a notch at the top of the screen. Built with Python, Qt, FastAPI and SQLite.",
  },
  // placeholderPreview(3),
  // placeholderPreview(4),
  // placeholderPreview(5),
] satisfies ProjectPreview[];
