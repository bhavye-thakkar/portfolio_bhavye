import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { SRGBColorSpace, TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import EventEmitter from "./EventEmitter";
import { sources } from "../sources";

import type { Texture } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const isProd = import.meta.env.PROD;

/** Keep in step with NEEDS in three/loader-avatar.ts. */
const AVATAR_FIRST = new Set([
  "avatar-model",
  "matcap-black",
  "matcap-gray",
  "matcap-skin",
  "matcap-white",
  "head-texture",
  "face-texture",
]);

type ResourceType = Texture | GLTF;

class Resources extends EventEmitter<{
  ready: void;
  progress: number;
}> {
  toLoad = sources.length;
  isReady = false;
  loaded = 0;
  items: Record<string, any> = {};

  loaders: {
    gltfLoader: GLTFLoader;
    textureLoader: TextureLoader;
    fontLoader: FontLoader;
  };

  constructor() {
    super();

    this.loaders = {
      gltfLoader: new GLTFLoader(),
      textureLoader: new TextureLoader(),
      fontLoader: new FontLoader(),
    };
  }

  /**
   * Two waves rather than nineteen requests at once: the loader's avatar (see
   * three/loader-avatar.ts) needs his model and six textures, and with every
   * request sharing the bandwidth those were finishing alongside everything
   * else, so he only ever appeared as the door was already giving way. His
   * files go first and the rest wait for ALL of them: starting the rest as
   * soon as his small textures were in put twelve requests alongside his
   * model's tail and, on 4G, he still arrived after the last asset.
   */
  startLoading() {
    if (this.isReady) return;

    const first = sources.filter((source) => AVATAR_FIRST.has(source.name));
    const rest = sources.filter((source) => !AVATAR_FIRST.has(source.name));
    let pending = first.length;
    let restStarted = false;
    const startRest = () => {
      if (restStarted) return;
      restStarted = true;
      rest.forEach((source) => this.loadSource(source));
    };

    first.forEach((source) =>
      this.loadSource(source, () => {
        if (--pending === 0) startRest();
      }),
    );
    if (!first.length) startRest();
  }

  loadSource(source: (typeof sources)[number], then?: () => void) {
    if (source.type === "gltfModel") {
      this.loaders.gltfLoader.load(source.path, (file) => {
        this.sourceLoaded(source, file);
        then?.();
      });
    } else if (source.type === "texture") {
      this.loaders.textureLoader.load(source.path, (file: Texture) => {
        file.colorSpace = SRGBColorSpace;
        this.sourceLoaded(source, file);
        then?.();
      });
    }
  }

  sourceLoaded(source: { name: string; type: string; path: string }, file: ResourceType) {
    this.items[source.name] = file;

    this.loaded++;

    this.emit("progress", this.loaded / this.toLoad);

    if (this.loaded === this.toLoad) {
      this.isReady = true;
      this.emit("ready");
      this.log("All resources loaded");
    }
  }

  log(message: string) {
    if (isProd) return;
    console.log(`[Resources] ${message}`);
  }
}

export const resources = new Resources();
resources.startLoading();
