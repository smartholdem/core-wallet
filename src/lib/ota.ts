/* oxlint-disable no-undef -- __APP_VERSION__ is a Vite compile-time define */
import { reactive } from "vue";

/**
 * OTA updates for the native app (Android / iOS).
 *
 * The APK is a shell around the web bundle; most releases only change the
 * bundle, so it is swapped over the air from GitHub Releases:
 *   releases/latest → ota.json { version, minNativeVersion, web, sha256 }
 *   → @capgo/capacitor-updater downloads web-v<ver>.zip, verifies SHA-256,
 *     swaps the bundle; if the new bundle never calls notifyAppReady() within
 *     appReadyTimeout the plugin rolls back automatically.
 * No Capgo cloud, no tokens — public GitHub API, 60 req/h is plenty.
 */
export const OTA_REPO = "smartholdem/core-wallet";
const API_LATEST = `https://api.github.com/repos/${OTA_REPO}/releases/latest`;
const CHECK_INTERVAL = 2 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY = 60 * 1000;
const LAST_CHECK_KEY = "sth.ota.lastCheck";

export type OtaStatus =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "native-required"
  | "error";

export interface OtaManifest {
  version: string;
  minNativeVersion: string;
  web: string;
  sha256: string;
  builtAt?: string;
}

export const ota = reactive({
  status: "idle" as OtaStatus,
  bundleVersion: __APP_VERSION__,
  nativeVersion: "",
  latest: null as OtaManifest | null,
  notes: "",
  releaseUrl: `https://github.com/${OTA_REPO}/releases/latest`,
  apkUrl: "",
  zipUrl: "",
  progress: 0,
  error: "",
  lastCheck: 0,
  pendingNext: false,
});

let updater: any = null;
let appPlugin: any = null;
let timer: any = null;
let readyBundleId = "";

export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

async function plugins() {
  if (!updater) {
    updater = (await import("@capgo/capacitor-updater")).CapacitorUpdater;
    appPlugin = (await import("@capacitor/app")).App;
  }
  return { updater, appPlugin };
}

/** Call once at app start on native. Safe to call on web (no-op). */
export async function initOta() {
  const { updater: u, appPlugin: app } = await plugins();
  // Tell the plugin this bundle booted fine — otherwise it rolls back.
  u.notifyAppReady().catch(() => {});

  try {
    const [cur, info] = await Promise.all([u.current(), app.getInfo()]);
    ota.nativeVersion = info?.version || "";
    const v = cur?.bundle?.version;
    if (v && v !== "builtin") ota.bundleVersion = v;
  } catch {}

  u.addListener("download", (e: any) => {
    ota.progress = Math.max(0, Math.min(100, Number(e?.percent) || 0));
  });
  u.addListener("downloadFailed", () => fail("Download failed"));
  u.addListener("updateFailed", () => fail("Update failed — previous version restored"));

  ota.lastCheck = Number(localStorage.getItem(LAST_CHECK_KEY) || 0);

  setTimeout(() => void checkForUpdate(true), FIRST_CHECK_DELAY);
  timer = setInterval(() => void checkForUpdate(true), CHECK_INTERVAL);
  app.addListener("appStateChange", ({ isActive }: { isActive: boolean }) => {
    if (isActive && Date.now() - ota.lastCheck > CHECK_INTERVAL) void checkForUpdate(true);
  });
}

function fail(msg: string) {
  ota.status = "error";
  ota.error = msg;
  ota.progress = 0;
}

export async function checkForUpdate(silent = false): Promise<OtaStatus> {
  if (ota.status === "downloading") return ota.status;
  ota.status = "checking";
  ota.error = "";
  try {
    const rel = await (await fetch(API_LATEST, { headers: { Accept: "application/vnd.github+json" } })).json();
    ota.lastCheck = Date.now();
    localStorage.setItem(LAST_CHECK_KEY, String(ota.lastCheck));
    if (!rel || !Array.isArray(rel.assets)) throw new Error("release not found");
    ota.releaseUrl = rel.html_url || ota.releaseUrl;
    ota.notes = String(rel.body || "").slice(0, 600);
    const manifestAsset = rel.assets.find((a: any) => a.name === "ota.json");
    if (!manifestAsset) {
      ota.status = "up-to-date";
      return ota.status;
    }
    const m: OtaManifest = await (await fetch(manifestAsset.browser_download_url)).json();
    ota.latest = m;
    const zip = rel.assets.find((a: any) => a.name === m.web);
    const apk = rel.assets.find((a: any) => /android.*\.apk$/i.test(a.name) || /\.apk$/i.test(a.name));
    ota.zipUrl = zip?.browser_download_url || "";
    ota.apkUrl = apk?.browser_download_url || ota.releaseUrl;

    if (compareVersions(m.version, ota.bundleVersion) <= 0) {
      ota.status = "up-to-date";
    } else if (ota.nativeVersion && compareVersions(ota.nativeVersion, m.minNativeVersion) < 0) {
      ota.status = "native-required";
    } else if (!ota.zipUrl) {
      throw new Error(`asset ${m.web} missing in release`);
    } else {
      ota.status = "available";
    }
  } catch (e: any) {
    if (!silent) fail(e?.message || "Update check failed");
    else ota.status = "idle";
  }
  return ota.status;
}

/** Download the bundle; `applyNow` swaps immediately (reload), else on next launch. */
export async function downloadUpdate(applyNow: boolean) {
  if (!ota.latest || !ota.zipUrl) return;
  const { updater: u } = await plugins();
  ota.status = "downloading";
  ota.progress = 0;
  ota.error = "";
  try {
    const bundle = await u.download({
      url: ota.zipUrl,
      version: ota.latest.version,
      checksum: ota.latest.sha256,
    });
    readyBundleId = bundle?.id;
    if (applyNow) {
      await u.set({ id: bundle.id });
    } else {
      await u.next({ id: bundle.id });
      ota.pendingNext = true;
      ota.status = "ready";
    }
  } catch (e: any) {
    fail(e?.message || "Update failed");
  }
}

export async function applyReadyUpdate() {
  if (!readyBundleId) return;
  const { updater: u } = await plugins();
  await u.set({ id: readyBundleId });
}

export function stopOta() {
  if (timer) clearInterval(timer);
}
