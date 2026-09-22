import { WebGLRenderer, Vector3 } from "three";
import gsap from "gsap";
import { scene } from "./scene";
import { renderTarget } from "./renderTarget";
import { camera } from "./camera";
import { sceneWeights } from "../../animations/scenes";
import { colors } from "../common/colors";
import { threeSizes } from "../utils/sizes";

import type { Camera, Object3D, Scene } from "three";

/**
 * False when the browser will not hand out a WebGL2 context: hardware
 * acceleration switched off, a policy, a blocklisted GPU, or, as measured on
 * the owner's own Chrome, the browser disabling its GPU for the rest of the
 * session after the GPU process crashed twice (the system disk was full).
 * Current Chrome has no software fallback, so `new WebGLRenderer` just throws.
 * Everything that needs a context asks this first: the scene boot in
 * three/index.ts, the loader's avatar and its first-frame wait in
 * usePreloader.ts, and NoWebgl.vue, which tells the visitor why.
 *
 * `webglSoftware` is the middle case: a context is granted but drawn on the
 * CPU (Windows hands Chrome the "Microsoft Basic Render Driver" when the GPU
 * is off, elsewhere it is SwiftShader or llvmpipe). Everything works, slowly,
 * and shader compiles stall the whole compositor; see `bootNow` in
 * three/index.ts for what that does to the loader.
 */
const probe = () => {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return { available: false, software: false };
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    // hand the probe's context straight back, browsers only allow a few
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return { available: true, software: /swiftshader|basic render|llvmpipe|softpipe|software/i.test(name) };
  } catch {
    return { available: false, software: false };
  }
};

export const { available: webglAvailable, software: webglSoftware } = probe();

let instance: WebGLRenderer | null = null;
let canvas: HTMLCanvasElement | null = null;
let visible = true;
let isActive = false;

/**
 * ── NO FRAMES FOR A CANVAS NOBODY CAN SEE ──────────────────────────────────
 *
 * Between the Experience ride-out and the Contact section the canvas is parked
 * below the Projects grid, entirely off-screen, and it used to render the full
 * scene every frame anyway. That is the whole GPU budget spent while the
 * visitor reads a DOM section, and it is also what the project page transition
 * competed with: the card grid is exactly where that click happens.
 *
 * The margin wakes the renderer a quarter of a screen before the canvas
 * scrolls in, so it never shows a stale frame on the way back into view.
 */
let onScreen = true;
let onScreenObserver: IntersectionObserver | null = null;

const emptyVector = new Vector3();

const init = (_canvas: HTMLCanvasElement | null) => {
  if (instance) return;
  canvas = _canvas;
  instance = new WebGLRenderer({
    canvas: canvas!,
    antialias: true,
    alpha: false,
  });
  // Error checking reads each program's link status and info logs right after
  // linking, which blocks the main thread until the driver has finished, the
  // opposite of what compileAsync is for. Profiled at 84ms of getShaderInfoLog
  // on the way back from a project page. Kept in dev, where the logs are wanted.
  instance.debug.checkShaderErrors = import.meta.env.DEV;

  if (canvas && "IntersectionObserver" in window) {
    onScreenObserver = new IntersectionObserver(
      (entries) => {
        onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
      },
      { rootMargin: "25% 0px" },
    );
    onScreenObserver.observe(canvas);
  }

  gsap.ticker.add(tick);
  threeSizes.on("resize", resize);
  resize();
};

const getInstance = () => {
  if (!instance) throw new Error("Renderer not initialized");
  return instance;
};

const resize = () => {
  if (!instance) return;
  instance.setSize(threeSizes.width, threeSizes.height, false);
  instance.setPixelRatio(threeSizes.pixelRatio);
};

const tick = () => {
  const shouldBeVisible = !camera.instance.position.equals(emptyVector) && isActive;

  if (canvas && shouldBeVisible !== visible) {
    canvas.style.visibility = shouldBeVisible ? "visible" : "hidden";
    visible = shouldBeVisible;
  }

  if (!instance || !shouldBeVisible || !onScreen) return;

  // The Experience scene keeps the same grid-floor backdrop, so it needs the
  // render target refreshed too, its camera moves through three beats.
  if (sceneWeights.about > 0.001 || sceneWeights.experience > 0.001) {
    renderTarget.render();
  }

  const color = sceneWeights.contact > 0.001 ? colors.beigeDark : colors.beigeLight;
  instance.setClearColor(color);
  instance.render(scene.instance, camera.instance);
};

const compile = async () => {
  await Promise.all([compileScene(camera.instance, scene.instance), compileScene(camera.instance, renderTarget.scene)]);
};

const setIsActive = (value: boolean) => {
  isActive = value;
};

const compileScene = async (camera: Camera, sceneToCompile: Scene) => {
  if (!instance) {
    console.error("Renderer not initialized");
    return;
  }

  const invisibleObjects: Object3D[] = [];
  const instancedWithOriginalCullState: [Object3D, boolean][] = [];

  sceneToCompile.traverse((child) => {
    if (child.visible === false) {
      invisibleObjects.push(child);
      child.visible = true;
    }

    if (child.frustumCulled === true) {
      instancedWithOriginalCullState.push([child, child.frustumCulled]);
      child.frustumCulled = false; // Ensure it's rendered
    }
  });

  /**
   * `compileAsync` gathers the scene's materials synchronously (so the
   * visibility juggling above/below stays correct) and then links the
   * programs via KHR_parallel_shader_compile where the driver offers it -
   * the main thread stays free instead of freezing for the whole link, which
   * is what used to hold the preloader up for seconds after the downloads
   * were already done.
   */
  const compiled = instance.compileAsync(sceneToCompile, camera);

  invisibleObjects.forEach((child) => (child.visible = false));
  instancedWithOriginalCullState.forEach(([child, originalState]) => {
    child.frustumCulled = originalState;
  });

  await compiled;

  renderTarget.render();
};

const destroy = () => {
  if (!instance) return;
  instance.dispose();
  gsap.ticker.remove(tick);
  onScreenObserver?.disconnect();
  onScreenObserver = null;
  onScreen = true;
  instance = null;
  visible = true;
};

export const renderer = { init, destroy, getInstance, compile, setIsActive };
