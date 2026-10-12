/**
 * ─── THE LIBRARY ──────────────────────────────────────────────────────────
 *
 * Every book on /library and every book page under it comes from this file;
 * the components render it and hold no copy of their own. Adding a book is
 * one entry here, its slug on a shelf below, and two cover files in
 * public/library (`<slug>-240.webp` and `<slug>-480.webp`; the 480 one's
 * pixel size goes in `cover`). The route, the sitemap entry and the static
 * page come from the data, except public/sitemap.xml, which is a static file
 * and takes a <url> block by hand.
 *
 * ── RULES ─────────────────────────────────────────────────────────────────
 *
 *   1. NOTHING ABOUT THE READER IS INVENTED. `description` is a factual line
 *      about the book (what it is, who wrote it, when). `personalNote` is the
 *      owner's own words or `null`, and the page says "no note yet" rather
 *      than pretending. No ratings, no "status", no reading dates unless the
 *      owner adds a field for them.
 *   2. Metadata was checked against Open Library on 2026-10-06 (title,
 *      author, series, first publication), and the six books added on
 *      2026-10-12 against Open Library and Penguin India's catalogue. Years
 *      are first publication, not the edition on the shelf. `year` is a
 *      string because one of them is "c. 180".
 *   3. Covers are the publishers' own, fetched from Open Library's covers
 *      service by ISBN or cover id, resized and re-encoded here. No generated
 *      art, no substitutes.
 *   4. Shelf names are editorial groupings, not the owner's words; rename
 *      them freely.
 */

export interface Book {
  /** URL segment: /library/<slug>, and the cover file name. */
  slug: string;
  title: string;
  /** As credited on the cover; co-authors joined with "and". */
  author: string;
  /** First publication. */
  year: string;
  /**
   * Page count, the median across the book's editions on Open Library
   * (2026-10-07), so approximate. It sets the spine's thickness on the shelf
   * and is shown as "about N pages".
   */
  pages: number;
  series?: { name: string; volume: number; of?: number };
  /** One or two factual sentences about the book. */
  description: string;
  /** The owner's note, or null for "not written yet". */
  personalNote: string | null;
  /** Pixel size of `<slug>-480.webp`: the aspect ratio the shelf lays out from, before the image loads. */
  cover: { width: number; height: number };
  /**
   * The spine's colour on the shelf, as a hex string. Taken from the cover
   * itself (the most populated saturated tone, scripts in the QA folder), not
   * chosen; the spine is typographic because publishers' spine artwork is
   * not something that can be sourced for every book.
   */
  spine: string;
}

export interface Shelf {
  slug: string;
  title: string;
  /** Book slugs in shelf order. */
  books: string[];
}

export const books: Book[] = [
  {
    slug: "meditations",
    title: "Meditations",
    author: "Marcus Aurelius",
    year: "c. 180",
    pages: 203,
    description:
      "The private notebooks of a Roman emperor, written in Greek between campaigns and never meant for readers; the most-read text of Stoic practice.",
    personalNote: null,
    cover: { width: 480, height: 740 },
    spine: "#011221",
  },
  {
    // Felix Dennis's book of this exact title (Ebury, 2006). If the shelf
    // holds a different "How to Get Rich", change the entry and the cover.
    slug: "how-to-get-rich",
    title: "How to Get Rich",
    author: "Felix Dennis",
    year: "2006",
    pages: 304,
    description:
      "The founder of Dennis Publishing on how he made his money, written in the first person as an account rather than a method.",
    personalNote: null,
    cover: { width: 480, height: 776 },
    spine: "#eeebea",
  },
  {
    slug: "the-subtle-art-of-not-giving-a-fck",
    title: "The Subtle Art of Not Giving a F*ck",
    author: "Mark Manson",
    year: "2016",
    pages: 224,
    description:
      "An argument for choosing what to care about and accepting limits, written against the relentless positivity of the shelf it sits on.",
    personalNote: null,
    cover: { width: 480, height: 718 },
    spine: "#ea5110",
  },
  {
    slug: "how-to-win-friends-and-influence-people",
    title: "How to Win Friends and Influence People",
    author: "Dale Carnegie",
    year: "1936",
    pages: 283,
    description:
      "Carnegie's handbook of dealing with people, built from the courses he taught in the 1930s; still in print and still the reference most others cite.",
    personalNote: null,
    cover: { width: 480, height: 776 },
    spine: "#550007",
  },
  {
    slug: "rich-dad-poor-dad",
    title: "Rich Dad Poor Dad",
    author: "Robert T. Kiyosaki",
    year: "1997",
    pages: 243,
    description:
      "Two father figures and what each taught the author about money, assets and work; the book that started the Rich Dad series.",
    personalNote: null,
    cover: { width: 480, height: 720 },
    spine: "#5c504b",
  },
  {
    slug: "ikigai",
    title: "Ikigai: The Japanese Secret to a Long and Happy Life",
    author: "Héctor García and Francesc Miralles",
    year: "2016",
    pages: 208,
    description:
      "A short book on the Japanese idea of a reason for being, built around the authors' interviews in Ogimi, the Okinawan village known for its long-lived residents.",
    personalNote: null,
    cover: { width: 480, height: 672 },
    spine: "#cee1e9",
  },
  {
    slug: "the-alchemist",
    title: "The Alchemist",
    author: "Paulo Coelho",
    year: "1988",
    pages: 197,
    description:
      "Santiago, an Andalusian shepherd, follows a recurring dream to the pyramids of Egypt. First published in Portuguese and since translated into more than eighty languages.",
    personalNote: null,
    cover: { width: 480, height: 726 },
    spine: "#dfd6b6",
  },
  {
    slug: "war-of-lanka",
    title: "War of Lanka",
    author: "Amish Tripathi",
    year: "2022",
    pages: 500,
    series: { name: "Ram Chandra Series", volume: 4 },
    description:
      "The fourth book of the Ram Chandra Series, where the three earlier books' separate tracks, Ram's, Sita's and Raavan's, meet in the war at Lanka.",
    personalNote: null,
    cover: { width: 480, height: 738 },
    spine: "#5d2110",
  },
  {
    slug: "raavan-enemy-of-aryavarta",
    title: "Raavan: Enemy of Aryavarta",
    author: "Amish Tripathi",
    year: "2019",
    pages: 400,
    series: { name: "Ram Chandra Series", volume: 3 },
    description:
      "The third book of the Ram Chandra Series and the third of its parallel narratives: the antagonist's life up to the point where the three stories converge.",
    personalNote: null,
    cover: { width: 480, height: 770 },
    spine: "#541f2a",
  },
  {
    slug: "sita-warrior-of-mithila",
    title: "Sita: Warrior of Mithila",
    author: "Amish Tripathi",
    year: "2017",
    pages: 380,
    series: { name: "Ram Chandra Series", volume: 2 },
    description:
      "The second book of the Ram Chandra Series: Sita's own story, told in parallel with Ram's from the first book and up to the same moment.",
    personalNote: null,
    cover: { width: 480, height: 738 },
    spine: "#dea186",
  },
  {
    slug: "the-psychology-of-money",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    year: "2020",
    pages: 288,
    description:
      "Nineteen short chapters on how people actually behave with money, by a former columnist for The Motley Fool and The Wall Street Journal.",
    personalNote: null,
    cover: { width: 480, height: 782 },
    spine: "#cbc8c0",
  },
  {
    slug: "atomic-habits",
    title: "Atomic Habits",
    author: "James Clear",
    year: "2018",
    pages: 323,
    description:
      "A system for building habits out of small changes, organised around four laws of behaviour change; one of the best-selling non-fiction books of recent years.",
    personalNote: null,
    cover: { width: 480, height: 726 },
    spine: "#f3f3e8",
  },
  {
    slug: "the-monk-who-sold-his-ferrari",
    title: "The Monk Who Sold His Ferrari",
    author: "Robin Sharma",
    year: "1997",
    pages: 216,
    description:
      "A fable: a litigator collapses in court, sells everything and returns from the Himalayas with a set of principles, told to a former colleague over one night.",
    personalNote: null,
    cover: { width: 480, height: 764 },
    spine: "#e8e1c7",
  },
  {
    slug: "do-epic-shit",
    title: "Do Epic Shit",
    author: "Ankur Warikoo",
    year: "2021",
    pages: 312,
    description:
      "Short entries on failure, money, habits and work, collected from the author's posts and talks; his first book.",
    personalNote: null,
    cover: { width: 480, height: 754 },
    spine: "#f9ee17",
  },
  {
    slug: "the-immortals-of-meluha",
    title: "The Immortals of Meluha",
    author: "Amish Tripathi",
    year: "2010",
    pages: 416,
    series: { name: "Shiva Trilogy", volume: 1, of: 3 },
    description:
      "The first book of the Shiva Trilogy, which retells the god Shiva as a Tibetan tribal leader who arrives in the empire of Meluha in 1900 BC.",
    personalNote: null,
    cover: { width: 480, height: 722 },
    spine: "#0c5c5f",
  },
  {
    slug: "the-secret",
    title: "The Secret",
    author: "Rhonda Byrne",
    year: "2006",
    pages: 216,
    description:
      "The book of the 2006 film of the same name, on the “law of attraction”: the idea that what a person thinks shapes what happens to them.",
    personalNote: null,
    cover: { width: 480, height: 608 },
    spine: "#a55b36",
  },
  {
    slug: "cant-hurt-me",
    title: "Can't Hurt Me",
    author: "David Goggins",
    year: "2018",
    pages: 364,
    description:
      "The memoir of a former Navy SEAL and ultramarathoner, with a challenge set at the end of each chapter.",
    personalNote: null,
    cover: { width: 480, height: 720 },
    spine: "#af8b3d",
  },
  {
    // Open Library dates the first edition 2021; Penguin's own edition (Ebury
    // Press, ISBN 9780143455691, the cover shown) is February 2022, 256 pages.
    slug: "the-hidden-hindu",
    title: "The Hidden Hindu",
    author: "Akshat Gupta",
    year: "2021",
    pages: 256,
    series: { name: "The Hidden Hindu", volume: 1, of: 3 },
    description:
      "A thriller in which Prithvi, twenty-one, searches for Om Shastri, an aghori who claims to have lived through all four yugas; the first book of Akshat Gupta's trilogy.",
    personalNote: null,
    cover: { width: 480, height: 744 },
    spine: "#a77a63",
  },
  {
    // Penguin Ebury Press, August 2022, ISBN 9780143456544, 250 pages.
    slug: "the-hidden-hindu-2",
    title: "The Hidden Hindu 2",
    author: "Akshat Gupta",
    year: "2022",
    pages: 250,
    series: { name: "The Hidden Hindu", volume: 2, of: 3 },
    description:
      "The second book of the trilogy: the book of Mritsanjeevani is in Nagendra's hands and the search turns to a hidden verse, with Om no longer alone.",
    personalNote: null,
    cover: { width: 480, height: 746 },
    spine: "#5c4238",
  },
  {
    // Penguin Ebury Press, March 2023, ISBN 9780143456551, 256 pages. Open
    // Library has no record of this one; the publisher's catalogue was the source.
    slug: "the-hidden-hindu-3",
    title: "The Hidden Hindu 3",
    author: "Akshat Gupta",
    year: "2023",
    pages: 256,
    series: { name: "The Hidden Hindu", volume: 3, of: 3 },
    description:
      "The trilogy's finale: Nagendra returns from the dead more powerful than before, and the immortals race him for the last of the hidden words.",
    personalNote: null,
    cover: { width: 480, height: 744 },
    spine: "#221403",
  },
  {
    slug: "the-daily-stoic",
    title: "The Daily Stoic",
    author: "Ryan Holiday and Stephen Hanselman",
    year: "2016",
    pages: 416,
    description:
      "A page for every day of the year: a passage from Seneca, Epictetus or Marcus Aurelius with a short commentary, translated and arranged by the authors.",
    personalNote: null,
    cover: { width: 480, height: 764 },
    spine: "#e1d3b3",
  },
  {
    slug: "think-and-grow-rich",
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    year: "1937",
    pages: 257,
    description:
      "Hill's thirteen principles of success, which he presented as drawn from his interviews with wealthy Americans of the early twentieth century, Andrew Carnegie among them.",
    personalNote: null,
    cover: { width: 480, height: 684 },
    spine: "#eeece4",
  },
  {
    slug: "shoe-dog",
    title: "Shoe Dog",
    author: "Phil Knight",
    year: "2016",
    pages: 386,
    description:
      "The memoir of Nike's co-founder, from a 1962 plan to import Japanese running shoes through the company's first years, ending in 1980.",
    personalNote: null,
    cover: { width: 480, height: 726 },
    spine: "#1c0700",
  },
  {
    slug: "white-nights",
    title: "White Nights",
    author: "Fyodor Dostoevsky",
    year: "1848",
    pages: 126,
    description:
      "A novella in four nights and a morning: a lonely dreamer in St Petersburg meets Nastenka on a bridge. Written early in Dostoevsky's career.",
    personalNote: null,
    cover: { width: 480, height: 694 },
    spine: "#020202",
  },
  {
    slug: "the-secret-of-the-nagas",
    title: "The Secret of the Nagas",
    author: "Amish Tripathi",
    year: "2011",
    pages: 412,
    series: { name: "Shiva Trilogy", volume: 2, of: 3 },
    description:
      "The second book of the Shiva Trilogy, following Shiva's search for the Nagas after the end of The Immortals of Meluha.",
    personalNote: null,
    cover: { width: 480, height: 752 },
    spine: "#5a513e",
  },
  {
    slug: "the-oath-of-the-vayuputras",
    title: "The Oath of the Vayuputras",
    author: "Amish Tripathi",
    year: "2013",
    pages: 575,
    series: { name: "Shiva Trilogy", volume: 3, of: 3 },
    description:
      "The last book of the Shiva Trilogy, which closes the question the series is built around: what evil is, and who has to fight it.",
    personalNote: null,
    cover: { width: 480, height: 744 },
    spine: "#5e220e",
  },
  {
    slug: "the-power-of-habit",
    title: "The Power of Habit",
    author: "Charles Duhigg",
    year: "2012",
    pages: 404,
    description:
      "A New York Times reporter on the science of habits, built around the cue, routine and reward loop and told through case studies of companies and individuals.",
    personalNote: null,
    cover: { width: 480, height: 622 },
    spine: "#f3d734",
  },
  {
    // Westland, 2015 (ISBN 9789385152146, the cover shown). Open Library's
    // median page count across its editions.
    slug: "ram-scion-of-ikshvaku",
    title: "Ram: Scion of Ikshvaku",
    author: "Amish Tripathi",
    year: "2015",
    pages: 353,
    series: { name: "Ram Chandra Series", volume: 1 },
    description:
      "The first book of Amish Tripathi's Ram Chandra Series, a retelling of the Ramayana that follows Ram from his birth in Ayodhya to his exile.",
    personalNote: null,
    cover: { width: 480, height: 720 },
    spine: "#663b2a",
  },
  {
    // Berrett-Koehler, 2001; the cover shown is the third edition (2017,
    // ISBN 9781626569416). Page count is Open Library's median across editions.
    slug: "eat-that-frog",
    title: "Eat That Frog!",
    author: "Brian Tracy",
    year: "2001",
    pages: 128,
    description:
      "Brian Tracy's short book on procrastination, built around twenty-one ways to start with the hardest task; a third edition appeared in 2017.",
    personalNote: null,
    cover: { width: 480, height: 698 },
    spine: "#92c844",
  },
  {
    // Penguin Ebury Press, April 2024, ISBN 9780143469131, 184 pages; the cover
    // shown is the updated and revised edition.
    slug: "i-dont-love-you-anymore",
    title: "I Don't Love You Anymore",
    author: "Rithvik Singh",
    year: "2024",
    pages: 184,
    description:
      "Poems and short prose on heartbreak and moving on, subtitled Moving On and Living Your Best Life; a 2024 bestseller in India.",
    personalNote: null,
    cover: { width: 480, height: 640 },
    spine: "#ebb74f",
  },
];

export const shelves: Shelf[] = [
  {
    slug: "stories",
    title: "Stories and epics",
    books: [
      "the-immortals-of-meluha",
      "the-secret-of-the-nagas",
      "the-oath-of-the-vayuputras",
      "ram-scion-of-ikshvaku",
      "sita-warrior-of-mithila",
      "raavan-enemy-of-aryavarta",
      "war-of-lanka",
      "the-hidden-hindu",
      "the-hidden-hindu-2",
      "the-hidden-hindu-3",
      "the-alchemist",
      "white-nights",
    ],
  },
  {
    slug: "mind",
    title: "Mind and habit",
    books: [
      "meditations",
      "the-daily-stoic",
      "atomic-habits",
      "the-power-of-habit",
      "eat-that-frog",
      "the-subtle-art-of-not-giving-a-fck",
      "ikigai",
      "the-monk-who-sold-his-ferrari",
      "cant-hurt-me",
      "i-dont-love-you-anymore",
    ],
  },
  {
    slug: "work",
    title: "Work and money",
    books: [
      "rich-dad-poor-dad",
      "the-psychology-of-money",
      "think-and-grow-rich",
      "how-to-get-rich",
      "shoe-dog",
      "do-epic-shit",
      "how-to-win-friends-and-influence-people",
      "the-secret",
    ],
  },
];

export const bookSlugs = books.map((book) => book.slug);

export const bookBySlug = (slug: string): Book | undefined => books.find((book) => book.slug === slug);

export const shelfOf = (slug: string): Shelf | undefined => shelves.find((shelf) => shelf.books.includes(slug));

/** `public/library/<slug>-<size>.webp`, 240 or 480 pixels wide. */
export const coverSrc = (slug: string, size: 240 | 480) => `/library/${slug}-${size}.webp`;

export const coverSrcset = (slug: string) => `${coverSrc(slug, 240)} 240w, ${coverSrc(slug, 480)} 480w`;
