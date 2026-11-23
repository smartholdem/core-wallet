import { defineStore } from "pinia";
import axios from "axios";
import { useSettingsStore } from "./settings";
import { useAuthStore } from "./auth";
import { useWalletStore } from "./wallet";
import {
  FLAG_BURNABLE,
  FLAG_MINTABLE,
  LIMITS,
  SOBJ_TYPE,
  TICKER_SOBJ_TYPE,
  TOKEN,
  TYPE_GROUP_SOBJ,
  TYPE_GROUP_TOKEN,
  type ChainTx,
  type TokenMetaAsset,
} from "@/lib/tokenTx";

export const SOBJ_REGISTER_FEE = "5000000000"; // 50 STH, protocol constant (sth-core sobj::FEE_REGISTER)

export interface TokenFees {
  init: string; initBurn: string; initBurnPercent: number; meta: string;
  mint: string; burn: string; transfer: string; transferPerRecipient: string;
}
export interface TokenConfig {
  enabled: boolean;
  fees: TokenFees | null;
  tickerRule: string;
  maxLogoBytes: number;
  maxRecipients: number;
  market: { enabled: boolean; fees: { sell: string; buy: string; cancel: string }; maxOpenOrders: number; pricePerToken: boolean } | null;
}
export interface TokenOrder {
  orderId: string; tokenId: string; symbol: string | null; decimals: number | null; seller: string;
  price: string; priceUnit: string; pricePerToken: string | null; amount: string; filled: string;
  remaining: string; total: string; height: number; open: boolean;
}

/** STH (smartoshi) a buyer pays for `amount` units: ceil(amount × price / priceUnit). */
export function orderCost(o: Pick<TokenOrder, "price" | "priceUnit">, amount: bigint): bigint {
  const unit = BigInt(o.priceUnit || "1") || 1n;
  return (amount * BigInt(o.price) + unit - 1n) / unit;
}
export interface WalletToken { id: string; balance: string; symbol: string | null; decimals: number | null }
export interface TokenDetail {
  id: string; symbol: string; decimals: number; flags: number; mintable: boolean; burnable: boolean;
  supply: string; supplyCap: string; owner: string; initHeight: number;
  meta: { name: string; description: string; website: string; logoType: string | null; logoSize: number; logoUrl: string | null } | null;
  sobj: { resigned: boolean; forSale: boolean } | null;
}
export interface Ticker { id: string; name: string; address: string; isResigned: boolean }

/** Map node error strings → i18n keys (node texts are developer-facing). */
export const NODE_ERRORS: [RegExp, string][] = [
  [/SmartObjectNameAlreadyRegisteredError|SmartObjectAlreadyRegisteredError/, "tok.errTickerTaken"],
  [/reserved|protected/i, "tok.errTickerReserved"],
  [/SmartObjectTickerInvalidError/, "tok.errTickerFormat"],
  [/TokenInsufficientBalanceError|insufficient token/i, "tok.errInsufficientTokens"],
  [/InsufficientBalanceError|balance must stay|needed/i, "tok.errInsufficientSth"],
  [/TokenAlreadyInitialized|already has a token|TokenExists/i, "tok.errAlreadyIssued"],
  [/not the owner|NotOwner|only the owner/i, "tok.errNotOwner"],
  [/TokenNotMintable|not mintable|TokenSupplyCapExceeded|exceeds supplyCap|cap/i, "tok.errMintCap"],
  [/TokenNotBurnable|not burnable/i, "tok.errNotBurnable"],
  [/StaticFeeMismatchError/, "tok.errFeeMismatch"],
  [/TokenTypeNotActiveError|tokens are not enabled|tokens.*disabled/i, "tok.errNotActive"],
  [/TokenOrderSelfTradeError/, "mkt.errSelf"],
  [/TokenOrderClosedError|TokenOrderNotFoundError/, "mkt.errClosed"],
  [/TokenOrderAmountError/, "mkt.errAmount"],
  [/TokenTooManyOrdersError/, "mkt.errTooMany"],
  [/TokenOrderNotOwnerError/, "mkt.errNotSeller"],
  [/price-granularity/, "mkt.errGranularity"],
  [/nonce/i, "tok.errNonce"],
  [/pool is full|rate/i, "tok.errPool"],
];

export function nodeErrorKey(message: string): string | null {
  for (const [re, key] of NODE_ERRORS) if (re.test(message)) return key;
  return null;
}

export const useTokensStore = defineStore("tokens", {
  state: () => ({
    config: null as TokenConfig | null,
    configNode: "",
    walletTokens: {} as Record<string, WalletToken[]>,
    owned: {} as Record<string, string[]>,
    tickers: {} as Record<string, Ticker[]>,
    details: {} as Record<string, TokenDetail>,
    /** address → list of queued (mempool) op descriptors */
    pending: {} as Record<string, { kind: string; id?: string; ticker?: string; txId: string; at: number }[]>,
    loading: false,
  }),
  getters: {
    apiBase: () => useSettingsStore().apiBase,
    supported(state): boolean {
      return !!state.config?.enabled && !!state.config?.fees;
    },
    market(state) {
      return state.config?.market?.enabled ? state.config.market : null;
    },
    fees(state): TokenFees | null {
      return state.config?.fees ?? null;
    },
    tickerRe(state): RegExp {
      try { return new RegExp(state.config?.tickerRule || "^[A-Z0-9]{3,10}$"); } catch { return /^[A-Z0-9]{3,10}$/; }
    },
    forAddress: (state) => (address: string) => state.walletTokens[address] ?? [],
    ownedIds: (state) => (address: string) => state.owned[address] ?? [],
    myTickers: (state) => (address: string) => state.tickers[address] ?? [],
    pendingFor: (state) => (address: string) => (state.pending[address] ?? []).filter((p) => Date.now() - p.at < 60_000),
    logoUrl: () => (d: TokenDetail | undefined) =>
      d?.meta?.logoUrl ? `${useSettingsStore().activeNode}${d.meta.logoUrl}` : null,
  },
  actions: {
    async fetchConfig(force = false) {
      const node = useSettingsStore().activeNode;
      if (!force && this.config && this.configNode === node) return this.config;
      try {
        const r = await axios.get(`${this.apiBase}/node/configuration`, { timeout: 8000 });
        const c = r.data?.data?.constants ?? {};
        this.config = {
          enabled: !!c.tokens,
          fees: c.tokenFees ?? null,
          tickerRule: c.tokenTickerRule ?? "^[A-Z0-9]{3,10}$",
          maxLogoBytes: Number(c.tokenMetaMaxLogoBytes ?? LIMITS.logo),
          maxRecipients: Number(c.tokenTransferMaxRecipients ?? 64),
          market: c.tokenMarket?.fees
            ? { enabled: !!c.tokenMarket.enabled, fees: c.tokenMarket.fees, maxOpenOrders: Number(c.tokenMarket.maxOpenOrders ?? 64), pricePerToken: !!c.tokenMarket.pricePerToken }
            : null,
        };
      } catch {
        this.config = { enabled: false, fees: null, tickerRule: "", maxLogoBytes: LIMITS.logo, maxRecipients: 1, market: null };
      }
      this.configNode = node;
      return this.config;
    },

    /** Balances + owned tokens + tickers for an address (re-read from the node every time). */
    async refresh(address: string) {
      if (!address) return;
      this.loading = true;
      try {
        await this.fetchConfig();
        if (!this.supported) return;
        const [bal, own, tick] = await Promise.allSettled([
          axios.get(`${this.apiBase}/wallets/${address}/tokens`, { timeout: 8000 }),
          axios.get(`${this.apiBase}/tokens`, { params: { owner: address, limit: 100 }, timeout: 8000 }),
          axios.get(`${this.apiBase}/sobj`, { params: { type: TICKER_SOBJ_TYPE, owner: address, limit: 100 }, timeout: 8000 }),
        ]);
        if (bal.status === "fulfilled") this.walletTokens[address] = bal.value.data?.data ?? [];
        if (own.status === "fulfilled") {
          // node ignores unknown filters → enforce owner client-side
          const list: TokenDetail[] = (own.value.data?.data ?? []).filter((t: TokenDetail) => t.owner === address);
          this.owned[address] = list.map((t) => t.id);
          for (const t of list) this.details[t.id] = t;
        }
        if (tick.status === "fulfilled") {
          this.tickers[address] = (tick.value.data?.data ?? [])
            .filter((s: any) => !s.isResigned && s.address === address)
            .map((s: any) => ({ id: s.id, name: s.data?.name ?? "", address: s.address, isResigned: !!s.isResigned }));
        }
        const missing = (this.walletTokens[address] ?? []).map((t) => t.id).filter((id) => !this.details[id]);
        await Promise.allSettled(missing.map((id) => this.fetchToken(id)));
      } finally {
        this.loading = false;
      }
    },

    async fetchToken(key: string): Promise<TokenDetail | null> {
      try {
        const r = await axios.get(`${this.apiBase}/tokens/${key}`, { timeout: 8000 });
        const d: TokenDetail = r.data?.data;
        if (d?.id) this.details[d.id] = d;
        return d ?? null;
      } catch {
        return null;
      }
    },

    async fetchHolders(id: string) {
      const r = await axios.get(`${this.apiBase}/tokens/${id}/holders`, { params: { limit: 100 }, timeout: 8000 });
      return (r.data?.data ?? []) as { address: string; balance: string }[];
    },

    /** Token-group txs touching `address`, optionally filtered by token id. */
    async fetchTokenTxs(address: string, id?: string, limit = 50) {
      const r = await axios.get(`${this.apiBase}/wallets/${address}/transactions`, {
        params: { typeGroup: TYPE_GROUP_TOKEN, limit }, timeout: 8000,
      });
      const list: any[] = r.data?.data ?? [];
      return id ? list.filter((t) => t.asset?.token?.id === id) : list;
    },

    /** Open asks of a token, cheapest first. */
    async fetchOrders(id: string) {
      const r = await axios.get(`${this.apiBase}/tokens/${id}/orders`, { params: { limit: 100 }, timeout: 8000 });
      return ((r.data?.data ?? []) as TokenOrder[]).filter((o) => o.open !== false);
    },

    async fetchTrades(id: string, limit = 20) {
      const r = await axios.get(`${this.apiBase}/tokens/${id}/trades`, { params: { limit }, timeout: 8000 });
      return (r.data?.data ?? []) as { txId: string; buyer: string; seller: string; amount: string; pricePerToken: string; total: string; timestamp: number; time?: string }[];
    },

    /** null = free, "taken" = ticker registered, "token" = token already issued. */
    async checkTicker(symbol: string): Promise<null | "taken" | "token"> {
      const s = symbol.toUpperCase();
      const [sobj, tok] = await Promise.allSettled([
        axios.get(`${this.apiBase}/sobj`, { params: { type: TICKER_SOBJ_TYPE, name: s, limit: 1 }, timeout: 8000 }),
        axios.get(`${this.apiBase}/tokens/${s}`, { timeout: 8000 }),
      ]);
      if (tok.status === "fulfilled" && tok.value.data?.data?.id) return "token";
      if (sobj.status === "fulfilled") {
        const hit = (sobj.value.data?.data ?? []).find((x: any) => x.data?.name === s && !x.isResigned);
        if (hit) return "taken";
      }
      return null;
    },

    transferFee(recipients = 1): bigint {
      const f = this.fees;
      if (!f) return 0n;
      return BigInt(f.transfer) + BigInt(f.transferPerRecipient) * BigInt(Math.max(0, recipients - 1));
    },

    /* ─────────── chain operations (all return the broadcast tx) ─────────── */

    async registerTicker(name: string) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_SOBJ, type: SOBJ_TYPE, fee: SOBJ_REGISTER_FEE,
        asset: { type: TICKER_SOBJ_TYPE, subType: 0, action: 0, data: { name } },
      }));
      this.track(ctxAddr(), { kind: "ticker", ticker: name, txId: tx.id! });
      return tx;
    },

    async initToken(args: { tickerId: string; decimals: number; initialSupply: bigint; supplyCap: bigint; mintable: boolean; burnable: boolean }) {
      const flags = (args.mintable ? FLAG_MINTABLE : 0) | (args.burnable ? FLAG_BURNABLE : 0);
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.INIT, fee: this.fees!.init,
        asset: { token: { id: args.tickerId, decimals: args.decimals, flags, initialSupply: args.initialSupply.toString(), supplyCap: args.supplyCap.toString() } },
      }));
      this.track(ctxAddr(), { kind: "init", id: args.tickerId, txId: tx.id! });
      return tx;
    },

    async transfer(args: { id: string; recipient: string; amount: bigint; memo?: string }) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.TRANSFER, fee: this.transferFee(1).toString(),
        asset: { token: { id: args.id, transfers: [{ recipientId: args.recipient, amount: args.amount.toString() }], memo: args.memo ?? "" } },
      }));
      this.track(ctxAddr(), { kind: "transfer", id: args.id, txId: tx.id! });
      return tx;
    },

    /** Up to `maxRecipients` payouts in one TokenTransfer. */
    async transferMany(args: { id: string; items: { recipientId: string; amount: bigint }[]; memo?: string }) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.TRANSFER, fee: this.transferFee(args.items.length).toString(),
        asset: { token: { id: args.id, transfers: args.items.map((i) => ({ recipientId: i.recipientId, amount: i.amount.toString() })), memo: args.memo ?? "" } },
      }));
      this.track(ctxAddr(), { kind: "transfer", id: args.id, txId: tx.id! });
      return tx;
    },

    /** Ask: `pricePerToken` in smartoshi per whole token. Uses TokenSellV2 when active, else legacy per-unit price. */
    async sell(args: { id: string; decimals: number; amount: bigint; pricePerToken: bigint }) {
      const m = this.market!;
      const scale = 10n ** BigInt(args.decimals);
      let type: number = TOKEN.SELL_V2;
      let price = args.pricePerToken;
      if (!m.pricePerToken) {
        if (price % scale !== 0n) throw new Error("price-granularity");
        type = TOKEN.SELL;
        price = price / scale;
      }
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type, fee: m.fees.sell,
        asset: { token: { id: args.id, amount: args.amount.toString(), price: price.toString() } },
      }));
      this.track(ctxAddr(), { kind: "sell", id: args.id, txId: tx.id! });
      return tx;
    },

    async buy(args: { order: TokenOrder; amount: bigint }) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.BUY, fee: this.market!.fees.buy,
        asset: { token: { id: args.order.tokenId, orderId: args.order.orderId, amount: args.amount.toString() } },
      }));
      this.track(ctxAddr(), { kind: "buy", id: args.order.tokenId, txId: tx.id! });
      return tx;
    },

    async cancelOrder(order: TokenOrder) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.CANCEL, fee: this.market!.fees.cancel,
        asset: { token: { id: order.tokenId, orderId: order.orderId } },
      }));
      this.track(ctxAddr(), { kind: "cancel", id: order.tokenId, txId: tx.id! });
      return tx;
    },

    async mint(args: { id: string; recipient: string; amount: bigint }) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.MINT, fee: this.fees!.mint,
        asset: { token: { id: args.id, amount: args.amount.toString(), recipientId: args.recipient } },
      }));
      this.track(ctxAddr(), { kind: "mint", id: args.id, txId: tx.id! });
      return tx;
    },

    async burn(args: { id: string; amount: bigint }) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.BURN, fee: this.fees!.burn,
        asset: { token: { id: args.id, amount: args.amount.toString() } },
      }));
      this.track(ctxAddr(), { kind: "burn", id: args.id, txId: tx.id! });
      return tx;
    },

    async setMeta(id: string, meta: TokenMetaAsset) {
      const tx = await useWalletStore().sendChainTx((ctx) => ({
        ...ctx, typeGroup: TYPE_GROUP_TOKEN, type: TOKEN.META, fee: this.fees!.meta,
        asset: { token: { id, meta } },
      }));
      this.track(ctxAddr(), { kind: "meta", id, txId: tx.id! });
      return tx;
    },

    track(address: string, p: { kind: string; id?: string; ticker?: string; txId: string }) {
      this.pending[address] = [...(this.pending[address] ?? []), { ...p, at: Date.now() }];
      setTimeout(() => {
        this.pending[address] = (this.pending[address] ?? []).filter((x) => x.txId !== p.txId);
        this.refresh(address).catch(() => {});
      }, 9500);
    },
  },
});

const ctxAddr = () => useAuthStore().address;
export type { ChainTx };
