import gsap from "gsap";
import { sizes } from "../utils/sizes";
import { sceneWeights, stageHold } from "./scenes";
import { points } from "./waypoints-data";
import { Vector3 } from "three";

import type { SceneKey } from "./types";

const position = new Vector3();
const focus = new Vector3();

/**
 * ── A PUSH ALONG THE SOLVED SIGHT LINE ────────────────────────────────────
 *
 * Fraction of the distance from the solved camera toward its own focus, 0 =
 * off. Experience's X-ray sequence drives it, and it exists so a transition can
 * add a slow move to a framing without needing a waypoint of its own.
 *
 * The reason it is a lerp toward `focus` and not an arbitrary offset is that a
 * lerp cannot change the sight LINE, only where the camera sits along it. So
 * whatever the framing already cleared, it still clears: the Experience
 * cameras all thread a gap between the two monitors (see the clearance rule in
 * `animations/story.ts`), and a new waypoint would have had to re-derive that
 * for landscape and portrait both. This provably cannot break it.
 *
 * Keep it small. It is a dolly, not a zoom, past ~0.2 the composition starts
 * to change rather than tighten.
 */
export const dolly = { value: 0 };

const init = () => {
  updateReferences();
  gsap.ticker.add(tick);
};

function weightedAverage<T extends { x: number; y: number; z: number }>(points: T[], weights: number[]): T {
  let total = 0,
    x = 0,
    y = 0,
    z = 0;

  for (let i = 0; i < points.length; i++) {
    const w = weights[i] ?? 0;
    total += w;
    x += points[i]!.x * w;
    y += points[i]!.y * w;
    z += points[i]!.z * w;
  }

  if (total === 0) total = 1;

  return { x: x / total, y: y / total, z: z / total } as T;
}

// cache
let positions: { x: number; y: number; z: number }[] = [];
let focuses: { x: number; y: number; z: number }[] = [];
let weights: number[] = [];
let resolvedPoints: typeof points.landscape | typeof points.portrait = points.landscape;

// called when viewport or scene set changes
function updateReferences() {
  const isLandscape = sizes.isLandscape;
  resolvedPoints = isLandscape ? points.landscape : points.portrait;

  const active = Object.entries(sceneWeights).filter(([key, weight]) => weight > 0 && key in resolvedPoints) as [
    SceneKey,
    number,
  ][];

  positions = active.map(([key]) => resolvedPoints[key as keyof typeof resolvedPoints]!.position);
  focuses = active.map(([key]) => resolvedPoints[key as keyof typeof resolvedPoints]!.focus);
  weights = active.map(([, w]) => w);
}

const tick = () => {
  // While the story page holds the stage it tweens `position` / `focus`
  // directly, one pose per chapter, there is no scroll for a waypoint blend
  // to read from.
  if (stageHold.value) return;

  updateReferences();

  const finalPos = weightedAverage(positions, weights);
  const finalFocus = weightedAverage(focuses, weights);

  position.set(finalPos.x, finalPos.y, finalPos.z);
  focus.set(finalFocus.x, finalFocus.y, finalFocus.z);

  if (dolly.value !== 0) position.lerp(focus, dolly.value);
};

const destroy = () => {
  gsap.ticker.remove(tick);
  dolly.value = 0;
};

export const waypoints = { init, points, updateReferences, position, focus, dolly, destroy };
