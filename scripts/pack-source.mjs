/**
 * pack-source.mjs - reviewer source archive for AMO.
 *
 * Mozilla requires a source-code archive for minified/bundled add-ons. This
 * script zips EXACTLY the files a reviewer needs to run
 * `yarn install --frozen-lockfile && yarn build:firefox` - nothing else
 * (no node_modules, no build output, no .env, no signing keys).
 *
 * Output: apps/extension/smartholdem-wallet-source-<version>.zip
 * Usage:  yarn pack:source
 */
import {
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  createWriteStream,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { ZipArchive } from "archiver";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version;
const OUT_DIR = resolve(ROOT, "apps/extension");
const OUT = resolve(OUT_DIR, `smartholdem-wallet-source-${VERSION}.zip`);

// Directories are added recursively; files verbatim. Keep this list in sync
// with the "Reproduce the Build" section of README.md.
const DIRS = ["src", "scripts", "public"];
const FILES = [
  "index.html",
  "popup.html",
  "manifest.json",
  "package.json",
  "yarn.lock",
  ".yarnrc",
  ".npmrc",
  ".nvmrc",
  "tsconfig.json",
  "env.d.ts",
  "vite.config.ts",
  "vite.config.extension.ts",
  "tailwind.config.js",
  "postcss.config.js",
  "README.md",
  "LICENSE",
  "AMO_REVIEWER_BUILD.md",
];
const IGNORE = /(^|\/)(\.DS_Store|Thumbs\.db|.*\.map)$/;

const missing = [...DIRS, ...FILES].filter((p) => !existsSync(resolve(ROOT, p)));
if (missing.length) {
  console.error(`\u001b[31m✗ pack-source: missing required entries:\u001b[0m ${missing.join(", ")}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
if (existsSync(OUT)) rmSync(OUT);

let entries = 0;
await new Promise((ok, fail) => {
  const output = createWriteStream(OUT);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on("close", ok);
  archive.on("error", fail);
  archive.on("warning", (e) => (e.code === "ENOENT" ? null : fail(e)));
  archive.on("entry", () => entries++);
  archive.pipe(output);
  for (const d of DIRS) {
    archive.directory(resolve(ROOT, d), d, (entry) => (IGNORE.test(entry.name) ? false : entry));
  }
  for (const f of FILES) archive.file(resolve(ROOT, f), { name: f });
  archive.finalize();
});

const buf = readFileSync(OUT);
console.log("\u001b[32m✓ Packed AMO source archive\u001b[0m");
console.log(`  out:     ${OUT}`);
console.log(`  entries: ${entries}`);
console.log(`  size:    ${(statSync(OUT).size / 1024).toFixed(1)} kB`);
console.log(`  sha256:  ${createHash("sha256").update(buf).digest("hex")}`);
console.log(`  version: ${VERSION}`);
console.log("");
console.log(
  "Reviewer build command: yarn install --frozen-lockfile && yarn build:firefox\n" +
    "Attach this archive on AMO → Version → \"Upload source code\" (or let\n" +
    "`yarn sign:amo` upload it automatically).",
);
