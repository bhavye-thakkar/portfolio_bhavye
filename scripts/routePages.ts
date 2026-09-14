import fs from "node:fs";
import path from "node:path";
import { runnerImport } from "vite";

import type { Plugin } from "vite";

/**
 * ─── A REAL HTML FILE FOR EVERY ROUTE ─────────────────────────────────────
 *
 * The app is one index.html and the hosts rewrote every path to it, so
 * /project/garbacircle answered with the HOME page's title, description,
 * canonical and <noscript> text. Google runs the JavaScript and can correct
 * that afterwards; most AI crawlers do not run it and saw the home page at
 * every URL. Even for Google the raw HTML declared every deep page a copy of
 * the home page (its canonical), which is an instruction not to index it.
 *
 * After the bundle is written, this copies the built index.html once per deep
 * route, `dist/project/garbacircle.html` and so on, with:
 *   · that route's head, from src/content/routeMeta.ts, the same values
 *     useHead.ts applies in the browser;
 *   · a <noscript> body written from the content files the page renders, so
 *     every word is one the page shows, plus links to every other page;
 *   · the home title and description on <html data-home-*>, which useHead
 *     needs for a visit that starts here and then navigates home.
 * The scripts are untouched: a browser boots the same app on the same route.
 *
 * The hosts map the clean URL onto the file (public/_redirects, vercel.json).
 * `vite preview` finds `<path>.html` on its own. `dist/404.html` is the app,
 * for the hosts to answer an unknown slug with a real 404 status.
 */

type Meta = { title: string; description: string; url: string; breadcrumb?: { name: string; url: string }[] };
type Chapter = { label: string; headline: string; body: string[]; meta?: string };
type Component = { type: string; props: Record<string, any> };
type Route =
  | {
      kind: "experience";
      meta: Meta;
      entry: { company: string; role: string; type: string; location: string; duration: string; chapter: string; statement: string; story: Chapter[] };
    }
  | {
      kind: "object";
      meta: Meta;
      entry: { eyebrow: string; title: string; subtitle: string; statement: string; body: string[]; facts: { label: string; value: string }[] };
    }
  | {
      kind: "project";
      meta: Meta;
      preview: { title: string; description: string };
      content?: { title: string; description?: string; live?: string; app?: string; components?: Component[] };
      tags: string[];
    };

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const escape = (value: string) => value.replace(/[&<>"]/g, (char) => ENTITIES[char]!);
/** JSON inside <script> must not be able to close the tag. */
const json = (value: unknown) => JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
const lines = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join("\n");
const paragraphs = (texts: string[]) => lines(...texts.map((text) => `<p>${escape(text)}</p>`));

// `text`, `items` and project `description` are authored HTML (<br/>, <strong>)
// and go in as written; every other field is plain text and is escaped.
const component = ({ type, props }: Component): string => {
  switch (type) {
    case "text":
      return lines(props.title && `<h2>${escape(props.title)}</h2>`, props.text && `<p>${props.text}</p>`);
    case "list":
      return lines(
        props.title && `<h2>${escape(props.title)}</h2>`,
        `<ul>${(props.items as string[]).map((item) => `<li>${item.replace(/<\/strong>/g, "</strong> ")}</li>`).join("")}</ul>`,
      );
    case "media":
      return `<figure><figcaption>${escape([props.caption, props.alt].filter(Boolean).join(": "))}</figcaption></figure>`;
    case "imageText":
      return lines(props.alt && `<p>${escape(props.alt)}</p>`, props.component && component(props.component));
    default:
      return "";
  }
};

const body = (route: Route) => {
  switch (route.kind) {
    case "experience": {
      const { entry } = route;
      return lines(
        `<h1>${escape(entry.company)}: ${escape(entry.role)}</h1>`,
        `<p>${escape([entry.chapter, entry.type, entry.location, entry.duration].filter(Boolean).join(", "))}</p>`,
        entry.statement && `<p>${escape(entry.statement)}</p>`,
        ...entry.story.map((chapter) =>
          lines(
            `<h2>${escape(chapter.label)}</h2>`,
            `<p><strong>${escape(chapter.headline)}</strong></p>`,
            paragraphs(chapter.body),
            chapter.meta && `<p>${escape(chapter.meta)}</p>`,
          ),
        ),
      );
    }
    case "object": {
      const { entry } = route;
      return lines(
        `<h1>${escape(entry.title)}</h1>`,
        `<p>${escape(entry.eyebrow)}. ${escape(entry.subtitle)}</p>`,
        `<p><strong>${escape(entry.statement)}</strong></p>`,
        paragraphs(entry.body),
        `<dl>${entry.facts.map((fact) => `<dt>${escape(fact.label)}</dt><dd>${escape(fact.value)}</dd>`).join("")}</dl>`,
      );
    }
    case "project": {
      const { content, preview, tags } = route;
      return lines(
        `<h1>${escape(content?.title ?? preview.title)}</h1>`,
        `<p>${escape(preview.description)}</p>`,
        content?.description && `<p>${content.description}</p>`,
        tags.length > 0 && `<p>Built with ${escape(tags.join(", "))}</p>`,
        content?.live && `<p><a href="${escape(content.live)}">${escape(content.live)}</a></p>`,
        content?.app && `<p><a href="${escape(content.app)}">${escape(content.app)}</a></p>`,
        ...(content?.components ?? []).map(component),
      );
    }
  }
};

/** Swaps the one tag a pattern finds, and fails the build if it is gone. */
const replace = (html: string, pattern: RegExp, replacement: string) => {
  if (!pattern.test(html)) throw new Error(`[route-pages] no match for ${pattern} in the built index.html`);
  return html.replace(pattern, () => replacement);
};

const metaTag = (attribute: "name" | "property", key: string) =>
  new RegExp(`<meta\\s+${attribute}="${key}"\\s+content="[^"]*"\\s*/?>`);

export const routePages = (): Plugin => {
  let root = "";
  let outDir = "";

  return {
    name: "route-pages",
    apply: "build",
    configResolved(config) {
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const { module } = await runnerImport<{ site: string; routes: Route[] }>(path.join(root, "src/content/routeData.ts"), {
        root,
        configFile: false,
        logLevel: "error",
      });
      const { site, routes } = module;

      const index = fs.readFileSync(path.join(outDir, "index.html"), "utf8");
      const homeTitle = (index.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").replace(/"/g, "&quot;");
      const homeDescription = index.match(metaTag("name", "description"))?.[0].match(/content="([^"]*)"/)?.[1] ?? "";
      const graphMatch = index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (!graphMatch) throw new Error("[route-pages] no JSON-LD graph in the built index.html");
      const graph = JSON.parse(graphMatch[1]!);

      const pathOf = (route: Route) => new URL(route.meta.url).pathname;
      const linkTo = (route: Route) => `<li><a href="${pathOf(route)}">${escape(route.meta.title.split(" | ")[0]!)}</a></li>`;

      for (const route of routes) {
        const { title, description, url, breadcrumb } = route.meta;
        const others = routes.filter((other) => other !== route);

        // The home page's ProfilePage node describes the home URL; here the
        // page is a WebPage of its own, still about the same Person.
        const pageGraph = {
          ...graph,
          "@graph": graph["@graph"].map((node: { "@type": string }) =>
            node["@type"] === "ProfilePage"
              ? {
                  "@type": "WebPage",
                  "@id": `${url}#webpage`,
                  url,
                  name: title,
                  description,
                  isPartOf: { "@id": `${site}/#website` },
                  about: { "@id": `${site}/#person` },
                  inLanguage: "en",
                }
              : node,
          ),
        };

        let html = index;
        html = replace(html, /<html lang="en">/, `<html lang="en" data-home-title="${homeTitle}" data-home-description="${homeDescription}">`);
        html = replace(html, /<title>[^<]*<\/title>/, `<title>${escape(title)}</title>`);
        html = replace(html, metaTag("name", "description"), `<meta name="description" content="${escape(description)}" />`);
        html = replace(html, /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`);
        html = replace(html, metaTag("property", "og:title"), `<meta property="og:title" content="${escape(title)}" />`);
        html = replace(html, metaTag("property", "og:description"), `<meta property="og:description" content="${escape(description)}" />`);
        html = replace(html, metaTag("property", "og:type"), `<meta property="og:type" content="article" />`);
        html = replace(html, metaTag("property", "og:url"), `<meta property="og:url" content="${url}" />`);
        html = replace(html, metaTag("name", "twitter:title"), `<meta name="twitter:title" content="${escape(title)}" />`);
        html = replace(html, metaTag("name", "twitter:description"), `<meta name="twitter:description" content="${escape(description)}" />`);
        html = replace(html, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${json(pageGraph)}\n    </script>`);
        if (breadcrumb) {
          const crumbs = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: breadcrumb.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, name: crumb.name, item: crumb.url })),
          };
          html = replace(html, /<\/head>/, `    <script type="application/ld+json" id="route-breadcrumb">${json(crumbs)}</script>\n  </head>`);
        }
        html = replace(
          html,
          /<noscript>[\s\S]*?<\/noscript>/,
          `<noscript>\n    <main>\n${lines(
            `<p><a href="/">Bhavye Thakkar</a></p>`,
            body(route),
            `<h2>More from this portfolio</h2>`,
            `<ul><li><a href="/">Bhavye Thakkar, home</a></li>${others.map(linkTo).join("")}</ul>`,
          )}\n    </main>\n    </noscript>`,
        );

        const file = path.join(outDir, `${pathOf(route)}.html`);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, html);
      }

      fs.writeFileSync(path.join(outDir, "404.html"), index);
      this.info?.(`wrote ${routes.length} route pages and 404.html`);
    },
  };
};
