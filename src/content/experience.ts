/**
 * ─── CAREER JOURNAL ───────────────────────────────────────────────────────
 *
 * The Experience section and the /experience/:slug story pages both read this
 * file and nothing else. Adding or reordering a company is: edit this array.
 * The section spacer, the camera beats, the scroll windows and the detail
 * routes all size themselves off it, see `sectionHeightVh` in
 * animations/transitions/experience.ts for how the scroll length is derived.
 *
 * NOTHING HERE MAY BE INVENTED. Entries with `placeholder: true` are honest
 * empty slots: they render as clearly-marked "to fill in" cards rather than
 * claiming a job that did not happen. Replace the company/role/location/
 * duration, drop the flag, and the entry becomes a real chapter.
 *
 * ── THE ORDER IS MOST RECENT FIRST ────────────────────────────────────────
 *
 * 01 Unispace (most recent), then 02 NotionMind (the startup one). The owner
 * chose this on 2026-09-10: a visitor reads the top card first, and the top
 * card should be where he is now, not where he began. The section still reads
 * as one journey, it just tells it in reverse, so `chapter` carries the
 * placement in words ("Most recent experience" / "Startup experience") rather
 * than leaving the number to imply a chronology it does not have.
 *
 * TWO COMPANIES, AND ONLY TWO. There is no reserved third slot: an empty
 * chapter that exists to lengthen the scroll is scroll for its own sake.
 *
 * ── HOW THE STORIES ARE WRITTEN ───────────────────────────────────────────
 *
 * Formal first person, plain sentences, the owner's facts and nothing else
 * (owner, 2026-09-11: "formal yet SEO and GEO friendly", "human made"). In
 * practice: name the technology, the number and the date instead of gesturing
 * at them, because a search or answer engine lifts one sentence out of the
 * page and it has to stay true on its own; say each thing once; no em or en
 * dashes, no staged reveals ("It worked. That turned out to be..."), no
 * questions to the reader. Labels are sentence case in source and uppercased
 * in CSS, except project names, which are proper nouns.
 */

/**
 * ── CHAPTER KEYS ARE CAMERA POSES ─────────────────────────────────────────
 *
 * Every key here has a framing in `LANDSCAPE` in animations/story.ts, so
 * adding one means adding a shot, and the shot has to clear the monitors (the
 * rule and the arithmetic are in that file). An entry uses whichever subset
 * of them its story needs, in whatever order: Unispace opens on `interview`,
 * NotionMind on `discovery`.
 */
export type StoryChapterKey =
  | "discovery"
  | "application"
  | "interview"
  | "hired"
  | "experience"
  | "projectOne"
  | "projectTwo"
  | "lessons"
  | "learned";

export interface StoryChapter {
  key: StoryChapterKey;
  /** The chapter's <h2>. */
  label: string;
  /** One sentence, set in the large type. */
  headline: string;
  /** Up to three short paragraphs. A chapter can be its headline alone. */
  body: string[];
  /** Small supporting line, e.g. a duration or a stack. Optional. */
  meta?: string;
}

export interface ExperienceEntry {
  slug: string;
  /** Where this job sits in the journey, shown beside the number. */
  chapter: string;
  company: string;
  role: string;
  /** Internship / Full-time / Freelance / Contract. */
  type: string;
  location: string;
  duration: string;
  /**
   * One sentence for the section card. The story page's meta description
   * reuses it (see `forExperience` in composables/useHead.ts), so it is also
   * what a search result shows under the title.
   */
  statement: string;
  /**
   * True until this is a real job. The card and the story page both say so
   * plainly instead of dressing an empty slot up as employment history.
   */
  placeholder?: boolean;
  story: StoryChapter[];
}

export const experiences: ExperienceEntry[] = [
  /**
   * The current role, and so the one the section opens on.
   *
   * ── WHERE EACH LINE COMES FROM ─────────────────────────────────────────
   *
   *   · "AI Researcher", full-time, and NEVER AN INTERN HERE: he joined
   *     directly as an employee (owner, 2026-09-11). His earlier "not intern
   *     anymore" meant his career had moved past internships, not that he had
   *     interned at Unispace; one pass of this story read it the second way
   *     and invented an internship chapter out of it. The CV's "Data Science
   *     and Machine Learning Intern" title for Unispace is simply wrong, see
   *     the exception note in `content/cv.ts`.
   *   · The interview chapters (owner, 2026-09-10, "same as notionmind"):
   *     two rounds, technical with the team (Python, past projects, the
   *     reasoning behind them) then the CEO (goals, whether he could take on
   *     the role), no assignment. The chapter SET mirrors NotionMind's on his
   *     instruction (2026-09-11, "use questions like notionmind"); the prose
   *     does not, and never names it.
   *   · The engineering paragraphs in "Role and tech stack": his own CV's four
   *     Unispace bullets, which describe the work, minus the wrong title.
   *   · Research, building the software, several projects, and "i love to do
   *     it its my passion": the owner, 2026-09-11. No research topic, tool,
   *     client, number or result is named because none has been given, and
   *     there are no project chapters for the same reason. He qualified
   *     "projects" with a word that could not be read ("oinyterrstion":
   *     international? integration? interesting?). It is left out rather than
   *     guessed, because two of those three are claims about the job.
   *
   * No start date has been given, so `duration` stays empty.
   *
   * NO CROSS-REFERENCES (owner, 2026-09-11): this story never names the other
   * company or leans on it ("again", "the same way", "this time"). Each entry
   * has to stand on its own for a reader, or a search result, that lands on
   * it directly.
   */
  {
    slug: "unispace",
    chapter: "Most recent experience",
    company: "Unispace",
    role: "AI Researcher",
    type: "Full-time",
    location: "Ahmedabad, India",
    duration: "",
    statement: "I do AI research and build software, and this work is my passion.",
    /**
     * Five chapters. The first three are the same questions NotionMind's
     * story answers, on the same poses, so the avatar's interview beats match
     * across both pages: the establishing glance (`discovery`), turned towards
     * the interviewer (`interview`), the proud face for the offer (`hired`).
     * Then he is down at the desk over his right shoulder for the work
     * (`projectOne`, where the monitors change over), and the story ends on
     * him back at work glancing across his screens (`experience`) rather than
     * on a wide settle, because this is the job he is still doing.
     */
    story: [
      {
        key: "discovery",
        label: "Hiring process",
        headline: "The interview process at Unispace had two rounds and no assignment.",
        body: ["The first was a technical round with the team, and the second was a final round with the CEO."],
      },
      {
        key: "interview",
        label: "Technical round",
        headline: "In the technical round, the team looked at the reasoning behind my work.",
        body: [
          "They asked about my Python knowledge and the projects I had already built, and most of the questions were about why I had made the decisions I did. The emphasis was on understanding the concepts behind the code.",
        ],
      },
      {
        key: "hired",
        label: "CEO round and offer",
        headline: "The final round with the CEO focused on my goals and whether I could take on the role.",
        body: [
          "It was less technical than the first round and more of a conversation.",
          "The offer was a full-time position as an AI Researcher, and I joined the company directly as an employee.",
        ],
      },
      {
        key: "projectOne",
        label: "Role and tech stack",
        headline: "I work across different projects, and the job mixes AI research with software engineering in Python.",
        body: [
          "On the engineering side, I develop and maintain scripts and applications in core Python, with an emphasis on clean, readable and efficient code. The work includes real-world data processing, such as file operations, string processing and exception handling.",
          "I write unit tests and validation scripts to keep the code correct and reliable, and I work with team members to design and implement core features using object-oriented programming principles.",
        ],
        meta: "Python, unit testing, data processing",
      },
      {
        key: "experience",
        label: "Why I love this work",
        headline: "Research and building software are my passion, and this role lets me do both.",
        body: [
          "I love this work. Moving between the research and the code is exactly what I want to be doing, and I get to do it every day.",
        ],
      },
    ],
  },
  {
    slug: "notionmind",
    chapter: "Startup experience",
    company: "NotionMind",
    role: "Software Developer Intern",
    type: "Internship",
    location: "Ahmedabad, India",
    // "to", not a comma: "Oct 2025, Mar 2026" read as two separate dates to a
    // parser, and a dash is the one punctuation mark this file avoids.
    duration: "Oct 2025 to Mar 2026",
    statement:
      "I started in data analysis and went on to build two internal products from scratch with React, Flask and PostgreSQL.",
    /**
     * ── EIGHT CHAPTERS ─────────────────────────────────────────────────────
     *
     * Hiring (the overview, the technical round, the CEO round and offer),
     * the role and stack, one chapter per project, the design lessons, and
     * what he took away. Two projects and no more: every feature does not
     * become a card.
     *
     * Facts are the owner's own account (2026-09-10). The dates in the offer
     * chapter are `duration` written out in full, the same dates llms.txt and
     * the noscript block in index.html carry.
     */
    story: [
      {
        key: "discovery",
        label: "Hiring process",
        headline: "NotionMind hired me after two interview rounds, with no assignment round.",
        body: [
          "The technical round with the team came first, and the final round with the CEO followed directly after it, so the decision rested entirely on those two conversations.",
        ],
      },
      {
        key: "interview",
        label: "Technical round",
        headline: "The technical round tested how well I understood my own work.",
        body: [
          "The team asked about my Python knowledge and went through the projects I had already built. Most of the questions were about the reasoning behind my project decisions. The focus was on understanding concepts rather than syntax, which made it a genuine test of technical depth.",
        ],
      },
      {
        key: "hired",
        label: "CEO round and offer",
        headline: "My final round was a conversation with the CEO, and it led to a six-month internship offer.",
        body: [
          "It was less technical and more conversational than the first round. We talked about my goals and about whether I could take on the role.",
          "I accepted the offer because it matched the direction I wanted my career to take at that point. The internship ran from 1 October 2025 to 31 March 2026.",
        ],
      },
      {
        key: "experience",
        label: "Role and tech stack",
        headline: "What began as data analysis in Jupyter Notebook became full-stack product development.",
        body: [
          "I started as a data analyst, working mainly in Jupyter Notebook on early analysis and reporting. The role quickly expanded beyond notebooks.",
          "I went on to build two major projects from scratch with React, Flask and PostgreSQL, and I owned both of them end to end, from the database to the interface.",
        ],
        meta: "React, Flask, PostgreSQL",
      },
      {
        key: "projectOne",
        label: "Metro Data Analytics Dashboard",
        headline: "An internal analytics dashboard for the company's metro application.",
        body: [
          "I built the data analytics side of this tool from the ground up. It tracked where users were located, which screens they spent the most time on and what they searched for inside the app.",
          "The company already had tens of thousands of data points but no effective way to understand them. The dashboard showed the team where its audience was and how that audience used the product.",
          "The main challenges were complex SQL queries, data transformation, turning raw data into meaningful metrics and designing a usable analytics interface.",
        ],
        meta: "About 2 to 2.5 months, built solo",
      },
      {
        key: "projectTwo",
        label: "Slack Daily Log Dashboard and Automation",
        headline: "A dashboard connected to Slack that captured employee daily logs automatically.",
        body: [
          "Whenever an employee posted a daily log in Slack, the system captured it, stored it in the database and made it available on the dashboard. From there, the team could filter by custom date range or by employee, download CSV files and open a personal chart for each employee showing total hours, total projects and the latest submitted log. The system also fetched each employee's profile picture directly from Slack.",
          "At first, those profile pictures were not being stored correctly. I traced the problem through storage, the backend and the frontend rendering, and fixed it at each stage. The backend also had to stay responsive with roughly 50,000 data points, and caching solved that performance problem.",
          "Automating the daily-log process end to end saved well over 37% of the time senior staff had previously spent scrolling through Slack, recording information by hand, cross-checking logs and organizing the data.",
        ],
        meta: "About 1 month, built solo",
      },
      {
        key: "lessons",
        label: "Product and design lessons",
        headline: "Building the dashboard showed me what to design for, and what I had missed.",
        body: [
          "Some of it came down to product decisions. PDF report downloads were restricted to higher-level users such as the CEO, so deciding who could access them mattered as much as building them.",
          "Other limitations only became clear in hindsight. The personal chart displayed one employee at a time, with their hours, projects and last log, and there was no efficient way to compare employees or to see who owned which project.",
          "The system worked, but it taught me that building something that works is different from building something that scales with the way people use it.",
        ],
      },
      {
        key: "learned",
        label: "What I learned",
        headline: "Owning two products on my own made me responsible for their entire lifecycle.",
        body: [
          "I built both products from scratch while working as a data analyst, which took me well beyond running analysis in notebooks.",
          "I learned how a proper three-tier architecture fits together and gained firsthand experience with database design, application architecture, data processing, caching, frontend rendering, real-time data synchronization, large data volumes, edge cases, usability and scalability.",
          "The biggest lesson is that whether something works is only the first question. I now also ask how it scales, how people use it and where it starts to break down after it ships.",
        ],
      },
    ],
  },
];

export const experienceBySlug = (slug: string) => experiences.find((entry) => entry.slug === slug) ?? null;

/** "01", "02", …, the sequence is the whole point of the section. */
export const chapterNumber = (index: number) => String(index + 1).padStart(2, "0");
