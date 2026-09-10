/**
 * android-version.mjs — keep android/app/build.gradle in sync with package.json.
 *   versionName = package.json version (e.g. 1.4.8)
 *   versionCode = major*10000 + minor*100 + patch (1.4.8 → 10408), monotonic for Play.
 * Runs inside `yarn build:android`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GRADLE = resolve(ROOT, "android/app/build.gradle");
if (!existsSync(GRADLE)) {
  console.error("✗ android/app/build.gradle not found — run `npx cap add android` first.");
  process.exit(1);
}

const version = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
const [maj, min, pat] = version.split(".").map((n) => parseInt(n, 10) || 0);
const versionCode = maj * 10000 + min * 100 + pat;

let gradle = readFileSync(GRADLE, "utf8");
gradle = gradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
writeFileSync(GRADLE, gradle);
console.log(`✓ android versionName ${version} · versionCode ${versionCode}`);
