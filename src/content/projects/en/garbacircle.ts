import garbacircleArtwork from "../../../assets/thumbnails/garbacircle.webp";

import type { ProjectContent } from "../../types";

/**
 * The only project with its real write-up. Everything below is true, the
 * title, the copy, the stack, the links, the feature list and now the artwork:
 * the app's own key art, which is also the card in the Projects grid (see
 * `previews/en.ts`). One file for both, so the card and the page cannot drift.
 *
 * The features are a list rather than six captioned media blocks on purpose.
 * They used to be six screenshots borrowed from an unrelated project. As text
 * they are still the real content, and there is one image instead of six.
 *
 * To finish it: drop real captures into
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
  // pre-register, so there is no store page yet, drop the Play/App Store URL
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
        src: garbacircleArtwork,
        alt: "Garba Circle key art: the app's logo beside a dancer holding dandiya sticks",
        caption: "Play. Dance. Connect.",
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
