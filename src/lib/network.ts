/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
import axios from "axios";
import { Managers } from "@smartholdem/crypto";
import { isExtension, isNativeApp } from "@/lib/runtime";

/** Public network identity as exposed by `GET /api/node/configuration`. */
export interface NetworkInfo {
  nethash: string;
  name: string;
  token: string;
  symbol: string;
  /** Address prefix byte (`pubKeyHash`). Mainnet = 63 (`S…`), testnet = 65 (`T…`). */
  version: number;
  explorer: string;
}

/** Per-node metadata (network + core version). */
export interface NodeInfo extends NetworkInfo {
  coreVersion: string;
}

export const MAINNET: NetworkInfo = {
  nethash: "b0987b45a3a754da1362bc6818548cb34f65750c9ac81d28c93e7545224df2d2",
  name: "mainnet",
  token: "STH",
  symbol: "STH",
  version: 63,
  explorer: "explorer.smartholdem.io",
};

const PRIVATE_HOST = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[?::1\]?)$/i;

/** `host`, `host:port`, `http://…`, `https://…/api/` → clean origin (no trailing slash / `/api`). */
export function normalizeNodeUrl(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    const host = s.split(/[/:]/)[0];
    s = (PRIVATE_HOST.test(host) ? "http://" : "https://") + s;
  }
  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    const path = u.pathname.replace(/\/api\/?$/i, "").replace(/\/+$/, "");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return null;
  }
}

/** Human-readable node label (origin without scheme when https). */
export function nodeLabel(url: string): string {
  return url.replace(/^https:\/\//i, "");
}

export function isDefaultNodeUrl(url: string, defaults: string[]): boolean {
  return defaults.includes(url);
}

const LOCAL_HOST = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?)$/i;

/**
 * Extension only: ask for a host permission so fetches to the node bypass CORS
 * (personal relays rarely send Access-Control-Allow-Origin). Must be called
 * synchronously from a user gesture. Resolves true when not needed / granted.
 */
export async function ensureHostPermission(url: string): Promise<boolean> {
  if (!isExtension() || !chrome.permissions?.request) return true;
  try {
    return await chrome.permissions.request({ origins: [`${url}/*`] });
  } catch {
    return false;
  }
}

/** Web/PWA served over https cannot reach plain-http nodes (mixed content) — except localhost. */
export function isBlockedMixedContent(url: string): boolean {
  if (isExtension() || isNativeApp()) return false;
  if (typeof location === "undefined" || location.protocol !== "https:") return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" && !LOCAL_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchNodeInfo(url: string, timeout = 8000): Promise<NodeInfo> {
  const res = await axios.get(`${url}/api/node/configuration`, { timeout });
  const d = res.data?.data;
  if (!d?.nethash) throw new Error("Not a SmartHoldem node (no nethash)");
  return {
    nethash: d.nethash,
    name: "",
    token: d.token ?? d.symbol ?? "?",
    symbol: d.symbol ?? d.token ?? "?",
    version: Number(d.version),
    explorer: d.explorer ?? "",
    coreVersion: d.core?.version ?? "",
  };
}

/** Full crypto config for `Managers.configManager.setConfig` (also yields the network name). */
export async function fetchCryptoConfig(url: string, timeout = 10000): Promise<any> {
  const res = await axios.get(`${url}/api/node/configuration/crypto`, { timeout });
  const d = res.data?.data;
  if (!d?.network?.nethash || !Array.isArray(d.milestones)) throw new Error("Invalid crypto config");
  return d;
}

export async function fetchNodeStatus(url: string, timeout = 5000): Promise<any> {
  const res = await axios.get(`${url}/api/node/status`, { timeout });
  return res.data?.data ?? null;
}

/** Point `@smartholdem/crypto` at the given network (mainnet preset when no config). */
export function applyCryptoConfig(config: any | null, nethash: string) {
  if (config?.milestones?.length) {
    Managers.configManager.setConfig(config);
    const top = Math.max(...config.milestones.map((m: any) => Number(m.height) || 0));
    Managers.configManager.setHeight(Math.max(top, 1));
    return;
  }
  if (nethash === MAINNET.nethash) {
    Managers.configManager.setFromPreset("mainnet");
    Managers.configManager.setHeight(10000000);
  }
}

export type ExplorerKind = "tx" | "wallet" | "block" | "token" | "tokens" | "market";

/** Mainnet always uses explorer.smartholdem.io (nodes may still report the legacy host). */
export function explorerUrl(explorer: string, kind: ExplorerKind, id = ""): string {
  const legacy = !explorer || /^(https?:\/\/)?(block)?explorer\.smartholdem\.io\/?$/i.test(explorer);
  const raw = legacy ? "explorer.smartholdem.io" : explorer;
  const base = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, "");
  return id ? `${base}/${kind}/${id}` : `${base}/${kind}`;
}

export function explorerTxUrl(explorer: string, txId: string): string {
  return explorerUrl(explorer, "tx", txId);
}
