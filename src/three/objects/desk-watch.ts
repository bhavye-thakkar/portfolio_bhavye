import {
  Box3,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshMatcapMaterial,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { getMatcap, createContactShadow } from "./workstation/materials";
import { raycast } from "../utils/raycast";
import { registerInspectTarget } from "../../animations/inspect";
import { useRouter } from "../../composables/useRouter";
import { lerp } from "../../utils/math";
import { disposeDialTexture, getDialTexture } from "./timex-dial";

import type { BufferGeometry, Material, Texture } from "three";
import type { ClickableBox3 } from "../types";

/**
 * ─── THE WATCH ON THE DESK ────────────────────────────────────────────────
 *
 * A wristwatch lying face up on the laminate, strap curled, the way one sits
 * when it comes off to type. Hover lifts it, clicking opens `/object/timex`.
 *
 * ── THE SAME WATCH HE WEARS AT WORK ───────────────────────────────────────
 *
 * On the hero desk it lies beside the keyboard, taken off; in Experience it is
 * on his wrist (`avatar/watch.ts` builds the wrist version off the same dial
 * canvas, `timex-dial.ts`), so the office desk does not get one. The round
 * smartwatch he wears at home is the other watch, and the two are meant to be
 * told apart at a glance: a dial with hands, and a screen.
 *
 * Still a factory, like `envelope.ts`, because `room/index.ts` is not the only
 * place a desk prop could ever live, but only the hero room builds one now.
 *
 * ── WHAT THE PANEL IS ALLOWED TO SAY ──────────────────────────────────────
 *
 * `content/objects.ts` owns the copy, and it names the brand and the owner's
 * own reference and nothing else. No case size, no movement, no water rating:
 * none of that is published anywhere this project can check, and a spec sheet
 * invented to fill a table is the one thing a portfolio must never ship. The
 * geometry below is likewise a generic round three-hander, not a claim about
 * what that reference looks like.
 */

export type DeskWatchOptions = {
  /** Where it lies, in the parent group's own space. The desk surface. */
  position: [number, number, number];
  yaw: number;
  /** 1 is the Experience workstation's scale. */
  scale?: number;
  /** Whether this one's scene is on screen. Collapses the hit box when false. */
  isOnStage: () => boolean;
  /**
   * Whether the inspect camera should be told about this instance. Only the
   * hero room's one says yes: `animations/inspect.ts` derives its pose from the
   * hero waypoint, so registering a second box would have the two instances
   * overwrite each other in its `targets` map and the camera would frame
   * whichever registered last.
   */
  framed?: boolean;
  /** A multiply-blended pool under it. The baked hero room does not need one. */
  shadow?: boolean;
  renderOrder?: number;
};

/** Case radius. Everything else below is derived from it. */
const R = 0.115;
const CASE_H = 0.052;

const STEEL = new Color(0xa2aab4);
const STEEL_HOVER = new Color(0xdfe8f4);

export type DeskWatch = {
  init: () => void;
  destroy: () => void;
  tick: (delta: number) => void;
  group: Group;
  setOpacity: (value: number) => void;
};

const router = useRouter();

export const createDeskWatch = (options: DeskWatchOptions): DeskWatch => {
  const order = options.renderOrder ?? 12.6;

  const group = new Group();
  /** Everything the hover lift moves as one piece. */
  const body = new Group();

  let disposables: (BufferGeometry | Material | Texture)[] = [];
  let materials: Material[] = [];
  let steelMaterial: MeshMatcapMaterial | null = null;

  const box = new Box3() as ClickableBox3;
  const boxCentre = new Vector3();
  const boxSize = new Vector3();

  let hover = 0;
  let opacity = 1;

  /**
   * ── THE STRAP ─────────────────────────────────────────────────────────────
   *
   * Four short slabs a side, each one turned a little further and dropped a
   * little lower than the last, so the leather falls away from the lugs and
   * settles on the desk instead of sticking out flat. Cheaper than a curve and,
   * at this size, indistinguishable from one: what the eye reads is that the
   * strap is not straight.
   */
  const strapSegments = (sign: 1 | -1): BufferGeometry[] => {
    const parts: BufferGeometry[] = [];
    let z = sign * (R + 0.03);
    let y = CASE_H * 0.42;
    let tilt = sign * 0.34;
    for (let i = 0; i < 4; i++) {
      const width = 0.15 - i * 0.012;
      const segment = new BoxGeometry(width, 0.022, 0.115);
      segment.rotateX(tilt);
      segment.translate(0, y, z);
      parts.push(segment);
      z += sign * 0.1;
      y = Math.max(0.012, y - 0.028);
      tilt *= 0.45;
    }
    // The buckle on the long side only, so the two ends are not a mirror image.
    if (sign === 1) {
      const buckle = new TorusGeometry(0.045, 0.008, 6, 14);
      buckle.rotateY(Math.PI / 2);
      buckle.translate(0, 0.014, z - 0.02);
      parts.push(buckle);
    }
    return parts;
  };

  const build = () => {
    const steel = new MeshMatcapMaterial({
      matcap: getMatcap("metal"),
      color: STEEL.getHex(),
      transparent: true,
    });
    steelMaterial = steel;

    const leather = new MeshMatcapMaterial({
      matcap: getMatcap("fabric"),
      color: 0x3a3128,
      transparent: true,
    });

    // ── case, bezel, crown and lugs, one merged mesh in steel
    const caseGeometry = new CylinderGeometry(R, R * 0.94, CASE_H, 30);
    caseGeometry.translate(0, CASE_H / 2, 0);

    const bezel = new TorusGeometry(R - 0.012, 0.014, 8, 30);
    bezel.rotateX(Math.PI / 2);
    bezel.translate(0, CASE_H, 0);

    const crown = new CylinderGeometry(0.019, 0.019, 0.03, 10);
    crown.rotateZ(Math.PI / 2);
    crown.translate(R + 0.012, CASE_H * 0.55, 0);

    const lugs = [1, -1].map((sign) => {
      const lug = new BoxGeometry(0.13, 0.022, 0.05);
      lug.translate(0, CASE_H * 0.5, sign * (R - 0.005));
      return lug;
    });

    const steelParts = [caseGeometry, bezel, crown, ...lugs].map((geometry) =>
      geometry.index ? geometry.toNonIndexed() : geometry,
    );
    const steelMerged = mergeGeometries(steelParts);
    steelParts.forEach((part) => part.dispose());
    if (steelMerged) {
      const mesh = new Mesh(steelMerged, steel);
      mesh.renderOrder = order;
      mesh.frustumCulled = false;
      body.add(mesh);
      disposables.push(steelMerged);
    }

    const strapParts = [...strapSegments(1), ...strapSegments(-1)].map((geometry) =>
      geometry.index ? geometry.toNonIndexed() : geometry,
    );
    const strapMerged = mergeGeometries(strapParts);
    strapParts.forEach((part) => part.dispose());
    if (strapMerged) {
      const mesh = new Mesh(strapMerged, leather);
      mesh.renderOrder = order - 0.02;
      mesh.frustumCulled = false;
      body.add(mesh);
      disposables.push(strapMerged);
    }

    // ── the dial, a hair under the bezel's inner edge
    const dial = new CircleGeometry(R - 0.021, 30);
    dial.rotateX(-Math.PI / 2);
    dial.translate(0, CASE_H + 0.004, 0);
    const dialMaterial = new MeshBasicMaterial({
      map: getDialTexture(),
      transparent: true,
      toneMapped: false,
    });
    const dialMesh = new Mesh(dial, dialMaterial);
    dialMesh.renderOrder = order + 0.04;
    dialMesh.frustumCulled = false;
    body.add(dialMesh);
    disposables.push(dial, dialMaterial);

    materials.push(steel, leather, dialMaterial);
    disposables.push(steel, leather);

    group.add(body);

    // Draws AFTER the shadow it stands in, or a multiply blend darkens the
    // watch instead of the desk. Same rule as the envelope.
    if (options.shadow) {
      const shadow = createContactShadow(R * 3.4, R * 6.4, 0, 0.003, 0, 0.4);
      if (shadow) {
        group.add(shadow.mesh);
        materials.push(shadow.mesh.material as Material);
        disposables.push(...shadow.disposables);
      }
    }

    group.position.set(options.position[0], options.position[1], options.position[2]);
    group.rotation.y = options.yaw;
    group.scale.setScalar(options.scale ?? 1);
  };

  const init = () => {
    if (group.children.length) return;
    build();

    box.onClick = () => {
      if (!options.isOnStage()) return;
      router.push("/object/timex");
    };
    box.hoverSound = "hover";
    // Cyan, the site's own interactive note. Explicitly NOT the orange ring
    // cursor, which means "this opens a case study".
    box.cursor = "circle-cyan";
    raycast.boxesToCheck.push(box);

    if (options.framed) registerInspectTarget("timex", box);
  };

  const setOpacity = (value: number) => {
    opacity = value;
  };

  const tick = (delta: number) => {
    const visible = options.isOnStage();
    group.visible = visible;
    if (!visible) {
      box.makeEmpty();
      return;
    }

    group.updateWorldMatrix(true, true);
    box.setFromObject(body);

    /**
     * Grown UPWARD, for the reason spelled out at length in `envelope.ts`: a
     * flat prop seen along a desk projects to a strip a few pixels tall, and the
     * hover lift then moves the box further than the strip is high, so hover
     * flickers and clicks land in the off frames. A watch is smaller than the
     * envelope, so it needs proportionally more.
     */
    box.getCenter(boxCentre);
    box.getSize(boxSize);
    boxCentre.y += 0.12;
    boxSize.x += 0.1;
    boxSize.y += 0.26;
    boxSize.z += 0.1;
    box.setFromCenterAndSize(boxCentre, boxSize);

    const goal = raycast.getHoveringBox() === box ? 1 : 0;
    hover = Math.abs(hover - goal) < 0.002 ? goal : lerp(hover, goal, 0.16 * delta);

    // The restrained hover the brief asks for: two millimetres of lift, three
    // per cent of scale, and the steel catching a little more light. No pulse,
    // no outline, nothing that moves when nobody is pointing at it.
    body.position.y = hover * 0.02;
    body.scale.setScalar(1 + hover * 0.03);
    steelMaterial?.color.lerpColors(STEEL, STEEL_HOVER, hover);

    for (const material of materials) material.opacity = opacity;
  };

  const destroy = () => {
    const index = raycast.boxesToCheck.indexOf(box);
    if (index !== -1) raycast.boxesToCheck.splice(index, 1);
    hover = 0;
    disposables.forEach((item) => item.dispose());
    disposables = [];
    materials = [];
    steelMaterial = null;
    body.clear();
    group.clear();
  };

  return { init, destroy, tick, group, setOpacity };
};

/** The shared dial texture; each instance disposes only what it built. */
export const disposeDeskWatchAssets = () => {
  disposeDialTexture();
};
