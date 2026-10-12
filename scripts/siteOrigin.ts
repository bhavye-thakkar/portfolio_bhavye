/**
 * ─── WHICH ADDRESS THIS BUILD CALLS ITS OWN ───────────────────────────────
 *
 * Every page declares one canonical origin (its <link rel="canonical">,
 * og:url, the sitemap's <loc>s, robots.txt's Sitemap line, the JSON-LD ids
 * and llms.txt). The source files are written with DEFAULT_ORIGIN; the build
 * swaps it for the address this deployment will actually be served from,
 * because this repo is deployed to more than one host and a canonical that
 * names a host which serves something else (or nothing) tells every crawler
 * to index that other thing instead. That is exactly what happened on
 * 2026-10-12: bhavyethakkar.netlify.app held an older site, and the live
 * copies on thakkarbhavya.netlify.app and bhavye.vercel.app pointed at it.
 *
 * Resolution order:
 *   1. SITE_ORIGIN, set by hand in the host's build environment: the ONE
 *      address the owner wants ranked. Set it on every deployment.
 *   2. URL, which Netlify sets to the site's production address.
 *   3. VERCEL_PROJECT_PRODUCTION_URL, which Vercel sets (host only).
 *   4. DEFAULT_ORIGIN, for local builds.
 * So an untouched deployment names itself, never a host it does not serve.
 * Two untouched deployments are two self-declared copies, which search
 * engines fold into one on their own; setting SITE_ORIGIN on both ends it.
 */
export const DEFAULT_ORIGIN = "https://bhavyethakkar.netlify.app";

const trim = (url: string) => url.replace(/\/+$/, "");

/** This deployment's own production address, if the platform says what it is. */
const ownOrigin = (env: NodeJS.ProcessEnv) => (env.URL ? trim(env.URL) : env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : null);

export const resolveOrigin = (env: NodeJS.ProcessEnv = process.env) => trim(env.SITE_ORIGIN || ownOrigin(env) || DEFAULT_ORIGIN);

/**
 * This deployment's own production address when SITE_ORIGIN names a
 * DIFFERENT host, i.e. when this address is retired in favour of the
 * canonical one; null otherwise. Three things hang off it:
 *   · on Netlify, route-pages prepends a host-wide 301 to dist/_redirects;
 *   · on every host, src/main.ts sends a visitor who still lands on the
 *     retired production host to the same path on the canonical one (a
 *     deploy preview on another host is left alone);
 *   · Vercel reads its redirects from vercel.json before the build, so a
 *     server-side 301 there is added by hand (the README has the entry).
 */
export const retiredOrigin = (env: NodeJS.ProcessEnv = process.env) => {
  const own = ownOrigin(env);
  if (!env.SITE_ORIGIN || !own) return null;
  return new URL(own).host === new URL(resolveOrigin(env)).host ? null : own;
};
