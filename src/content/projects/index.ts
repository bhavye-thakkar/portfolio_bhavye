import type { Locale } from "../../i18n/types";

// Garba Circle is the only written-up project so far; the rest are reserved
// slots, see `placeholder.ts`. A slug here must have a matching file in
// `en/` and a matching row in `previews/en.ts`.
export const projectIds = ["garbacircle", "project-02", "project-03", "project-04", "project-05"];

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
