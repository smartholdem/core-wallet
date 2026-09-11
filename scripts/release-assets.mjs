/**
 * release-assets.mjs — OTA assets for a GitHub Release.
 *
 *   apps/release/web-v<version>.zip   contents of apps/dist-android (index.html at zip root)
 *   apps/release/ota.json             { version, minNativeVersion, web, sha256, builtAt }
 *   apps/release/checksums.txt        sha256 of every file in apps/release
 *   apps/release/smartholdem-wallet-android-<version>.apk   copied if a release APK exists
 *
 * Usage:  yarn release:ota              (= build:android + this script)
 *         node scripts/release-assets.mjs [--min-native 1.4.8]
 *
 * minNativeVersion defaults to versionName in android/app/build.gradle (= "this bundle
 * needs the current APK"). If the native side did NOT change in this release, pass the
 * version of the last APK that did, so every installed APK receives the OTA.
 * Pure Node + archiver — works on Windows too (no `zip` binary needed).
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  copyFileSync,
  createWriteStream,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ZipArchive } from "archiver";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(ROOT, "apps/dist-android");
const OUT = resolve(ROOT, "apps/release");
const PKG = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version;

const gradle = readFileSync(resolve(ROOT, "android/app/build.gradle"), "utf8");
const gradleVersion = gradle.match(/versionName\s+"([^"]+)"/)?.[1] || VERSION;
const argIdx = process.argv.indexOf("--min-native");
const minNative = argIdx > -1 ? process.argv[argIdx + 1] : gradleVersion;

if (!existsSync(resolve(DIST, "index.html"))) {
  console.error("\u001b[31m✗ apps/dist-android/index.html not found — run `yarn build:android` first\u001b[0m");
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const zipName = `web-v${VERSION}.zip`;
const zipPath = resolve(OUT, zipName);
await new Promise((ok, fail) => {
  const output = createWriteStream(zipPath);
  const archive = new ZipArchive({ zlib: { level: 9 } });
  output.on("close", ok);
  archive.on("error", fail);
  archive.pipe(output);
  // directory contents at archive root → index.html at "/"
  archive.directory(DIST, false, (entry) => (/\.map$|\.DS_Store$/.test(entry.name) ? false : entry));
  archive.finalize();
});

const sha256 = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const zipHash = sha256(zipPath);

const manifest = {
  version: VERSION,
  minNativeVersion: minNative,
  web: zipName,
  sha256: zipHash,
  builtAt: new Date().toISOString(),
};
writeFileSync(resolve(OUT, "ota.json"), JSON.stringify(manifest, null, 2) + "\n");

const apkCandidates = [
  resolve(ROOT, "android/app/build/outputs/apk/release/app-release.apk"),
  resolve(ROOT, "android/app/build/outputs/apk/release/app-release-unsigned.apk"),
];
const apk = apkCandidates.find((p) => existsSync(p));
if (apk) copyFileSync(apk, resolve(OUT, `smartholdem-wallet-android-${VERSION}.apk`));

const sums = readdirSync(OUT)
  .filter((f) => f !== "checksums.txt")
  .sort()
  .map((f) => `${sha256(resolve(OUT, f))}  ${f}`);
writeFileSync(resolve(OUT, "checksums.txt"), sums.join("\n") + "\n");

console.log("\u001b[32m✓ OTA release assets\u001b[0m");
console.log(`  ${zipName}  ${(statSync(zipPath).size / 1e6).toFixed(1)} MB  sha256=${zipHash}`);
console.log(`  ota.json   version=${VERSION}  minNativeVersion=${minNative}`);
console.log(`  apk        ${apk ? `smartholdem-wallet-android-${VERSION}.apk${apk.includes("unsigned") ? " (UNSIGNED — sign before publishing!)" : ""}` : "not found (run yarn android:aab / assembleRelease if the native side changed)"}`);
console.log(`  out        ${OUT}`);
console.log(`→ Upload apps/release/* to https://github.com/smartholdem/core-wallet/releases/new?tag=${VERSION}`);
console.log("  Asset names must stay exactly: ota.json, " + zipName + ". Do NOT mark the release as pre-release.");
