import { WebGLRenderTarget, Scene } from "three";
import { renderer } from "../renderer";
import { threeSizes } from "../../utils/sizes";
import { camera as mainCamera } from "../camera";

const instance = new WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: 0,
  depthBuffer: false,
  stencilBuffer: false,
});

const scene = new Scene();
scene.add(mainCamera.parallaxGroup);

const init = () => {
  threeSizes.on("resize", resize);
  resize();
};

const render = () => {
  const rendererInstance = renderer.getInstance();
  rendererInstance.setRenderTarget(instance);
  rendererInstance.setClearColor("#0169b4");
  rendererInstance.render(scene, mainCamera.instance);
  rendererInstance.setRenderTarget(null);
};

const destroy = () => {
  threeSizes.off("resize", resize);
};

/**
 * Half resolution. This target holds the grid floor and About's rising
 * particles, and the only thing that reads it is the dark-plane composite,
 * which does one bilinear `texture2D` of it under a vignette (the bloom
 * uniforms on that material are declared and never used by its GLSL). So the
 * trade is honest: the backdrop is upscaled 2x, which softens the grid's thin
 * lines a little, in exchange for quartering a full-screen pass that runs
 * every frame for the whole of About and Experience. That pass was half the
 * per-frame cost of those sections, and the grid is a dark backdrop behind
 * the avatar, so the softness is the right side of the trade.
 *
 * Anything that sizes itself in FRAMEBUFFER pixels inside this target has to
 * know about this: `gl_PointSize` is one, see `lab/particles.ts`, which reads
 * `SCALE` to keep its points the same size on screen.
 */
export const SCALE = 0.5;

const resize = () => {
  const { width, height, pixelRatio } = threeSizes;
  instance.setSize(Math.round(width * pixelRatio * SCALE), Math.round(height * pixelRatio * SCALE));
};

export const renderTarget = { render, scene, init, instance, destroy };
