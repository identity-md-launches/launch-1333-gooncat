// Offline checks for the production export in dist/. Exits non-zero on any failure.
//  1. required files exist
//  2. every relative asset URL in HTML/CSS resolves to a committed file
//  3. required meta tags, title, favicon, single h1, footer line
//  4. the export is served by the preview server and /simd-coin.json fallback renders 'launching…'
//  5. declared colour pairs meet WCAG AA contrast (computed from the tokens in style.css)
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./preview.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
let failures = 0;
const ok = (/** @type {string} */ m) => console.log("  ok   " + m);
const fail = (/** @type {string} */ m) => { failures += 1; console.log("  FAIL " + m); };

console.log("1. required files");
for (const f of ["index.html", "404.html", "assets/css/style.css", "assets/js/app.js", "assets/img/logo.jpg", "assets/img/favicon.svg", "assets/img/og.jpg"]) {
  existsSync(join(dist, f)) ? ok(f) : fail(`${f} missing`);
}

console.log("2. relative asset URLs resolve");
const html = readFileSync(join(dist, "index.html"), "utf8");
const css = readFileSync(join(dist, "assets/css/style.css"), "utf8");
const refs = new Set();
for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) refs.add(m[1]);
for (const m of css.matchAll(/url\(["']?([^"')]+)["']?\)/g)) refs.add(m[1]);
for (const r of refs) {
  if (/^(https?:|data:|#|%23|mailto:)/.test(r)) continue;
  const p = resolve(dist, r.split("#")[0].split("?")[0]);
  existsSync(p) && statSync(p).isFile() ? ok(r) : fail(`${r} does not resolve under dist/`);
}
if (/(src|href)="\//.test(html)) fail("index.html uses a root-absolute asset URL"); else ok("index.html asset URLs are relative");

console.log("3. document metadata and structure");
const need = [
  [/<title>[^<]{10,}<\/title>/, "title"], [/name="description" content="[^"]{30,}"/, "description"],
  [/rel="canonical"/, "canonical"], [/property="og:title"/, "og:title"], [/property="og:description"/, "og:description"],
  [/property="og:image" content="https:\/\/gooncat\.si-md\.xyz\/assets\/img\/og\.jpg"/, "og:image absolute"],
  [/name="twitter:card" content="summary_large_image"/, "twitter:card"], [/rel="icon"/, "favicon"],
  [/Built 100% by the Identity\.md swarm · launched on <a[^>]*>si-md\.xyz\/launchpad<\/a> · not financial advice/, "footer line"],
  [/<main id="main">/, "main landmark"], [/class="skip-link"/, "skip link"],
];
for (const [re, name] of need) re.test(html) ? ok(name) : fail(`${name} missing`);
const h1s = (html.match(/<h1[\s>]/g) || []).length;
h1s === 1 ? ok("exactly one h1") : fail(`${h1s} h1 elements`);
const sections = (html.match(/<section /g) || []).length;
sections >= 7 ? ok(`${sections} sections`) : fail(`only ${sections} sections`);
for (const bad of [/lorem ipsum/i, /coming soon/i, /0x0{39}1/, /0xFec44feFbC7B83Ce9Be3A36d647D36f45CFF59E2(?!.*launch)/]) {
  if (bad.test(html)) fail(`forbidden text matched ${bad}`);
}
if (/data-contract>launching…</.test(html)) ok("contract shows launching… until deploy"); else fail("contract placeholder missing");
const imgsNoAlt = [...html.matchAll(/<img (?![^>]*\balt=)[^>]*>/g)].length;
imgsNoAlt === 0 ? ok("every img has alt") : fail(`${imgsNoAlt} img tags without alt`);

console.log("4. served export");
const server = await startServer(0, false);
const port = /** @type {any} */ (server.address()).port;
const base = `http://127.0.0.1:${port}`;
const r1 = await fetch(base + "/");
r1.status === 200 && (await r1.text()).includes("GOONCAT") ? ok("GET / is 200") : fail("GET / failed");
const r2 = await fetch(base + "/assets/js/app.js");
r2.status === 200 ? ok("app.js served") : fail("app.js not served");
const r3 = await fetch(base + "/simd-coin.json");
r3.status === 404 ? ok("/simd-coin.json absent before launch (page must show launching…)") : fail("unexpected simd-coin.json");
const r4 = await fetch(base + "/nope");
r4.status === 404 && (await r4.text()).includes("This page is asleep") ? ok("404.html served for unknown path") : fail("404 page not served");
server.close();

console.log("5. contrast of declared token pairs (WCAG 2 ratio)");
const tok = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]));
const lum = (/** @type {string} */ hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (/** @type {string} */ a, /** @type {string} */ b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ["oat-100", "espresso-950", 4.5, "body text on page"], ["oat-300", "espresso-950", 4.5, "muted text on page"],
  ["oat-300", "espresso-900", 4.5, "muted text on alt section"], ["oat-100", "espresso-800", 4.5, "text on card"],
  ["oat-300", "espresso-800", 4.5, "muted text on card"], ["espresso-950", "butter-400", 4.5, "ink on primary button"],
  ["espresso-950", "sprig-400", 4.5, "ink on loud button"], ["espresso-950", "frog-400", 4.5, "ink on contrast button"],
  ["frog-400", "espresso-950", 4.5, "links on page"], ["butter-400", "espresso-950", 3, "display headings (large text)"],
  ["sprig-400", "espresso-950", 3, "loud display text (large text)"], ["oat-100", "espresso-700", 4.5, "text on ghost button"],
  ["frog-400", "espresso-800", 3, "focus ring on card"],
];
for (const [fg, bg, min, label] of pairs) {
  const r = ratio(tok[fg], tok[bg]);
  r >= min ? ok(`${label}: ${r.toFixed(2)}:1 (min ${min})`) : fail(`${label}: ${r.toFixed(2)}:1 < ${min}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
