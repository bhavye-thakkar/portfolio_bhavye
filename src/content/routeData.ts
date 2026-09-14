import projectPreviews from "./projects/previews/en";
import { experiences } from "./experience";
import { roomObjects } from "./objects";
import { site } from "./profile";
import { projectModules } from "./projects/index";
import { tagLabels } from "../components/tagVariants";
import { experienceMeta, objectMeta, projectMeta } from "./routeMeta";

import type { ProjectContent } from "./types";

/**
 * Every deep route with its head and the content its page renders, for the
 * build (scripts/routePages.ts), which writes a static HTML file per route. The
 * app never imports this file.
 *
 * Everything is imported statically and computed at load, including the
 * previews the app loads lazily: the build reads this through Vite's module
 * runner, which is closed as soon as the import resolves, so an `import()`
 * inside a function here fails when called.
 */

export { site };

export const routes = [
  ...experiences.map((entry) => ({ kind: "experience" as const, meta: experienceMeta(entry.slug)!, entry })),
  ...roomObjects.map((entry) => ({ kind: "object" as const, meta: objectMeta(entry.slug)!, entry })),
  ...projectPreviews.map((preview) => {
    const content = projectModules.en[preview.slug]?.default as ProjectContent | undefined;
    return {
      kind: "project" as const,
      meta: projectMeta(preview),
      preview,
      content,
      tags: (content?.tags ?? []).map((tag) => tagLabels[tag]),
    };
  }),
];
