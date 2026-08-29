/**
 * ─── THE TWO OBJECTS THAT ANSWER FOR THEMSELVES ───────────────────────────
 *
 * The room is full of props. Two of them are not: the orchid on the shelf and
 * the painting on the wall were both chosen, and both are clickable, and both
 * open a page that says why. Everything a visitor reads on those pages is in
 * this file — the components render it and hold no copy of their own.
 *
 * ── RULES FOR EDITING THE COPY ────────────────────────────────────────────
 *
 *   1. It is about the OBJECT and the DECISION, not about the person. No
 *      claims of achievement, no biography, no adjectives applied to Bhavye.
 *      "The orchid is slow to bloom" is fair; "I am patient like an orchid"
 *      is not, and it is the exact sentence this file exists to prevent.
 *   2. Keep it short. Three paragraphs is the ceiling; two reads better.
 *   3. `facts` are verifiable — the painting's date and museum, the plant's
 *      species, the way the object is actually built in this scene. They are
 *      the reason the pages do not read as decoration with a caption.
 *
 * Changing the wording is one edit here. Adding a third object means adding
 * an entry here, a hotspot in `three/objects/room/`, and a `<url>` in
 * public/sitemap.xml — the route itself needs no change.
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
   * centre. Both are tuned by eye against the hero shot — see
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
    subtitle: "Phalaenopsis — modelled in code, not imported",
    statement: "It is the slowest thing in the room, and the only one that had to be grown.",
    body: [
      "An orchid does not reward hurry. It spends most of the year as leaves and roots, and the flowers arrive months after the work that produced them — which is a fair description of most software worth keeping.",
      "This one is not a downloaded prop. Every petal comes from the same small blade function, given its own jittered parameters, so no two blooms in the scene share geometry. That irregularity is the whole point: it is what separates a plant from a duplicated asset, and it only exists because someone sat with it.",
      "It also keeps the room honest. A workspace made entirely of screens and hardware says one thing about the person at the desk. A living thing on the shelf, tended rather than installed, says the other half.",
    ],
    facts: [
      { label: "Species", value: "Phalaenopsis (moth orchid)" },
      { label: "Built from", value: "One keeled-blade generator, ~14 meshes" },
      { label: "Blooms", value: "Each one seeded separately — no repeats" },
      { label: "Stands where", value: "The shelf's original potted plant used to" },
    ],
    hotspotLabel: "View why Bhavye chose the orchid",
    description:
      "Why an orchid sits on the shelf in Bhavye Thakkar's 3D portfolio — patience, slow growth, and a plant modelled petal by petal in code.",
    framing: { distance: 2.5, height: 0.15 },
  },
  {
    slug: "starry-night",
    eyebrow: "On the wall",
    title: "The Starry Night",
    subtitle: "Vincent van Gogh, 1889 — public domain",
    statement: "A night sky nobody had seen, because it was the first one someone thought to draw as motion.",
    body: [
      "Van Gogh painted this from a window in Saint-Rémy, mostly from memory, and put currents in the sky that are not visible to anyone standing under it. The stars are not wrong. They are the same stars, read differently — which is the part worth hanging on a wall.",
      "That is the job on a good day: look at something everyone has already looked at, notice the pattern underneath it, and then do the unglamorous work of making that visible to other people. The noticing is cheap. The turning-it-into-a-thing is not.",
      "It hangs here as a public-domain reproduction, baked into the room's own texture atlas at ninety-two by a hundred and six pixels — small enough that the brushwork had to be sharpened by hand to survive. Even the copy took tending.",
    ],
    facts: [
      { label: "Artist", value: "Vincent van Gogh (1853–1890)" },
      { label: "Painted", value: "June 1889, Saint-Rémy-de-Provence" },
      { label: "Held by", value: "The Museum of Modern Art, New York" },
      { label: "Rights", value: "Public domain — reproduction, not an imitation" },
    ],
    hotspotLabel: "View why Bhavye chose The Starry Night",
    description:
      "Why Van Gogh's The Starry Night hangs in Bhavye Thakkar's 3D portfolio — imagination, pattern-finding, and turning ideas into something you can look at.",
    framing: { distance: 3.1, height: 0.05 },
  },
];

export const objectSlugs = roomObjects.map((entry) => entry.slug);

export const objectBySlug = (slug: string): RoomObject | undefined =>
  roomObjects.find((entry) => entry.slug === slug);
