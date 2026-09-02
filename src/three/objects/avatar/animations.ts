import { avatar } from ".";
import { avatarHologram } from "./hologram";
import { AnimationAction, AnimationMixer, LoopOnce, LoopPingPong, LoopRepeat } from "three";
import gsap from "gsap";
import { resources } from "../../../utils/resources";
import { sceneWeights } from "../../../animations/scenes";
import { face } from "./face";
import { sleepingSprite } from "../contact/sleeping-sprite";
import { playSound } from "../../../features/sounds/utils/sounds";
import { isFeatureEnabled } from "../../../utils/features";
import { stopSnoreRepetition } from "../../../features/sounds/core/contact";
import { createWalkClip } from "./walk-clip";
import { goodbye } from "./goodbye";

import type { AnimationClip, Object3D } from "three";

let mixer: AnimationMixer;
let activeAction: string | null = null;
const actions = new Map<string, AnimationAction>();
let isAwake = false;
const wavingStrength = { value: isFeatureEnabled("introWave") ? 1 : 0 };
let hologramMixer: AnimationMixer;
const hologramActions = new Map<string, AnimationAction>();

const init = () => {
  mixer = new AnimationMixer(avatar.getMesh() as Object3D);
  hologramMixer = new AnimationMixer(avatarHologram.getMesh() as Object3D);

  setupActions();
  setupHologramActions();

  play("desktop-idle");

  wave();
};

const getActionFromMesh = (name: string) => {
  const resource = resources.items["avatar-model"];
  const action = resource.animations.find((animation: AnimationClip) => animation.name === name);
  if (!action) throw new Error("[AvatarAnimations] Action not found");
  return action;
};

const setupActions = () => {
  //idle
  const desktopIdle = mixer.clipAction(getActionFromMesh("idle"));
  desktopIdle.loop = LoopPingPong;
  actions.set("desktop-idle", desktopIdle);
  desktopIdle.weight = 1;

  //t-idle
  const tIdle = mixer.clipAction(getActionFromMesh("t-idle"));
  tIdle.loop = LoopPingPong;
  actions.set("t-idle", tIdle);
  tIdle.weight = 0;
  tIdle.play();

  //left-desktop
  const leftDesktop = mixer.clipAction(getActionFromMesh("left-desktop"));
  leftDesktop.repetitions = 1;
  leftDesktop.clampWhenFinished = true;
  actions.set("left-desktop", leftDesktop);
  leftDesktop.weight = 0;

  //sleeping
  const sleeping = mixer.clipAction(getActionFromMesh("sleeping"));
  sleeping.loop = LoopPingPong;
  actions.set("sleeping", sleeping);
  sleeping.weight = 1;
  sleeping.play();

  //wake-up
  const wake = mixer.clipAction(getActionFromMesh("wake-up"));
  wake.repetitions = 1;
  wake.clampWhenFinished = true;
  actions.set("wake-up", wake);

  //contact-idle
  const contactIdle = mixer.clipAction(getActionFromMesh("contact-idle"));
  contactIdle.loop = LoopPingPong;
  actions.set("contact-idle", contactIdle);

  //wave
  const wave = mixer.clipAction(getActionFromMesh("wave"));
  wave.clampWhenFinished = true;
  wave.loop = LoopOnce;
  actions.set("wave", wave);

  //walk, authored from t-idle's standing pose, the rig ships no walk clip
  const walk = mixer.clipAction(createWalkClip(getActionFromMesh("t-idle")));
  walk.loop = LoopRepeat;
  actions.set("walk", walk);
  walk.weight = 0;
  walk.play();
};

const setupHologramActions = () => {
  //idle
  const desktopIdle = hologramMixer.clipAction(getActionFromMesh("idle"));
  desktopIdle.loop = LoopPingPong;
  hologramActions.set("desktop-idle", desktopIdle);
  desktopIdle.weight = 1;
  desktopIdle.play();

  //t-idle
  const tIdle = hologramMixer.clipAction(getActionFromMesh("t-idle"));
  tIdle.loop = LoopPingPong;
  hologramActions.set("t-idle", tIdle);
  tIdle.weight = 0;
  tIdle.play();

  //left-desktop
  const leftDesktop = hologramMixer.clipAction(getActionFromMesh("left-desktop"));
  leftDesktop.repetitions = 1;
  leftDesktop.clampWhenFinished = true;
  hologramActions.set("left-desktop", leftDesktop);
  leftDesktop.weight = 0;

  //wave
  const wave = hologramMixer.clipAction(getActionFromMesh("wave"));
  wave.clampWhenFinished = true;
  wave.loop = LoopOnce;
  hologramActions.set("wave", wave);
};

const play = (name: string, transition: number = 0.5) => {
  if (activeAction === name) return;
  // Nothing is set up until the avatar model has loaded, and a deep link to a
  // story page asks for a chapter's beat well before that. Only an EMPTY map
  // is treated as "not ready", once it is populated an unknown name is still
  // a typo and still throws.
  if (actions.size === 0) return;
  const newAction = actions.get(name);
  const newHologramAction = hologramActions.get(name);
  if (!newAction || !newHologramAction) throw new Error("[AvatarAnimations] Action not found");

  newAction.reset().play();
  newHologramAction.reset().play();

  if (activeAction) {
    const currentAction = actions.get(activeAction);
    if (currentAction) currentAction.crossFadeTo(newAction, transition);

    const currentHologramAction = hologramActions.get(activeAction);
    if (currentHologramAction) currentHologramAction.crossFadeTo(newHologramAction, transition);
  }

  activeAction = name;
};

const setWeight = (key: string, weight: number) => {
  const action = actions.get(key);
  if (action) action.weight = weight;
  const hologramAction = hologramActions.get(key);
  if (hologramAction) hologramAction.weight = weight;
};

const updateIntro = () => {
  // Experience sits him back down: `seated` overrides the standing t-idle that
  // About leaves latched on for the rest of the page.
  const standing = avatar.tIdleIntensity.value * (1 - avatar.seated.value);

  setWeight("desktop-idle", (1 - standing) * (1 - wavingStrength.value));
  setWeight("left-desktop", (1 - standing) * (1 - wavingStrength.value));
  setWeight("t-idle", standing);
  setWeight("sleeping", 0);
  setWeight("contact-idle", 0);
  setWeight("wake-up", 0);
  setWeight("wave", wavingStrength.value * (1 - avatar.tIdleIntensity.value));
  setWeight("walk", 0);
};

const wave = () => {
  //get wave duration from action
  const waveAction = actions.get("wave");
  const hologramWaveAction = hologramActions.get("wave");
  if (!waveAction) return;
  const tl = gsap.timeline();

  const waveDuration = waveAction.getClip().duration;
  // reset so the goodbye can wave again after the intro clamped this at its end
  waveAction.reset().play();
  hologramWaveAction?.reset().play();

  tl.add(face.wave());
  tl.fromTo(wavingStrength, { value: 1 }, { value: 0 }, waveDuration - 0.2);

  return tl;
};

const wakeUp = () => {
  if (isAwake) return;
  isAwake = true;
  const sleepingAction = actions.get("sleeping");
  const wakeUpAction = actions.get("wake-up");
  const contactIdleAction = actions.get("contact-idle");
  if (!sleepingAction || !wakeUpAction || !contactIdleAction) return;

  stopSnoreRepetition();
  playSound("gasp");

  //crossfade to wake-up
  sleepingAction.crossFadeTo(wakeUpAction, 0.2);
  wakeUpAction.play();

  const wakeUpDuration = wakeUpAction.getClip().duration;

  setTimeout(() => {
    //crossfade to contact-idle
    wakeUpAction.crossFadeTo(contactIdleAction, 0.5);
    contactIdleAction.play();
  }, wakeUpDuration * 1000);

  face.wakeUp();
  sleepingSprite.hide();
};

const updateContact = () => {
  // the goodbye walk takes the body over from the standing actions
  const settled = 1 - goodbye.state.walk;

  setWeight("desktop-idle", 0);
  setWeight("left-desktop", 0);
  setWeight("t-idle", 0);
  setWeight("sleeping", settled);
  setWeight("contact-idle", settled);
  setWeight("wake-up", settled);
  setWeight("wave", isAwake ? wavingStrength.value * settled : 0);
  setWeight("walk", goodbye.state.walk);
};

const update = () => {
  const isContact = sceneWeights.contact > 0.001;
  if (isContact) {
    updateContact();
  } else {
    updateIntro();
  }

  const delta = gsap.ticker.deltaRatio(60);
  mixer.update(delta / 60);
  hologramMixer.update(delta / 60);
};

export const animations = { init, play, actions, update, wakeUp, getIsAwake: () => isAwake, wave };
