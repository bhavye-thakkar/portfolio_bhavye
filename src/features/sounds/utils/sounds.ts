import { sounds as items, pools } from "../definitions/sounds";
import { sprites } from "../definitions/sprites";
import { isFeatureEnabled } from "../../../utils/features";

import type { Howl } from "howler";
import type { SoundKey, PoolKey } from "../types";

/**
 * A per-frame volume write that waits for the file. Howler queues every call
 * made before a Howl has loaded and drains that queue recursively from its
 * load handler, so sixty queued writes a second over a slow download ended in
 * "RangeError: Maximum call stack size exceeded" inside Howler on the live
 * site (seen on every cold load). Written only on change, so a settled scene
 * costs nothing per frame either.
 */
export const setVolume = (howl: Howl, volume: number) => {
  if (howl.state() !== "loaded" || howl.volume() === volume) return;
  howl.volume(volume);
};

export const getSoundsHowl = (sound: SoundKey) => {
  const data = items[sound];
  if ("spriteKey" in data) {
    return sprites[data.spriteKey].howl;
  }
  return data.howl;
};

//when soundKey is the key of a pool, play a random sound from the pool
const playPoolSound = (poolKey: PoolKey) => {
  const pool = pools[poolKey];
  const randomSound = pool[Math.floor(Math.random() * pool.length)];
  playSound(randomSound as SoundKey);
};

export const playSound = (key: SoundKey | PoolKey) => {
  if (!isFeatureEnabled("sounds")) return;

  if (key in pools) {
    playPoolSound(key as PoolKey);
    return;
  }

  const data = items[key as SoundKey];
  if (!data) return;

  const howl = getSoundsHowl(key as SoundKey);

  let id: number | undefined;
  if ("spriteKey" in data) {
    // For sprites, play the specific sprite name
    id = howl.play(data.name);
  } else {
    id = howl.play();
  }

  return id;
};
