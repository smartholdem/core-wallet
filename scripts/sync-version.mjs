/**
 * sync-version.mjs — package.json is the single source of truth for the version.
 *
 * Propagates `version` into every place that hardcodes it:
 *   manifest.json                     "version"
 *   android/app/build.gradle          versionName + versionCode (major*10000+minor*100+patch)
 *   src/locales/index.ts              "welcome.version": "vX.Y.Z · …" (all locales)
 *   src/inject/inject.js              window.smartholdem.version (extension provider)
 *   src/inject/mobile-provider.js     window.smartholdem.version (Android provider)
 *
 * Runs automatically at the start of every build:* script and after `yarn bump`.
 * Idempotent; exits 0 with a summary of what changed.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VERSION = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
if (!/^\d+\.\d+\.\d+$/.test(VERSION)) {
  console.error(`✗ package.json version "${VERSION}" is not X.Y.Z`);
  process.exit(1);
}
const [maj, min, pat] = VERSION.split(".").map(Number);
const VERSION_CODE = maj * 10000 + min * 100 + pat;

const changed = [];
function patch(rel, fn, optional = false) {
  const file = resolve(ROOT, rel);
  if (!existsSync(file)) {
    if (!optional) console.warn(`  ! ${rel} not found — skipped`);
    return;
  }
  const before = readFileSync(file, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed.push(rel);
  }
}

patch("manifest.json", (s) => s.replace(/("version"\s*:\s*")[^"]+(")/, `$1${VERSION}$2`));

patch(
  "android/app/build.gradle",
  (s) =>
    s.replace(/versionCode\s+\d+/, `versionCode ${VERSION_CODE}`).replace(/versionName\s+"[^"]*"/, `versionName "${VERSION}"`),
  true,
);

patch("src/locales/index.ts", (s) => s.replace(/("welcome\.version"\s*:\s*"v)\d+\.\d+\.\d+/g, `$1${VERSION}`));

for (const f of ["src/inject/inject.js", "src/inject/mobile-provider.js"]) {
  patch(f, (s) =>
    s
      .replace(/(^\s*version:\s*")\d+\.\d+\.\d+(")/m, `$1${VERSION}$2`)
      .replace(/(window\.smartholdem\.version\s+\/\/\s*")\d+\.\d+\.\d+(")/, `$1${VERSION}$2`),
  );
}

console.log(`✓ version ${VERSION} (android versionCode ${VERSION_CODE})`);
console.log(changed.length ? `  updated: ${changed.join(", ")}` : "  everything already in sync");
