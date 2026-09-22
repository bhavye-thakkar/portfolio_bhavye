import { AnimationClip, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } from "three";

import type { AnimationClip as Clip, KeyframeTrack, Object3D } from "three";

/**
 * ─── A WALK AUTHORED IN WORLD SPACE ───────────────────────────────────────
 *
 * avatar.glb ships no walk. The first attempt (walk-clip.ts) added sinusoidal
 * swings to single bones about their local axes, on top of the first frame of
 * `t-idle`, and it went wrong in three ways that no amount of tuning fixed:
 *
 *  1. That frame is not a neutral pose. Measured: left thigh 19.6° forward with
 *     the knee pre-bent 27°, right leg straight, pelvis rolled 9°. It is a
 *     relaxed contrapposto, so symmetric swings on top of it are a limp.
 *  2. Every bone has its own axis convention (the hips' +Z points down, the
 *     feet answer the opposite sign to the shins, the two arms mirror each
 *     other), and each one was found the hard way, after shipping it wrong.
 *  3. A sine is not a gait. The planted foot has to travel backwards at the
 *     body's own constant speed or it slides, and nothing tied the hips'
 *     height to the legs' reach, so he floated at the split.
 *
 * Here the pose is decided in WORLD space instead: where each ankle is, which
 * way each limb points, how far the torso leans. The skeleton itself is the
 * calculator: a bone's local rotation is its parent's world rotation undone,
 * then the wanted world rotation applied, so no axis convention is ever needed.
 * The legs are 2-bone IK from the hip joint to an ankle that follows a real
 * foot path: heel strike, flat, heel-off over the ball of the foot, swing.
 * The hips ride at the height the planted leg can actually reach.
 *
 * The clip is one second long: `action.time` is the phase. Scrub it by distance
 * travelled over the returned `stride` (loader-avatar.ts), or play it at one
 * cycle per so many seconds and move him `stride` a cycle (the goodbye), and
 * the feet cannot slide by construction.
 *
 * Every length is in LEG LENGTHS (thigh + shin, measured off the skeleton in
 * world space when the clip is built), so the same numbers hold whatever scale
 * the avatar stands at in a given scene.
 */

export type GaitOptions = {
  /** ground covered per cycle (two steps) */
  stride: number;
  /** share of the cycle each foot spends on the ground */
  stance: number;
  /** how high the swinging ankle lifts */
  lift: number;
  /** toes up at heel strike and heel up at toe-off, radians */
  heelStrike: number;
  toeOff: number;
  /** the planted leg never quite locks: its reach as a share of thigh + shin */
  reach: number;
  /** lowers the hips further, which bends both knees: the braced stance */
  crouch: number;
  /** feet placed this far behind the hips: someone leaning on a door */
  trail: number;
  /** torso pitched forward, radians, and how much of it the head undoes */
  lean: number;
  headLevel: number;
  /**
   * "push": both palms held out on a door, angles from horizontal, up positive.
   * "swing": arms counter-swing the same-side leg, `elbow` is the bend added
   * as an arm comes forward.
   */
  arms: { mode: "push"; upper: number; fore: number; hand: number } | { mode: "swing"; amount: number; elbow: number };
};

export const GAIT_DEFAULTS: GaitOptions = {
  stride: 1.6,
  stance: 0.6,
  lift: 0.14,
  heelStrike: 0.3,
  toeOff: 0.7,
  reach: 0.975,
  crouch: 0,
  trail: 0,
  lean: 0,
  headLevel: 0.6,
  arms: { mode: "swing", amount: 0.45, elbow: 0.35 },
};

const SAMPLES = 40;

const LEGS = [
  { thigh: "leftUpLegBone", shin: "leftLegBone", foot: "leftFootBone", toe: "leftToeBaseBone", offset: 0 },
  { thigh: "rightUpLegBone", shin: "rightLegBone", foot: "rightFootBone", toe: "rightToeBaseBone", offset: 0.5 },
] as const;

// `leg` is the index of the same-side leg, which the arm counter-swings
const ARMS = [
  { upper: "leftArmBone", fore: "leftForeArmBone", hand: "leftHandBone", finger: "leftHandIndex1Bone", leg: 0 },
  { upper: "rightarmBone", fore: "rightForearmBone", hand: "rightHandBone", finger: "bone-right-hand", leg: 1 },
] as const;

const SPINE = ["spineBone", "spine1Bone", "spine2Bone"] as const;

const DRIVEN = [
  "hipsBone",
  ...SPINE,
  "headBone",
  ...LEGS.flatMap((leg) => [leg.thigh, leg.shin, leg.foot, leg.toe]),
  ...ARMS.flatMap((arm) => [arm.upper, arm.fore, arm.hand]),
];

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp = (t: number, min = 0, max = 1) => Math.min(max, Math.max(min, t));
const frac = (t: number) => t - Math.floor(t);

/** the flat foot from the side: ankle height, and how far ahead the ball and behind the heel touch */
type FootShape = { ankle: number; ball: number; heel: number };

/** The ankle joint's height above the sole, as a share of the shin: measured, 0.573 over 0.967. */
const ANKLE_OVER_SHIN = 0.592;

/**
 * Where the ankle is relative to the ground under the hip joint (x forward,
 * y above the floor) and how the sole is pitched, toes up positive, at `u` of
 * this leg's own cycle. u = 0 is heel strike.
 */
const footPath = (
  u: number,
  o: Pick<GaitOptions, "stride" | "stance" | "lift" | "heelStrike" | "toeOff" | "trail">,
  foot: FootShape,
) => {
  const travel = o.stance * o.stride; // how far the body passes over one planted foot
  // the ankle, carried by a foot pitched about a point of the sole at `pivot`
  const about = (pivot: number, pitch: number) => ({
    x: pivot - pivot * Math.cos(pitch) - foot.ankle * Math.sin(pitch),
    y: -pivot * Math.sin(pitch) + foot.ankle * Math.cos(pitch),
  });

  if (u < o.stance) {
    const s = u / o.stance;
    // lands on the heel, lies flat while the body passes over, rolls off the ball
    const pitch =
      s < 0.16 ? o.heelStrike * (1 - smooth(s / 0.16)) : s > 0.52 ? -o.toeOff * smooth((s - 0.52) / 0.48) : 0;
    const ankle = about(pitch > 0 ? -foot.heel : foot.ball, pitch);
    return { x: ankle.x - (s - 0.5) * travel - o.trail, y: ankle.y, pitch, planted: true };
  }

  const w = (u - o.stance) / (1 - o.stance);
  const from = about(foot.ball, -o.toeOff);
  const to = about(-foot.heel, o.heelStrike);
  const e = smooth(w);
  return {
    x: from.x - 0.5 * travel + (to.x - from.x + travel) * e - o.trail,
    // up early so the toes clear, down late: the peak sits before the middle
    y: from.y + (to.y - from.y) * e + o.lift * Math.sin(Math.PI * Math.pow(w, 0.75)),
    pitch: -o.toeOff + (o.heelStrike + o.toeOff) * smooth(clamp((w - 0.08) / 0.8)),
    planted: false,
  };
};

export const createGaitClip = (root: Object3D, baseClip: Clip, overrides: Partial<GaitOptions> = {}) => {
  const given: GaitOptions = { ...GAIT_DEFAULTS, ...overrides };

  const bones = new Map<string, Object3D>();
  root.traverse((child) => {
    if ((child as { isBone?: boolean }).isBone) bones.set(child.name, child);
  });
  const bone = (name: string) => {
    const found = bones.get(name);
    if (!found) throw new Error(`[gait] no bone "${name}"`);
    return found;
  };

  // The base clip's first frame: the pose every bone not driven here keeps.
  const base = new Map<string, number[]>();
  for (const track of baseClip.tracks) {
    const split = track.name.lastIndexOf(".");
    const property = track.name.slice(split + 1);
    const first = Array.from(track.values.slice(0, property === "quaternion" ? 4 : 3));
    base.set(track.name, first);
    const target = bones.get(track.name.slice(0, split));
    if (property === "quaternion") target?.quaternion.fromArray(first);
    else if (property === "position") target?.position.fromArray(first);
    else if (property === "scale") target?.scale.fromArray(first);
  }
  root.updateWorldMatrix(true, true);

  // The body's axes. The model faces -Z in its parent's space, and whatever
  // turns that parent (the loader's yaw, the desk avatar's transform) turns these.
  const frame = new Quaternion();
  root.parent?.getWorldQuaternion(frame);
  const FWD = new Vector3(0, 0, -1).applyQuaternion(frame).normalize();
  const UP = new Vector3(0, 1, 0).applyQuaternion(frame).normalize();
  const RIGHT = new Vector3().crossVectors(FWD, UP).normalize();
  const DOWN = UP.clone().negate();

  const worldQ = (name: string) => bone(name).getWorldQuaternion(new Quaternion());
  const worldP = (name: string) => bone(name).getWorldPosition(new Vector3());
  /** a turn in the body's side plane: positive swings a hanging limb forward, lifts the toes, tips the torso BACK */
  const pitched = (angle: number, rest: Quaternion) => new Quaternion().setFromAxisAngle(RIGHT, angle).multiply(rest);
  const heading = (angle: number) => FWD.clone().multiplyScalar(Math.cos(angle)).addScaledVector(UP, Math.sin(angle));
  const parentQ = new Quaternion();
  /** gives `name` this world rotation, whatever its parents are doing */
  const face = (name: string, target: Quaternion) => {
    const b = bone(name);
    b.parent!.getWorldQuaternion(parentQ);
    b.quaternion.copy(parentQ.invert()).multiply(target);
    b.updateWorldMatrix(false, true);
  };
  /** the world rotation that points `name`, towards its `child`, along `direction` */
  const aimed = (name: string, child: string, direction: Vector3) =>
    new Quaternion().setFromUnitVectors(worldP(child).sub(worldP(name)).normalize(), direction).multiply(worldQ(name));

  // ── measured off the base frame, where both soles are flat on the floor and
  // the right foot stands under a straight leg ──
  const ankleAt = worldP("rightFootBone");
  const ball = worldP("rightToeBaseBone").sub(ankleAt).dot(FWD);
  const shin = ankleAt.distanceTo(worldP("rightLegBone"));
  const foot: FootShape = { ankle: shin * ANKLE_OVER_SHIN, ball, heel: ball * 0.6 };
  const floorY = ankleAt.dot(UP) - foot.ankle;
  // the options, from leg lengths into this scene's world units
  const leg = shin + worldP("rightLegBone").distanceTo(worldP("rightUpLegBone"));
  const o = {
    ...given,
    stride: given.stride * leg,
    lift: given.lift * leg,
    crouch: given.crouch * leg,
    trail: given.trail * leg,
    floorY,
  };
  const restSpine = SPINE.map((name) => worldQ(name));
  const restHead = worldQ("headBone");
  const restFeet = LEGS.map((leg) => ({ foot: worldQ(leg.foot), toe: worldQ(leg.toe) }));
  // How far out to the side each arm hangs in the base frame. Aimed purely in
  // the side plane the upper arm passes straight through the ribs, and its skin
  // shows through the sleeve.
  const splay = ARMS.map((arm) => ({
    upper: worldP(arm.fore).sub(worldP(arm.upper)).normalize().dot(RIGHT),
    fore: worldP(arm.hand).sub(worldP(arm.fore)).normalize().dot(RIGHT),
  }));
  /** `heading`, carried out to the side by `lateral` (the sine of the angle off the side plane) */
  const splayed = (angle: number, lateral: number) =>
    heading(angle)
      .multiplyScalar(Math.sqrt(1 - lateral * lateral))
      .addScaledVector(RIGHT, lateral);

  // ── the neutral stance the gait is measured from: pelvis level, legs plumb ──
  const hipLine = worldP("rightUpLegBone").sub(worldP("leftUpLegBone")).normalize();
  const levelHips = new Quaternion().setFromUnitVectors(hipLine, RIGHT).multiply(worldQ("hipsBone"));
  face("hipsBone", levelHips);
  const restLegs = LEGS.map((leg) => {
    const thigh = aimed(leg.thigh, leg.shin, DOWN);
    face(leg.thigh, thigh);
    const shin = aimed(leg.shin, leg.foot, DOWN);
    face(leg.shin, shin);
    return { thigh, shin };
  });
  const thighLength = worldP("leftLegBone").distanceTo(worldP("leftUpLegBone"));
  const shinLength = worldP("leftFootBone").distanceTo(worldP("leftLegBone"));
  const legLength = thighLength + shinLength;
  const hipsHome = worldP("hipsBone");
  const jointDrop = hipsHome.dot(UP) - worldP("leftUpLegBone").dot(UP);

  // Hip joints' height through the cycle: what the planted leg can reach, the
  // lower of the two when both are down, smoothed round the loop so double
  // support has no corner in it.
  const reach = legLength * o.reach;
  const raw = Array.from({ length: SAMPLES }, (_, i) => {
    let height = o.floorY + foot.ankle + reach;
    for (const leg of LEGS) {
      const path = footPath(frac(i / SAMPLES + leg.offset), o, foot);
      if (path.planted)
        height = Math.min(height, o.floorY + path.y + Math.sqrt(Math.max(0.01, reach * reach - path.x * path.x)));
    }
    return height - o.crouch;
  });
  const kernel = [1, 4, 6, 4, 1];
  const jointY = raw.map(
    (_, i) => kernel.reduce((sum, k, j) => sum + k * raw[(i + j - 2 + SAMPLES) % SAMPLES]!, 0) / 16,
  );

  // ── sample the cycle ──
  const times = new Float32Array(SAMPLES + 1);
  const sampled = new Map<string, Float32Array>();
  for (const name of DRIVEN) sampled.set(`${name}.quaternion`, new Float32Array((SAMPLES + 1) * 4));
  sampled.set("hipsBone.position", new Float32Array((SAMPLES + 1) * 3));
  const hipsAt = new Vector3();

  for (let i = 0; i <= SAMPLES; i++) {
    const phase = (i % SAMPLES) / SAMPLES;
    times[i] = i / SAMPLES;

    // pelvis: level, tipped a little into the lean, at the height the legs allow
    const hips = bone("hipsBone");
    hipsAt.copy(hipsHome).addScaledVector(UP, jointY[i % SAMPLES]! + jointDrop - hipsHome.dot(UP));
    hips.position.copy(hips.parent!.worldToLocal(hipsAt));
    face("hipsBone", pitched(-o.lean * 0.2, levelHips));

    // torso: the lean fed in up the spine, the head undoing part of it
    SPINE.forEach((name, j) => face(name, pitched(-o.lean * (0.45 + 0.275 * j), restSpine[j]!)));
    face("headBone", pitched(-o.lean * (1 - o.headLevel), restHead));

    // legs: 2-bone IK from the hip joint to the ankle, in the body's side plane
    const paths = LEGS.map((leg) => footPath(frac(phase + leg.offset), o, foot));
    LEGS.forEach((leg, k) => {
      const path = paths[k]!;
      const dx = path.x;
      const dy = o.floorY + path.y - worldP(leg.thigh).dot(UP);
      const distance = Math.min(Math.hypot(dx, dy), legLength * 0.999);
      const line = Math.atan2(dx, -dy); // hip-to-ankle line from straight down, forward positive
      const atHip = Math.acos(
        clamp((thighLength ** 2 + distance ** 2 - shinLength ** 2) / (2 * thighLength * distance), -1, 1),
      );
      const atKnee = Math.acos(
        clamp((thighLength ** 2 + shinLength ** 2 - distance ** 2) / (2 * thighLength * shinLength), -1, 1),
      );
      const thigh = line + atHip; // the knee bends forwards
      face(leg.thigh, pitched(thigh, restLegs[k]!.thigh));
      face(leg.shin, pitched(thigh - (Math.PI - atKnee), restLegs[k]!.shin));
      face(leg.foot, pitched(path.pitch, restFeet[k]!.foot));
      // heel up: the toes stay flat on the floor rather than following the foot
      face(leg.toe, path.planted && path.pitch < 0 ? restFeet[k]!.toe : pitched(path.pitch, restFeet[k]!.toe));
    });

    ARMS.forEach((arm, k) => {
      const out = splay[k]!;
      if (o.arms.mode === "push") {
        // palms at shoulder width: most of the hang's splay closes as the arms come up
        face(arm.upper, aimed(arm.upper, arm.fore, splayed(o.arms.upper, out.upper * 0.4)));
        face(arm.fore, aimed(arm.fore, arm.hand, splayed(o.arms.fore, out.fore * 0.2)));
        face(arm.hand, aimed(arm.hand, arm.finger, heading(o.arms.hand)));
        return;
      }
      // forward as the same-side foot goes back, by exactly as much
      const forward = clamp(-(paths[arm.leg]!.x + o.trail) / (0.5 * o.stance * o.stride), -1, 1);
      const upper = -Math.PI / 2 + forward * o.arms.amount;
      face(arm.upper, aimed(arm.upper, arm.fore, splayed(upper, out.upper)));
      face(arm.fore, aimed(arm.fore, arm.hand, splayed(upper + 0.12 + o.arms.elbow * (0.5 + 0.5 * forward), out.fore)));
    });

    for (const name of DRIVEN) bone(name).quaternion.toArray(sampled.get(`${name}.quaternion`)!, i * 4);
    hips.position.toArray(sampled.get("hipsBone.position")!, i * 3);
  }

  // Every track the base clip has, so the clip is a whole pose: a bone without
  // one keeps whatever the action it faded in from had left on it.
  const tracks: KeyframeTrack[] = baseClip.tracks.map((track) => {
    const Track = track.name.endsWith(".quaternion") ? QuaternionKeyframeTrack : VectorKeyframeTrack;
    const values = sampled.get(track.name);
    if (values) return new Track(track.name, times as unknown as number[], values as unknown as number[]);
    const held = base.get(track.name)!;
    return new Track(track.name, [0, 1], [...held, ...held]);
  });

  return { clip: new AnimationClip("gait", 1, tracks), stride: o.stride };
};
