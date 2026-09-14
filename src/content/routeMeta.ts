import { experienceBySlug } from "./experience";
import { objectBySlug } from "./objects";
import { profile, site } from "./profile";

import type { ProjectPreview } from "./types";

/**
 * ─── THE HEAD OF EVERY DEEP ROUTE ─────────────────────────────────────────
 *
 * One source, two readers. `composables/useHead.ts` applies these in the
 * browser on every route change, and the build (`scripts/routePages.ts`, via
 * `routeData.ts`) writes them into a static HTML file per route, so a crawler
 * that never runs JavaScript still gets each page's own title, description,
 * canonical and text instead of the home page's.
 */

export const SUFFIX = "Bhavye Thakkar";

export type Crumb = { name: string; url: string };
export type Meta = { title: string; description: string; url: string; breadcrumb?: Crumb[] };

/** Titles come from the same content files the pages render from. */
export const experienceMeta = (slug: string): Meta | null => {
  const entry = experienceBySlug(slug);
  if (!entry) return null;

  // A reserved slot has no statement and no dates; describing it as a role
  // that happened would be a lie in a search result.
  // The location goes in because this entry actually has one, not to put a city
  // in a meta tag: it is the page's own `location` field, the same string the
  // page renders, and an entry without one simply does not get the clause.
  // The only other geographic assertion is the Person schema in index.html
  // (Ahmedabad, Gujarat, IN), the city he actually publishes as his base.
  const place = entry.location ? `, ${entry.location}` : "";
  const description = entry.placeholder
    ? `A chapter of ${SUFFIX}'s career journal that has not been filled in yet.`
    : // The card's own summary sentence, the one line this entry already has
      // for "what was this job", rather than a generic one about chapter
      // counts that every entry shared word for word.
      `${entry.role} at ${entry.company}${place}${entry.duration ? `, ${entry.duration}` : ""}. ${entry.statement || `How the role came about and what it turned into, in ${entry.story.length} chapters.`}`;

  return {
    title: `${entry.company}, Experience | ${SUFFIX}`,
    description,
    url: `${site}/experience/${slug}`,
    breadcrumb: [
      { name: SUFFIX, url: `${site}/` },
      { name: "Experience", url: `${site}/#experience` },
      { name: entry.company, url: `${site}/experience/${slug}` },
    ],
  };
};

/**
 * The two clickable props. Their copy is the only thing on the site that is
 * about a decision rather than about work, so the description is the one
 * written for the purpose in content/objects.ts rather than a stitched-up
 * sentence.
 */
export const objectMeta = (slug: string): Meta | null => {
  const entry = objectBySlug(slug);
  if (!entry) return null;

  return {
    title: `${entry.title}, ${entry.eyebrow} | ${SUFFIX}`,
    description: entry.description,
    url: `${site}/object/${slug}`,
    breadcrumb: [
      { name: SUFFIX, url: `${site}/` },
      { name: entry.title, url: `${site}/object/${slug}` },
    ],
  };
};

export const projectMeta = (preview: ProjectPreview): Meta => ({
  title: `${preview.title}, Project | ${SUFFIX}`,
  description: `${preview.title}: ${preview.description}. A project by ${SUFFIX}, ${profile.role}.`,
  url: `${site}/project/${preview.slug}`,
  breadcrumb: [
    { name: SUFFIX, url: `${site}/` },
    { name: "Projects", url: `${site}/#projects` },
    { name: preview.title, url: `${site}/project/${preview.slug}` },
  ],
});
