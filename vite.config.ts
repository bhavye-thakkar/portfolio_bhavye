import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import glsl from "vite-plugin-glsl";
import { routePages } from "./scripts/routePages";
import { resolveOrigin, retiredOrigin } from "./scripts/siteOrigin";

import type { Connect, Plugin } from "vite";

/**
 * `/sitemap` serves public/sitemap.xml, in `vite` and `vite preview`, instead
 * of falling through to the SPA and its 404 page. Production does the same in
 * public/_redirects (Netlify) and vercel.json.
 */
const sitemapAlias = (): Plugin => {
  const rewrite: Connect.NextHandleFunction = (req, _res, next) => {
    if (/^\/sitemap\/?(\?|$)/.test(req.url ?? "")) req.url = "/sitemap.xml";
    next();
  };
  return {
    name: "sitemap-alias",
    configureServer: (server) => {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer: (server) => {
      server.middlewares.use(rewrite);
    },
  };
};

export default defineConfig({
  plugins: [
    sitemapAlias(),
    routePages(),
    vue(),
    glsl({
      include: ["**/*.glsl", "**/*.vert", "**/*.frag"],
      defaultExtension: "glsl",
      warnDuplicatedImports: false,
    }),
  ],
  // The canonical origin, decided by the deployment (scripts/siteOrigin.ts):
  // `site` in src/content/profile.ts reads it, and route-pages stamps it into
  // the built HTML, sitemap, robots.txt and llms.txt.
  define: {
    __SITE_ORIGIN__: JSON.stringify(resolveOrigin()),
    // The host this deployment is retiring from, for main.ts's redirect; null unless SITE_ORIGIN says so.
    __RETIRED_HOST__: JSON.stringify(retiredOrigin() ? new URL(retiredOrigin()!).host : null),
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
  },
  resolve: {
    extensions: [".js", ".jsx", ".ts", ".tsx", ".json", ".ogg", ".wav", ".glsl", ".ktx2"],
  },
  assetsInclude: ["**/*.svg", "**/*.gltf", "**/*.glb", "**/*.png", "**/*.jpg", "**/*.ktx2"],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "/src/assets/styles/mixins.scss";`,
      },
    },
  },
  build: {
    outDir: "./dist",
    sourcemap: false,
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        inlineDynamicImports: false,
        assetFileNames: "assets/[hash].[ext]",
        entryFileNames: "chunks/[name]-[hash].js",
        chunkFileNames: "chunks/[hash].js",
      },
    },
  },
});
