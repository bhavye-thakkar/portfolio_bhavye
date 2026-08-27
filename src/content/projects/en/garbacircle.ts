import { PLACEHOLDER_IMAGE } from "../placeholder";

import type { ProjectContent } from "../../types";

/**
 * The only project with its real write-up. Everything below is true — the
 * title, the copy, the stack, the links and the feature list. The one stand-in
 * is the visual: the shared placeholder plate holds the hero slot until the
 * Garba Circle captures exist.
 *
 * The features are a list rather than six captioned media blocks on purpose.
 * They used to be six screenshots borrowed from an unrelated project, and
 * swapping those for six copies of the same plate would have read as a page
 * that failed to load. As text they are still the real content, and there is
 * one image instead of six identical ones.
 *
 * To finish it: drop the captures into
 * `src/assets/images/projects/garbacircle/`, import them, and turn each list
 * item back into its own `media` block with the same caption.
 */
export default {
  title: "Garba Circle",
  theme: "dark",
  tags: ["flutter", "node", "postgresql"],
  videoBorder: false,
  // ─── LINKS ──────────────────────────────────────────────────────────────
  // `live` is the website, `app` is the application build. The app is still on
  // pre-register, so there is no store page yet — drop the Play/App Store URL
  // into `app` and its button appears next to Live View.
  live: "https://garbacircle.in",
  app: "",
  description:
    "Garba Circle is a companion app for Navratri across Ahmedabad, Baroda and Surat. It brings together interactive ground maps, live event feeds, and squad leaderboards with RassXP badges that track a dancer's season.<br/><br/>The project started as a way to replace scattered WhatsApp groups and grew into a platform organisers use to run their own grounds.",
  components: [
    {
      type: "media",
      props: {
        type: "image",
        src: PLACEHOLDER_IMAGE,
        alt: "Garba Circle — artwork pending",
        caption: "Artwork pending",
      },
    },
    {
      type: "list",
      props: {
        title: "In the app",
        size: "md",
        items: [
          "Smart ground maps",
          "Live event feeds",
          "Earn RassXP badges",
          "City leaderboards",
          "Garba squads",
          "Pre-register",
        ],
      },
    },
  ],
} satisfies ProjectContent;
