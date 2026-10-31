import promoVideo from "../../../assets/projects/monday/promo.mp4";
import promoPoster from "../../../assets/projects/monday/promo.webp";
import architecture from "../../../assets/projects/monday/architecture.webp";
import limitsAgent from "../../../assets/projects/monday/limits-agent.webp";
import workspace from "../../../assets/projects/monday/workspace.webp";
import looks from "../../../assets/projects/monday/looks.webp";

import type { ProjectContent } from "../../types";

/**
 * ─── MONDAY, THE CASE STUDY ───────────────────────────────────────────────
 *
 * Every claim was checked on 2026-10-29 against Monday's own records
 * (E:\monday\app: CHECKLIST.md, docs/qa, docs/adr, the design-ref reports) and
 * its code, never against its README alone, and again on 2026-10-30 against
 * docs/qa/QA_MATRIX.md and the public code (Core's 148 routes are app.py's; the
 * phone listener's 14 are a separate app). "What works today" holds only what
 * those records show run and seen working; "Partly there" says what is missing;
 * nothing planned is written as built. Re-check before adding a feature here.
 *
 * Every picture is a real off-screen render of Monday's Qt code, placed at 1x on
 * a plain backdrop (compositions and the promo source live outside the repo, in
 * E:\qa-shots\monday-promo). Left out on purpose: the chat screens (the owner's
 * own messages) and the "*_high" AI-limits renders, whose 86% is self-check test
 * data.
 *
 * THE DOWNLOAD is Monday's published 0.3.5 package, byte for byte the file in
 * E:\monday\releases (2026-10-30: its latest.json's Ed25519 signature checked
 * with the public key in core/update.py, SHA-256 and size matched), kept under
 * public/downloads like the Garba Circle APK on the owner's instruction
 * (2026-10-29). Replace the file rather than adding versions beside it: every
 * copy stays in git history. Unlike 0.3.1, this package's core was NOT started
 * from an extract (that rewrites the owner's Startup shortcut), so the copy
 * below claims tables, contents and signature only.
 *
 * `source` is the owner's public repo (published 2026-10-29): app/ and mobile/.
 * Only app/ carries a licence (app/LICENSE.md, MIT), so the copy says the
 * desktop app is MIT-licensed, never that the whole repository is.
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
    "A local-first AI assistant for Windows that works the computer it runs on.<br/><br/>Monday opens apps, drives its own browser, runs commands and watches the coding agents on the PC, all from a notch at the top of the screen. Code decides what may run, risky steps wait for an explicit Approve, and the interface shows only the states its backend reported.",
  components: [
    {
      type: "media",
      props: {
        type: "video",
        src: promoVideo,
        poster: promoPoster,
        alt: "Monday on a Windows desktop: its notch starts, opens into Home, replays a verified Notepad task, follows a Claude Code session, reads AI limits and shows its three looks",
        caption: "A tour of Monday",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Why I am building it",
        text: "Most assistants answer in a chat window and leave the work to me. I wanted one that does the work on my own computer, in the applications I already use, and then shows me what actually happened.<br/><br/>Monday runs entirely on the PC it controls. Its core accepts requests from that machine only, keeps every record in one SQLite database and reaches models through Ollama first, so an ordinary request does not depend on a cloud service. When something fails, the interface says Failed; when a number is unknown, it says N/A. The goal is an assistant that can take on open-ended work in any application. The dependable part today is narrower, and this page keeps the two apart.",
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: architecture,
        alt: "Monday's architecture: the Qt desktop app calls Monday Core on 127.0.0.1:8765 over REST; a request passes the guard, Jev and rules, a plan, router.permit with its SAFE, ASK and BLOCK rulings, execution, verification and a receipt, then an event bus streamed back to the window; workers are computer control, Monday's Chrome, terminal and Office, Hermes Agent, coding agents and Ollama; storage is SQLite and an Obsidian vault",
        caption: "How a request moves",
        focus: 50,
      },
    },
    {
      type: "text",
      props: {
        title: "Architecture",
        text: "Monday is two programs. The desktop app (core/desktop.py, PySide6) owns the tray icon, the window, the notch and a supervisor that starts Monday Core and restarts it after a crash. Core is a FastAPI server on 127.0.0.1:8765 with 148 routes. Its guard accepts loopback requests only, checks the Host and Origin headers against DNS rebinding and requests from web pages, and owner-only routes need a token that is regenerated on every start.<br/><br/>A request first goes to Jev, a TypeSafe model that returns typed probabilities, and to the deterministic rules in router.policy. Every step of the resulting plan then meets router.permit, which is plain code: SAFE runs, ASK waits for the owner, BLOCK never runs, and high-risk steps ask in every mode. A permitted step is carried out by Monday's own controllers or handed to a worker, verified, recorded in a receipts table and published on one event bus. The window reads that bus as a single Server-Sent Events stream, which replays whatever it missed while disconnected.",
      },
    },
    {
      type: "list",
      props: {
        title: "What works today",
        size: "lg",
        columns: 2,
        items: [
          "<strong>Computer control</strong>Opens, types into and closes desktop applications through UI Automation, SendInput and Windows OCR, checking each step. In testing, text typed into Notepad was saved byte for byte, and a request to play a YouTube video started playback in 7.3 seconds.",
          "<strong>Its own browser</strong>Playwright drives an installed Chrome on Monday's own profile, with Take control, Resume and Stop. Web research returns dated, cited sources: seven of them in 12.8 seconds in the recorded run.",
          "<strong>Local models first</strong>Ollama Cloud models are tried first, then local ones. In a test behind a dead network proxy, the local llama3.2:1b model still answered in 0.9 seconds.",
          "<strong>Approvals and receipts</strong>Every step gets a SAFE, ASK or BLOCK ruling from code, never from a model. Anything with an external effect writes a receipt, and success is reported only when a receipt or a process result proves it.",
          "<strong>Coding agents, supervised</strong>The notch follows Claude Code and Codex sessions from their logs, with the plan, the diff and the tests, and answers Claude Code's permission prompts with Allow or Deny. A coding task handed to Codex has been verified end to end, including Monday catching an edit that Codex did not report.",
          "<strong>Office documents</strong>Builds Word, PowerPoint and Excel files through COM and reads them back to check them. An eight-page report with four credited photos took 36 seconds.",
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
      type: "list",
      props: {
        title: "Partly there",
        size: "lg",
        columns: 2,
        items: [
          "<strong>Voice</strong>Push-to-talk and a spoken wake word run on faster-whisper and Google's speech recognizer. Wake-up was tested on synthetic voices, 28 of 28 with no false wake, but not yet on mine, and spoken replies have not been confirmed on speakers.",
          "<strong>Open-ended screen tasks</strong>For work without a fixed path, Hermes Agent proposes each step over the Agent Client Protocol and Monday's rules decide. It finished 14 of the last 56 such tasks, which is why fixed, deterministic paths always run first.",
          "<strong>Other coding agents</strong>Adapters for Claude Code, Gemini CLI, Kilo Code and Grok Build are written and pass tests against stand-ins. None of them has completed a task for Monday on this PC yet.",
          "<strong>Memory</strong>Conversation and task history survive restarts in SQLite, and research notes are written into an Obsidian vault. The vault's decision and project notes are not written yet.",
          "<strong>AI limits</strong>The AI limits look reads Codex, OpenRouter and Ollama usage live. The Claude Code relay is installed but has not reported yet, so its card says No usage source.",
          "<strong>Phone companion</strong>A Flutter app pairs with an eight-digit code over a separate HTTPS listener that is off by default. It ran a desktop task from an Android emulator; a real phone has not been tested.",
        ],
      },
    },
    {
      type: "media",
      props: {
        type: "image",
        src: limitsAgent,
        alt: "Left, the AI limits page with real readings for Codex, OpenRouter and Ollama and No usage source for Claude Code and Jev; right, a Claude Code session watched from the notch, its live diff and Claude Code use shown as N/A",
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
          "<strong>Speed by measurement</strong>Three hundred traced requests showed that Monday's own code takes about 30 milliseconds; the waiting happens in model turns. Fixed, deterministic paths now run before any model, so playing a YouTube video takes 7.3 seconds instead of about 175 through the open-ended agent.",
          "<strong>Agents cannot approve themselves</strong>The open-ended agent could once click Monday's own Approve button. Its screen proxy now refuses any action aimed at Monday's windows, or whose target it cannot identify.",
          "<strong>No false success</strong>A shutdown request that the agent had refused was once reported as completed. Power actions now go through fixed Win32 calls that always ask, and an agent saying it could not finish is recorded as Failed.",
          "<strong>A wake word without a keyword engine</strong>At first, saying the bare name woke 0 of 3,844 listening sessions. A second Whisper pass primed for the name, with no deaf gap after each phrase, brought wake-up to between 0.6 and 1.7 seconds.",
          "<strong>An honest start</strong>Core used to come up 50 to 90 seconds after the window. It now starts in about 2 seconds, calls wait instead of reporting the core as unreachable, and the pet keeps its eyes shut until Core says it is ready.",
          "<strong>A phone that never reaches the core</strong>The phone talks to a separate, allow-listed listener, paired once with an eight-digit code, a hashed device secret and a pinned certificate. Core itself still refuses everything but loopback.",
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
        text: "Python 3.14 with asyncio and sqlite3; FastAPI, uvicorn, pydantic and httpx for the core; PySide6 (Qt 6) for the window and the notch; pywin32 and WinRT for Office, OCR and media sessions; and TypeSafe's SDK for Jev. Ollama, Hermes Agent, cua-driver and the coding agents' command lines run as separate processes. The installer is built with WiX 5 and the phone companion with Flutter. There is no test framework: more than fifty per-module self-checks and a preflight of about a hundred live checks run against a running core.",
      },
    },
    {
      type: "text",
      props: {
        title: "Download and run",
        text: "The download is Monday 0.3.5, a 78 MB per-user installer (Monday-0.3.5.msi, SHA-256 4fb7c06f53a15c2f4ff051619eef62ea74c5c9f5243a5c421badf5b8ce1e2df8). It installs into %LOCALAPPDATA%\\Programs\\Monday without administrator rights, adds Start menu and desktop shortcuts, upgrades an older version in place and refuses to downgrade. It needs Python 3.14 (64-bit) from python.org, and it stops with that message when Python is missing.<br/><br/>The package carries no keys, history or personal data, so AI features need at least one provider on the PC: Ollama for models, or a key in Monday's .env file. Playwright, cua-driver, the voice environment, Hermes Agent and the coding agents are installed separately. The installer is not code-signed yet, so SmartScreen warns about an unknown publisher. For this version I checked the signed release manifest, the installer's tables and its contents; it has not yet been installed on a second PC.<br/><br/>The source code is public on GitHub: the desktop app, under the MIT licence, and the phone companion. The repository's .env.example lists the keys Monday reads.",
      },
    },
    {
      type: "text",
      props: {
        title: "Not built yet",
        text: "A keyword wake engine, MCP connectors, recognising the owner's voice, a screen vision model and meeting links. The macOS and Linux code paths exist but have never run on either system, and computer control is Windows only.",
      },
    },
  ],
} satisfies ProjectContent;
