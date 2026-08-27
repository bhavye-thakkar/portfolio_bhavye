import { resources } from "../../../utils/resources";
import { Mesh, Vector3, Euler, Group, ShaderMaterial, LinearSRGBColorSpace } from "three";
import { scene } from "../../core/scene";
import { animations } from "./animations";
import { sceneWeights, sceneWeightsInOut } from "../../../animations/scenes";
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
import { mix } from "../../../utils/math";
//import { avatarHologram } from "./hologram";
import { goodbye } from "./goodbye";

import type { Material, Bone, Texture } from "three";

let mesh: Mesh | null = null;
let rightHandBone: Bone | null = null;

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

  // Smart watch on the left wrist: black body, lighter screen, both off the
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

  scene.instance.add(transform);
};

const tick = () => {
  animations.update();

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

  //uniforms.uProgress.value = sceneWeightsInOut.about.in * 1.1 - 0.1;
  // About's scan dissolves him into the hologram; Experience runs it back so he
  // materialises again at the desk. `mix` here is a plain lerp — see
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
  uniforms,
  transform,
};
