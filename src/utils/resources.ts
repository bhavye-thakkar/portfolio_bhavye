import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { SRGBColorSpace, TextureLoader } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import EventEmitter from "./EventEmitter";
import { sources } from "../sources";

import type { Texture } from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

const isProd = import.meta.env.PROD;

type ResourceType = Texture | GLTF;

class Resources extends EventEmitter<{
  ready: void;
  progress: number;
}> {
  toLoad = sources.length;
  isReady = false;
  loaded = 0;
  items: Record<string, any> = {};
  /** Names of sources whose download failed: absent from `items`, counted as done. */
  failed = new Set<string>();

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
   * All at once. These used to come in two waves, the loader's 3D avatar's
   * model and textures first, while he was drawn by WebGL; he is a sheet of
   * pre-rendered frames in index.html now, and the room needs every file
   * before it boots, so nothing gains from waiting on anything else.
   */
  startLoading() {
    if (this.isReady) return;
    sources.forEach((source) => this.loadSource(source));
  }

  loadSource(source: (typeof sources)[number]) {
    // A request that fails (a 404 after a bad deploy, a dropped connection, a
    // blocked host) used to be silent: the counter never reached the total,
    // "ready" never fired, and the loader sat over the page for good. Now it
    // is counted as done without an item; the scene boot reads the gap and
    // reports a failed scene instead of a stuck one (three/index.ts).
    const fail = (error: unknown) => {
      this.failed.add(source.name);
      console.warn(`[Resources] ${source.name} failed to load from ${source.path}`, error);
      this.sourceLoaded(source, null);
    };
    if (source.type === "gltfModel") {
      this.loaders.gltfLoader.load(
        source.path,
        (file) => {
          this.sourceLoaded(source, file);
        },
        undefined,
        fail,
      );
    } else if (source.type === "texture") {
      this.loaders.textureLoader.load(
        source.path,
        (file: Texture) => {
          file.colorSpace = SRGBColorSpace;
          this.sourceLoaded(source, file);
        },
        undefined,
        fail,
      );
    }
  }

  sourceLoaded(source: { name: string; type: string; path: string }, file: ResourceType | null) {
    if (file) this.items[source.name] = file;

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
