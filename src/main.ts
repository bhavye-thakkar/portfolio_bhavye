import { createApp } from "vue";
import "./assets/styles/index.scss";
import App from "./App.vue";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { site } from "./content/profile";

// A deployment retired in favour of the canonical address (SITE_ORIGIN named
// another host; scripts/siteOrigin.ts) sends its visitors on to the same
// page there. Only its own production host, so a deploy preview still works.
declare const __RETIRED_HOST__: string | null;
if (typeof __RETIRED_HOST__ === "string" && location.host === __RETIRED_HOST__) {
  location.replace(`${site}${location.pathname}${location.search}${location.hash}`);
}

gsap.registerPlugin(ScrollTrigger);

createApp(App).mount("#app");
