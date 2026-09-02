import gsap from "gsap";
import { sceneWeightsInOut } from "../scenes";
import { animations as avatarAnimations } from "../../three/objects/avatar/animations";
import { createMatchMedia } from "../utils/matchMedia";
import { goodbye } from "../../three/objects/avatar/goodbye";
import { ScrollTrigger } from "gsap/ScrollTrigger";

let inTl: gsap.core.Timeline | null = null;
let outTl: gsap.core.Timeline | null = null;
let wakeUpMm: gsap.MatchMedia | null = null;
let goodbyeMm: gsap.MatchMedia | null = null;

const setup = (contact: HTMLElement) => {
  inTl = gsap.timeline({
    scrollTrigger: {
      trigger: contact,
      start: "top bottom",
      end: "bottom bottom",
      scrub: true,
    },
  });

  inTl.fromTo(sceneWeightsInOut.contact, { in: 0 }, { in: 1, duration: 1, ease: "none" }, 0);

  outTl = gsap.timeline({
    scrollTrigger: {
      trigger: contact,
      start: "bottom bottom",
      end: "bottom top",
      scrub: true,
    },
  });
  outTl.fromTo(sceneWeightsInOut.contact, { out: 0 }, { out: 1, duration: 1, ease: "none" }, 0);

  /**  wakeUpTrigger = ScrollTrigger.create({
    trigger: contact,
    start: "center 75%",
    onEnter: () => {
      gsap.delayedCall(0.25, () => {
        avatarAnimations.wakeUp();
      });
    },
  }); */
  wakeUpMm = createMatchMedia((_context, { isMobile }) => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: contact,
        start: isMobile ? "top 10%" : "top 15%",
      },
    });
    tl.call(avatarAnimations.wakeUp, [0.25]);
  });

  // The walk-away ending is off: the closing beat is the avatar standing in the
  // contact scene facing the visitor. `goodbye.state` stays at its defaults, so
  // avatar/index.ts and contact/shadow.ts read zeroes and behave as they did
  // before it existed.
  // ponytail: one call rather than unpicking goodbye/walk-clip/figure-shadow -
  // re-enable by restoring this line; delete those three modules to be rid of it.
  void setupGoodbye;
};

/**
 * The closing beat: once the visitor has read the contact section the avatar
 * waves, turns and walks off while the scene fades. It plays on its own clock
 * rather than on scrub, so the pause and the turn keep their timing however fast
 * the visitor scrolls, and it rewinds if they scroll back up.
 *
 * Landscape only. Portrait keeps the existing ending untouched.
 */
const setupGoodbye = (contact: HTMLElement) => {
  goodbyeMm = createMatchMedia((_context, { isLandscape }) => {
    if (!isLandscape) {
      goodbye.reset();
      return;
    }

    goodbye.init(document.querySelector<HTMLCanvasElement>("canvas.three-canvas"));

    const trigger = ScrollTrigger.create({
      trigger: contact,
      start: "bottom 92%",
      onEnter: goodbye.play,
      onLeaveBack: goodbye.rewind,
    });

    return () => {
      trigger.kill();
      goodbye.reset();
    };
  });
};

const destroy = () => {
  if (inTl) {
    inTl.kill();
    inTl = null;
  }
  if (outTl) {
    outTl.kill();
    outTl = null;
  }
  if (goodbyeMm) {
    goodbyeMm.kill();
    goodbyeMm = null;
  }
  goodbye.destroy();
  if (wakeUpMm) {
    wakeUpMm.kill();
    wakeUpMm = null;
  }
};

export const contact = { setup, destroy };
