import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const ASSET_DIR = path.join(DIST_DIR, "assets");
const ENTRY_BUDGET_BYTES = 80 * 1024;
const HEAVY_THREE_PATTERN = /(three|cinematicstage|effectcomposer|renderpass|unrealbloom)/i;

function fail(message) {
  console.error(`Performance budget failed: ${message}`);
  process.exitCode = 1;
}

const html = await readFile(path.join(DIST_DIR, "index.html"), "utf8");
const entryMatch = html.match(/<script[^>]+src="([^"]+\.js)"/);

if (!entryMatch) {
  fail("could not resolve the JavaScript entry from dist/index.html");
  process.exit();
}

const entryPath = path.join(DIST_DIR, entryMatch[1].replace(/^\//, ""));
const entrySize = (await stat(entryPath)).size;
if (entrySize > ENTRY_BUDGET_BYTES) {
  fail(
    `entry ${path.basename(entryPath)} is ${(entrySize / 1024).toFixed(1)} KB; ` +
      `budget is ${ENTRY_BUDGET_BYTES / 1024} KB`,
  );
}

const assets = await readdir(ASSET_DIR);
for (const required of ["vendor-react-", "vendor-motion-"]) {
  if (!assets.some((asset) => asset.startsWith(required) && asset.endsWith(".js"))) {
    fail(`missing stable ${required.slice(0, -1)} chunk`);
  }
}

const initialAssets = [
  ...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g),
].map((match) => match[1]);
const eagerThreeAssets = initialAssets.filter((asset) => HEAVY_THREE_PATTERN.test(asset));
if (eagerThreeAssets.length > 0) {
  fail(`Three.js must remain lazy, but index.html loads ${eagerThreeAssets.join(", ")}`);
}

const hasLazyThreeChunk = assets.some(
  (asset) => asset.endsWith(".js") && HEAVY_THREE_PATTERN.test(asset),
);
if (!hasLazyThreeChunk) {
  fail("no lazy Three.js or postprocessing chunk was found in dist/assets");
}

if (!process.exitCode) {
  console.log(
    `Performance budget passed: entry ${(entrySize / 1024).toFixed(1)} KB, ` +
      "stable React/GSAP vendors, Three.js lazy.",
  );
}
