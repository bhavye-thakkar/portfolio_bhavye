/**
 * ─── THE TWO OBJECTS THAT ANSWER FOR THEMSELVES ───────────────────────────
 *
 * The room is full of props. Two of them are not: the orchid on the shelf and
 * the painting on the wall were both chosen, and both are clickable, and both
 * open a page that says why. Everything a visitor reads on those pages is in
 * this file, the components render it and hold no copy of their own.
 *
 * ── RULES FOR EDITING THE COPY ────────────────────────────────────────────
 *
 *   1. Each object has its own register and must keep it. The ORCHID speaks
 *      in images and never names what it stands for, its meaning stays
 *      beneath the surface on purpose. Do not add a sentence that explains
 *      it: to a stranger the page must read as writing about a flower, and
 *      the words ex/girlfriend/relationship/love must never appear. The
 *      PAINTING speaks in first-person wonder, fascination with night and
 *      motion, not romance. First person is voice, not biography: neither
 *      page makes claims about Bhavye, praises him, or lists achievements.
 *   2. Keep it short. Three paragraphs is the ceiling; two reads better.
 *   3. `facts` are verifiable, the painting's date and museum, the plant's
 *      species, the way the object is actually built in this scene. They are
 *      the reason the pages do not read as decoration with a caption.
 *   4. Search terms (blue orchid, Starry Night, Three.js portfolio, and so
 *      on) live in `description` and the head tags, never inside the poem.
 *
 * Changing the wording is one edit here. Adding a third object means adding
 * an entry here, a hotspot in `three/objects/room/`, and a `<url>` in
 * public/sitemap.xml, the route itself needs no change.
 */

export interface RoomObject {
  /** URL segment: /object/<slug>. Must also match the hotspot that opens it. */
  slug: string;
  /** Small line above the title. */
  eyebrow: string;
  title: string;
  /** Attribution or classification, set under the title. */
  subtitle: string;
  /** The answer to "why is this here", in one sentence set large. */
  statement: string;
  /** The body. Two or three short paragraphs. */
  body: string[];
  /** Labelled facts, rendered as a definition list. Verifiable only. */
  facts: { label: string; value: string }[];
  /** Accessible name for the 3D hotspot and the keyboard link that mirrors it. */
  hotspotLabel: string;
  /** Meta description for /object/<slug>. One sentence, ~150 characters. */
  description: string;
  /**
   * How the camera frames it. `distance` is metres back along the line from
   * the object to the hero camera, `height` lifts the eye above the object's
   * centre. Both are tuned by eye against the hero shot, see
   * `animations/inspect.ts`, which computes the rest at runtime so a change to
   * the room's transform cannot leave a hard-coded camera behind.
   */
  framing: { distance: number; height: number };
}

export const roomObjects: RoomObject[] = [
  {
    slug: "orchid",
    eyebrow: "On the shelf",
    title: "The Orchid",
    subtitle: "Phalaenopsis, a blue orchid, grown in code",
    statement: "Nothing else in this room ever needed tending. That was the point of it.",
    body: [
      "Blue is the colour orchids almost never consent to. A Phalaenopsis will give you white, violet, a spill of deep pink, but a true blue orchid is rare enough that people have always treated it as something between a flower and a wish. This one keeps that impossibility quietly, on a shelf at desk height, where the morning light reaches first.",
      "An orchid keeps its own calendar. It spends most of the year as leaves and roots, indifferent to being watched, and then, long after expecting has worn itself out, it blooms all at once, as if no time had passed. Some presences are like that. They arrive once, without asking, and afterwards the room is never quite arranged around anything else.",
      "It was grown here petal by petal, each bloom given its own small irregularities, because the slow way was the only way that felt true. Some things stay beautiful not by asking to be remembered, but by quietly becoming the way a room remembers.",
    ],
    facts: [
      { label: "Species", value: "Phalaenopsis (moth orchid)" },
      { label: "Colour", value: "A blue found almost nowhere in nature" },
      { label: "Built from", value: "One keeled-blade generator, ~14 meshes" },
      { label: "Blooms", value: "Each one seeded separately, no repeats" },
    ],
    hotspotLabel: "View why Bhavye chose the orchid",
    description:
      "A blue orchid on the shelf of Bhavye Thakkar's interactive 3D portfolio, a Phalaenopsis grown petal by petal in Three.js, on rarity, patience, and what quietly stays.",
    framing: { distance: 2.5, height: 0.15 },
  },
  {
    slug: "starry-night",
    eyebrow: "On the wall",
    title: "The Starry Night",
    subtitle: "Vincent van Gogh, 1889, public domain",
    statement: "I have never managed to see it as a finished painting. The night in it is still moving.",
    body: [
      "Van Gogh painted the sky over Saint-Rémy mostly from memory, and put into it something no telescope has ever found: currents. Wind made visible. Stars that do not sit in the dark but burn wakes through it, the way lights do when you look at them through water. It is not the night sky as it is, it is the night as it feels to someone who cannot stop looking at it.",
      "That is what keeps me standing in front of it. Everyone had seen that sky; he looked until it moved. Then came the patient, unglamorous work of pinning the movement down in paint, imagination taken seriously enough to become a thing other people can stand in front of, a century later, in rooms he never saw. Every screen in this one is attempting a much smaller version of exactly that.",
      "It hangs here as a public-domain reproduction, baked into the room's own texture atlas at ninety-two by a hundred and six pixels, small enough that the brushwork had to be sharpened by hand to survive the shrinking. Even at that size, the sky refuses to hold still.",
    ],
    facts: [
      { label: "Artist", value: "Vincent van Gogh (1853–1890)" },
      { label: "Painted", value: "June 1889, Saint-Rémy-de-Provence" },
      { label: "Held by", value: "The Museum of Modern Art, New York" },
      { label: "Rights", value: "Public domain, reproduction, not an imitation" },
    ],
    hotspotLabel: "View why Bhavye chose The Starry Night",
    description:
      "Why Van Gogh's The Starry Night hangs in the 3D room of Bhavye Thakkar's Three.js portfolio, night, motion, and imagination made visible in an interactive art experience.",
    framing: { distance: 3.1, height: 0.05 },
  },
];

export const objectSlugs = roomObjects.map((entry) => entry.slug);

export const objectBySlug = (slug: string): RoomObject | undefined =>
  roomObjects.find((entry) => entry.slug === slug);
