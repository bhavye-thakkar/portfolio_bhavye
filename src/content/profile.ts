/**
 * ─── PORTFOLIO DATA ───────────────────────────────────────────────────────
 *
 * The single source for everything about the person rather than the work:
 * who, where, how to reach him, what he knows, what he has been certified in.
 * The HUD panels, the social row, the metadata and `public/llms.txt` all read
 * from here, so changing a link is one edit in one file.
 *
 * ── PROVENANCE ────────────────────────────────────────────────────────────
 *
 * Every value below was read off the live portfolio at
 * https://bhavyethakkar.netlify.app on 2026-08-28 — the skills table, the
 * certificate links and the project links came out of that site's own page
 * bundles, not out of a summary of them. Nothing here is inferred.
 *
 * Two rules this file exists to keep:
 *
 *   1. NOTHING IS INVENTED. A field with no verified value is empty or absent,
 *      never a plausible guess and never `"#"`. `certificates[].url` is the
 *      one that matters most: a card with a url becomes a real link, a card
 *      without one stays an unclickable HUD card.
 *
 *   2. NO WORK EXPERIENCE. The source site has a Work Experience section
 *      (companies, titles, dates). It is deliberately NOT imported and must
 *      not be added here — `content/experience.ts` owns that section and is
 *      written independently. This file is skills, certificates, projects,
 *      hackathons and contact details only.
 */

/**
 * ⚠ PLACEHOLDER DOMAIN. This is the origin the app stamps into per-route
 * canonicals and og:url. It is the same value as index.html's canonical,
 * public/sitemap.xml's <loc>s and public/robots.txt's Sitemap line — those
 * three are static files and have to be changed by hand in the same edit.
 *
 * Nothing ranks until this is the real domain: a canonical pointing at
 * example.com tells every crawler this page is a copy of somebody else's.
 */
export const site = "https://example.com";

/** Who and where. */
export const profile = {
  /** Display name used in the HUD; the full name is in the masthead and footer. */
  firstName: "Bhavye",
  fullName: "Bhavye Thakkar",
  /** The role line the source site leads with. */
  role: "Data Scientist and Flutter Engineer",
  /** `addressCountry` from the source site's Person schema. Nothing narrower is published. */
  country: "India",
  /**
   * The About copy, verbatim from the source site. Kept as one string rather
   * than split into the HUD's shorter lines, which live in the i18n bundle.
   */
  bio: "I craft digital products that merge creativity with technology. With hands-on experience in Flutter and AI/ML, I've built apps, explored data-driven solutions, and brought ideas to life at hackathons. What excites me most is solving real problems with simple, scalable tech—and leaving an impact that lasts.",
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
  /**
   * ⚠ PLACEHOLDER — no X account is published anywhere on the portfolio, so
   * this is the stand-in the social row shipped with and it does not resolve.
   * Put the real handle here, or drop the `x` entry from `social.ts`.
   * It is deliberately kept out of `sameAs` in the page's structured data:
   * pointing search engines at a profile that does not exist is worse than
   * listing one fewer profile.
   */
  x: "https://x.com/example",
} as const;

// There is deliberately no CV entry here. Nothing in the site links to one,
// and llms.txt does not publish one — adding it back means adding it in both
// places at once.

/**
 * The technical skills table from the source site's /skills page, with the
 * proficiency band it publishes for each one. `level` is that page's own
 * percentage — carried across so the number cannot drift from the label.
 */
export const skills = [
  { name: "Python", level: 75, tag: "Intermediate" },
  { name: "JavaScript", level: 75, tag: "Intermediate" },
  { name: "Flutter", level: 85, tag: "Advanced" },
  { name: "Pandas", level: 90, tag: "Advanced" },
  { name: "NumPy", level: 80, tag: "Advanced" },
  { name: "Seaborn", level: 80, tag: "Advanced" },
  { name: "Matplotlib", level: 80, tag: "Advanced" },
  { name: "TensorFlow", level: 65, tag: "Intermediate" },
  { name: "OpenCV", level: 30, tag: "Beginner" },
] as const satisfies { name: string; level: number; tag: string }[];

export const softSkills = ["Communication", "Problem-Solving", "Teamwork", "Time Management"] as const;

/**
 * The AI/ML subjects the source site's Person schema lists under `knowsAbout`,
 * minus the general-purpose web entries which are covered by `skills`.
 */
export const aiMl = [
  "Machine Learning",
  "Deep Learning",
  "Artificial Intelligence",
  "Computer Vision",
  "Data Science",
  "Data Analytics",
] as const;

/**
 * ── LLM ───────────────────────────────────────────────────────────────────
 *
 * The source site names no LLM technology anywhere — not in the skills table,
 * not in the project stacks, not in `knowsAbout`. This single entry is carried
 * over from THIS portfolio's own existing skills panel, which is the only
 * place it is claimed. Nothing has been added to it: inventing a LangChain or
 * an OpenAI here would be exactly the fabrication this file exists to prevent.
 *
 * If specific LLM work exists, name it here and it flows to the HUD and to
 * llms.txt at once.
 */
export const llm = ["Generative AI & LLMs"] as const;

/**
 * The HUD's skills panel, in the order and wording it has always used. This
 * is the portfolio's own list, kept as-is at the owner's instruction — it is
 * NOT the source site's skills table (that is `skills` above, which the
 * metadata and llms.txt publish).
 *
 * The two lists are allowed to differ, and the difference is deliberate: this
 * one is what a visitor reads on the stage, the other one is what a machine
 * reads and every entry in it is verifiable.
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
 * exact link the source site points at — none of them is reconstructed, and
 * none of them is a `#`. A card with an empty `url` renders as a plain card
 * rather than a dead link, so a future entry without a link is still safe.
 *
 * `note` is the sponsor line the source site prints under the organisation.
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

/**
 * ── SOURCE-SITE PROJECTS ──────────────────────────────────────────────────
 *
 * Recorded, not rendered. `content/projects/` owns the Projects grid: Garba
 * Circle is the one written-up case study and the rest are reserved slots by
 * design. Promoting one of these into a slot needs a real write-up and real
 * artwork, and the source site publishes a one-line description and a repo
 * link — turning that into a case study would mean writing fiction.
 *
 * So they live here with their verified links, which is what llms.txt
 * publishes and what a future promotion starts from. `demo` is null wherever
 * the source site had no destination; two of its cards linked to `"#"`, which
 * is a dead link and is deliberately not carried over.
 */
export const sourceProjects = [
  {
    title: "Mobile Finance App",
    description: "Flutter expense tracking app with budget analysis and financial insights.",
    tech: ["Flutter", "Python", "SQLAlchemy"],
    status: "In Progress",
    repo: "https://github.com/bhavye-thakkar/Expense-tracker",
    demo: null,
  },
  {
    title: "Stock Market Analyzer",
    description: "Stock prediction tool using machine learning, with real-time data and interactive charts.",
    tech: ["Python", "Streamlit", "yfinance", "scikit-learn"],
    status: "Completed",
    repo: "https://github.com/bhavye-thakkar/Stock_MArket-prediction-AI-ML",
    demo: null,
  },
  {
    title: "House Price Prediction",
    description: "Regression model for house prices behind an interactive Streamlit interface.",
    tech: ["Python", "Streamlit", "Pandas", "NumPy"],
    status: "Completed",
    repo: "https://github.com/bhavye-thakkar/house-price-prediction-with-the-help-of-streeamlit",
    demo: null,
  },
  {
    title: "Note Taking & Summarization",
    description: "Collaborative note-taking app with automatic summarisation.",
    tech: ["Flutter", "Python", "Firebase"],
    status: "Completed",
    repo: "https://github.com/bhavye-thakkar/note-taking-and-summarization-",
    demo: null,
  },
  {
    title: "To-Do App",
    description: "Task manager with real-time sync and collaborative lists.",
    tech: ["Flutter", "Firebase", "Dart"],
    status: "Completed",
    repo: null,
    demo: null,
  },
] as const satisfies {
  title: string;
  description: string;
  tech: readonly string[];
  status: string;
  repo: string | null;
  demo: string | null;
}[];

/**
 * Hackathons, as published on the source site's /hackathons page. Recorded
 * rather than rendered for the same reason as the projects above: this site
 * has no hackathons section, and adding one would be a redesign rather than a
 * content import. llms.txt publishes them.
 */
export const hackathons = [
  {
    name: "InnoNova — 24-Hour Hackathon",
    organisation: "Innovation Hub",
    date: "March 2025",
    role: "Team Lead",
    result: "Top 15 Finalist",
    tech: ["AI/ML", "Python", "TensorFlow"],
  },
  {
    name: "HackHertz",
    organisation: "Tech Community",
    date: "September 2025",
    role: "Team Lead",
    result: "Finalist",
    tech: ["React", "Node.js", "Mobile"],
  },
  {
    name: "Tic Tac Toe 2025",
    organisation: "DA-IICT, Gandhinagar",
    date: "April 2025",
    role: "Participant",
    result: "Participant",
    tech: ["Algorithms", "Game Theory", "Python"],
  },
  {
    name: "Smart India Hackathon 2024",
    organisation: "Government of India",
    date: "Aug–Sept 2024",
    role: "Participant",
    result: "Participant",
    tech: ["Civic Tech", "Full Stack"],
  },
] as const satisfies {
  name: string;
  organisation: string;
  date: string;
  role: string;
  result: string;
  tech: readonly string[];
}[];
