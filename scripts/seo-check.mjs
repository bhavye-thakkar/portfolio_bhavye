/**
 * ─── WHAT A SCREAMING FROG CRAWL WOULD FLAG, AS A BUILD STEP ──────────────
 *
 *   node scripts/seo-check.mjs                             checks dist/
 *   node scripts/seo-check.mjs https://bhavye.vercel.app   checks the live site
 *
 * `npm run build` ends with the first form, so a page that lost its title, its
 * canonical or its text fails CI and fails Vercel's own build: the broken
 * version never reaches production. .github/workflows/deploy.yml runs the
 * second one after each production deploy and once a week.
 *
 * No dependencies: the HTML is our own build's, so a regex reads it.
 */
import fs from "node:fs";
import path from "node:path";

const live = process.argv[2]?.replace(/\/+$/, "");
const DIST = path.resolve(import.meta.dirname, "../dist");
const TITLE_MAX = 60;
const DESCRIPTION = [50, 155];
/** words inside #app; the shortest real page (a book) has about 60 */
const WORDS_MIN = 50;
const HEADERS = ["content-security-policy", "x-content-type-options", "x-frame-options", "referrer-policy", "strict-transport-security"];
/** the Netlify copies of this site (netlify.toml): they serve it themselves and name the canonical; the first held the older portfolio until 2026-11-25 */
const MIRRORS = ["bhavyethakkar", "thakkarbhavya", "bhavyathakkar", "thakkarbhavye"].map((name) => `https://${name}.netlify.app/`);

const problems = [];
const fail = (where, what) => problems.push(`${where}  ${what}`);
const get = (url, options) => fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000), ...options });

const fileOf = (pathname) => {
  const candidates = pathname === "/" ? ["index.html"] : [pathname, `${pathname}.html`];
  return candidates.map((name) => path.join(DIST, decodeURIComponent(name))).find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
};

/** The text of a path, from dist/ or from the live site; null if it is not there. */
const read = async (pathname) => {
  if (!live) {
    const file = fileOf(pathname);
    return file ? fs.readFileSync(file, "utf8") : null;
  }
  const response = await get(live + pathname);
  if (response.status !== 200) return null;
  for (const header of HEADERS) if (!response.headers.get(header)) fail(pathname, `no ${header} header`);
  return response.text();
};

const exists = async (pathname) => (live ? (await get(live + pathname, { method: "HEAD" })).status === 200 : !!fileOf(pathname));

const decode = (text) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const all = (html, pattern) => [...html.matchAll(pattern)].map((match) => decode(match[1].trim()));

const sitemap = await read("/sitemap.xml");
if (!sitemap) throw new Error("no sitemap.xml");
const locs = all(sitemap, /<loc>([^<]+)<\/loc>/g);
const robots = (await read("/robots.txt")) ?? "";
if (!robots.includes(`Sitemap: ${new URL(locs[0]).origin}/sitemap.xml`)) fail("/robots.txt", "no Sitemap line for this origin");
if (live && new URL(locs[0]).origin !== live) fail("/sitemap.xml", `lists ${new URL(locs[0]).origin}, not ${live}`);

const seen = { title: new Map(), description: new Map() };
const internal = new Map();
const external = new Map();

for (const loc of locs) {
  const { pathname } = new URL(loc);
  // noscript does not count: most text extractors (and Screaming Frog) drop it
  const html = (await read(pathname))?.replace(/<!--[\s\S]*?-->|<noscript>[\s\S]*?<\/noscript>/g, "");
  if (!html) {
    fail(pathname, "in the sitemap but not served with a 200");
    continue;
  }

  const one = (label, values) => {
    if (values.length !== 1 || !values[0]) fail(pathname, `${values.length} ${label}`);
    return values[0] ?? "";
  };
  const title = one("<title>", all(html, /<title>([^<]*)<\/title>/g));
  const description = one("meta description", all(html, /<meta\s+name="description"\s+content="([^"]*)"/g));
  const canonical = one("canonical", all(html, /<link\s+rel="canonical"\s+href="([^"]*)"/g));
  const metaRobots = one("meta robots", all(html, /<meta\s+name="robots"\s+content="([^"]*)"/g));

  if (title.length > TITLE_MAX) fail(pathname, `title is ${title.length} characters: ${title}`);
  if (description.length < DESCRIPTION[0] || description.length > DESCRIPTION[1]) fail(pathname, `description is ${description.length} characters`);
  if (canonical !== loc) fail(pathname, `canonical is ${canonical}, the sitemap says ${loc}`);
  if (/noindex/.test(metaRobots)) fail(pathname, "noindex");
  for (const [key, value] of [["title", title], ["description", description]]) {
    if (seen[key].has(value)) fail(pathname, `same ${key} as ${seen[key].get(value)}`);
    seen[key].set(value, pathname);
  }

  const body = html.match(/<div id="app">([\s\S]*?)<\/main>/)?.[1] ?? "";
  // a page still streaming in must have the loader before the text it covers
  if (html.indexOf('class="preloader"') > html.indexOf('id="app"')) fail(pathname, "the loader comes after #app: the static text flashes");
  const words = decode(body.replace(/<[^>]+>/g, " ")).split(/\s+/).filter(Boolean).length;
  if (words < WORDS_MIN) fail(pathname, `${words} words of static text`);
  if ((body.match(/<h1[\s>]/g) ?? []).length !== 1) fail(pathname, "not exactly one <h1>");
  if ((html.match(/<img\b(?![^>]*\balt=)/g) ?? []).length) fail(pathname, "an <img> without alt");

  for (const block of html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(block[1]);
    } catch (error) {
      fail(pathname, `JSON-LD does not parse: ${error.message}`);
    }
  }

  for (const href of all(html, /<a\s[^>]*?href="([^"#]+)/g)) {
    if (href.startsWith("/")) internal.set(href, pathname);
    else if (href.startsWith("http")) external.set(href, pathname);
  }

  // the names the site is looked for by, in the text of every page (owner, 2026-11-26: "visible on all pages")
  if (!html.includes("Bhavye Thakkar")) fail(pathname, 'does not say "Bhavye Thakkar"');
  if (!body.includes("Bhavya Thakkar") || !/portfolio/i.test(body)) fail(pathname, 'its text does not say "Bhavya Thakkar" and "portfolio"');
  // the organisations he is looked for by (owner, 2026-11-26), named on home; and one he asked never to be named
  for (const name of ["Unispace", "NotionMind", "Shree Swaminarayan Institute of Technology", "SSIT"]) if (pathname === "/" && !body.includes(name)) fail(pathname, `its text does not name ${name}`);
  if (/brainy\s*beam/i.test(html)) fail(pathname, "mentions Brainy Beam, which the owner asked to keep off the site");
}

if (!live && !/noindex/.test((await read("/404.html")) ?? "")) fail("/404.html", "missing, or not noindex");

const paths = new Set(locs.map((loc) => new URL(loc).pathname));
for (const [href, from] of internal) if (!paths.has(href) && !(await exists(href))) fail(from, `broken link to ${href}`);
for (const pathname of paths) if (pathname !== "/" && !internal.has(pathname)) fail(pathname, "orphan: no page links to it");

if (live) {
  for (const [href, from] of external) {
    // only a page that is gone; LinkedIn and others answer a bot 403/429/999
    const status = await get(href).then((response) => response.status, (error) => error.cause?.code ?? error.name);
    if ([404, 410, "ENOTFOUND"].includes(status)) fail(from, `${status}: ${href}`);
  }
  // no redirect (owner, 2026-11-26): each copy answers 200 itself, names this origin as the original,
  // and is served like it (netlify.toml repeats vercel.json's headers)
  const csp = (await get(`${live}/`)).headers.get("content-security-policy");
  for (const mirror of MIRRORS) {
    const response = await get(mirror);
    const html = await response.text();
    const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    if (response.status !== 200 || canonical !== `${live}/`) fail(mirror, `${response.status} with canonical ${canonical}, not a 200 naming ${live}/`);
    for (const header of HEADERS) if (!response.headers.get(header)) fail(mirror, `no ${header} header`);
    if (response.headers.get("content-security-policy") !== csp) fail(mirror, "a different Content-Security-Policy from vercel.json's");
    const script = html.match(/src="(\/chunks\/[^"]+\.js)"/)?.[1];
    if (script && !/immutable/.test((await get(new URL(script, mirror), { method: "HEAD" })).headers.get("cache-control") ?? "")) fail(mirror, `${script} is not cached as immutable`);
  }
  // the one renamed page (Monday took slot 02)
  for (const { source, destination } of JSON.parse(fs.readFileSync(path.resolve(DIST, "../vercel.json"), "utf8")).redirects) {
    const response = await get(live + source);
    const to = new URL(response.headers.get("location") ?? "", live).href;
    if (response.status !== 308 || to !== new URL(destination, live).href) fail(source, `${response.status} to ${to}, not a 308 to ${destination}`);
  }
  const missing = await get(`${live}/there-is-no-such-page`);
  if (missing.status !== 404) fail("/there-is-no-such-page", `${missing.status}, not a 404`);
}

if (problems.length) {
  console.error(`seo-check: ${problems.length} problem${problems.length > 1 ? "s" : ""} in ${live ?? "dist/"}\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`seo-check: ${locs.length} pages, ${internal.size} internal links${live ? `, ${external.size} external` : ""}, no problems in ${live ?? "dist/"}`);
