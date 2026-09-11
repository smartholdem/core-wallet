/**
 * bump-version.mjs — `yarn bump patch|minor|major|X.Y.Z`
 * Updates package.json version and syncs it everywhere (scripts/sync-version.mjs).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG_PATH = resolve(ROOT, "package.json");
const raw = readFileSync(PKG_PATH, "utf8");
const pkg = JSON.parse(raw);
const arg = (process.argv[2] || "patch").trim();

let next;
if (/^\d+\.\d+\.\d+$/.test(arg)) {
  next = arg;
} else {
  const [a, b, c] = pkg.version.split(".").map(Number);
  next =
    arg === "major" ? `${a + 1}.0.0` : arg === "minor" ? `${a}.${b + 1}.0` : arg === "patch" ? `${a}.${b}.${c + 1}` : null;
  if (!next) {
    console.error("usage: yarn bump patch|minor|major|X.Y.Z");
    process.exit(1);
  }
}

// keep formatting: replace only the version line
writeFileSync(PKG_PATH, raw.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));
console.log(`package.json ${pkg.version} → ${next}`);

const r = spawnSync(process.execPath, [resolve(ROOT, "scripts/sync-version.mjs")], { stdio: "inherit" });
process.exit(r.status ?? 1);
