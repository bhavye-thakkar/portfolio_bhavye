/**
 * ─── THE CV ───────────────────────────────────────────────────────────────
 *
 * Transcribed verbatim from `public/cv/Bhavye-Thakkar-CV.pdf`, the owner's own
 * document. That PDF is the source of truth and it ships alongside this file -
 * the "Open the full CV" action on the panel points straight at it, so the two
 * are always the same document.
 *
 * ── RULES FOR EDITING ─────────────────────────────────────────────────────
 *
 *  1. NOTHING HERE IS WRITTEN FOR THE SITE. Every line below is in the PDF. If
 *     a claim is not in the PDF it does not belong here, and if the PDF changes
 *     the replacement goes in `public/cv/` in the SAME edit, a panel that has
 *     drifted from the file it links to is worse than no panel.
 *  2. THE PDF'S OWN WORDING IS KEPT, including its capitalisation and its
 *     typos. "S&p500", "GUJARAT Technological university" and "Notionmind" are
 *     how the document reads; silently correcting them here would mean the page
 *     and the download no longer say the same thing.
 *
 * ── WHY THIS IS NOT `profile.ts` ──────────────────────────────────────────
 *
 * `profile.ts` is what the source portfolio publishes, and the CV disagrees
 * with it in two places on purpose: the CV leads with "AI/ML Engineer" where
 * the site leads with "Data Scientist and Flutter Engineer", and it names a
 * second internship the site does not list. Both are the owner's own claims in
 * their own documents, so neither is corrected against the other, the CV panel
 * reads this file and the rest of the site goes on reading `profile.ts`.
 */

export interface CvEntry {
  /** Job title, degree, certificate name, project or hackathon name. */
  title: string;
  /** Employer, institution, issuer, the line under the title. */
  subtitle?: string;
  /** Dates or any right-aligned note. */
  meta?: string;
  /** A second line under the subtitle, e.g. the app a hackathon produced. */
  note?: string;
  bullets?: string[];
}

export interface CvSection {
  /** The label in the left-hand column. */
  label: string;
  entries: CvEntry[];
  /** Certificates set two-up rather than as a single column. */
  columns?: 2;
}

/** The masthead. `role` is the CV's own line, not the site's. */
export const cvHeader = {
  name: "Bhavye Thakkar",
  role: "AI/ML Engineer",
  email: "thakkarbhavye1425@gmail.com",
  address: "Ahmedabad, Gandhinagar",
  portfolio: "https://bhavyethakkar.netlify.app/",
} as const;

/** The file the "Open the full CV" action opens. Lives in `public/cv/`. */
export const cvFile = "/cv/Bhavye-Thakkar-CV.pdf";

export const cvSections: CvSection[] = [
  {
    label: "Professional Experience",
    entries: [
      {
        title: "Software Developer Intern",
        subtitle: "Notionmind  | Ahmedabad",
        bullets: [
          "Designed and implemented Support Vector Machine (SVM) and k-Nearest Neighbors (k-NN) classifiers entirely from scratch using core Python, avoiding high-level ML libraries to deepen algorithmic understanding.",
          "Developed custom distance metric functions (Euclidean, Manhattan) and applied the Elbow Method to determine the ideal k in the k-NN algorithm for improved classification accuracy.",
          "Optimized both models for computational efficiency, ensuring correctness through rigorous unit testing and performance validation.",
          "Built a time-based S&p500 stock price prediction pipeline, splitting data using an 80/20 chronological split to respect real-world time-series constraints.",
        ],
      },
      {
        title: "Data Science and Machine Learning Intern",
        subtitle: "BrainyBeam Technologies Pvt. Ltd. | Ahmedabad",
        bullets: [
          "Write unit tests and validation scripts to ensure the correctness and reliability of code.",
          "Handle file operations, string processing, and exception handling for real-world data processing tasks.",
          "Develop and maintain scripts and applications using core Python, emphasizing clean, readable, and efficient code.",
          "Collaborate with team members to design and implement core features using object-oriented programming principles.",
        ],
      },
    ],
  },
  {
    label: "Education",
    entries: [
      {
        title: "GUJARAT Technological university (GTU) | 2022– 2026",
        subtitle: "Bachelor in Computer Engineering (BE)",
        bullets: ["CGPA: 7.50 / 10"],
      },
    ],
  },
  {
    label: "Certificates",
    columns: 2,
    entries: [
      {
        title: "Artificial Intelligence /Machine Learning (AI/ML) with IoT, Deep Learning, and Computer Vision",
        subtitle: "Edunet Foundation | Sponsored by SAP",
      },
      { title: "Data Analytics", subtitle: "Deloitte" },
      { title: "TensorFlow for Machine Learning – GeeksforGeeks", subtitle: "GeeksforGeeks" },
      { title: "Intel® AI", subtitle: "Intel Corporation India" },
    ],
  },
  {
    label: "Major Projects",
    entries: [
      {
        title: "Time-Based Stock Price Prediction for S&P500",
        bullets: [
          "Built a time-series prediction pipeline using lag features and technical indicators, Decision Tree, and Random Forest models on S&P500 stock data.",
          "Evaluated model performance using MAE, MSE, RMSE, and R²; performed hyperparameter tuning and visualized key feature importances to improve forecasting accuracy.",
        ],
      },
      {
        title: "AI-Powered Expense Tracker (Flutter)",
        bullets: [
          "Built an AI-powered expense tracker in Flutter with dynamic graphs for weekly, monthly, and yearly spending, along with insights on average and highest expenses.",
          "Integrated group-based expense management (Splitwise-style) and an AI assistant to guide users with saving habits and resolve money-related queries.",
        ],
      },
    ],
  },
  {
    label: "Hackathons",
    entries: [
      {
        title: "Innonova 24-Hour Hackathon, Indore",
        note: "AI-Powered To-Do List App (Flutter)",
        bullets: [
          "Developed a smart To-Do list app with NLP-based task categorization and intelligent priority management to enhance daily productivity.",
          "Integrated AI-generated reminders that adapt based on task urgency, deadlines, and user behavior patterns.",
          "Built an AI-powered note-taking app with automatic summarization, keyword extraction, and real-time smart suggestions for efficient content recall and organization.",
        ],
      },
      {
        title:
          "DAIICT Hackathon (Dhirubhai Ambani Institute of Information and Communication Technology), Ahmedabad",
        note: "AI-Powered Expense Tracker (Flutter)",
        bullets: [
          "Engineered a feature-rich expense tracking app with AI-driven insights and interactive graphs for weekly, monthly, and yearly spending analysis.",
          "Implemented group-based expense management similar to Splitwise, enabling seamless splitting and tracking of shared expenses.",
          "Integrated an AI assistant to provide personalized saving tips and financial guidance based on user behavior and spending patterns.",
        ],
      },
    ],
  },
];
