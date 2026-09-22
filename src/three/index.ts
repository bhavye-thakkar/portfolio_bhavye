import { scene } from "./core/scene";
import { camera } from "./core/camera";
import { renderer, webglAvailable } from "./core/renderer";
import { objects } from "./objects";
import { renderTarget } from "./core/renderTarget";
import { threeSizes } from "./utils/sizes";
import { resources } from "../utils/resources";
import { raycast } from "./utils/raycast";
import { sceneWeights, sceneWeightsInOut, stageHold } from "../animations/scenes";
import { waypoints } from "../animations/waypoints";

let canvas: HTMLCanvasElement | null = null;
let pendingBoot: (() => void) | null = null;
let bootRequested = false;

const init = (_canvas: HTMLCanvasElement) => {
  canvas = _canvas;

  const boot = () => {
    threeSizes.init(_canvas);
    camera.init();
    renderTarget.init();
    renderer.init(canvas);

    objects.initHero();
    raycast.init();
    objects.initDeferred();

    // QA-SHIM temporary, remove before ship
    if (location.search.includes("qa=1")) {
      import("./objects/avatar").then(({ avatar }) =>
        import("./objects/workstation").then(({ workstation }) =>
          import("./objects/cv-document").then((cvDocumentModule) =>
            import("./utils/raycast").then(({ raycast }) => {
              (window as any).__qa = { renderer, scene, camera, threeSizes, objects, canvas, sceneWeights, sceneWeightsInOut, waypoints, stageHold, avatar, workstation, cvDocumentModule, raycast };
            }),
          ),
        ),
      );
    }
  };

  resources.once("ready", () => {
    // No context, no scene. The renderer would throw halfway through this list
    // and leave the half before it initialised; the page carries on as HTML.
    if (!webglAvailable) return;

    // The first boot waits for the loader to call for it, see `bootNow`.
    if (bootRequested) boot();
    else pendingBoot = boot;
  });
};

/**
 * ─── THE SCENE BOOT, ON THE LOADER'S CUE ──────────────────────────────────
 *
 * The boot is a run of long tasks (150-300ms each, measured) and, on a CPU
 * renderer, a shader compile that stalls the browser's whole compositor for
 * seconds. Run at "ready", it landed in the middle of the loader's walk: his
 * pose updated at 22fps with 0.2s holes while the door slid on smoothly, and on
 * the Microsoft Basic Render Driver the screen simply sat on the shut door from
 * 1s to 7.5s with the whole opening unpainted behind it.
 *
 * So the boot is parked at "ready", and usePreloader calls this once the avatar
 * has given the door its last shove and planted himself: the stall lands on a
 * nearly still frame, where it cannot be seen. Later boots (Home remounting
 * after a project page) find `bootRequested` set and run at once.
 */
const bootNow = () => {
  bootRequested = true;
  pendingBoot?.();
  pendingBoot = null;
};

const destroy = () => {
  pendingBoot = null;
  threeSizes.destroy();
  renderTarget.destroy();
  renderer.destroy();
  objects.destroy();
  // `init` adds two window listeners and a ticker callback and this never took
  // them off again, so every remount of Home left a live raycaster behind
  // hit-testing a scene that no longer existed.
  raycast.destroy();
  camera.destroy();
  canvas = null;
};

export const three = { init, destroy, bootNow };
