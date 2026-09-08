import { resources } from "../../../utils/resources";
import { scene } from "../../core/scene";
import { Euler, Group, Mesh } from "three";
import { getRoomMaterial } from "../../common/materials";
import { sceneWeights } from "../../../animations/scenes";
import gsap from "gsap";
import { shadow } from "./shadow";
import { desktops } from "./desktops";
import { mouse } from "./mouse";
import { messagePopup } from "./message-popup";
import { penguin } from "./penguin";
import { music } from "./music";
import { orchid } from "./orchid";
import { hotspots3D } from "./hotspots";
import { createEnvelope } from "../envelope";
import { createDeskWatch } from "../desk-watch";

import type { Object3D } from "three";

const group = new Group();
const chairScrollRotation = new Euler();

/**
 * The CV envelope, on the free desk in front of the penguin.
 *
 * It is on the hero desk as well as the Experience one because the CV should
 * not be gated behind eleven screens of scroll: this is the first thing on the
 * page, and the same prop, the same cyan seal and the same panel. The two are
 * never on screen at once, `hero` and `experience` are mutually exclusive
 * scene weights.
 *
 * The position is in ROOM-LOCAL space, and it was measured rather than picked:
 * the desk surface is at y 1.5 (the mouse sits at 1.50 and the speaker at
 * 1.44), and walking the desk plane through the hero camera's projection puts
 * this spot in clear white desk between the penguin and the front-left edge.
 * A child of the room group, because the hero timeline yaws that group as the
 * page scrolls.
 *
 * Slightly smaller than the Experience one: the room is modelled a little
 * tighter than the office bay, and at full size the envelope read as A4 next to
 * a mouse.
 */
let envelope: ReturnType<typeof createEnvelope> | null = null;

/**
 * The Timex, on the front edge of the desk between the keyboard and the mouse.
 *
 * Room-local, and anchored to things that are already there rather than picked:
 * the mouse sits at (-0.8, 1.5, -0.56) and the speaker at (-1.68, 1.44, -1.95),
 * so x runs from the monitors at the back toward the front edge and z runs
 * along the desk. This is a little in front of the mouse and a little toward
 * the middle, which is desk a hand rests on and nothing else occupies.
 *
 * This is the instance the inspect camera is told about (`framed`), because
 * only the hero shot can be framed, see `animations/inspect.ts`.
 */
let deskWatch: ReturnType<typeof createDeskWatch> | null = null;

let objects: {
  blackboard: Mesh;
  carpet: Mesh;
  chair: Mesh;
  frame: Mesh;
  mouse: Mesh;
  music: Mesh;
  penguin: Mesh;
  "penguin-wing-left": Mesh;
  "penguin-wing-right": Mesh;
  plant: Mesh;
  room: Mesh;
  shelf: Mesh;
} | null = null;

const init = () => {
  gsap.ticker.add(tick);
  initObjects();
  shadow.init();
  desktops.init();
  messagePopup.init();
  if (objects?.mouse) mouse.init(objects.mouse);
  if (objects?.penguin)
    penguin.init(objects.penguin, { left: objects["penguin-wing-left"], right: objects["penguin-wing-right"] });

  if (objects?.music) music.init(objects.music);
  if (objects?.shelf) hideShelfPlant(objects.shelf);

  orchid.init();
  group.add(orchid.group);

  // After the orchid, because it measures the plant, and after initObjects,
  // because it needs the frame mesh.
  hotspots3D.init(objects?.frame);

  // No contact shadow: the room's lighting is baked into its atlas and already
  // has shadows painted under everything on the desk, so a second, brighter
  // one reads as a smudge rather than as contact.
  envelope = createEnvelope({
    position: [0.35, 1.5, 2.05],
    yaw: 0.34,
    scale: 0.85,
    isOnStage: () => sceneWeights.hero > 0.5,
    // The room draws in the opaque pass; anything transparent has to come after
    // it or the desk paints over the prop.
    renderOrder: 6,
  });
  envelope.init();
  group.add(envelope.group);

  // Same no-shadow rule as the envelope: the room's contact shadows are painted
  // into its atlas and a second one reads as a smudge.
  deskWatch = createDeskWatch({
    /**
     * x runs from the monitors at the back toward the near edge, which is at
     * about x 0, and z runs along the desk. Both numbers are clearance:
     *
     *   · at x 0.02 the strap's long end hung off the front of the desk and
     *     into the wall behind it, so the whole prop moved back;
     *   · the mouse is at (-0.8, 1.5, -0.56) and the strap is 0.72 long, so at
     *     yaw -0.42 it reaches z -0.79 at the near end, a comfortable 0.23
     *     short of it. Any closer and the two props touch.
     */
    position: [-0.68, 1.5, -1.15],
    yaw: -0.42,
    scale: 0.92,
    framed: true,
    isOnStage: () => sceneWeights.hero > 0.5,
    renderOrder: 6,
  });
  deskWatch.init();
  group.add(deskWatch.group);
};

/**
 * The shelf mesh ends with its own potted plant: a pot plus two leaf clusters,
 * the last 796 triangles of the buffer. The orchid stands in its place, so walk
 * back over every trailing triangle that sits above the board (y > 4.037) and
 * behind the books (z < 5.7) and stop drawing there.
 */
const hideShelfPlant = (shelf: Mesh) => {
  const index = shelf.geometry.getIndex();
  const position = shelf.geometry.getAttribute("position");
  if (!index) return;

  let end = index.count;
  while (end >= 3) {
    const isPlant = [0, 1, 2].every((offset) => {
      const vertex = index.getX(end - 3 + offset);
      return position.getY(vertex) > 4.037 && position.getZ(vertex) < 5.7;
    });

    if (!isPlant) break;
    end -= 3;
  }

  shelf.geometry.setDrawRange(0, end);
};

const initObjects = () => {
  if (objects) return;
  const resource = resources.items["room-model"];

  const penguin = resource.scene.children.find((child: Object3D) => child.name === "penguin");
  objects = {
    blackboard: resource.scene.children.find((child: Object3D) => child.name === "blackboard"),
    carpet: resource.scene.children.find((child: Object3D) => child.name === "carpet"),
    chair: resource.scene.children.find((child: Object3D) => child.name === "chair"),
    frame: resource.scene.children.find((child: Object3D) => child.name === "frame"),
    mouse: resource.scene.children.find((child: Object3D) => child.name === "mouse"),
    music: resource.scene.children.find((child: Object3D) => child.name === "music"),
    plant: resource.scene.children.find((child: Object3D) => child.name === "plant"),
    room: resource.scene.children.find((child: Object3D) => child.name === "room"),
    shelf: resource.scene.children.find((child: Object3D) => child.name === "shelf"),
    penguin,
    "penguin-wing-left": penguin.children.find((child: Object3D) => child.name === "penguin-wing-left"),
    "penguin-wing-right": penguin.children.find((child: Object3D) => child.name === "penguin-wing-right"),
  };

  Object.values(objects).forEach((object) => {
    if (!object) return;
    const mat = getRoomMaterial();
    object.material = mat;
    group.add(object);

    if (object.name === "carpet") {
      object.renderOrder = -10;
      object.onBeforeRender = () => {
        mat.depthWrite = false;
      };

      object.onAfterRender = () => {
        mat.depthWrite = true;
      };
    }
  });

  scene.instance.add(group);
};

const tick = () => {
  group.visible = sceneWeights.hero > 0.001;

  if (objects?.chair) {
    objects.chair.rotation.copy(chairScrollRotation);
  }

  penguin.tick();
  music.tick();
  orchid.tick();
  hotspots3D.tick();
  const delta = gsap.ticker.deltaRatio(60);
  envelope?.tick(delta);
  deskWatch?.tick(delta);
};

const destroy = () => {
  gsap.ticker.remove(tick);
  shadow.destroy();
  envelope?.destroy();
  envelope = null;
  deskWatch?.destroy();
  deskWatch = null;
  //group.clear();
  //objects = null;
  desktops.destroy();
  mouse.destroy();
  penguin.destroy();
  music.destroy();
  orchid.destroy();
  hotspots3D.destroy();
};

export const room = { init, destroy, group, chairScrollRotation };
