import { contact, profiles } from "./profile";

/**
 * The icon row in the header, the footer and the Contact section. Composed
 * from `profile.ts` rather than repeating the URLs, so there is exactly one
 * place an address can be wrong.
 *
 * ⚠ The X entry is a PLACEHOLDER. The source portfolio publishes an email, a
 * GitHub and a LinkedIn and no X account, so there is no verified handle to
 * point it at — `profiles.x` is `https://x.com/example` and goes nowhere.
 * Swap in the real handle in `profile.ts`, or delete the entry, before this
 * ships; it is the one link on the site that does not resolve.
 */
export const social = [
  { url: contact.mailto, name: "mail" },
  { url: profiles.github, name: "github" },
  { url: profiles.linkedin, name: "linkedin" },
  { url: profiles.x, name: "x" },
] as const satisfies { url: string; name: "mail" | "github" | "instagram" | "linkedin" | "x" }[];
