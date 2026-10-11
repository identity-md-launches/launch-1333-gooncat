// Tiny static preview server for dist/ with a sample /simd-coin.json for local checks.
// Usage: node web/preview.mjs [port] [--sample]  (Ctrl+C to stop)
// With --sample the server answers /simd-coin.json with example market data so the
// live-stats, contract and billboard states can be inspected before the real launch.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, dirname, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.argv[2]) || 4173;
const sample = process.argv.includes("--sample");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };

export const SAMPLE = {
  name: "GOONCAT", symbol: "GOONCAT", token: "0x1111111111111111111111111111111111111111", chainName: "Ethereum",
  coinUrl: "https://si-md.xyz/launchpad", chartUrl: "https://si-md.xyz/launchpad", status: "live",
  market: { marketCap: 2500000, priceUsd: 0.0025, volume24h: 123456.78 },
};

export function startServer(p = port, withSample = sample) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname === "/simd-coin.json") {
      if (!withSample) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(SAMPLE));
      return;
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    if (path.endsWith("/")) path += "index.html";
    let file = join(root, path);
    try {
      const s = await stat(file);
      if (s.isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      const body = await readFile(join(root, "404.html")).catch(() => Buffer.from("not found"));
      res.writeHead(404, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    }
  });
  return new Promise((resolve) => server.listen(p, "127.0.0.1", () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().then(() => console.log(`Preview: http://127.0.0.1:${port}/ (serving dist/${sample ? ", sample /simd-coin.json" : ""})`));
}
