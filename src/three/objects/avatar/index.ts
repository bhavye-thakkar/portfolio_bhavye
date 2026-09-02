import { resources } from "../../../utils/resources";
import { Mesh, Quaternion, Vector3, Euler, Group, ShaderMaterial, LinearSRGBColorSpace } from "three";
import { scene } from "../../core/scene";
import { animations } from "./animations";
import { sceneWeights, sceneWeightsInOut, stageHold } from "../../../animations/scenes";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { face } from "./face";
import { spectacles } from "./spectacles";
import { watch } from "./watch";
import { leftDesktop as avatarLeftDesktop } from "./left-desktop";
import matcapVertexShader from "../../shaders/avatar-matcap/vertex.glsl";
import matcapFragmentShader from "../../shaders/avatar-matcap/fragment.glsl";
import headVertexShader from "../../shaders/avatar-head/vertex.glsl";
import headFragmentShader from "../../shaders/avatar-head/fragment.glsl";
import lensFragmentShader from "../../shaders/avatar-lens/fragment.glsl";
import gsap from "gsap";
import { aboutProgress } from "../../../animations/transitions/about";
import { lerp, mix } from "../../../utils/math";
//import { avatarHologram } from "./hologram";
import { goodbye } from "./goodbye";

import type { Material, Bone, Texture } from "three";

let mesh: Mesh | null = null;
let rightHandBone: Bone | null = null;
let headBone: Bone | null = null;
let spineBone: Bone | null = null;

const tIdleIntensity = { value: 0 };

/**
 * Experience owns these two. They live here rather than in the transition so
 * the animation and material code can read them without importing back into
 * the timeline module.
 *
 * `seated`      1 overrides tIdleIntensity and puts him back in the desk idle.
 *               About's own scrubbed timeline holds tIdleIntensity at 1 for the
 *               rest of the page, so the two cannot share one value.
 * `materialise` 1 undoes About's dissolve, so the solid avatar comes back.
 */
const seated = { value: 0 };
const materialise = { value: 0 };

const waypointsPosition = new Vector3();
const waypointsRotation = new Euler();
/**
 * Extra yaw for HIM ALONE, on top of the waypoint rotation.
 *
 * The workstation group is pinned to `waypointsRotation` every tick, so
 * turning him by writing that rotates the desk and both monitors with him -
 * which is how the Experience story ended up framing a monitor across his
 * face when a chapter turned him towards the camera. This is applied to his
 * transform only, so the furniture stays where it is.
 */
const storyTurn = { value: 0 };
const transform = new Group();
const uniforms = { uProgress: { value: 0 }, uAmbientStrength: { value: 0 } };
const contactPosition = new Vector3(0, -13, 0);
const contactRotation = new Euler(0, -Math.PI, 0);

const init = () => {
  setupMesh();
  animations.init();
  face.init();
  avatarLeftDesktop.init();
  gsap.ticker.add(tick);
};

const getMaterial = (name: string): Material | null => {
  if (name === "face") return face.getMaterial();
  if (name === "head") {
    const texture = resources.items["head-texture"];
    texture.flipY = false;
    texture.colorSpace = LinearSRGBColorSpace;
    texture.generateMipmaps = false;
    return new ShaderMaterial({
      vertexShader: headVertexShader,
      fragmentShader: headFragmentShader,
      transparent: true,
      uniforms: {
        uHeadTexture: { value: texture },
        ...uniforms,
      },
    });
  }

  const tex = resources.items["matcap-black"];
  tex.colorSpace = LinearSRGBColorSpace;
  tex.generateMipmaps = false;

  return new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: matcapFragmentShader,
    transparent: true,
    uniforms: {
      uMatcap: { value: tex },
      ...uniforms,
    },
  });
};

const assignMatcap = (child: Mesh): boolean => {
  let tex: Texture | null = null;

  if (child.name === "black") {
    tex = resources.items["matcap-black"];
  } else if (child.name === "gray") {
    tex = resources.items["matcap-gray"];
  } else if (child.name === "skin") {
    tex = resources.items["matcap-skin"];
  } else if (child.name === "white") {
    tex = resources.items["matcap-white"];
  }

  if (tex) {
    tex.colorSpace = LinearSRGBColorSpace;
    child.userData.matcap = tex;
    return true;
  }

  return false;
};

const setupMesh = () => {
  if (mesh) return;
  const resource = resources.items["avatar-model"];
  mesh = cloneSkeleton(resource.scene.children[0]) as Mesh;

  mesh.frustumCulled = false;

  mesh.traverse((child) => {
    if (child instanceof Mesh) {
      const mat = getMaterial(child.name);
      if (!mat) return;
      child.material = mat;
      child.frustumCulled = false;
      child.renderOrder = child.name === "face" ? 25 : 24;

      const hasMatcap = assignMatcap(child);
      if (hasMatcap) {
        child.onBeforeRender = () => {
          child.material.uniforms.uMatcap.value = child.userData.matcap;
        };
      }
    }
  });

  const brain = mesh.getObjectByName("brain") as Mesh;
  if (brain) {
    mesh.remove(brain);
  }

  // After traverse so the spectacles keep their own material assignments
  const lensMaterial = new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: lensFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: { ...uniforms },
  });
  const skinTexture = resources.items["matcap-skin"];
  skinTexture.colorSpace = LinearSRGBColorSpace;
  const noseMaterial = new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: matcapFragmentShader,
    transparent: true,
    uniforms: { uMatcap: { value: skinTexture }, ...uniforms },
  });
  spectacles.init(mesh, getMaterial("spectacles") as Material, lensMaterial, noseMaterial);

  // Smart watch on his right wrist: black body, lighter screen, both off the
  // existing matcaps so it sits in the same palette as the shoes and shirt.
  const whiteTexture = resources.items["matcap-white"];
  whiteTexture.colorSpace = LinearSRGBColorSpace;
  const watchScreenMaterial = new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: matcapFragmentShader,
    transparent: true,
    uniforms: { uMatcap: { value: whiteTexture }, ...uniforms },
  });
  watch.init(mesh, getMaterial("watch") as Material, watchScreenMaterial);

  mesh.rotation.z = 0;

  transform.add(mesh);

  rightHandBone = mesh.getObjectByName("bone-right-hand") as Bone;
  headBone = mesh.getObjectByName("headBone") as Bone;
  // spine2 is the upper chest, the highest spine joint, so its share of the
  // turn moves the shoulders without swinging him off the chair.
  spineBone = mesh.getObjectByName("spine2Bone") as Bone;

  scene.instance.add(transform);
};

/**
 * ─── WHERE HE LOOKS AT THE DESK ───────────────────────────────────────────
 *
 * The desk idle was authored for the hero room, where the main monitor sits
 * straight ahead, but the Experience bay has two monitors flanking that
 * exact spot, so the base pose stares at the bezel gap between them. Each
 * camera beat features one specific screen, so he turns a little toward that
 * screen, blended with the same weights that drive the camera. Positive
 * turns him toward HIS left.
 *
 * ── TWO THINGS THAT MAKE IT READ AS A PERSON LOOKING ──────────────────────
 *
 * 1. **The axis is world-vertical, converted into the bone's parent space,
 *    and PRE-multiplied.** A bone's own axes run along the limb, this rig
 *    carries Blender's Z-up on its root, so post-multiplying a (0,1,0)
 *    axis-angle is not a yaw at all: it comes out as a tilt-and-roll mix,
 *    and the head lolls instead of turning. Expressing world +Y in the
 *    parent's frame and pre-multiplying is a true turn whatever the rig's
 *    conventions are, with nothing hard-coded to be wrong later.
 * 2. **The torso carries a third of it.** Nobody turns their head to a
 *    second monitor with their chest locked forward; a head that swivels
 *    alone reads as an owl. The upper spine takes a small share and the head
 *    the rest, so the whole upper body acknowledges the screen. The share is
 *    deliberately small, the spine's children include the arms, and his
 *    hands have to stay on the keyboard.
 *
 * Off while a story page holds the stage: its chapters play the left-desktop
 * clip deliberately and this must not fight it.
 */
const GAZE_BY_BEAT = { "experience-1": -0.26, "experience-2": 0.3, "experience-3": -0.3 } as const;

/** How much of the turn the upper spine takes; the head takes the rest. */
const SPINE_SHARE = 0.34;

const gaze = { value: 0 };
const gazeQuaternion = new Quaternion();
const parentQuaternion = new Quaternion();
const gazeAxis = new Vector3();

/**
 * What `turnBone` premultiplied onto each bone last frame, so it can be taken
 * back off before the mixer runs again.
 *
 * ── WHY THIS EXISTS: THE HEAD USED TO WIND ITSELF ROUND THE NECK ──
 *
 * `turnBone` premultiplies the gaze onto a quaternion the AnimationMixer owns.
 * That is only safe if the mixer rewrites the bone every frame, and it does
 * not: `PropertyMixer.apply` compares the pose it just blended against the one
 * it last wrote and skips the write when they match. The comparison reads its
 * OWN cache, never the bone, so it cannot see the turn we premultiplied after
 * it ran. On every skipped frame our turn survives and the next frame stacks
 * another on top of it, the head creeps round a few degrees a second until he
 * is looking backwards over his own shoulder while his body still faces the
 * desk, dragging the shoulders out with it via the spine's share.
 *
 * The give-away in a probe is that the angle never comes back and ignores the
 * sign flip between beat 2 (+0.3) and beat 3 (-0.3): it only ever winds one
 * way. A clamp would have hidden that; it is an accumulation bug, not a range
 * one.
 *
 * So the turn is removed before `animations.update()` rather than left on the
 * bone. Whether the mixer writes this frame or skips it, the pose it sees is
 * the clip's own, and the gaze is rebuilt from scratch on top of it.
 */
const gazeApplied = new Map<Bone, Quaternion>();
let gazeLive = false;

/** Puts the gaze bones back to the pose the clip last wrote. */
const clearGaze = () => {
  if (!gazeLive) return;
  // Unit quaternions, so `invert` is a conjugate, it undoes the premultiply
  // exactly. Safe to mutate in place: `turnBone` overwrites it before the next
  // clear, and `gazeLive` stops this running twice against one application.
  for (const [bone, applied] of gazeApplied) bone.quaternion.premultiply(applied.invert());
  gazeLive = false;
};

/** Turns one bone about the WORLD vertical, in its parent's frame. */
const turnBone = (bone: Bone, angle: number) => {
  if (!bone.parent) return;
  bone.parent.getWorldQuaternion(parentQuaternion).invert();
  gazeAxis.set(0, 1, 0).applyQuaternion(parentQuaternion);
  gazeQuaternion.setFromAxisAngle(gazeAxis, angle);
  bone.quaternion.premultiply(gazeQuaternion);

  let applied = gazeApplied.get(bone);
  if (!applied) gazeApplied.set(bone, (applied = new Quaternion()));
  applied.copy(gazeQuaternion);
  gazeLive = true;
};

const updateGaze = () => {
  let target = 0;

  if (!stageHold.value && sceneWeights.experience > 0.001) {
    let sum = 0;
    let bias = 0;
    for (const key of Object.keys(GAZE_BY_BEAT) as (keyof typeof GAZE_BY_BEAT)[]) {
      const weight = sceneWeights[key];
      sum += weight;
      bias += weight * GAZE_BY_BEAT[key];
    }
    if (sum > 0.001) {
      target = (bias / sum) * sceneWeights.experience * seated.value;
    }
  }

  gaze.value = lerp(gaze.value, target, Math.min(1, 0.06 * gsap.ticker.deltaRatio()));

  if (Math.abs(gaze.value) < 0.001) return;
  // Spine first: the head's share is measured on top of a torso that has
  // already turned, which is the order a body actually does it in.
  if (spineBone) turnBone(spineBone, gaze.value * SPINE_SHARE);
  if (headBone) turnBone(headBone, gaze.value * (1 - SPINE_SHARE));
};

const tick = () => {
  // Order matters: the gaze comes off, the mixer writes the clip pose, the gaze
  // goes back on. See `gazeApplied`.
  clearGaze();
  animations.update();
  updateGaze();

  const isContact = sceneWeights.contact > 0.001;

  if (isContact) {
    // the goodbye turns him away and walks him off along -Z; both are 0 until it runs
    transform.position.copy(contactPosition);
    transform.position.z -= goodbye.state.distance;
    transform.rotation.set(contactRotation.x, contactRotation.y + goodbye.state.yaw, contactRotation.z);
    uniforms.uProgress.value = 0;
    uniforms.uAmbientStrength.value = 0;
    transform.visible = true;
    return;
  }

  transform.position.copy(waypointsPosition);
  transform.rotation.copy(waypointsRotation);
  transform.rotation.y += storyTurn.value;

  //uniforms.uProgress.value = sceneWeightsInOut.about.in * 1.1 - 0.1;
  // About's scan dissolves him into the hologram; Experience runs it back so he
  // materialises again at the desk. `mix` here is a plain lerp, see
  // animations/transitions/experience.ts.
  const scan = aboutProgress.value * 1.1 - 0.1;
  uniforms.uProgress.value = mix(scan, -0.1, materialise.value);
  uniforms.uAmbientStrength.value = sceneWeightsInOut.about.in;

  if (!mesh) return;
  if (uniforms.uProgress.value > 0.999 && sceneWeights.contact > 0.99) {
    mesh.visible = false;
  } else {
    mesh.visible = true;
  }
};

const destroy = () => {
  //mesh = null;
  //transform.clear();
  face.destroy();
  gsap.ticker.remove(tick);
};

export const avatar = {
  init,
  destroy,
  getMesh: () => mesh,
  getRightHandBone: () => rightHandBone,
  tIdleIntensity,
  seated,
  materialise,
  waypointsPosition,
  waypointsRotation,
  storyTurn,
  uniforms,
  transform,
};
