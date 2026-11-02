import promoVideo from "../../../assets/projects/monday/promo.mp4";
import promoPoster from "../../../assets/projects/monday/promo.webp";
import promoVertical from "../../../assets/projects/monday/promo-vertical.mp4";
import promoVerticalPoster from "../../../assets/projects/monday/promo-vertical.webp";
import architecture from "../../../assets/projects/monday/architecture.webp";
import limitsAgent from "../../../assets/projects/monday/limits-agent.webp";
import workspace from "../../../assets/projects/monday/workspace.webp";
import looks from "../../../assets/projects/monday/looks.webp";

import type { ProjectContent } from "../../types";

/**
 * ─── MONDAY, THE CASE STUDY ───────────────────────────────────────────────
 *
 * The full write-up, in plain words (owner, 2026-11-01: "I want the things in
 * detail, like before", after a Garba-length cut): no code names, but the
 * measured details stay. "Partly there" and "Not built yet" stay out ("he
 * hasn't done that... remove that whole section"), and nothing partial may
 * read as finished: the wake word is "on test voices", the phone app (emulator
 * only) is not mentioned. Every claim was checked against Monday's own records
 * and code (E:\monday\app, 2026-10-29/30). Re-check before adding one.
 *
 * Every picture is a real off-screen render of Monday's Qt code; the promo's
 * source lives in E:\qa-shots\monday-promo (comp/promo2.html), and phones get
 * its vertical cut (Media.vue `mobileSrc`). Left out on purpose: the chat
 * screens (the owner's own messages) and the "*_high" AI-limits renders.
 *
 * THE DOWNLOAD is Monday's published 0.3.5 package, byte for byte the file in
 * E:\monday\releases (its signed manifest checked), served from
 * public/downloads; replace the file on a new version. Phones never see the
 * button (ProjectHero.vue). Only the desktop app is MIT-licensed
 * (app/LICENSE.md), so the copy never calls the whole repository open source.
 */
export default {
  title: "Monday",
  theme: "dark",
  tags: ["python", "qt", "fastapi", "sqlite"],
  videoBorder: false,
  msi: "/downloads/Monday-0.3.5.msi",
  source: "https://github.com/bhavye-thakkar/monday",
  note: "Version 0.3.5, 78 MB, for 64-bit Windows (built and tested on Windows 11). Needs Python 3.14 (64-bit) from python.org. The installer is not code-signed yet, so Windows SmartScreen warns before it runs.",
  description:
    "A local-first AI assistant for Windows that works the computer it runs on.<br/><br/>Monday opens apps, drives its own browser, runs commands and watches the coding agents on the PC, all from a notch at the top of the screen. Plain code decides what may run, risky steps wait for your Approve, and the screen only ever shows what really happened.",
  components: [
    {
      type: "media",
      props: {
        type: "video",
        src: promoVideo,
        poster: promoPoster,
        mobileSrc: promoVertical,
        mobilePoster: promoVerticalPoster,
        alt: "Monday on a desktop: its notch starts and docks, opens into Home with Ctrl+Alt+M, replays a verified Notepad task, opens a Claude Code session from its tile, reads AI limits and shows its three looks",
        caption: "A tour of Monday",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Why I am building it",
        text: "Most assistants answer in a chat window and leave the work to me. I wanted one that does the work on my own computer, in the applications I already use, and then shows me what actually happened.<br/><br/>Monday runs entirely on the PC it controls. It only takes requests from that machine, keeps every record in one database on it, and tries free models through Ollama first, so an ordinary request does not depend on a paid cloud service. When something fails, it says Failed; when a number is unknown, it says N/A instead of guessing.",
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: architecture,
        alt: "Monday's architecture: the desktop app talks to Monday Core on the same PC; a request passes a guard, Jev and Monday's rules, a plan, a SAFE, ASK or BLOCK ruling for each step, the work itself, a check and a receipt, then an event stream back to the window; the work is done by computer control, Monday's own Chrome, a terminal, Office, Hermes Agent, coding agents and Ollama; records live in one database and an Obsidian vault",
        caption: "How a request moves",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Architecture",
        text: "Monday is two programs. The desktop app owns the tray icon, the window and the notch, and keeps the second program, Monday Core, running: if Core crashes, the app starts it again. Core is a small server that only answers its own computer. It refuses other devices and web pages, and its private actions need a key that changes every time it starts.<br/><br/>A request goes first to Jev, a model that turns it into a clear decision, and to Monday's own rules. Each step of the resulting plan then gets a ruling from plain code, never from a model: SAFE runs, ASK waits for you, BLOCK never runs, and high-risk steps always ask. A step that may run is done by Monday itself or handed to a helper, checked, written down as a receipt and announced on one live stream, which the window follows and catches up on if it was disconnected.",
      },
    },
    {
      type: "list",
      props: {
        title: "What works today",
        size: "lg",
        columns: 2,
        items: [
          "<strong>Computer control</strong>Opens, types into and closes the programs on the PC through Windows' own accessibility tools, keystrokes and text recognition, checking each step. In testing, text typed into Notepad was saved exactly, and a request to play a YouTube video started playback in 7.3 seconds.",
          "<strong>Its own browser</strong>Monday drives its own copy of Chrome, which you can take over, hand back or stop at any time. Web research comes back with dated sources: seven of them in 12.8 seconds in the recorded run.",
          "<strong>Free models first</strong>Free cloud models through Ollama are tried first, then models on the PC itself. In a test with the network cut, a small local model still answered in 0.9 seconds.",
          "<strong>Approvals and receipts</strong>Every step gets a SAFE, ASK or BLOCK ruling from code, never from a model. Anything with a real effect writes a receipt, and success is reported only when a receipt or a program's own result proves it.",
          "<strong>Coding agents, supervised</strong>The notch follows Claude Code and Codex while they work, with their plan, their changes and their tests, and answers Claude Code's permission questions with Allow or Deny. A coding task handed to Codex was checked end to end, including Monday catching a change Codex did not report.",
          "<strong>Office documents</strong>Builds Word, PowerPoint and Excel files and reads them back to check them. An eight-page report with four credited photos took 36 seconds.",
        ],
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: workspace,
        alt: "Monday's window on its Home page: push-to-talk settings and a history of Notepad tasks marked Verified",
        caption: "Verified, not assumed",
        focus: 30,
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: limitsAgent,
        alt: "Left, the AI limits page with live readings for Codex, OpenRouter and Ollama and No usage source where there is no number; right, a Claude Code session followed from the notch, with its live changes",
        caption: "N/A when there is no number",
        focus: 10,
      },
    },
    {
      type: "list",
      props: {
        title: "Engineering notes",
        size: "lg",
        columns: 2,
        items: [
          "<strong>Speed by measurement</strong>Three hundred traced requests showed that Monday's own code takes about 30 milliseconds; the waiting happens while models think. Fixed, known paths now run before any model, so playing a YouTube video takes 7.3 seconds instead of about 175.",
          "<strong>Agents cannot approve themselves</strong>The open-ended agent could once click Monday's own Approve button. It is now refused any action aimed at Monday's windows, or at anything it cannot identify.",
          "<strong>No false success</strong>A shutdown the agent had refused was once reported as done. Power actions now go through fixed Windows calls that always ask, and an agent that could not finish is recorded as Failed.",
          "<strong>A wake word without a keyword engine</strong>At first, saying the bare name woke 0 of 3,844 listening sessions. A second listening pass tuned to the name, with no deaf gap after each phrase, brought wake-up to between 0.6 and 1.7 seconds on test voices.",
          "<strong>An honest start</strong>Core used to come up 50 to 90 seconds after the window. It now starts in about 2 seconds, requests wait for it instead of failing, and the pet keeps its eyes shut until Core says it is ready.",
        ],
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: looks,
        alt: "The notch's three looks: Classic and Floating island open, the closed bars of all three, and an update notice in the notch",
        caption: "Three looks for the notch",
        focus: 20,
      },
    },
    {
      type: "text",
      props: {
        title: "Stack",
        text: "Python 3.14 throughout. The core is built on FastAPI with a SQLite database; the window and the notch on PySide6 (Qt 6); Office, text recognition and media control on Windows' own interfaces; and Jev on TypeSafe. Ollama, Hermes Agent and the coding agents run as separate programs. The installer is built with WiX. Instead of a test framework, more than fifty built-in self-checks and about a hundred live checks run against a running core.",
      },
    },
    {
      type: "text",
      props: {
        title: "Download and run",
        text: "The download is Monday 0.3.5, a 78 MB installer for one Windows user (Monday-0.3.5.msi). It installs into %LOCALAPPDATA%\\Programs\\Monday without administrator rights, adds Start menu and desktop shortcuts, upgrades an older version in place and refuses to downgrade. It needs Python 3.14 (64-bit) from python.org, and says so if Python is missing.<br/><br/>The package carries no keys, history or personal data, so the AI features need at least one provider on the PC: Ollama for models, or a key in Monday's settings file. Playwright, the voice tools, Hermes Agent and the coding agents are installed separately. The installer is not code-signed yet, so SmartScreen warns about an unknown publisher. For this version I checked the signed release file, the installer's tables and its contents; it has not yet been installed on a second PC.<br/><br/>The source code is public on GitHub: the desktop app under the MIT licence, and the phone companion.",
      },
    },
  ],
} satisfies ProjectContent;
