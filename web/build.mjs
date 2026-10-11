// Production export: copy site/ to dist/ byte for byte. The site has no build step,
// so the export is the source. Run from anywhere: `node web/build.mjs`.
import { cpSync, rmSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "site");
const out = join(root, "dist");

if (!existsSync(join(src, "index.html"))) {
  console.error("site/index.html not found");
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

let files = 0, bytes = 0;
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  const s = statSync(p);
  if (s.isDirectory()) walk(p); else { files += 1; bytes += s.size; }
});
walk(out);
console.log(`dist/ written: ${files} files, ${bytes} bytes`);
