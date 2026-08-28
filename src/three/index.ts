import { scene } from "./core/scene";
import { camera } from "./core/camera";
import { renderer } from "./core/renderer";
import { objects } from "./objects";
import { renderTarget } from "./core/renderTarget";
import { threeSizes } from "./utils/sizes";
import { resources } from "../utils/resources";
import { raycast } from "./utils/raycast";
import { sceneWeights, sceneWeightsInOut, stageHold } from "../animations/scenes";
import { waypoints } from "../animations/waypoints";

let canvas: HTMLCanvasElement | null = null;

const init = (_canvas: HTMLCanvasElement) => {
  canvas = _canvas;

  resources.once("ready", () => {
    threeSizes.init(_canvas);
    camera.init();
    renderTarget.init();
    renderer.init(canvas);

    objects.init();
    raycast.init();

    // QA-SHIM temporary, remove before ship
    if (location.search.includes("qa=1")) {
      (window as any).__qa = { renderer, scene, camera, threeSizes, objects, canvas, sceneWeights, sceneWeightsInOut, waypoints, stageHold };
    }
  });
};

const destroy = () => {
  threeSizes.destroy();
  renderTarget.destroy();
  renderer.destroy();
  objects.destroy();
  camera.destroy();
  canvas = null;
};

export const three = { init, destroy };
