import providerSource from "@/inject/mobile-provider.js?raw";
import { getAuthorizedOrigins } from "@/lib/origins";

/**
 * Android/iOS dApp browser — Capgo InAppBrowser WebView with the SmartHoldem
 * provider injected at documentStart. Requests coming out of the page are
 * handed to the wallet UI (same intent pipeline as the extension); while the
 * user decides, the WebView is hidden and shown again on completion.
 */
type Handler = (method: string, params: any) => void;

interface PendingReq {
  id: string | number;
  method: string;
  origin: string;
}

const TOOLBAR_COLOR = "#121315";

class DappBrowser {
  private plugin: any = null;
  private handler: Handler | null = null;
  private lockedCheck: (() => boolean) | null = null;
  private addressGetter: (() => string) | null = null;
  private pending = new Map<string | number, PendingReq>();
  private listeners: any[] = [];
  viewId: string | null = null;
  currentUrl = "";
  hidden = false;

  get isOpen() {
    return this.viewId !== null;
  }

  init(opts: { onRequest: Handler; isLocked: () => boolean; address: () => string }) {
    this.handler = opts.onRequest;
    this.lockedCheck = opts.isLocked;
    this.addressGetter = opts.address;
  }

  private async load() {
    if (this.plugin) return this.plugin;
    const mod = await import("@capgo/inappbrowser");
    this.plugin = mod.InAppBrowser;
    this.listeners = await Promise.all([
      this.plugin.addListener("messageFromWebview", (ev: any) => this.onMessage(ev)),
      this.plugin.addListener("urlChangeEvent", (ev: any) => {
        if (typeof ev?.url === "string") this.currentUrl = ev.url;
      }),
      this.plugin.addListener("closeEvent", () => this.onClosed()),
    ]);
    return this.plugin;
  }

  async open(url: string) {
    const plugin = await this.load();
    if (this.viewId) await this.close();
    this.currentUrl = url;
    const res = await plugin.openWebView({
      url,
      title: "SmartHoldem dApp",
      toolbarType: "navigation",
      toolbarColor: TOOLBAR_COLOR,
      toolbarTextColor: "#E6E1D8",
      showReloadButton: true,
      showArrow: true,
      isPresentAfterPageLoad: true,
      preShowScript: providerSource,
      preShowScriptInjectionTime: "documentStart",
      activeNativeNavigationForWebview: true,
      openBlankTargetInWebView: true,
      enabledSafeTopMargin: true,
      textZoom: 100,
    });
    this.viewId = res?.id ?? "default";
    this.hidden = false;
  }

  async show() {
    if (!this.viewId) return;
    await this.plugin.show({ id: this.viewId });
    this.hidden = false;
  }

  async hide() {
    if (!this.viewId) return;
    await this.plugin.hide({ id: this.viewId });
    this.hidden = true;
  }

  async close() {
    if (!this.viewId) return;
    const id = this.viewId;
    this.viewId = null;
    try {
      await this.plugin.close({ id });
    } catch {}
    this.onClosed();
  }

  private onClosed() {
    for (const [id] of this.pending) this.reply(id, undefined, "smartholdem: dApp browser closed");
    this.pending.clear();
    this.viewId = null;
    this.hidden = false;
  }

  private async onMessage(ev: any) {
    const msg = ev?.detail?.source ? ev.detail : ev;
    if (!msg || msg.source !== "smartholdem-dapp" || !this.handler) return;
    const { id, method, params } = msg;
    let origin = "";
    try {
      origin = new URL(msg.href || this.currentUrl).origin;
    } catch {}
    this.pending.set(id, { id, method, origin });

    if (method === "getAccount") {
      const [whitelist, addr] = [await getAuthorizedOrigins(), this.addressGetter?.() || ""];
      if (origin && addr && whitelist.includes(origin)) {
        this.complete(id, true, { address: addr });
        return;
      }
    }
    if (this.lockedCheck?.()) {
      this.complete(id, false, null, "smartholdem: wallet is locked — unlock it and retry");
      await this.hide();
      return;
    }
    await this.hide();
    this.handler(method, { ...(params || {}), __id: id, origin });
  }

  /** Resolve a dApp promise (called by the Authorize* modals via dappBus). */
  complete(id: string | number, approved: boolean, payload: any, error?: string) {
    if (!this.pending.has(id)) return;
    this.pending.delete(id);
    this.reply(id, approved ? payload : undefined, approved ? undefined : error || "User rejected the request.");
    if (this.hidden) void this.show();
  }

  private reply(id: string | number, result: any, error?: string) {
    if (!this.plugin || !this.viewId) return;
    const detail: any = { source: "smartholdem-wallet", id };
    if (error) detail.error = error;
    else detail.result = result ?? null;
    void this.plugin.postMessage({ id: this.viewId, detail });
  }
}

export const dappBrowser = new DappBrowser();
