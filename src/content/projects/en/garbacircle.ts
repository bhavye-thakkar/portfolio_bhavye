import groundMapVideo from "../../../assets/projects/garbacircle/ground-map.mp4";
import groundMapPoster from "../../../assets/projects/garbacircle/ground-map.webp";
import groundDetails from "../../../assets/projects/garbacircle/ground-details.webp";
import groupsColoursVideo from "../../../assets/projects/garbacircle/groups-colours.mp4";
import groupsColoursPoster from "../../../assets/projects/garbacircle/groups-colours.webp";
import dayColours from "../../../assets/projects/garbacircle/day-colours.webp";

import type { ProjectContent } from "../../types";

/**
 * ─── GARBA CIRCLE, THE CASE STUDY ─────────────────────────────────────────
 *
 * Every picture and clip below is the real app, recorded on an Android phone
 * over adb from the owner's own debug build (2026-09-13). The phone screens were
 * cut and composed into 16:9 tiles: ffmpeg for the trims, dissolves, status bar
 * crop and rounded corners, CapCut CLI for the layout of each video tile (the
 * editable drafts are outside the repo), ffmpeg again for the web encode.
 *
 * Left out on purpose: the leaderboard (other people's names), the top of
 * Settings (the account's email and phone number), the live group map (members'
 * locations) and the group list and profile header (test data). The venue on
 * screen is a public event listing.
 *
 * THE WORDS COME FROM GARBACIRCLE.IN (owner, 2026-09-13). Every text on this
 * page is the product's own website copy, the English strings in the site's
 * `src/context/LanguageContext.tsx`, placed into the same blocks: the hero, "A
 * platform perfect for…", "More with Garba Circle", the nine day colours, the
 * waitlist and the footer. It describes the product the way the website does,
 * so it includes features that are not in the current app build (event feeds,
 * badges, city leaderboards, classes); that is the owner's call. The media
 * stays the real app. Keep "RassXP" as the website spells it.
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
    "The search ends. The ultimate garba app.<br/><br/>From your city to the garba floor. Discover major garba grounds, build your team, compete, and earn your place as a Garba champion, all from one beautiful app.",
  components: [
    {
      type: "media",
      props: {
        type: "video",
        src: groundMapVideo,
        poster: groundMapPoster,
        alt: "Garba Circle on three phones: Explore, the ground map opening a venue card, and the picker for ten cities",
        caption: "Smart ground maps",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "A platform perfect for…",
        text: "<strong>Garba Squads</strong> struggling with scattered WhatsApp groups and squad-based competitions, who need clarity, coordination, and team spirit in a single space. <strong>Ground Explorers</strong> who need to discover the best venues on time, stay updated on the latest events, and ensure a high-quality experience every night.<br/><br/><strong>Competitive Dancers</strong> seeking total visibility of leaderboards, predictable competition schedules, and data-driven recognition of their skills. <strong>Navratri Organizers</strong> that want complete ground management, lower coordination costs, and effortless scalability for their heritage events.",
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: groundDetails,
        alt: "The card for Mandavadi Garba: poster, rating, tags, price, about, Get Directions and Check In",
        caption: "Before you head out",
        focus: 17,
      },
    },
    {
      type: "list",
      props: {
        title: "More with Garba Circle",
        size: "lg",
        columns: 2,
        items: [
          "<strong>Live event feeds</strong>Stay in the loop with event announcements, lineup updates, and buzz from garba grounds across your city, all in one feed.",
          "<strong>Smart ground maps</strong>Browse every major garba venue on an interactive map. See entrance details and everything you need before you head out.",
          "<strong>Earn RassXP badges</strong>Complete challenges, check in nightly, and collect badges that show your journey from beginner to legend.",
          "<strong>City leaderboards</strong>Compete for the top spot in your city. Your squad's collective XP earns city-wide recognition.",
          "<strong>Garba classes</strong>Discover garba classes near you, view instructor details, call them directly, and inquire about timings, fees, and available batches.",
        ],
      },
    },
    {
      type: "media",
      props: {
        type: "video",
        src: groupsColoursVideo,
        poster: groupsColoursPoster,
        alt: "Joining a group, creating a group with an emoji, colours and days, and switching the accent colour in Settings",
        caption: "Garba squads",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Nine days, nine colours",
        text: "Every night of Navratri has its own colour: Day 1 Royal Blue, Day 2 Golden Yellow, Day 3 Emerald Green, Day 4 Lavender, Day 5 Festive Orange, Day 6 Cream Gold, Day 7 Crimson Red, Day 8 Sky Blue and Day 9 Royal Purple.",
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: dayColours,
        alt: "The Profile screen in the Emerald Green, Royal Blue and Festive Orange day colours",
        caption: "Nine Navratri days",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Join the waitlist for early access today",
        text: "Pre-register now for a surprise reward. It takes less than 1 minute to complete, and everyone who pre-registers receives bonus RassXP points when Garba Circle launches.",
      },
    },
    {
      type: "text",
      props: {
        title: "Stay in the loop",
        text: "Follow Garba Circle on Facebook and Instagram, and pre-register on garbacircle.in.",
      },
    },
  ],
} satisfies ProjectContent;
