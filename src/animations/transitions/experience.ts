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
 * One continuous move, not a new page. About hands the stage over mid-scroll:
 * the lab pod shrinks away, the avatar lowers out of the standing t-idle into
 * the seated desk idle, the office assembles around him on the same grid floor
 * and the scan turns him solid again. Then it is a career journal — one
 * chapter per company — and at the end the whole thing runs backwards and the
 * stage rides out into Projects.
 *
 * ── ONE BEAT PER PHASE ────────────────────────────────────────────────────
 *
 * The camera has exactly as many states as the section has phases, and it only
 * ever crosses on a phase boundary:
 *
 *   opening   experience-1   establishing shot
 *   chapter 0 experience-2   over one shoulder
 *   chapter 1 experience-3   over the other
 *   settle    experience-1   back to the establishing shot
 *
 * The previous version rotated two framings *per company* and added a closing
 * swing on top, so a single company produced three camera moves and a wheel
 * notch could look like the scene had changed by itself. Within a chapter the
 * camera now holds and the change of state is carried by the monitors, which
 * wipe from one scenario to the other at the middle of the window — a
 * deliberate beat that cannot be mistaken for a jump.
 *
 * ── WHERE EACH THING IS ALLOWED TO HAPPEN ─────────────────────────────────
 *
 * `.intro-sticky` is 100lvh tall and stops being sticky over the LAST 100lvh
 * of its wrapper, whose last child is this section's spacer. So the final
 * 100vh of scroll is the stage physically riding up out of the viewport, and
 * anything choreographed there is watched through a shrinking letterbox. That
 * is what the old closing did — the office came apart in a strip two hundred
 * pixels tall, which is why it read as a wash-out rather than as an ending.
 *
 * So the whole story, the un-build included, lives in the pinned range:
 *
 *   spacer -100vh .. 0     in      (overlaps About's out exactly)
 *   spacer    0   .. -100  beats   opening, chapters, settle, close  [pinned]
 *   spacer -100   .. end   out     the stage rides out; nothing animates
 *
 * Everything below is written for N companies. `content/experience.ts` is the
 * only place another one has to be added — the spacer height, the scroll
 * windows and the camera beats all divide themselves up again.
 */

let inMm: gsap.MatchMedia | null = null;
let beatsMm: gsap.MatchMedia | null = null;
let outTl: gsap.core.Timeline | null = null;

type Panel = { element: HTMLElement; timeline: gsap.core.Timeline | null };

type ExperienceOptions = {
  spacer: HTMLElement;
  /** "My journey" — pinned to the avatar while the camera is still. */
  opening: Panel;
  /** One per company, in order. */
  chapters: Panel[];
};

/**
 * How much scroll each part of the section owns, in vh. The spacer's height
 * and the timeline's fractions are both derived from these, so the two cannot
 * drift apart.
 *
 * `settle` is the final Experience state: the last card has gone, the office
 * is still standing, and the camera has craned back to the shot the section
 * opened on. `close` is the un-build, and it is the last thing that happens
 * while the stage is still pinned. `exit` is not a choice — it is the 100lvh
 * the sticky stage takes to ride out of frame, and it is deliberately empty.
 */
export const SECTION_VH = {
  opening: 180,
  chapter: 280,
  settle: 150,
  close: 110,
  exit: 100,
} as const;

/** Total spacer height for N companies, in vh. */
export const sectionHeightVh = (count: number) =>
  SECTION_VH.opening +
  SECTION_VH.chapter * Math.max(count, 1) +
  SECTION_VH.settle +
  SECTION_VH.close +
  SECTION_VH.exit;

/**
 * The establishing shot. The opening holds on it and the closing comes back to
 * it, which is what makes the two ends of the section feel like one move
 * played in both directions.
 */
const ESTABLISHING = "experience-1" satisfies SceneKey;

/** One framing per company, in order. Wraps if there are ever more than two. */
const CHAPTER_BEATS = ["experience-2", "experience-3"] as const satisfies readonly SceneKey[];

const beatFor = (index: number) => CHAPTER_BEATS[index % CHAPTER_BEATS.length]!;

const setup = (options: ExperienceOptions) => {
  setupIn(options.spacer);
  setupBeats(options);
  setupOut(options.spacer);
};

/**
 * ── THE OPENING ───────────────────────────────────────────────────────────
 *
 * The order matters more than the durations. He is still a hologram here, and
 * the rig has no sit-down clip — `seated` cross-fades the standing t-idle into
 * the seated desk idle, and the half-way pose of that blend has his hips at
 * roughly desk height with his legs half-extended under it.
 *
 * That pose is fine once the desk is opaque: from every Experience framing the
 * desk top is between the camera and his lower half, so it hides the legs and
 * all that reads is a figure settling into the chair. It is only wrong while
 * the desk is still fading in — a 40%-opaque desk shows the legs straight
 * through itself, which is what made the old opening look like a man sitting
 * on top of his own desk.
 *
 * So the bay finishes building first, and only then does he sit. The closing
 * runs the same rule backwards: he stands back up while the desk is still
 * solid, and the office only comes apart after he is clear of it.
 */
const setupIn = (spacer: HTMLElement) => {
  inMm = createMatchMedia((_context) => {
    const tl = gsap.timeline({
      duration: 1,
      scrollTrigger: {
        trigger: spacer,
        start: "top bottom",
        end: "top top",
        scrub: true,
      },
    });

    // About's HUD layer has no exit of its own — its story simply ends at the
    // certificates. Hand the stage over by fading the whole layer out; the
    // scrub reverses this on the way back up.
    tl.fromTo(".about-content", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2, ease: "none" }, 0.05);

    tl.fromTo(sceneWeightsInOut.experience, { in: 0 }, { in: 1, duration: 1, ease: "none" }, 0);
    tl.fromTo(sceneWeightsInOut[ESTABLISHING], { in: 0, out: 0 }, { in: 1, duration: 1, ease: "none" }, 0);

    // The lab pod is the About scene's floor; it steps aside for the deck.
    tl.fromTo(
      lab.group.scale,
      { x: 1, y: 1, z: 1 },
      { x: 0.001, y: 0.001, z: 0.001, duration: 0.4, ease: "power2.in" },
      0,
    );

    // The bay assembles around the standing hologram and reaches full opacity
    // before he moves.
    tl.fromTo(workstation.reveal, { value: 0 }, { value: 1, duration: 0.42, ease: "power2.out" }, 0.04);
    tl.fromTo(
      workstation.group.scale,
      { x: 0.94, y: 0.94, z: 0.94 },
      { x: 1, y: 1, z: 1, duration: 0.46, ease: "power2.out" },
      0.04,
    );

    // Then he takes the chair, with the desk already solid in front of him.
    tl.fromTo(avatar.seated, { value: 0 }, { value: 1, duration: 0.32, ease: "power2.inOut" }, 0.44);

    // Last: the scan sweeps him back to solid — About's dissolve in reverse.
    tl.fromTo(avatar.materialise, { value: 0 }, { value: 1, duration: 0.3, ease: "power2.inOut" }, 0.7);
  });
};

const setupBeats = ({ spacer, opening, chapters }: ExperienceOptions) => {
  beatsMm = createMatchMedia((_context, { isLandscape }) => {
    const tl = gsap.timeline({
      duration: 1,
      scrollTrigger: {
        trigger: spacer,
        start: "top top",
        // The stage unsticks here. Everything above is watched full-frame.
        end: "bottom bottom",
        scrub: true,
      },
    });

    const count = Math.max(chapters.length, 1);
    const beatsVh = SECTION_VH.opening + SECTION_VH.chapter * count + SECTION_VH.settle + SECTION_VH.close;
    const openingEnd = SECTION_VH.opening / beatsVh;
    const span = SECTION_VH.chapter / beatsVh;
    const settleStart = openingEnd + span * count;
    const closeStart = settleStart + SECTION_VH.settle / beatsVh;
    const closeSpan = 1 - closeStart;

    // How long a card takes to cross in or out, as a share of one company's
    // window rather than of the whole section — so the pacing per chapter is
    // the same however many companies there are, and a card can never flick
    // past in a single wheel notch.
    const cross = span * 0.2;

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
      tl.to(
        panel.element,
        { autoAlpha: 0, y: isLandscape ? -14 : "-8vh", duration: cross * 0.9, ease: "power1.in" },
        at,
      );
    };

    /**
     * Crosses the camera from one waypoint to the next. The weight solver
     * averages every active waypoint, so a cross is a straight line between
     * the two positions — `out` is reset on the incoming side so a framing can
     * be arrived at more than once, which the closing relies on.
     */
    const swing = (from: SceneKey, to: SceneKey, at: number, duration: number) => {
      if (from === to) return;
      tl.to(sceneWeightsInOut[from as keyof typeof sceneWeightsInOut], { out: 1, duration, ease: "power1.inOut" }, at);
      tl.to(
        sceneWeightsInOut[to as keyof typeof sceneWeightsInOut],
        { in: 1, out: 0, duration, ease: "power1.inOut" },
        at,
      );
    };

    // ── the opening. Who this is and what the set of chapters is, on the
    // establishing shot the in-timeline already arrived at. The card is pinned
    // to the avatar, so it hands over before the camera starts to move.
    enter(opening, cross * 0.4);
    leave(opening, openingEnd - cross);

    let camera: SceneKey = ESTABLISHING;
    const swingDur = span * 0.3;

    chapters.forEach((panel, index) => {
      const start = openingEnd + index * span;
      const beat = beatFor(index);

      // The move straddles the boundary: it is already under way as the last
      // card leaves and has settled before the next one lands.
      swing(camera, beat, Math.max(0, start - swingDur * 0.55), swingDur);
      camera = beat;

      // The chapter's own second state. No camera move — the screens change
      // under a held shot, which is a beat rather than a cut.
      tl.to(
        screens.state,
        { blend: index % 2 === 0 ? 1 : 0, duration: span * 0.22, ease: "power2.inOut" },
        start + span * 0.46,
      );

      enter(panel, start + span * 0.06);
      leave(panel, start + span * 0.8);
    });

    // ── the final Experience state. The cards are done and the camera cranes
    // back to the shot the section opened on — over the desk rather than
    // through it, see the note in waypoints-data — then holds there so the
    // office gets its scale back before anything comes apart.
    swing(camera, ESTABLISHING, settleStart, (SECTION_VH.settle / beatsVh) * 0.62);
    // Both scenarios have been up by now; the section closes on the one it
    // opened on.
    tl.to(screens.state, { blend: 0, duration: (SECTION_VH.settle / beatsVh) * 0.4 }, settleStart);

    /**
     * ── THE CLOSE ───────────────────────────────────────────────────────────
     *
     * The opening backwards, property for property, in the reverse order:
     *
     *   scan solid ← office assembles ← he sits ← lab pod shrinks
     *   scan away  → office un-builds → he stands
     *
     * The camera does not move: it is already on the establishing shot, which
     * is the opening's last frame, so the section closes on the picture it
     * opened on and the stage rides out from there.
     *
     * `immediateRender: false` on every one of these. A `fromTo` otherwise
     * stamps its from-value the moment it is added, which would undo the
     * in-timeline that tweens the same properties up from zero.
     */
    const closeAt = (fraction: number) => closeStart + closeSpan * fraction;

    tl.fromTo(
      avatar.materialise,
      { value: 1 },
      { value: 0, duration: closeSpan * 0.3, ease: "power2.inOut", immediateRender: false },
      closeAt(0),
    );
    // He stands while the desk is still solid, so it goes on hiding his legs
    // through the half-way pose — the opening's rule, run backwards.
    tl.fromTo(
      avatar.seated,
      { value: 1 },
      { value: 0, duration: closeSpan * 0.32, ease: "power2.inOut", immediateRender: false },
      closeAt(0.24),
    );
    tl.fromTo(
      workstation.group.scale,
      { x: 1, y: 1, z: 1 },
      { x: 0.94, y: 0.94, z: 0.94, duration: closeSpan * 0.4, ease: "power2.in", immediateRender: false },
      closeAt(0.56),
    );
    tl.fromTo(
      workstation.reveal,
      { value: 1 },
      { value: 0, duration: closeSpan * 0.38, ease: "power2.in", immediateRender: false },
      closeAt(0.56),
    );
    // He is standing and alone on the grid floor again — the frame About handed
    // over — and only then does the hologram scan away.
    tl.fromTo(
      avatarHologram.dissolve,
      { value: 0 },
      { value: 1, duration: closeSpan * 0.28, ease: "power1.in", immediateRender: false },
      closeAt(0.72),
    );
  });
};

/**
 * The ride-out. The stage is leaving the viewport under its own scroll and
 * there is nothing left on it, so the only thing that runs here is the weight
 * that keeps the dark plane open. It is linear and only reaches 1 at the very
 * end: dropping it early swaps the clear colour to beige while the stage is
 * still on screen, which is the white flash the old closing had.
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

  outTl.fromTo(sceneWeightsInOut.experience, { out: 0 }, { out: 1, duration: 1, ease: "none" }, 0);
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
