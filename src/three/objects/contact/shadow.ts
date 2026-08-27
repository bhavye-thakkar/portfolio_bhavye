import { resources } from "../../../utils/resources";
import { contact } from ".";
import { getShadowMaterial } from "../../common/materials";
import { colors } from "../../common/colors";
import { Color } from "three";
import { goodbye } from "../avatar/goodbye";

import type { Object3D } from "three";

const backgroundColor = colors.beigeDark.clone().convertLinearToSRGB();
const shadowColor = new Color("rgb(208, 185, 156)");
/** world-space radius of the avatar's baked contact shadow */
const FIGURE_RADIUS = 1.7;

const init = () => {
  initObjects();
};

const initObjects = () => {
  const resource = resources.items["contact-model"];
  const texture = resources.items["contact-shadow-texture"];
  texture.flipY = false;

  const mesh = resource.scene.children.find((child: Object3D) => child.name === "shadow-catcher");
  if (!mesh) return;

  mesh.material = getShadowMaterial();
  mesh.onBeforeRender = () => {
    const { uniforms } = mesh.material;
    uniforms.uTexture.value = texture;
    uniforms.uColorBackground.value = backgroundColor;
    uniforms.uColorShadow.value = shadowColor;

    // the avatar's shadow is baked at his standing spot (world origin), so the
    // goodbye lifts it out — figure-shadow.ts carries a fresh one along with him
    uniforms.uFigureFrom.value.set(0, 0);
    uniforms.uFigureBlend.value = goodbye.state.shadow;
    uniforms.uFigureRadius.value = FIGURE_RADIUS;
  };

  mesh.renderOrder = -1000;

  contact.group.add(mesh);
};

const destroy = () => {};

export const shadow = { init, destroy };
