import { onMounted, onUnmounted, ref, watch } from "vue";
import gsap from "gsap";
import { lerp } from "../../../utils/math";
import { Howler } from "howler";
import { isFeatureEnabled } from "../../../utils/features";
import { tick as contactTick } from "../core/contact";
import { useAgent } from "../../../composables/useAgent";
import { stopSnoreRepetition } from "../core/contact";
import { tick as roomTick } from "../core/room";
import { sounds } from "../definitions/sounds";
import { getSoundsHowl } from "../utils/sounds";

import type { SoundKey } from "../types";

export const howlerUnlocked = ref(false);
export const soundsEnabled = ref(false);

Howler.volume(0);

export const useHowler = () => {
  const { isTouch } = useAgent();
  const enabledVolume = ref<number>(0);

  const handleUnlocked = () => {
    howlerUnlocked.value = true;

    // Disable sounds completely on touch devices
    if (isTouch.value) {
      soundsEnabled.value = false;
      return;
    }

    const storeItem = localStorage.getItem("portfolio-soundsEnabled");
    if (storeItem) {
      soundsEnabled.value = storeItem === "true";
    } else {
      soundsEnabled.value = true;
      localStorage.setItem("portfolio-soundsEnabled", "true");
    }
  };

  const tick = () => {
    if (!howlerUnlocked.value) {
      if (Howler.ctx.state !== "running") return;
      handleUnlocked();
    } else if (!isTouch.value) {
      // Only process sounds on non-touch devices
      contactTick();
      roomTick();

      const currentVolume = Howler.volume();
      if (currentVolume > 0.99 && enabledVolume.value === 1) {
        return;
      }
      const speed = enabledVolume.value === 1 ? 0.01 : 0.05;
      Howler.volume(lerp(currentVolume, enabledVolume.value, speed));
    }
  };

  const handleVisibilityChange = () => {
    Howler.mute(document.visibilityState === "hidden");
  };

  const handleKeyPress = (event: KeyboardEvent) => {
    if (event.code === "KeyM" && !isTouch.value) {
      soundsEnabled.value = !soundsEnabled.value;
    }
  };

  watch(soundsEnabled, (newVal) => {
    if (!isFeatureEnabled("sounds") || isTouch.value) return;
    enabledVolume.value = newVal ? 1 : 0;
    localStorage.setItem("portfolio-soundsEnabled", newVal.toString());
  });

  const loadAllSounds = () => {
    /**
     * De-duplicated by Howl INSTANCE, not by sound key.
     *
     * Six of the keys in `sounds` — bird, keyboard, the three mouse wheels and
     * notification — are sprites on one shared `room` Howl, and two more share
     * the `contact` one. Howler starts a fresh XHR for every `load()` call
     * without checking whether that file is already loading, so looping over
     * the keys downloaded room.mp3 six times and contact.ogg twice: about
     * 0.9 MB of identical bytes on every single page load, measured as five
     * concurrent 145 KB requests for the same URL.
     */
    const howls = new Set((Object.keys(sounds) as SoundKey[]).map(getSoundsHowl).filter(Boolean));
    for (const howl of howls) howl.load();
  };

  onMounted(() => {
    if (!isFeatureEnabled("sounds")) return;
    Howler.volume(0);

    if (howlerUnlocked.value) {
      soundsEnabled.value = localStorage.getItem("portfolio-soundsEnabled") === "true";
    }

    gsap.ticker.add(tick);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("keydown", handleKeyPress);

    if (!isTouch.value) {
      loadAllSounds();
    }
  });

  onUnmounted(() => {
    if (!isFeatureEnabled("sounds")) return;
    gsap.ticker.remove(tick);
    window.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("keydown", handleKeyPress);
    stopSnoreRepetition();
  });
};
