import gsap from "gsap";
import {
  AnimationMixer,
  Box3,
  Group,
  LinearSRGBColorSpace,
  LoopRepeat,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SkinnedMesh,
  Vector3,
  WebGLRenderer,
} from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { resources } from "../utils/resources";
import { webglAvailable } from "./core/renderer";
import { createGaitClip } from "./objects/avatar/gait";
import walkSheet from "../assets/loader/walk.webp";
import { spectacles } from "./objects/avatar/spectacles";
import matcapVertexShader from "./shaders/avatar-matcap/vertex.glsl";
import matcapFragmentShader from "./shaders/avatar-matcap/fragment.glsl";
import headVertexShader from "./shaders/avatar-head/vertex.glsl";
import headFragmentShader from "./shaders/avatar-head/fragment.glsl";
import faceVertexShader from "./shaders/avatar-face/vertex.glsl";
import faceFragmentShader from "./shaders/avatar-face/fragment.glsl";
import lensFragmentShader from "./shaders/avatar-lens/fragment.glsl";

import type { GaitOptions } from "./objects/avatar/gait";
import type { AnimationClip, Object3D, Texture } from "three";

/**
 * ─── THE AVATAR IN THE LOADER ─────────────────────────────────────────────
 *
 * The same avatar.glb that sits at the desk, pushing the loader's door across
 * the screen and off it. Drawn by a renderer of its own into a transparent
 * canvas that rides the door's edge (index.html), so the door carries him and
 * nothing here knows where it is.
 *
 * ── THE DOOR MOVES, HIS LEGS FOLLOW ───────────────────────────────────────
 *
 * Each frame the distance the door has carried him is turned into walk phase,
 * one cycle per stride, with no clock, no cap and no smoothing: the planted
 * foot cannot slide, whatever the frame rate does. The door's speed is chosen
 * by usePreloader.ts from `cyclePx()`, so the walk lands between a brisk walk
 * and a scramble on any screen. Two earlier designs failed here: a door on CSS
 * timings of its own dragged him eleven strides per step (skating), and a door
 * slowed to a 2-steps-a-second stroll with a stop beside the name read as
 * sluggish and unfinished. The reference's character crosses at about 40% of
 * the screen a second with quick steps, hands on the curtain, never stopping.
 *
 * ── HIS HANDS ARE ON THE DOOR ─────────────────────────────────────────────
 *
 * The camera is placed by projecting every vertex of the posed body and
 * sliding sideways until the furthest-forward one (a fingertip) lands on the
 * door's edge line. Framing off the bounding box left a gap of 12% of the
 * canvas: the hands sit nearer the middle of his depth than the box's near
 * face, so under perspective they project well short of the box corner.
 *
 * The mixer owns every bone; nothing else writes to the skeleton.
 *
 * ── AND WITHOUT WEBGL, A SHEET OF HIS OWN FRAMES ──────────────────────────
 *
 * A browser with no GPU (Chrome refuses WebGL then, it no longer falls back
 * to software) still gets him: `walk.webp` is one walk cycle of this very
 * model, captured from this renderer, stepped by the door's distance exactly
 * as the live one is. Re-capture it whenever WALK or the framing changes
 * (the QA shim's `snapshot`, see the session notes).
 */

const NEEDS = [
  "avatar-model",
  "matcap-black",
  "matcap-gray",
  "matcap-skin",
  "matcap-white",
  "head-texture",
  "face-texture",
];

/**
 * Driving a heavy door: long strides, feet a little behind the hips, leaning
 * in, arms out at chest height. Lengths are in leg lengths, see gait.ts.
 */
const WALK: Partial<GaitOptions> = {
  stride: 2,
  lift: 0.15,
  lean: 0.3,
  trail: 0.12,
  headLevel: 0.55,
  arms: { mode: "push", upper: -0.3, fore: 0.1, hand: 0.95 },
};

/**
 * The pre-rendered fallback: 16 frames of one cycle, 4 by 4, row by row, and
 * how many px of door one cycle covers per px of the box's height (measured
 * off the live renderer at capture: cyclePx / canvas height).
 */
const SHEET = { url: walkSheet, frames: 16, cols: 4, rows: 4, stridePerHeight: 0.754 };

/** how much of the canvas height he stands in */
const FILL = 0.94;
/**
 * Where across the canvas his hands end. The canvas overlaps the door by 6% of
 * its width (index.html, `.preloader-walker`), so 0.95 puts the fingertips 1%
 * past the door's edge: pressing on it, never short of it.
 */
const PALMS_AT = 0.95;

const whenLoaded = () =>
  new Promise<void>((resolve) => {
    const has = () => NEEDS.every((name) => resources.items[name]);
    if (has()) return resolve();
    const onProgress = () => {
      if (!has()) return;
      resources.off("progress", onProgress);
      resolve();
    };
    resources.on("progress", onProgress);
  });

const texture = (name: string): Texture => {
  const tex = resources.items[name];
  tex.colorSpace = LinearSRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
};

const mountSheet = async (canvas: HTMLCanvasElement) => {
  const clip = document.createElement("div");
  clip.className = "preloader-sheet";
  const img = new Image();
  img.decoding = "async";
  img.alt = "";
  img.style.width = `${SHEET.cols * 100}%`;
  img.style.height = `${SHEET.rows * 100}%`;
  img.src = SHEET.url;
  clip.append(img);
  canvas.replaceWith(clip);
  // rejects on a failed load, which fails the mount: the door then goes alone
  await img.decode();

  let lastX = clip.getBoundingClientRect().left;
  let phase = 0;
  let shown = -1;
  const tick = () => {
    const box = clip.getBoundingClientRect();
    phase += Math.max(0, box.left - lastX) / (SHEET.stridePerHeight * box.height);
    lastX = box.left;
    const frame = Math.floor((phase % 1) * SHEET.frames) % SHEET.frames;
    if (frame === shown) return;
    shown = frame;
    img.style.transform = `translate(${(-(frame % SHEET.cols) * 100) / SHEET.cols}%, ${(-Math.floor(frame / SHEET.cols) * 100) / SHEET.rows}%)`;
  };
  gsap.ticker.add(tick);
  tick();

  return {
    cyclePx: () => SHEET.stridePerHeight * clip.getBoundingClientRect().height,
    dispose: () => gsap.ticker.remove(tick),
  };
};

const mount = async (canvas: HTMLCanvasElement) => {
  if (!webglAvailable) return mountSheet(canvas);
  await whenLoaded();

  const uniforms = { uProgress: { value: 0 }, uAmbientStrength: { value: 0 } };
  const materials: ShaderMaterial[] = [];
  const matcap = (name: string) => {
    const material = new ShaderMaterial({
      vertexShader: matcapVertexShader,
      fragmentShader: matcapFragmentShader,
      transparent: true,
      uniforms: { uMatcap: { value: texture(name) }, ...uniforms },
    });
    materials.push(material);
    return material;
  };
  const head = texture("head-texture");
  head.flipY = false;
  const headMaterial = new ShaderMaterial({
    vertexShader: headVertexShader,
    fragmentShader: headFragmentShader,
    transparent: true,
    uniforms: { uHeadTexture: { value: head }, ...uniforms },
  });
  const faceMaterial = new ShaderMaterial({
    vertexShader: faceVertexShader,
    fragmentShader: faceFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: { uTexture: { value: texture("face-texture") }, uFrame: { value: 0 }, ...uniforms },
  });
  const lensMaterial = new ShaderMaterial({
    vertexShader: matcapVertexShader,
    fragmentShader: lensFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: { ...uniforms },
  });
  materials.push(headMaterial, faceMaterial, lensMaterial);

  const resource = resources.items["avatar-model"];
  const mesh = cloneSkeleton(resource.scene.children[0]) as Mesh;
  mesh.frustumCulled = false;
  mesh.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.frustumCulled = false;
    child.renderOrder = child.name === "face" ? 25 : 24;
    if (child.name === "face") child.material = faceMaterial;
    else if (child.name === "head") child.material = headMaterial;
    else if (["black", "gray", "skin", "white"].includes(child.name)) child.material = matcap(`matcap-${child.name}`);
    else child.material = matcap("matcap-black");
  });
  const brain = mesh.getObjectByName("brain");
  if (brain) mesh.remove(brain);
  spectacles.init(mesh, matcap("matcap-black"), lensMaterial, matcap("matcap-skin"));

  // Same as the desk avatar's setup: the armature's own roll is dropped, and
  // the facing is a parent group's yaw, never the armature's. The model faces
  // -Z on its own, so -PI/2 turns him to +X: towards the door on his right.
  const scene = new Scene();
  mesh.rotation.z = 0;
  const rig = new Group();
  rig.rotation.y = -Math.PI / 2;
  rig.add(mesh);
  scene.add(rig);

  const skinned: SkinnedMesh[] = [];
  mesh.traverse((child) => child instanceof SkinnedMesh && skinned.push(child));
  const bounds = new Box3();
  const pose = () => {
    rig.updateMatrixWorld(true);
    skinned.forEach((child) => child.skeleton.update());
  };

  // The walk, built on t-idle's first frame. timeScale 0: the pose is whatever
  // `time` is set to, see the tick.
  const tIdle = resource.animations.find((clip: AnimationClip) => clip.name === "t-idle");
  const mixer = new AnimationMixer(mesh as Object3D);
  const scrubbed = (options: Partial<GaitOptions>) => {
    const gait = createGaitClip(mesh, tIdle, options);
    const action = mixer.clipAction(gait.clip);
    action.loop = LoopRepeat;
    action.timeScale = 0;
    action.play();
    return { action, stride: gait.stride };
  };
  let walking = scrubbed(WALK);
  let walk = walking.action;
  // world units of ground per walk cycle
  let stride = walking.stride;

  const camera = new PerspectiveCamera(24, 1, 0.1, 100);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

  // Framed off the POSED body. `precise` runs the vertices through the bones;
  // the plain bounds are the bind pose, which on this rig sits metres away.
  const halfTan = Math.tan((camera.fov * Math.PI) / 360);
  let distance = 1;
  let cyclePx = 200;
  const fit = () => {
    walk.weight = 1;
    walk.time = 0.3;
    mixer.update(0);
    pose();
    bounds.setFromObject(mesh, true);
    distance = (bounds.max.y - bounds.min.y) / (2 * FILL * halfTan);
  };
  /** the furthest forward any vertex of the body projects, in clip space, over a walk cycle */
  const vertex = new Vector3();
  const furthest = () => {
    let max = -Infinity;
    for (const phase of [0.05, 0.3, 0.55, 0.8]) {
      walk.time = phase;
      mixer.update(0);
      pose();
      for (const child of skinned) {
        const position = child.geometry.attributes.position!;
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i);
          child.applyBoneTransform(i, vertex);
          vertex.applyMatrix4(child.matrixWorld).project(camera);
          if (vertex.x > max) max = vertex.x;
        }
      }
    }
    return max;
  };
  const frame = () => {
    const box = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(box.width));
    const height = Math.max(1, Math.round(box.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camera.position.set(bounds.max.x, bounds.min.y + distance * halfTan, bounds.max.z + distance);
    camera.lookAt(camera.position.x, camera.position.y, 0);
    // slide until the fingertips sit at PALMS_AT: the shift is exact for a
    // point at `distance`, the hands are nearly there, two passes settle it
    for (let pass = 0; pass < 2; pass++) {
      camera.updateMatrixWorld(true);
      camera.position.x += (furthest() - (PALMS_AT * 2 - 1)) * distance * halfTan * camera.aspect;
    }
    // one walk cycle of ground, in CSS pixels, at the depth he stands at
    cyclePx = (stride * height) / (2 * camera.position.z * halfTan);
  };
  fit();
  frame();

  let frames = 0;
  // QA-SHIM temporary, remove before ship
  const qaLog: number[][] | null = location.search.includes("qa=1") ? ((window as any).__loaderLog = []) : null;
  let pinned: number | null = null;
  let lastX = canvas.getBoundingClientRect().left;
  let phase = 0;

  const tick = () => {
    // QA-SHIM temporary, remove before ship
    const began = qaLog ? performance.now() : 0;
    // The door carried him this far since the last frame: that much walk, no
    // more, no less. A dropped frame arrives as one larger step, never a slide.
    const x = canvas.getBoundingClientRect().left;
    phase += Math.max(0, x - lastX) / cyclePx;
    lastX = x;
    if (pinned !== null) phase = pinned;
    walk.time = phase % 1;
    mixer.update(0);
    renderer.render(scene, camera);
    frames++;
    // QA-SHIM temporary, remove before ship
    if (qaLog)
      qaLog.push([
        Math.round(began * 10) / 10,
        Math.round(x * 10) / 10,
        +phase.toFixed(3),
        +(performance.now() - began).toFixed(2),
      ]);
  };
  gsap.ticker.add(tick);
  window.addEventListener("resize", frame);

  // QA-SHIM temporary, remove before ship
  if (location.search.includes("qa=1")) {
    (window as any).__loaderAvatar = {
      mesh,
      camera,
      bounds,
      mixer,
      frame,
      scene,
      get walk() {
        return walk;
      },
      get gait() {
        return { phase, cyclePx, stride };
      },
      // a phase 0..1 pins the walk there, null lets go
      pin: (at: number | null) => {
        pinned = at;
      },
      // the posed frame at a phase as a PNG: read straight after the draw, before the compositor takes the buffer
      snapshot: (at: number) => {
        walk.time = at % 1;
        mixer.update(0);
        renderer.render(scene, camera);
        return canvas.toDataURL("image/png");
      },
      regait: (overrides: Partial<GaitOptions>) => {
        walk.stop();
        mixer.uncacheAction(walk.getClip());
        walking = scrubbed({ ...WALK, ...overrides });
        walk = walking.action;
        stride = walking.stride;
        fit();
        frame();
      },
    };
  }

  await new Promise<void>((resolve) => {
    const check = () => (frames > 0 ? resolve() : requestAnimationFrame(check));
    check();
  });

  return {
    /** how many CSS pixels of door one of his walk cycles covers, at the size he is drawn */
    cyclePx: () => cyclePx,
    dispose: () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", frame);
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
};

export const loaderAvatar = { mount };
