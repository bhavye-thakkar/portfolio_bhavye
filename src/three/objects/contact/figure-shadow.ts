import { CanvasTexture, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three";

import { scene } from "../../core/scene";
import { avatar } from "../avatar";
import { goodbye } from "../avatar/goodbye";

/**
 * A soft contact shadow that travels with the avatar during the goodbye walk.
 *
 * The scene's own shadows are painted into the shadow-catcher texture, but that
 * quad only reaches z ≈ -4.5 at x = 0 — barely a third of the walk — and its
 * copy of the avatar's shadow is baked at his standing spot. So the catcher's
 * shader erases the baked patch (see shaders/shadow-catcher) and this mesh lays a
 * fresh one down wherever he actually is, on or off the quad.
 */

const SIZE = 3.1;
/** just above the floor plane, which sits at y = -13 */
const FLOOR_Y = -12.99;
const OPACITY = 0.5;

let mesh: Mesh | null = null;
let texture: CanvasTexture | null = null;
let material: MeshBasicMaterial | null = null;
let geometry: PlaneGeometry | null = null;

/** Radial falloff, flat in the middle so the core reads as contact, not a vignette. */
const createTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) return null;

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.42, "rgba(255,255,255,0.92)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);

  const result = new CanvasTexture(canvas);
  result.colorSpace = SRGBColorSpace;
  return result;
};

const init = () => {
  if (mesh) return;

  texture = createTexture();
  if (!texture) return;

  geometry = new PlaneGeometry(SIZE, SIZE);
  geometry.rotateX(-Math.PI / 2);

  material = new MeshBasicMaterial({
    // the catcher's own shadow tint, so the two read as one lighting setup
    color: "rgb(208, 185, 156)",
    map: texture,
    transparent: true,
    opacity: 0,
    // the floor never writes depth, so nothing hides it there; the parcels do,
    // so they still occlude it correctly once he walks behind them
    depthWrite: false,
  });

  mesh = new Mesh(geometry, material);
  mesh.renderOrder = -900;
  mesh.visible = false;

  // added to the scene root, like the avatar, so it can track him in world space
  // without unwinding the contact group's own offset and yaw
  scene.instance.add(mesh);
};

const tick = () => {
  if (!mesh || !material) return;

  const strength = goodbye.state.shadow;
  mesh.visible = strength > 0.001;
  if (!mesh.visible) return;

  material.opacity = OPACITY * strength;
  mesh.position.set(avatar.transform.position.x, FLOOR_Y, avatar.transform.position.z);
};

const destroy = () => {
  geometry?.dispose();
  material?.dispose();
  texture?.dispose();
  if (mesh) scene.instance.remove(mesh);
  mesh = null;
  geometry = null;
  material = null;
  texture = null;
};

export const figureShadow = { init, tick, destroy };
