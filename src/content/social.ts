import { contact, profiles } from "./profile";

/**
 * The icon row in the header, the footer and the Contact section. Composed
 * from `profile.ts` rather than repeating the URLs, so there is exactly one
 * place an address can be wrong.
 *
 * All four resolve. The X entry was a placeholder until 2026-09-09, when the
 * owner supplied the handle; it is now in `profile.ts` like the others.
 */
export const social = [
  { url: contact.mailto, name: "mail" },
  { url: profiles.github, name: "github" },
  { url: profiles.linkedin, name: "linkedin" },
  { url: profiles.x, name: "x" },
] as const satisfies { url: string; name: "mail" | "github" | "instagram" | "linkedin" | "x" }[];
