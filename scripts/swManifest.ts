import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import type { Plugin } from "vite";

/**
 * ─── WHAT THIS BUILD IS MADE OF, WRITTEN INTO THE SERVICE WORKER ──────────
 *
 * public/sw.js keeps every file of the build it serves cache-first, and its
 * bytes used to be the same from one deploy to the next. Two things followed:
 * the browser never installed a newer worker, so each deploy's hashed files
 * piled up in the visitor's cache for good; and a font, an icon or the CV PDF
 * replaced under the same URL stayed the OLD file for every returning visitor.
 *
 * So the build writes into dist/sw.js the hashed files it produced and a digest
 * of each deploy-versioned public file. The worker's bytes now change whenever
 * the output does, the browser installs it, and its activation drops what this
 * build no longer has (`prune` in public/sw.js).
 */
const HASHED = ["assets", "chunks"];
const VERSIONED = ["fonts", "meta", "cv"];
const SLOT = "const BUILD = { hashed: [], public: {} };";

const filesIn = (dir: string): string[] =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(dir, entry.name);
        return entry.isDirectory() ? filesIn(file) : [file];
      })
    : [];

export const swManifest = (): Plugin => {
  let outDir = "";

  return {
    name: "sw-manifest",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const sw = path.join(outDir, "sw.js");
      const source = fs.readFileSync(sw, "utf8");
      if (!source.includes(SLOT)) throw new Error(`[sw-manifest] no \`${SLOT}\` in dist/sw.js`);

      const url = (file: string) => `/${path.relative(outDir, file).split(path.sep).join("/")}`;
      const digest = (file: string) => createHash("sha1").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
      const hashed = HASHED.flatMap((dir) => filesIn(path.join(outDir, dir))).map(url).sort();
      const versioned = Object.fromEntries(
        VERSIONED.flatMap((dir) => filesIn(path.join(outDir, dir))).map((file) => [url(file), digest(file)]),
      );

      fs.writeFileSync(sw, source.replace(SLOT, () => `const BUILD = ${JSON.stringify({ hashed, public: versioned })};`));
    },
  };
};
