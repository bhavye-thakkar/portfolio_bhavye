import { PerspectiveCamera, Group, Vector3, Object3D } from "three";
import { threeSizes } from "../utils/sizes";
import { isTouch } from "../../utils/observer";
import gsap from "gsap";
import { scene } from "./scene";
import { waypoints } from "../../animations/waypoints";
import { sceneWeights, sceneWeightsInOut } from "../../animations/scenes";
import { sizes } from "../../utils/sizes";
import { clamp, damp, smoothstep } from "../../utils/math";

const PARALLAX_INTENSITY = 1;
const PARALLAX_SPEED = 0.6;
const contactPosition = {
  portrait: new Vector3(0, -8, 12),
  landscape: new Vector3(0, -8.5, 9),
};
const contactFocus = {
  portrait: new Vector3(0, -9.4, 0),
  landscape: new Vector3(0, -10.5, 0),
};

const instance = new PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 100);

const parallaxGroup = new Group();
scene.instance.add(parallaxGroup);
parallaxGroup.add(instance);

const cursor = { x: 0, y: 0 };

const init = () => {
  threeSizes.on("resize", resize);
  resize();

  if (!isTouch()) {
    window.addEventListener("mousemove", handleMouseMove);
  }

  gsap.ticker.add(tick);
  tick();
};

const handleMouseMove = (event: MouseEvent) => {
  cursor.x = event.clientX / threeSizes.width - 0.5;
  cursor.y = event.clientY / threeSizes.height - 0.5;
};

/**
 * The sway follows the pointer with a frame-rate independent ease, and each
 * frame's step is CLAMPED to 0.05 rather than skipped above it. The old guard
 * skipped the whole step whenever it was larger, and the step grows with the
 * frame delta, so on a slow frame, or after a quick flick of the mouse across
 * the window, the camera froze in place until the pointer came back towards it.
 */
const updateParallax = (object: Object3D) => {
  const delta = Math.min(gsap.ticker.deltaRatio(), 4);
  const parallaxX = cursor.x * PARALLAX_INTENSITY;
  const parallaxY = -cursor.y * PARALLAX_INTENSITY;
  object.position.x += clamp(damp(object.position.x, parallaxX, PARALLAX_SPEED * 0.1, delta) - object.position.x, -0.05, 0.05);
  object.position.y += clamp(damp(object.position.y, parallaxY, PARALLAX_SPEED * 0.1, delta) - object.position.y, -0.05, 0.05);
};

const calculateContactTransform = () => {
  const isLandscape = sizes.isLandscape;
  const breakpoint = isLandscape ? "landscape" : "portrait";
  const isMd = sizes.matchMedia("md");

  const inProgress = 1 - sceneWeightsInOut.contact.in;
  const outProgress = sceneWeightsInOut.contact.out;

  instance.position.copy(contactPosition[breakpoint]);
  //instance.position.y += inProgress * (isMd ? 4 : 6);
  //instance.position.y -= outProgress * (isMd ? 4 : 6);
  if (isLandscape && isMd) {
    instance.position.y += inProgress * 4;
    instance.position.y -= outProgress * 4;
  }

  instance.lookAt(contactFocus[breakpoint]);
};

const tick = () => {
  const isContact = sceneWeights.contact > 0.001;

  if (isContact === false) {
    instance.position.copy(waypoints.position);

    if (sizes.matchMedia("md")) {
      // About's exit drop would fight the Experience beats, which own the
      // camera once the stage is handed over. Both factors are smoothstepped
      // like the waypoint weights, so the drop eases in and out instead of
      // starting and stopping at full speed on the linear ramps behind it.
      //
      // Experience's `in`, not its weight: the weight falls back to 0 as the
      // stage rides out, which brought the whole 2.75 drop back in over those
      // 100vh and carried him up out of the frame faster than the page was
      // scrolling, so on a laptop the hand-over to Projects ran at double
      // speed. Past the ride-out the stage is off screen and this is unseen.
      instance.position.y -=
        smoothstep(sceneWeightsInOut.about.out) * 2.75 * (1 - smoothstep(sceneWeightsInOut.experience.in));
    }
  }

  updateParallax(parallaxGroup);

  if (isContact) {
    calculateContactTransform();
  } else {
    instance.lookAt(waypoints.focus);
  }
};

const resize = () => {
  instance.aspect = threeSizes.width / threeSizes.height;
  instance.updateProjectionMatrix();
};

const project = (point: Vector3): { x: number; y: number } => {
  const projected = point.clone();
  projected.project(instance);

  const x = projected.x * threeSizes.width * 0.5;
  const y = -projected.y * threeSizes.height * 0.5;

  return { x, y };
};

const destroy = () => {
  threeSizes.off("resize", resize);
  gsap.ticker.remove(tick);
  window.removeEventListener("mousemove", handleMouseMove);
  cursor.x = 0;
  cursor.y = 0;
};

export const camera = { init, destroy, instance, parallaxGroup, updateParallax, project };
