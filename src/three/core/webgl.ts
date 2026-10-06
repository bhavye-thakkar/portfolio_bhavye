/**
 * ─── WHAT KIND OF WEBGL THIS BROWSER HAS ──────────────────────────────────
 *
 * Probed once, before anything else in `three/` loads, and in a module of its
 * own so that `utils/sizes.ts` can read it without importing the renderer
 * (which imports sizes: a cycle).
 *
 * `webglAvailable` is false when the browser will not hand out a WebGL2
 * context: hardware acceleration switched off, a policy, a blocklisted GPU,
 * or, as measured on the owner's own Chrome, the browser disabling its GPU
 * for the rest of the session after the GPU process crashed twice (the
 * system disk was full). Current Chrome has no software fallback, so
 * `new WebGLRenderer` just throws. Everything that needs a context asks this
 * first: the scene boot in three/index.ts, the loader's avatar and its
 * first-frame wait in usePreloader.ts, and NoWebgl.vue, which tells the
 * visitor why.
 *
 * `webglSoftware` is the middle case: a context is granted but drawn on the
 * CPU (Windows hands Chrome the "Microsoft Basic Render Driver" when the GPU
 * is off, elsewhere it is SwiftShader or llvmpipe). Everything works, slowly,
 * and shader compiles stall the whole compositor; see `bootNow` in
 * three/index.ts for what that does to the loader.
 *
 * ── CPU MODE ──────────────────────────────────────────────────────────────
 *
 * A software rasteriser pays for every fragment with CPU time, so the two
 * fragment multipliers that a GPU absorbs for free are switched off when it
 * is detected: the 1.5 device-pixel cap drops to 1 (utils/sizes.ts, 2.25x
 * fewer pixels) and the renderer's 4x MSAA is off (renderer.ts). Measured in
 * headless Chrome on SwiftShader at a phone's 390x844, both on: the hero
 * frame ran at 15-20fps and the orchid close-up at 14. The look is a touch
 * softer on model edges, which is the right trade on a machine that cannot
 * otherwise hold a frame rate at all.
 *
 * The flag is also stamped on `<html>` as `data-software-gl`, so a stylesheet
 * can switch off the one DOM animation that re-rasterises a full-screen layer
 * every frame (the Starry Night's star drift, ObjectDetail.vue). It is set
 * before Vue mounts, so no first paint ever runs with the drift on.
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

if (webglSoftware && typeof document !== "undefined") {
  document.documentElement.setAttribute("data-software-gl", "");
}
