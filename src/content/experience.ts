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
 * The array is the running order, newest first: NotionMind is chapter 01 and
 * the section opens on it. Everything after it is a reserved slot until there
 * is a real job to put there.
 */

export type StoryChapterKey = "discovery" | "application" | "interview" | "hired" | "experience" | "learned";

export interface StoryChapter {
  key: StoryChapterKey;
  /** Chapter label, e.g. "Discovery". */
  label: string;
  /** The question this chapter answers, shown in the draft slot as a prompt. */
  prompt: string;
  /** One-line answer, set in the large type. Empty renders the draft slot. */
  headline: string;
  /** One to three short paragraphs. Empty renders the draft slot. */
  body: string[];
  /** Small supporting line, e.g. a date or a channel. Optional. */
  meta?: string;
}

export interface ExperienceEntry {
  slug: string;
  /** Editorial chapter title for the section, e.g. "The First Opportunity". */
  chapter: string;
  company: string;
  role: string;
  /** Internship / Full-time / Freelance / Contract. */
  type: string;
  location: string;
  duration: string;
  /** One line for the section card. Empty renders the draft slot. */
  statement: string;
  /**
   * True until this is a real job. The card and the story page both say so
   * plainly instead of dressing an empty slot up as employment history.
   */
  placeholder?: boolean;
  /**
   * True when the chapters below are stand-in copy rather than what happened.
   * The story page shows a SAMPLE CONTENT badge while this is set, so filler
   * cannot quietly ship as a real account of a real job. Delete the flag in the
   * same edit that puts the real story in.
   */
  sampleStory?: boolean;
  story: StoryChapter[];
}

/**
 * The six beats of "how I got there", in the order the story page walks them.
 * Copy this for a new company and fill `headline` / `body` in; the layout is
 * identical either way.
 */
const draftStory = (): StoryChapter[] => [
  {
    key: "discovery",
    label: "Discovery",
    prompt: "How did you first hear about this place?",
    headline: "",
    body: [],
  },
  {
    key: "application",
    label: "Application",
    prompt: "How did you apply, or who did you reach out to?",
    headline: "",
    body: [],
  },
  {
    key: "interview",
    label: "Interview",
    prompt: "What did they ask, and what did you build or show?",
    headline: "",
    body: [],
  },
  {
    key: "hired",
    label: "Hired",
    prompt: "How did the conversation turn into an actual role?",
    headline: "",
    body: [],
  },
  {
    key: "experience",
    label: "Experience",
    prompt: "What did you actually work on day to day?",
    headline: "",
    body: [],
  },
  {
    key: "learned",
    label: "Learned",
    prompt: "What do you carry out of this that you did not walk in with?",
    headline: "",
    body: [],
  },
];

/**
 * Stand-in copy so the story layout can be judged with text in it. Deliberately
 * self-describing rather than plausible: nothing here asserts anything about a
 * real job, so if it ever reaches production it reads as an unfinished page
 * instead of as a fabricated career. Every second paragraph says what to
 * replace it with.
 */
const sampleStoryContent = (): StoryChapter[] => {
  const filler: Record<StoryChapterKey, { headline: string; body: string[]; meta?: string }> = {
    discovery: {
      headline: "Placeholder: how the opportunity first surfaced.",
      body: [
        "Sample copy standing in for the real account, set at roughly the length a real answer wants to be so the column can be judged with text in it.",
        "Replace this with the channel it came through, who mentioned it, and what made it worth chasing.",
      ],
      meta: "Sample content",
    },
    application: {
      headline: "Placeholder: how the application went out.",
      body: [
        "Sample copy. Two paragraphs is the comfortable default at this measure; three is the most a chapter should carry before the column starts to feel long.",
        "Replace this with the real route in, the form, the email, the referral, and who read it first.",
      ],
    },
    interview: {
      headline: "Placeholder: what the interview asked for.",
      body: [
        "Sample copy sitting in for the actual conversation, kept short enough that the chapter still reads as a beat rather than an essay.",
        "Replace this with the questions that were actually asked, and whatever was built or shown in response.",
      ],
    },
    hired: {
      headline: "Placeholder: how it became an offer.",
      body: [
        "Sample copy. This is usually the shortest chapter in the telling, and one paragraph often carries it on its own.",
        "Replace this with how the decision landed and what was agreed.",
      ],
    },
    experience: {
      headline: "Placeholder: what the work actually was.",
      body: [
        "Sample copy for the chapter that normally earns the most room, since this is the one a reader came for.",
        "Replace this with the day-to-day: the stack, the team, the projects, and anything that made it to production.",
      ],
      meta: "Sample content",
    },
    learned: {
      headline: "Placeholder: what came out of it.",
      body: [
        "Sample copy for the closing beat, which reads best specific and short rather than broad and long.",
        "Replace this with one concrete thing learned here that would not have been learned anywhere else.",
      ],
    },
  };

  return draftStory().map((chapter) => ({ ...chapter, ...filler[chapter.key] }));
};

export const experiences: ExperienceEntry[] = [
  {
    slug: "notionmind",
    // Deliberately non-ordinal: NotionMind is last in the array, so a title
    // claiming "First" would contradict its own chapter number. Rewrite it to
    // whatever is true once the earlier chapters are filled in.
    chapter: "The Opportunity",
    company: "NotionMind",
    role: "Software Developer Intern",
    type: "Internship",
    location: "Ahmedabad, India",
    duration: "Oct 2025, Mar 2026",
    statement: "Placeholder one-liner, replace with the real summary of the role.",
    // ── Remove this flag and swap sampleStoryContent() for the real chapters
    //    in the same edit. The badge on the story page is tied to it.
    sampleStory: true,
    story: sampleStoryContent(),
  },
  /**
   * Reserved slot. It is a full chapter, its own card, its own camera beat,
   * its own story page, so the section can be built and judged at its real
   * length, but nothing here claims a job. Replacing it is: company, role,
   * type, location, duration, statement, then drop `placeholder` and swap
   * `sampleStoryContent()` for the real six chapters.
   */
  {
    slug: "company-02",
    chapter: "The Next Chapter",
    company: "Company 02",
    role: "Role to be added",
    type: "",
    location: "",
    duration: "",
    statement: "",
    placeholder: true,
    sampleStory: true,
    story: sampleStoryContent(),
  },
];

export const experienceBySlug = (slug: string) => experiences.find((entry) => entry.slug === slug) ?? null;

/** "01", "02", …, the sequence is the whole point of the section. */
export const chapterNumber = (index: number) => String(index + 1).padStart(2, "0");

export const isDraft = (chapter: StoryChapter) => !chapter.headline && chapter.body.length === 0;
