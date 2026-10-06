import { experienceBySlug } from "./experience";
import { objectBySlug } from "./objects";
import { books, shelves, bookBySlug, shelfOf } from "./library";
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
export type Meta = {
  title: string;
  description: string;
  url: string;
  breadcrumb?: Crumb[];
  /** Structured data of the page's own, beyond the breadcrumb (schema.org JSON-LD). */
  jsonLd?: Record<string, unknown>;
};

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

/**
 * ── THE LIBRARY ───────────────────────────────────────────────────────────
 *
 * The archive and one page per book. Descriptions are built from the data in
 * content/library.ts, so they say what the shelf says: titles, authors and
 * counts, no reading claims. The structured data is a schema.org ItemList of
 * Book nodes for the archive and a single Book for a book page.
 */
const bookNode = (slug: string) => {
  const book = bookBySlug(slug)!;
  const node: Record<string, unknown> = {
    "@type": "Book",
    name: book.title,
    author: { "@type": "Person", name: book.author },
    url: `${site}/library/${book.slug}`,
  };
  // Only a real year goes out as a date; "c. 180" and a span stay prose.
  if (/^\d{4}$/.test(book.year)) node.datePublished = book.year;
  if (book.series) node.isPartOf = { "@type": "BookSeries", name: book.series.name, position: book.series.volume };
  return node;
};

export const libraryMeta = (): Meta => ({
  title: `Library, a personal reading archive | ${SUFFIX}`,
  description: `${SUFFIX}'s personal library: ${books.length} books on one shelf in ${shelves.length} groups, from the Shiva Trilogy and the Ram Chandra Series to Meditations, Atomic Habits and The Psychology of Money, each with a page of its own.`,
  url: `${site}/library`,
  breadcrumb: [
    { name: SUFFIX, url: `${site}/` },
    { name: "Library", url: `${site}/library` },
  ],
  jsonLd: {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${SUFFIX}'s library`,
    numberOfItems: books.length,
    itemListElement: books.map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: bookNode(book.slug),
    })),
  },
});

export const bookMeta = (slug: string): Meta | null => {
  const book = bookBySlug(slug);
  if (!book) return null;
  const shelf = shelfOf(slug);
  const where = shelf ? ` In the "${shelf.title}" group of ${SUFFIX}'s personal library.` : ` In ${SUFFIX}'s personal library.`;

  return {
    title: `${book.title}, ${book.author} | Library | ${SUFFIX}`,
    description: `${book.description}${where}`,
    url: `${site}/library/${slug}`,
    breadcrumb: [
      { name: SUFFIX, url: `${site}/` },
      { name: "Library", url: `${site}/library` },
      { name: book.title, url: `${site}/library/${slug}` },
    ],
    jsonLd: { "@context": "https://schema.org", ...bookNode(slug) },
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
