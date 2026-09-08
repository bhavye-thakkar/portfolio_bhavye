/**
 * ─── PORTFOLIO DATA ───────────────────────────────────────────────────────
 *
 * The single source for everything about the person rather than the work:
 * who, where, how to reach him, what he knows, what he has been certified in.
 * The HUD panels, the social row and the metadata read from here, and
 * `public/llms.txt` mirrors it by hand, so changing a link is one edit in one
 * file (and one line in llms.txt).
 *
 * Two rules this file exists to keep:
 *
 *   1. NOTHING IS INVENTED. A field with no verified value is empty or absent,
 *      never a plausible guess and never `"#"`. `certificates[].url` is the
 *      one that matters most: a card with a url becomes a real link, a card
 *      without one stays an unclickable HUD card.
 *
 *   2. ONLY WHAT THE SITE SHOWS. There used to be a second skills table, a
 *      list of repositories and a list of hackathons in here, imported from an
 *      older portfolio and published only through llms.txt. None of it was
 *      rendered on this site, and the owner's rule (2026-09-08) is that the
 *      machine-readable summary lists exactly the projects and skills a
 *      visitor sees, no fewer and no more. So they are gone, and llms.txt
 *      reads `skillHighlights`, the Projects grid and the certificates below.
 *
 *   3. NO WORK EXPERIENCE. `content/experience.ts` owns that section and is
 *      written independently.
 */

/**
 * ── THE CANONICAL ORIGIN ──────────────────────────────────────────────────
 *
 * The origin the app stamps into per-route canonicals and og:url. The same
 * value appears in index.html's canonical, public/sitemap.xml's <loc>s,
 * public/robots.txt's Sitemap line and public/llms.txt; those four are static
 * files and have to be changed by hand in the same edit.
 *
 * ONE value, even though this build is deployed to several of the addresses in
 * `portfolioLinks` below. That is the point of a canonical: every mirror
 * serves this same tag, which tells a crawler which copy is the original
 * instead of leaving five identical sites competing with each other. The other
 * addresses are published as `sameAs` in index.html's Person graph and listed
 * in llms.txt, which is where an alternative address genuinely belongs.
 */
export const site = "https://bhavyethakkar.netlify.app";

/** Who and where. */
export const profile = {
  /** Display name used in the HUD; the full name is in the masthead and footer. */
  firstName: "Bhavye",
  fullName: "Bhavye Thakkar",
  /** The role line the site leads with. */
  role: "Data Scientist and Flutter Engineer",
  /** `addressCountry` in the Person schema. Nothing narrower is published here. */
  country: "India",
  /** The About copy. Kept as one string; the HUD's shorter lines live in the i18n bundle. */
  bio: "I craft digital products that merge creativity with technology. With hands-on experience in Flutter and AI/ML, I've built apps, explored data-driven solutions, and brought ideas to life at hackathons. What excites me most is solving real problems with simple, scalable tech-and leaving an impact that lasts.",
} as const;

export const contact = {
  email: "thakkarbhavye1425@gmail.com",
  get mailto() {
    return `mailto:${this.email}`;
  },
} as const;

export const profiles = {
  github: "https://github.com/bhavye-thakkar",
  linkedin: "https://www.linkedin.com/in/bhavyethakkar/",
  /** The owner's own handle (supplied 2026-09-09); also in index.html's `sameAs` and llms.txt. */
  x: "https://x.com/bhavye_thakkar",
} as const;

/**
 * ── EVERY SITE HE PUBLISHES ───────────────────────────────────────────────
 *
 * One array. Adding or retiring an address is one edit here and nowhere else,
 * which is the whole reason it is not written into a component.
 *
 * ⚠ THESE DO NOT RENDER AS A LIST ANYWHERE, AND MUST NOT AGAIN. There used to
 * be a "Portfolio / Other websites" block under the Contact icons: five hosts
 * stacked with no way to tell them apart, which is a link dump rather than a
 * call to action. Removed on the owner's instruction (2026-09-03), component
 * and i18n keys deleted with it. The addresses stayed because they are still
 * true and still useful to a machine: `site` above is the canonical, these are
 * its mirrors, and they are published in index.html's `sameAs` and in
 * `public/llms.txt`. That is the whole of their job.
 *
 * The FIRST entry is the primary portfolio and the one `site` points at: it is
 * the address the CV itself prints.
 *
 * ⚠ URLS ARE VERBATIM. These are the addresses the owner supplied, character
 * for character; all five answered 200 when they went in. The label is just
 * the host with the scheme dropped, because that is the only thing that
 * honestly distinguishes one from another without opening it, and inventing
 * "the React one" or "the older one" would be a guess about their contents.
 */
export const portfolioLinks = [
  { label: "bhavyethakkar.netlify.app", url: "https://bhavyethakkar.netlify.app/", primary: true },
  { label: "bhavye.vercel.app", url: "https://bhavye.vercel.app" },
  { label: "thakkarbhavya.netlify.app", url: "https://thakkarbhavya.netlify.app" },
  { label: "bhavyathakkar.netlify.app", url: "https://bhavyathakkar.netlify.app" },
  { label: "thakkarbhavye.netlify.app", url: "https://thakkarbhavye.netlify.app" },
] as const satisfies { label: string; url: string; primary?: boolean }[];

// The CV lives in `content/cv.ts`, transcribed from the PDF in `public/cv/`.
// Nothing here duplicates it: that document leads with a different role line,
// and the two are allowed to differ, see the header of `content/cv.ts`.

/**
 * The HUD's skills panel, in the order and wording it has always used. This
 * is THE skills list: what a visitor reads on the stage is what llms.txt and
 * index.html's `knowsAbout` publish, so the three cannot disagree.
 */
export const skillHighlights = [
  { name: "Three.js & WebGL" },
  { name: "Node.js & WebSockets" },
  { name: "React & Vue" },
  // Kubernetes removed on request. Redis went with it rather than being left
  // alone on the row: it was never a claim of its own, only the second half of
  // that label, and no verified skill exists to pair it with.
  { name: "Real-time Multiplayer" },
  { name: "FastAPI" },
  { name: "Python & TensorFlow" },
  { name: "Keras & scikit-learn" },
  { name: "Pandas & NumPy" },
  { name: "Matplotlib & Seaborn" },
  { name: "Computer Vision & NLP" },
  { name: "Generative AI & LLMs" },
  { name: "Machine Learning" },
  { name: "Deep Learning" },
] as const satisfies { name: string }[];

/**
 * Certificates, with the real destination behind each one. Every `url` is the
 * exact link the card points at, none of them is reconstructed, and none of
 * them is a `#`. A card with an empty `url` renders as a plain card rather
 * than a dead link, so a future entry without a link is still safe.
 *
 * `note` is the sponsor line printed under the organisation.
 */
export const certificates = [
  {
    organisation: "Edunet Foundation",
    note: "Sponsored by SAP",
    name: "Artificial Intelligence / Machine Learning (AI/ML)",
    year: "2024",
    url: "https://drive.google.com/file/d/1cy62eOolwDnVRfcP5BY2luChQY9k8t66/view",
    image: null,
  },
  {
    organisation: "GeeksforGeeks",
    note: null,
    name: "TensorFlow Certification",
    year: "2024",
    url: "https://drive.google.com/file/d/1A6JV-YtU8XLByb0hWmTmDmGu_kzdhak9/view",
    image: null,
  },
  {
    organisation: "Deloitte",
    note: null,
    name: "Data Analytics",
    year: "2025",
    url: "https://drive.google.com/file/d/1LR1f5aJhqdCBf6lJyazxB8ISPXdW9WrN/view",
    image: null,
  },
  {
    organisation: "Intel®",
    note: null,
    name: "Intel® Applied AI",
    year: "2022",
    url: "https://drive.google.com/file/d/1NjFWw2v-8CZT8ImyxrOq4eMZBASpFJM4/view",
    image: null,
  },
  {
    organisation: "Oracle",
    note: null,
    name: "Data Science Professional",
    year: "2025",
    url: "https://drive.google.com/file/d/1qe64-45D5WFgawEeiUnB24M1HmTlbknh/view?usp=drive_link",
    image: null,
  },
] as const satisfies {
  organisation: string;
  note: string | null;
  name: string;
  year: string;
  url: string;
  image: string | null;
}[];
