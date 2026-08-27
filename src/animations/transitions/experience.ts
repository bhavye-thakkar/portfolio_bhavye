import gsap from "gsap";
import { sceneWeightsInOut } from "../scenes";
import { createMatchMedia } from "../utils/matchMedia";
import { avatar } from "../../three/objects/avatar";
import { avatarHologram } from "../../three/objects/avatar/hologram";
import { lab } from "../../three/objects/lab";
import { workstation } from "../../three/objects/workstation";
import { screens } from "../../three/objects/workstation/screens";

import type { SceneKey } from "../types";

/**
 * ─── EXPERIENCE ───────────────────────────────────────────────────────────
 *
 * One continuous move, not a new page. The About section hands the stage over
 * mid-scroll: while its own `out` runs, the avatar lowers from the standing
 * t-idle into the seated desk idle, the lab pod shrinks away and the office
 * assembles under him on the same grid floor.
 *
 * After that the section is a career journal. The opening card is pinned to
 * the avatar and names the chapter set; then one chapter card per company
 * holds the screen while the camera walks a shoulder at a time behind it and
 * the monitors change under the move.
 *
 *   spacer -100vh .. 0     in       (overlaps About's out exactly)
 *   spacer    0   .. 300   chapters
 *   spacer  300   .. 400   out
 *
 * Everything below is written for N companies. `content/experience.ts` is the
 * only place a second one has to be added — the windows, the camera swings and
 * the monitor switches all divide themselves up again.
 */

let inMm: gsap.MatchMedia | null = null;
let beatsMm: gsap.MatchMedia | null = null;
let outTl: gsap.core.Timeline | null = null;

export const experienceProgress = { value: 0 };

type Panel = { element: HTMLElement; timeline: gsap.core.Timeline | null };

type ExperienceOptions = {
  spacer: HTMLElement;
  /** "My journey" — pinned to the avatar while the camera is still. */
  opening: Panel;
  /** One per company, in order. */
  chapters: Panel[];
};

/**
 * How much scroll each part of the section owns, in vh. The spacer's height and
 * the timeline's fractions are both derived from these, so the two cannot drift
 * apart — the section is exactly as long as the beats need it to be.
 *
 * `settle` is the ending: the last company's card has left, the office is
 * still standing, and the camera pulls back round to the establishing shot
 * before anything starts to come apart. Without it the final chapter runs
 * straight into the scan-away and the ending arrives before the visitor has
 * finished the journey.
 *
 * `chapter` is per company. With a single company that one window is the whole
 * middle of the section, so it is sized to let one story breathe rather than
 * to keep a queue of cards moving — the section is not padded with extra
 * companies to make up length.
 */
export const SECTION_VH = {
  opening: 200,
  chapter: 300,
  settle: 160,
  exit: 100,
} as const;

/** Total spacer height for N companies, in vh. */
export const sectionHeightVh = (count: number) =>
  SECTION_VH.opening + SECTION_VH.chapter * Math.max(count, 1) + SECTION_VH.settle + SECTION_VH.exit;

/**
 * The framings the chapters rotate through. All three sit behind the avatar
 * (z < 6), which is what makes crossing between any two of them safe — see the
 * note on `experience-4` in waypoints-data.
 */
const CHAPTER_BEATS = ["experience-2", "experience-3", "experience-4"] as const satisfies readonly SceneKey[];

/**
 * Where the section ends up once the last card has left — high behind his head,
 * looking down the desk. It is one of the chapter beats on purpose: see the
 * note on the closing swing below for why the establishing shot cannot be used.
 * A chapter count that already leaves the camera here makes the swing a no-op
 * and the settle holds, which is the old behaviour and still fine.
 */
const CLOSING_BEAT = "experience-4" satisfies SceneKey;

const setup = (options: ExperienceOptions) => {
  setupIn(options.spacer);
  setupChapters(options);
  setupOut(options.spacer);
};

const setupIn = (spacer: HTMLElement) => {
  inMm = createMatchMedia((_context, { isMobile }) => {
    const tl = gsap.timeline({
      duration: 1,
      scrollTrigger: {
        trigger: spacer,
        start: isMobile ? "top bottom" : "top bottom",
        end: "top top",
        scrub: true,
      },
    });

    tl.fromTo(sceneWeightsInOut.experience, { in: 0 }, { in: 1, duration: 1, ease: "none" }, 0);
    tl.fromTo(sceneWeightsInOut["experience-1"], { in: 0 }, { in: 1, duration: 1, ease: "none" }, 0);

    // About's HUD layer has no exit of its own — its story simply ends at the
    // certificates. Hand the stage over by fading the whole layer out; the
    // scrub reverses this on the way back up.
    tl.fromTo(".about-content", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, ease: "none" }, 0.05);

    // The lab pod is the About scene's floor; it steps aside for the deck.
    tl.fromTo(lab.group.scale, { x: 1, y: 1, z: 1 }, { x: 0.001, y: 0.001, z: 0.001, duration: 0.45, ease: "power2.in" }, 0);

    tl.fromTo(workstation.reveal, { value: 0 }, { value: 1, duration: 0.5, ease: "power2.out" }, 0.28);
    tl.fromTo(workstation.group.scale, { x: 0.94, y: 0.94, z: 0.94 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: "power2.out" }, 0.28);

    // He arrives in two steps, in this order: the hologram lowers out of the
    // standing t-idle into the chair, and only then does the scan sweep him
    // back to solid, head first — About's dissolve run in reverse.
    tl.fromTo(avatar.seated, { value: 0 }, { value: 1, duration: 0.5, ease: "power2.inOut" }, 0.08);
    tl.fromTo(avatar.materialise, { value: 0 }, { value: 1, duration: 0.4, ease: "power2.inOut" }, 0.58);
  });
};

const setupChapters = ({ spacer, opening, chapters }: ExperienceOptions) => {
  beatsMm = createMatchMedia((_context, { isLandscape }) => {
    const tl = gsap.timeline({
      duration: 1,
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        end: "bottom bottom",
        scrub: true,
      },
    });

    tl.fromTo(experienceProgress, { value: 0 }, { value: 1, duration: 1, ease: "none" }, 0);

    // The beats trigger covers everything except the last `exit` vh, so the
    // fractions below are shares of that, measured in the same vh the spacer is
    // built from.
    const count = Math.max(chapters.length, 1);
    const beatsVh = SECTION_VH.opening + SECTION_VH.chapter * count + SECTION_VH.settle;
    const openingEnd = SECTION_VH.opening / beatsVh;
    const span = SECTION_VH.chapter / beatsVh;
    // How long a card takes to cross in or out, and how long the camera takes to
    // swing. Expressed as a share of one company's window rather than a fixed
    // fraction of the section, so the pacing per chapter stays the same however
    // many companies there are — a card must never flick past in one wheel notch.
    const cross = span * 0.22;

    const enter = (panel: Panel, at: number) => {
      tl.fromTo(
        panel.element,
        { autoAlpha: 0, y: isLandscape ? 14 : "8vh" },
        { autoAlpha: 1, y: 0, duration: cross, ease: "power1.out" },
        at,
      );
      tl.add(() => {
        panel.timeline?.restart(true);
      }, at);
    };

    const leave = (panel: Panel, at: number) => {
      tl.to(panel.element, { autoAlpha: 0, y: isLandscape ? -14 : "-8vh", duration: cross * 0.9, ease: "power1.in" }, at);
    };

    /**
     * Crosses the camera from one waypoint to the next. `out` is reset on the
     * incoming side so a shoulder can be used twice when there are several
     * companies to walk through.
     */
    const swing = (from: SceneKey, to: SceneKey, at: number) => {
      // The same beat on both sides would put an `out: 1` and an `out: 0` tween
      // on one object at one time, which is a coin toss rather than a hold.
      // The closing swing below can land here when the chapter count leaves the
      // camera already on the beat it is being sent to.
      if (from === to) return;
      const duration = span * 0.34;
      tl.to(sceneWeightsInOut[from as keyof typeof sceneWeightsInOut], { out: 1, duration, ease: "power1.inOut" }, at);
      tl.to(
        sceneWeightsInOut[to as keyof typeof sceneWeightsInOut],
        { in: 1, out: 0, duration, ease: "power1.inOut" },
        at,
      );
    };

    // Beat 0 — establish. Who this is and what the set of chapters is. The card
    // is pinned to the avatar, so it hands over before the camera starts to arc.
    enter(opening, cross * 0.5);
    leave(opening, openingEnd - cross);

    let camera: SceneKey = "experience-1";

    chapters.forEach((panel, index) => {
      const start = openingEnd + index * span;
      const half = start + span / 2;

      // Every company gets its own pair of framings out of the rotation, so
      // consecutive chapters never look like the same shot twice — with two
      // beats, companies 01 and 03 were identical stills.
      const first = CHAPTER_BEATS[index % CHAPTER_BEATS.length]!;
      const second = CHAPTER_BEATS[(index + 1) % CHAPTER_BEATS.length]!;

      swing(camera, first, Math.max(0, start - cross * 0.6));
      swing(first, second, half);
      camera = second;

      tl.to(screens.state, { blend: index % 2 === 0 ? 1 : 0, duration: span * 0.3, ease: "power2.inOut" }, half);

      enter(panel, start);
      // Every card leaves the same way, including the last: it clears the frame
      // and then the settle segment closes the section out below.
      leave(panel, start + span - cross);
    });

    // ── the closing shot. The settle window used to be a held still, which is
    // the one place the section can read as empty scroll — and with a single
    // company it is a sixth of the whole thing. The last card has gone, the
    // office is still standing, and the camera rises behind him for one last
    // look down the desk before the un-build takes over.
    //
    // It has to be `experience-4` and not the establishing `experience-1`.
    // A swing is a weighted blend of two positions, so the camera travels the
    // straight line between them — and 3 → 1 runs from behind his shoulder
    // (z 1.8) out to the front of the bay (z 13.2), which passes directly over
    // his head and lands the middle of the move looking straight down at the
    // desk. Every beat in CHAPTER_BEATS sits behind him, so crossing between
    // any two of them stays behind him. This is the same 3 → 4 crossing the
    // chapter loop already makes for a second company.
    const settleStart = openingEnd + chapters.length * span;
    swing(camera, CLOSING_BEAT, settleStart + (1 - settleStart) * 0.18);
  });
};

/**
 * The closing is the opening run backwards, beat for beat — same properties,
 * same order reversed, same easing philosophy. The opening was:
 *
 *   lab pod shrinks → he sits → the office assembles → the scan turns him solid
 *
 * so the closing is:
 *
 *   the scan turns him back to hologram → the office comes apart → he stands →
 *   the hologram scans away
 *
 * Two things this fixes. The old exit dissolved the avatar in the first third
 * and then held ~500px of empty blue, because the hologram he dissolves *into*
 * was gated on the About scene and had already been switched off — so the
 * section did not close, it just emptied. And the camera's beat weights were
 * driven to zero, which collapses the waypoint average to the origin: a snap to
 * nowhere rather than a move. The camera now returns to the establishing shot —
 * literally the opening's last frame — and only lets go once the stage is
 * scrolling out of view.
 */
const setupOut = (spacer: HTMLElement) => {
  outTl = gsap.timeline({
    scrollTrigger: {
      trigger: spacer,
      start: "bottom bottom",
      end: "bottom top",
      scrub: true,
    },
  });

  // Linear across the whole range, and only 1 at the very end: the dark plane
  // reads this, and dropping it early swaps the clear colour to beige mid-scroll.
  outTl.fromTo(sceneWeightsInOut.experience, { out: 0 }, { out: 1, duration: 1, ease: "none" }, 0);

  // ── camera: it holds the beat it is on, deliberately. The two alternatives
  // are both worse. Crossing to another waypoint blends the two positions, and
  // the straight line between two over-the-shoulder beats passes through the
  // avatar's head. Zeroing the beat weights collapses the waypoint average to
  // the origin, which is the snap to nowhere the old exit had. Holding is the
  // continuity — the closing is carried by the un-build below and by the sticky
  // stage itself riding up out of frame, which the scroll already does.

  // ── the un-build. immediateRender would stamp these from-values at page load
  // and undo the in-timeline, which tweens the same properties up from 0.
  // Every one of these is a `fromTo`, which is also what makes the reverse
  // direction safe: arriving at this range from Projects, scrolling up, the
  // from-values are explicit rather than whatever the property happened to hold.
  outTl.fromTo(
    avatar.materialise,
    { value: 1 },
    { value: 0, duration: 0.36, ease: "power2.inOut", immediateRender: false },
    0.08,
  );
  outTl.fromTo(
    workstation.group.scale,
    { x: 1, y: 1, z: 1 },
    { x: 0.94, y: 0.94, z: 0.94, duration: 0.54, ease: "power2.in", immediateRender: false },
    0.26,
  );
  outTl.fromTo(
    workstation.reveal,
    { value: 1 },
    { value: 0, duration: 0.48, ease: "power2.in", immediateRender: false },
    0.3,
  );
  outTl.fromTo(
    avatar.seated,
    { value: 1 },
    { value: 0, duration: 0.4, ease: "power2.inOut", immediateRender: false },
    0.3,
  );
  // Last: the hologram scans away. It finishes at 0.86 rather than running to
  // the end, because the sticky stage is riding up the whole time — past ~0.85
  // only a sliver of it is still on screen, and a half-dissolved figure in that
  // sliver reads as a pair of floating legs.
  outTl.fromTo(
    avatarHologram.dissolve,
    { value: 0 },
    { value: 1, duration: 0.28, ease: "power1.in", immediateRender: false },
    0.58,
  );
};

const destroy = () => {
  inMm?.revert();
  beatsMm?.revert();
  outTl?.revert();
  inMm = null;
  beatsMm = null;
  outTl = null;
};

export const experience = { setup, destroy };
