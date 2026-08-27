import { AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from "three";

import type { AnimationClip as Clip, KeyframeTrack } from "three";

/**
 * The avatar.glb rig ships idle / sleeping / wake-up / wave clips but no walk,
 * so the goodbye needs one authored here. It is a normal AnimationClip driven by
 * the same AnimationMixer as every other action, which keeps the crossfades and
 * the weight blending in `animations.ts` working unchanged.
 *
 * Three facts about this rig, all measured by posing single bones and rendering:
 *  - a limb's forward/back swing is a rotation about local X applied in PARENT
 *    space, i.e. `quaternion.copy(rest).premultiply(q)`. Post-multiplying gives a
 *    mix of swing and adduction, because a bone's own axes run along the limb.
 *  - the hips carry the Blender Z-up conversion, so their vertical axis is local
 *    +Z, not +Y. That is where the walk bob goes.
 *  - the clip must cover EVERY bone the base clip covers, not just the ones that
 *    swing. A bone with no track keeps whatever the previous action left on it,
 *    so a partial clip inherits the tail of the pose it crossfaded from.
 */

/** samples per cycle — enough for the mixer to interpolate a smooth loop */
const SAMPLES = 24;
/** one full cycle is two steps — slow, for a relaxed walk-away */
const DURATION = 1.35;

const TAU = Math.PI * 2;
const X_AXIS = new Vector3(1, 0, 0);

const DEFAULTS = {
  hip: 0.36,
  knee: 0.62,
  ankle: 0.16,
  arm: 0.5,
  foreArm: 0.14,
  /** small constant bend so the legs never lock straight */
  kneeRest: 0.08,
  spine: 0.03,
  bob: 0.04,
  /** cycle phase where knee flexion peaks, just after toe-off */
  kneePeak: Math.PI * 0.85,
  /** how much of hip+knee the ankle cancels to keep the sole level */
  ankleLevel: 0.8,
};

/**
 * Ground speed that matches the stride, so the feet plant instead of skating.
 * Two steps per cycle, each roughly `2 * legLength * sin(hip)` long.
 */
export const walkSpeed = (legLength: number, tuning: WalkTuning = {}) =>
  (4 * legLength * Math.sin((tuning.hip ?? DEFAULTS.hip) * 0.92)) / DURATION;

export type WalkTuning = Partial<typeof DEFAULTS>;

const splitTrackName = (name: string) => {
  const separator = name.lastIndexOf(".");
  return { bone: name.slice(0, separator), property: name.slice(separator + 1) };
};

const createSwings = (tuning: typeof DEFAULTS): Record<string, (phase: number) => number> => {
  const hip = (phase: number) => tuning.hip * Math.sin(phase);

  const knee = (phase: number) => {
    const lobe = 0.5 + 0.5 * Math.cos(phase - tuning.kneePeak);
    return -(tuning.kneeRest + tuning.knee * lobe * lobe);
  };

  // the ankle mostly cancels hip + knee so the sole stays level through stance
  // instead of walking on tiptoe, with a small push added at toe-off
  const ankle = (phase: number) =>
    -(hip(phase) + knee(phase)) * tuning.ankleLevel + tuning.ankle * Math.sin(phase - tuning.kneePeak);

  const opposite = (fn: (phase: number) => number) => (phase: number) => fn(phase + Math.PI);

  return {
    leftUpLegBone: hip,
    rightUpLegBone: opposite(hip),
    leftLegBone: knee,
    rightLegBone: opposite(knee),
    leftFootBone: ankle,
    rightFootBone: opposite(ankle),

    // arms counter-swing the same-side leg
    leftArmBone: (p) => tuning.arm * Math.sin(p + Math.PI),
    rightarmBone: (p) => tuning.arm * Math.sin(p),
    leftForeArmBone: (p) => -tuning.foreArm * (1.1 + Math.sin(p + Math.PI)),
    rightForearmBone: (p) => -tuning.foreArm * (1.1 + Math.sin(p)),

    // torso rides the stride, at twice the rate and a fraction of the amplitude
    spineBone: (p) => tuning.spine * Math.cos(p * 2),
    spine1Bone: (p) => tuning.spine * 0.6 * Math.cos(p * 2 + 0.4),
  };
};

/**
 * Builds a relaxed walk cycle on top of `baseClip`'s first frame, which should be
 * a neutral standing pose (t-idle works; contact-idle has the arms folded).
 */
export const createWalkClip = (baseClip: Clip, overrides: WalkTuning = {}): Clip => {
  const tuning = { ...DEFAULTS, ...overrides };
  const swings = createSwings(tuning);

  const times = new Float32Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) times[i] = (i / SAMPLES) * DURATION;

  const held = [0, DURATION];
  const rotation = new Quaternion();
  const rest = new Quaternion();
  const result = new Quaternion();
  const offset = new Vector3();

  const tracks: KeyframeTrack[] = [];

  for (const track of baseClip.tracks) {
    const { bone, property } = splitTrackName(track.name);
    const size = property === "quaternion" ? 4 : 3;
    const base = Array.from(track.values.slice(0, size));

    const angleAt = property === "quaternion" ? swings[bone] : undefined;

    if (angleAt) {
      const values = new Float32Array(times.length * 4);
      rest.fromArray(base);

      for (let i = 0; i < times.length; i++) {
        rotation.setFromAxisAngle(X_AXIS, angleAt((times[i]! / DURATION) * TAU));
        result.copy(rest).premultiply(rotation);
        result.toArray(values, i * 4);
      }

      tracks.push(new QuaternionKeyframeTrack(track.name, times as unknown as number[], values as unknown as number[]));
      continue;
    }

    if (bone === "hipsBone" && property === "position") {
      // two bobs per cycle: high at mid-stance, low at each leg spread.
      // the hips carry the Z-up conversion, so the bob rides local +Z.
      offset.fromArray(base);
      const values = new Float32Array(times.length * 3);

      for (let i = 0; i < times.length; i++) {
        const phase = (times[i]! / DURATION) * TAU;
        values[i * 3] = offset.x;
        values[i * 3 + 1] = offset.y;
        values[i * 3 + 2] = offset.z + tuning.bob * Math.cos(phase * 2);
      }

      tracks.push(new VectorKeyframeTrack(track.name, times as unknown as number[], values as unknown as number[]));
      continue;
    }

    // everything else is pinned to the standing pose, so the clip is a complete
    // body pose rather than a patch over whatever action it crossfaded from
    const TrackType = property === "quaternion" ? QuaternionKeyframeTrack : VectorKeyframeTrack;
    tracks.push(new TrackType(track.name, held, [...base, ...base]));
  }

  return new AnimationClip("walk", DURATION, tracks);
};

export const WALK_DURATION = DURATION;
