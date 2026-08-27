import gsap from "gsap";

export const sceneWeights = {
  hero: 1,
  about: 0,
  "about-1": 0,
  "about-2": 0,
  experience: 0,
  "experience-1": 0,
  "experience-2": 0,
  "experience-3": 0,
  "experience-4": 0,
  projects: 0,
  contact: 0,
};

const sceneWeightKeys = Object.keys(sceneWeights);

//in = 1 and out = 0 = fully visible
//in = 0 and out = 0 = not reached yet
//out = 1 = scrolled past

export const sceneWeightsInOut = {
  hero: {
    in: 1,
    out: 0,
  },
  about: {
    in: 0,
    out: 0,
  },
  "about-1": {
    in: 0,
    out: 0,
  },
  "about-2": {
    in: 0,
    out: 0,
  },
  experience: {
    in: 0,
    out: 0,
  },
  "experience-1": {
    in: 0,
    out: 0,
  },
  "experience-2": {
    in: 0,
    out: 0,
  },
  "experience-3": {
    in: 0,
    out: 0,
  },
  "experience-4": {
    in: 0,
    out: 0,
  },
  contact: {
    in: 0,
    out: 0,
  },
};

/**
 * The Experience story page takes the stage over: it scrolls its own document,
 * which leaves the home page's ScrollTriggers measuring a `position: fixed`
 * layout. Holding freezes `sceneWeights` at whatever the last honest scroll
 * produced, so the story can set the stage by hand and nothing scrubs under it.
 */
export const stageHold = { value: false };

const init = () => {
  gsap.ticker.add(tick);
};

const tick = () => {
  if (stageHold.value) return;

  for (const key of sceneWeightKeys) {
    const inOut = sceneWeightsInOut[key as keyof typeof sceneWeightsInOut];
    if (!inOut) continue;

    sceneWeights[key as keyof typeof sceneWeights] = Math.max(0, Math.min(1, inOut.in * (1 - inOut.out)));
  }
};

const destroy = () => {
  gsap.ticker.remove(tick);
};

export const scenes = { init, destroy };
