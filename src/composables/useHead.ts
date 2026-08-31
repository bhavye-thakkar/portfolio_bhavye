import { watch } from "vue";
import { path, experienceId, projectId, objectId, notFound } from "./useRouteObserver";
import { experienceBySlug } from "../content/experience";
import { objectBySlug } from "../content/objects";
import { previews } from "../content/projects/previews";
import { profile, site } from "../content/profile";

/**
 * ─── PER-ROUTE HEAD ───────────────────────────────────────────────────────
 *
 * This is a single-page app that changes its URL with `history.pushState` and
 * never changed anything else. Every route — the home page, five project
 * pages, two experience stories — served the same `<title>`, the same
 * description and the same canonical, which is to say eight URLs that a
 * search engine cannot tell apart. The canonical was the worst of it: every
 * deep page was declaring itself a duplicate of the home page, which is an
 * instruction not to index it.
 *
 * So: one watcher, three tags. No library — `document.title` and two
 * `setAttribute` calls do the whole job, and a head manager would be four
 * dependencies to avoid writing them.
 *
 * The base values live in index.html and are read back on first run, so the
 * home page keeps exactly what is in the static markup and only the deep
 * routes override it.
 */

const SUFFIX = "Bhavye Thakkar";

type Crumb = { name: string; url: string };
type Meta = { title: string; description: string; url: string; breadcrumb?: Crumb[] };

let base: Meta | null = null;

const readBase = (): Meta => {
  if (base) return base;
  base = {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    url: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? `${site}/`,
  };
  return base;
};

/** Creates the tag if the static markup did not ship one, then sets it. */
const setMeta = (selector: string, attribute: string, value: string, create: () => Element) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = create();
    document.head.appendChild(element);
  }
  element.setAttribute(attribute, value);
};

/**
 * `BreadcrumbList` for the detail routes, matching the trail `Breadcrumbs.vue`
 * renders. One tag, replaced in place — the home page removes it rather than
 * leaving a stale trail behind after a client-side navigation back.
 */
const BREADCRUMB_ID = "route-breadcrumb";

const applyBreadcrumb = (crumbs: Crumb[] | undefined) => {
  const existing = document.getElementById(BREADCRUMB_ID);

  if (!crumbs || crumbs.length < 2) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.id = BREADCRUMB_ID;
  script.setAttribute("type", "application/ld+json");
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  });
  if (!existing) document.head.appendChild(script);
};

const apply = ({ title, description, url, breadcrumb }: Meta) => {
  document.title = title;
  applyBreadcrumb(breadcrumb);

  setMeta('meta[name="description"]', "content", description, () => {
    const el = document.createElement("meta");
    el.setAttribute("name", "description");
    return el;
  });

  setMeta('link[rel="canonical"]', "href", url, () => {
    const el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    return el;
  });

  // Open Graph and Twitter mirror the same three values — a card that says
  // something different from the page is its own kind of wrong.
  const og: [string, string][] = [
    ["og:title", title],
    ["og:description", description],
    ["og:url", url],
    ["twitter:title", title],
    ["twitter:description", description],
  ];

  for (const [property, value] of og) {
    const isTwitter = property.startsWith("twitter:");
    const selector = isTwitter ? `meta[name="${property}"]` : `meta[property="${property}"]`;
    setMeta(selector, "content", value, () => {
      const el = document.createElement("meta");
      el.setAttribute(isTwitter ? "name" : "property", property);
      return el;
    });
  }
};

/** Titles come from the same content files the pages render from. */
const forExperience = (slug: string): Meta | null => {
  const entry = experienceBySlug(slug);
  if (!entry) return null;

  // A reserved slot has no statement and no dates; describing it as a role
  // that happened would be a lie in a search result.
  // The location goes in because this entry actually has one, not to put a city
  // in a meta tag: it is the page's own `location` field, the same string the
  // page renders, and an entry without one simply does not get the clause.
  // The only other geographic assertion is the Person schema in index.html
  // (Ahmedabad, Gujarat, IN) — the city he actually publishes as his base.
  const place = entry.location ? `, ${entry.location}` : "";
  const description = entry.placeholder
    ? `A chapter of ${SUFFIX}'s career journal that has not been filled in yet.`
    : `${entry.role} at ${entry.company}${place}${entry.duration ? `, ${entry.duration}` : ""}. How the role came about, in six chapters.`;

  return {
    title: `${entry.company} — Experience | ${SUFFIX}`,
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
const forObject = (slug: string): Meta | null => {
  const entry = objectBySlug(slug);
  if (!entry) return null;

  return {
    title: `${entry.title} — ${entry.eyebrow} | ${SUFFIX}`,
    description: entry.description,
    url: `${site}/object/${slug}`,
    breadcrumb: [
      { name: SUFFIX, url: `${site}/` },
      { name: entry.title, url: `${site}/object/${slug}` },
    ],
  };
};

const projectMeta = new Map<string, Meta>();

const loadProjectMeta = async () => {
  if (projectMeta.size) return;
  const module = await previews.en();
  for (const preview of module.default) {
    projectMeta.set(preview.slug, {
      title: `${preview.title} — Project | ${SUFFIX}`,
      description: `${preview.title}: ${preview.description}. A project by ${SUFFIX}, ${profile.role}.`,
      url: `${site}/project/${preview.slug}`,
      breadcrumb: [
        { name: SUFFIX, url: `${site}/` },
        { name: "Projects", url: `${site}/#projects` },
        { name: preview.title, url: `${site}/project/${preview.slug}` },
      ],
    });
  }
};

const update = async () => {
  if (typeof document === "undefined") return;
  const fallback = readBase();

  // A dead end should say so in the tab and in a search result, and it must
  // not claim a canonical of its own — pointing it at the home page is what
  // tells a crawler there is nothing here worth indexing separately.
  if (notFound.value) {
    apply({
      title: `Page not found — ${SUFFIX}`,
      description: "There is no page at this address.",
      url: `${site}/`,
    });
    return;
  }

  if (experienceId.value) {
    apply(forExperience(experienceId.value) ?? fallback);
    return;
  }

  if (objectId.value) {
    apply(forObject(objectId.value) ?? fallback);
    return;
  }

  if (projectId.value) {
    // The previews are a lazy chunk. Show the base head until it lands rather
    // than blocking, then correct it — crawlers read the settled DOM.
    await loadProjectMeta();
    if (!projectId.value) return;
    apply(projectMeta.get(projectId.value) ?? fallback);
    return;
  }

  apply(fallback);
};

export const useHead = () => {
  watch(path, update, { immediate: true });
};
