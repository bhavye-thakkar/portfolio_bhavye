import type { Locale } from "../../i18n/types";

// Garba Circle and Monday are the written-up projects; slots 03 to 05 are
// reserved, see `placeholder.ts`. A slug here must have a matching file in
// `en/` and a matching row in `previews/en.ts`.
//
// ── TWO ROWS ONLY, ON THE OWNER'S INSTRUCTION (2026-09-10) ────────────────
// Four empty slots behind one real project made the grid read as a mostly
// unfinished portfolio. Monday filled slot 02 on 2026-10-29 (vercel.json sends
// the old /project/project-02 to it). Slots 03 to 05 are commented out rather
// than deleted: `en/project-03.ts`…`project-05.ts` and their rows in
// `previews/en.ts` are still on disk, so restoring one is uncommenting it in
// BOTH places. A slug left here without its preview row (or the reverse) is a
// broken card.
export const projectIds = [
  "garbacircle",
  "monday",
  // "project-03",
  // "project-04",
  // "project-05",
];

function simplifyModules(glob: Record<string, any>) {
  const result: Record<string, any> = {};
  for (const [path, mod] of Object.entries(glob)) {
    const match = path.match(/\/([a-z0-9_-]+)\.ts$/i);
    if (match) result[match[1] as string] = mod;
  }
  return result;
}

export const projectModules = {
  en: simplifyModules(import.meta.glob("./en/*.ts", { eager: true })),
} as const satisfies Record<Locale, Record<string, any>>;
