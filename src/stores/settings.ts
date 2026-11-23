import { defineStore } from "pinia";
import CryptoJS from "crypto-js";
import {
  MAINNET,
  applyCryptoConfig,
  fetchCryptoConfig,
  fetchNodeInfo,
  fetchNodeStatus,
  ensureHostPermission,
  isBlockedMixedContent,
  normalizeNodeUrl,
  type NetworkInfo,
  type NodeInfo,
} from "@/lib/network";

export const DEFAULT_NODES = [
  "https://node0.smartholdem.io",
  "https://node1.smartholdem.io",
  "https://node2.smartholdem.io",
  "https://node3.smartholdem.io",
  "https://node4.smartholdem.io",
  "https://node5.smartholdem.io",
];

const MAINNET_NODE_INFO: NodeInfo = { ...MAINNET, coreVersion: "" };

export interface NodeStatus {
  node: string;
  status: any;
  latency: number;
  synced: boolean;
}

export const useSettingsStore = defineStore("appSettings", {
  state: () => ({
    darkMode: true,
    currency: "USDT",
    /**
     * Auto-lock idle timeout in seconds. `0` (or `autoLockEnabled === false`)
     * disables auto-lock entirely. Default = 5 min.
     */
    lockTimeoutSec: 300,
    autoLockEnabled: true,
    theme: "rust" as "rust" | "cyan" | "light",
    locale: "en" as "en" | "ru" | "zh" | "es",
    pinHash: "" as string, // SHA-384(pin)
    /** Native only: unlock with fingerprint/face; PIN is kept in Keystore. */
    biometricUnlock: false,
    /** Native only: dApp URLs opened in the in-app browser (most recent first). */
    recentDapps: [] as string[],
    /** Address book. */
    contacts: [] as { name: string; address: string }[],
    /** Native only: lock as soon as the app goes to background. */
    lockOnBackground: true,
    /** Node origins (`https://host` / `http://127.0.0.1:4003`). */
    nodes: [...DEFAULT_NODES] as string[],
    /** User-added nodes (subset of `nodes`, removable). */
    customNodes: [] as string[],
    activeNode: DEFAULT_NODES[0],
    /** Manual pick → stay on this node while it responds. */
    pinnedNode: false,
    /** Per-node network identity from `/api/node/configuration`. */
    nodeInfo: Object.fromEntries(DEFAULT_NODES.map((n) => [n, MAINNET_NODE_INFO])) as Record<string, NodeInfo>,
    /** Per-nethash crypto config (`/api/node/configuration/crypto`). */
    cryptoConfig: {} as Record<string, any>,
    activeNetwork: { ...MAINNET } as NetworkInfo,
    nodesStatus: [] as NodeStatus[],
    activeNodeStatus: null as any,
  }),
  getters: {
    apiBase(state) {
      return `${state.activeNode}/api`;
    },
    isMainnet(state) {
      return state.activeNetwork.nethash === MAINNET.nethash;
    },
    /** Address prefix byte of the active network. */
    networkVersion(state) {
      return state.activeNetwork.version;
    },
    token(state) {
      return state.activeNetwork.token || "STH";
    },
    networkName(state) {
      return state.activeNetwork.name || (state.activeNetwork.nethash === MAINNET.nethash ? "mainnet" : "custom");
    },
    /** Distinct networks known from nodes (mainnet first). */
    networks(state): NetworkInfo[] {
      const map = new Map<string, NetworkInfo>();
      map.set(MAINNET.nethash, MAINNET);
      for (const n of state.nodes) {
        const i = state.nodeInfo[n];
        if (i && !map.has(i.nethash)) map.set(i.nethash, i);
      }
      return [...map.values()];
    },
    nodesOf: (state) => (nethash: string) =>
      state.nodes.filter((n) => (state.nodeInfo[n]?.nethash ?? MAINNET.nethash) === nethash),
  },
  actions: {
    savePinHash(pin: string) {
      this.pinHash = CryptoJS.SHA384(pin).toString();
    },
    validatePin(pin: string) {
      return CryptoJS.SHA384(pin).toString() === this.pinHash;
    },
    /** Migrate legacy bare-hostname entries and (re)apply crypto config. Call once at boot. */
    bootstrapNetwork() {
      const fix = (n: string) => normalizeNodeUrl(n) ?? n;
      this.nodes = [...new Set([...DEFAULT_NODES, ...this.nodes.map(fix)])];
      this.customNodes = this.customNodes.map(fix).filter((n) => !DEFAULT_NODES.includes(n));
      this.activeNode = fix(this.activeNode);
      if (!this.nodes.includes(this.activeNode)) this.activeNode = DEFAULT_NODES[0];
      for (const n of DEFAULT_NODES) if (!this.nodeInfo[n]) this.nodeInfo[n] = MAINNET_NODE_INFO;
      this.applyNetwork();
    },
    netName(nethash: string): string {
      return this.cryptoConfig[nethash]?.network?.name ?? (nethash === MAINNET.nethash ? "mainnet" : "");
    },
    applyNetwork() {
      applyCryptoConfig(this.cryptoConfig[this.activeNetwork.nethash] ?? null, this.activeNetwork.nethash);
    },
    /** Manual pick: pins the node and switches network if it belongs to another chain. */
    setActiveNode(node: string) {
      if (!this.nodes.includes(node)) return false;
      const info = this.nodeInfo[node];
      const changed = !!info && info.nethash !== this.activeNetwork.nethash;
      this.activeNode = node;
      this.pinnedNode = true;
      this.activeNodeStatus = this.nodesStatus.find((s) => s.node === node)?.status ?? null;
      if (info) this.activeNetwork = { ...info };
      if (changed) this.applyNetwork();
      return changed;
    },
    /** Switch to a network: prefer its fastest synced node. Returns false when no node is known. */
    switchNetwork(nethash: string) {
      const candidates = this.nodesOf(nethash);
      if (!candidates.length) return false;
      const best =
        this.nodesStatus.find((s) => s.synced && candidates.includes(s.node))?.node ?? candidates[0];
      this.setActiveNode(best);
      this.pinnedNode = false;
      return true;
    },
    /** Validate + register a node. Fetches its configuration (+ crypto config for unknown networks). */
    async addNode(raw: string): Promise<NodeInfo> {
      const url = normalizeNodeUrl(raw);
      if (!url) throw new Error("invalid-url");
      if (this.nodes.includes(url)) throw new Error("exists");
      if (isBlockedMixedContent(url)) throw new Error("mixed-content");
      if (!(await ensureHostPermission(url))) throw new Error("permission");
      const info = await fetchNodeInfo(url);
      if (!this.cryptoConfig[info.nethash] && info.nethash !== MAINNET.nethash) {
        const cfg = await fetchCryptoConfig(url);
        this.cryptoConfig[info.nethash] = cfg;
        info.name = cfg.network?.name ?? "";
      } else {
        info.name = this.netName(info.nethash);
      }
      this.nodeInfo[url] = info;
      this.nodes.push(url);
      this.customNodes.push(url);
      fetchNodeStatus(url)
        .then((status) => {
          this.nodesStatus = [
            ...this.nodesStatus.filter((s) => s.node !== url),
            { node: url, status, latency: 0, synced: !!status?.synced },
          ];
        })
        .catch(() => {});
      return info;
    },
    removeNode(url: string) {
      if (DEFAULT_NODES.includes(url)) return;
      this.nodes = this.nodes.filter((n) => n !== url);
      this.customNodes = this.customNodes.filter((n) => n !== url);
      this.nodesStatus = this.nodesStatus.filter((s) => s.node !== url);
      delete this.nodeInfo[url];
      if (this.activeNode === url) {
        this.pinnedNode = false;
        if (!this.switchNetwork(this.activeNetwork.nethash)) {
          this.switchNetwork(MAINNET.nethash);
        }
      }
    },
    /** Probe every node; auto-select the fastest synced node of the ACTIVE network unless pinned. */
    async updateNodes() {
      const probes = this.nodes.map(async (node) => {
        const t0 = Date.now();
        try {
          const status = await fetchNodeStatus(node);
          const latency = Date.now() - t0;
          if (!this.nodeInfo[node]?.coreVersion) {
            fetchNodeInfo(node)
              .then((i) => { this.nodeInfo[node] = { ...i, name: this.netName(i.nethash) }; })
              .catch(() => {});
          }
          return { node, status, latency, synced: !!status?.synced };
        } catch {
          return { node, status: null, latency: Infinity, synced: false };
        }
      });
      const results = await Promise.allSettled(probes);
      const statuses: NodeStatus[] = results.map((r, i) =>
        r.status === "fulfilled"
          ? r.value
          : { node: this.nodes[i], status: null, latency: Infinity, synced: false }
      );
      statuses.sort((a, b) => a.latency - b.latency);
      this.nodesStatus = statuses;

      const mine = statuses.filter((s) => this.nodesOf(this.activeNetwork.nethash).includes(s.node));
      const pinned = mine.find((s) => s.node === this.activeNode);
      if (this.pinnedNode && pinned?.synced) {
        this.activeNodeStatus = pinned.status;
        return pinned;
      }
      const best = mine.find((s) => s.synced);
      if (best) {
        this.pinnedNode = false;
        this.activeNode = best.node;
        this.activeNodeStatus = best.status;
        return best;
      }
      this.activeNodeStatus = pinned?.status ?? null;
      return null;
    },
    setTheme(theme: "rust" | "cyan" | "light") {
      this.theme = theme;
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme", theme);
        document.body.setAttribute("data-theme", theme);
      }
    },
    applyTheme() {
      this.setTheme(this.theme);
    },
    setLocale(locale: "en" | "ru" | "zh" | "es") {
      this.locale = locale;
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("lang", locale);
      }
    },
    /** Auto-lock configuration. `seconds` = 0 disables timer. */
    setAutoLock(enabled: boolean, seconds?: number) {
      this.autoLockEnabled = enabled;
      if (typeof seconds === "number" && seconds > 0) {
        this.lockTimeoutSec = seconds;
      }
    },
  },
  persist: {
    key: "sth.settings",
    storage: localStorage,
    omit: ["nodesStatus", "activeNodeStatus"],
  } as any,
});
