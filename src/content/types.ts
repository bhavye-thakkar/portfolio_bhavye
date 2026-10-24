import { projectIds } from "./projects/index";

import type { TagVariant } from "../components/tagVariants";
import type { ProjectComponent } from "../features/projects/types";

export type ProjectId = (typeof projectIds)[number];

export interface ProjectContent {
  title: string;
  theme: "light" | "dark";
  tags: TagVariant[];
  description?: string;
  videoBorder?: boolean;
  live?: string;
  /** application build (store page, APK, TestFlight…), shown as its own button */
  app?: string;
  /** an Android package to download, a path under public/downloads, shown as a download button */
  apk?: string;
  source?: string;
  components?: ProjectComponent[];
}

export interface SkillContent {
  name: string;
  bullets: string[];
}

export interface ProjectPreview {
  title: string;
  slug: string;
  thumbnail: string;
  description: string;
  /**
   * One or two factual sentences for search results and structured data, taken
   * from what the case study itself shows. A reserved slot has none, and so
   * gets neither a search description of its own nor a schema.org node.
   */
  summary?: string;
}
