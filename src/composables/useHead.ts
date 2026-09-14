import { watch } from "vue";
import { path, experienceId, projectId, objectId, notFound } from "./useRouteObserver";
import { previews } from "../content/projects/previews";
import { site } from "../content/profile";
import { SUFFIX, experienceMeta, objectMeta, projectMeta } from "../content/routeMeta";

import type { Crumb, Meta } from "../content/routeMeta";

/**
 * ─── PER-ROUTE HEAD ───────────────────────────────────────────────────────
 *
 * This is a single-page app that changes its URL with `history.pushState` and
 * never changed anything else. Every route, the home page, five project
 * pages, two experience stories, served the same `<title>`, the same
 * description and the same canonical, which is to say eight URLs that a
 * search engine cannot tell apart. The canonical was the worst of it: every
 * deep page was declaring itself a duplicate of the home page, which is an
 * instruction not to index it.
 *
 * So: one watcher, three tags. No library, `document.title` and two
 * `setAttribute` calls do the whole job, and a head manager would be four
 * dependencies to avoid writing them. The values themselves come from
 * `content/routeMeta.ts`, which the build also writes into a static HTML file
 * per route (`scripts/routePages.ts`).
 *
 * The base values live in index.html and are read back on first run, so the
 * home page keeps exactly what is in the static markup and only the deep
 * routes override it. A visit that starts on a deep route loads that route's
 * static file, whose head is not the home page's, so the build copies the home
 * title and description onto `<html data-home-title data-home-description>`.
 */

let base: Meta | null = null;

const readBase = (): Meta => {
  if (base) return base;
  const home = document.documentElement.dataset;
  base = {
    title: home.homeTitle ?? document.title,
    description: home.homeDescription ?? document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    url: `${site}/`,
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
 * renders. One tag, replaced in place, the home page removes it rather than
 * leaving a stale trail behind after a client-side navigation back. The static
 * route files ship the same tag with the same id, so it is reused, not doubled.
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

  // Open Graph and Twitter mirror the same three values, a card that says
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

const projectMetaBySlug = new Map<string, Meta>();

const loadProjectMeta = async () => {
  if (projectMetaBySlug.size) return;
  const module = await previews.en();
  for (const preview of module.default) projectMetaBySlug.set(preview.slug, projectMeta(preview));
};

const update = async () => {
  if (typeof document === "undefined") return;
  const fallback = readBase();

  // A dead end should say so in the tab and in a search result, and it must
  // not claim a canonical of its own, pointing it at the home page is what
  // tells a crawler there is nothing here worth indexing separately.
  if (notFound.value) {
    apply({
      title: `Page not found, ${SUFFIX}`,
      description: "There is no page at this address.",
      url: `${site}/`,
    });
    return;
  }

  if (experienceId.value) {
    apply(experienceMeta(experienceId.value) ?? fallback);
    return;
  }

  if (objectId.value) {
    apply(objectMeta(objectId.value) ?? fallback);
    return;
  }

  if (projectId.value) {
    // The previews are a lazy chunk. Show the base head until it lands rather
    // than blocking, then correct it, crawlers read the settled DOM.
    await loadProjectMeta();
    if (!projectId.value) return;
    apply(projectMetaBySlug.get(projectId.value) ?? fallback);
    return;
  }

  apply(fallback);
};

export const useHead = () => {
  watch(path, update, { immediate: true });
};
