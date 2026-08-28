import { watch } from "vue";
import { path, experienceId, projectId } from "./useRouteObserver";
import { experienceBySlug } from "../content/experience";
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

type Meta = { title: string; description: string; url: string };

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

const apply = ({ title, description, url }: Meta) => {
  document.title = title;

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
  const description = entry.placeholder
    ? `A chapter of ${SUFFIX}'s career journal that has not been filled in yet.`
    : `${entry.role} at ${entry.company}${entry.duration ? `, ${entry.duration}` : ""}. How the role came about, in six chapters.`;

  return {
    title: `${entry.company} — Experience | ${SUFFIX}`,
    description,
    url: `${site}/experience/${slug}`,
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
    });
  }
};

const update = async () => {
  if (typeof document === "undefined") return;
  const fallback = readBase();

  if (experienceId.value) {
    apply(forExperience(experienceId.value) ?? fallback);
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
