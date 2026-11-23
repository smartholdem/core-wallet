<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";
import ActionSheet from "./ActionSheet.vue";
import OpSummary from "./OpSummary.vue";
import { useTokensStore, orderCost, type TokenDetail, type TokenOrder } from "@/stores/tokens";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { useTokenOp, tokenAmount, sth } from "@/lib/tokenUi";
import { toUnits, fromUnits } from "@/lib/tokenTx";
import { explorerUrl } from "@/lib/network";
import { shortAddress, timeAgo } from "@/lib/utils";
import { useT } from "@/locales";

const props = defineProps<{ open: boolean; token: TokenDetail; balance: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "done", txId: string): void }>();
const t = useT();
const tokens = useTokensStore();
const auth = useAuthStore();
const settings = useSettingsStore();
const { busy, run } = useTokenOp();

const mode = ref<"list" | "sell" | "buy" | "cancel">("list");
const orders = ref<TokenOrder[] | null>(null);
const trades = ref<Awaited<ReturnType<typeof tokens.fetchTrades>>>([]);
const sel = ref<TokenOrder | null>(null);
const amount = ref("");
const price = ref("");

async function load() {
  orders.value = null;
  const [o, tr] = await Promise.all([tokens.fetchOrders(props.token.id).catch(() => []), tokens.fetchTrades(props.token.id, 10).catch(() => [])]);
  orders.value = o;
  trades.value = tr;
}
watch(() => props.open, (o) => { if (o) { mode.value = "list"; load(); } });

const dec = computed(() => props.token.decimals);
const perToken = (o: TokenOrder) => BigInt(o.pricePerToken ?? (BigInt(o.price) * 10n ** BigInt(dec.value)) / (BigInt(o.priceUnit || "1") || 1n));
const units = computed(() => { try { return toUnits(amount.value, dec.value); } catch { return null; } });
const priceUnits = computed(() => { try { return toUnits(price.value, 8); } catch { return null; } });
const step = computed(() => (tokens.market && !tokens.market.pricePerToken ? 10n ** BigInt(dec.value) : 1n));
const myOpen = computed(() => (orders.value ?? []).filter((o) => o.seller === auth.address).length);

function go(m: "sell" | "buy" | "cancel", o: TokenOrder | null = null) {
  sel.value = o;
  amount.value = m === "buy" && o ? fromUnits(o.remaining, dec.value) : "";
  price.value = "";
  mode.value = m;
}

const sellTotal = computed(() => (units.value && priceUnits.value ? (units.value * priceUnits.value + 10n ** BigInt(dec.value) - 1n) / 10n ** BigInt(dec.value) : 0n));
const sellErr = computed(() => {
  if (units.value != null && units.value > BigInt(props.balance)) return t.value("tok.errInsufficientTokens");
  if (priceUnits.value && priceUnits.value % step.value !== 0n) return t.value("mkt.errGranularity");
  if (tokens.market && myOpen.value >= tokens.market.maxOpenOrders) return t.value("mkt.errTooMany");
  return "";
});
const canSell = computed(() => !busy.value && !!units.value && !!priceUnits.value && !sellErr.value);

const buyCost = computed(() => (sel.value && units.value ? orderCost(sel.value, units.value) : 0n));
const buyErr = computed(() => (sel.value && units.value != null && units.value > BigInt(sel.value.remaining) ? t.value("mkt.errAmount") : ""));
const canBuy = computed(() => !busy.value && !!sel.value && !!units.value && !buyErr.value);

async function fire(fn: () => Promise<{ id?: string }>) {
  const tx = await run(fn);
  if (tx) emit("done", tx.id!);
}
const doSell = () => fire(() => tokens.sell({ id: props.token.id, decimals: dec.value, amount: units.value!, pricePerToken: priceUnits.value! }));
const doBuy = () => fire(() => tokens.buy({ order: sel.value!, amount: units.value! }));
const doCancel = () => fire(() => tokens.cancelOrder(sel.value!));
const title = computed(() => ({ list: t.value("mkt.title"), sell: t.value("mkt.sellTitle"), buy: t.value("mkt.buyTitle"), cancel: t.value("mkt.cancelTitle") })[mode.value]);
</script>

<template>
  <ActionSheet :open="open" :title="`${title} · ${token.symbol}`" testid="token-market-sheet" @close="emit('close')">
    <p v-if="!tokens.market" class="text-[11px] text-rust" data-testid="market-disabled">{{ t("mkt.disabled") }}</p>

    <template v-else-if="mode === 'list'">
      <button v-if="BigInt(balance) > 0n" @click="go('sell')" class="forge-btn-primary h-10 text-[10px] uppercase tracking-[0.18em]" data-testid="market-sell-btn">+ {{ t("mkt.sell") }}</button>
      <div class="flex items-center justify-between">
        <span class="forge-label !mb-0">{{ t("mkt.orders") }}</span>
        <button @click="load" class="text-[10px] text-cyan-voltGlow" data-testid="market-refresh-btn">↻</button>
      </div>
      <p v-if="!orders" class="text-[11px] text-fiatDim animate-pulse">{{ t("tok.loading") }}</p>
      <div v-else class="flex flex-col gap-1.5" data-testid="market-orders">
        <div v-for="o in orders" :key="o.orderId" class="forge-card p-2.5 flex items-center justify-between gap-2 text-xs" data-testid="market-order-row">
          <div class="min-w-0">
            <p class="mono text-bone">{{ sth(perToken(o), 8) }} <span class="text-[10px] text-fiat">{{ settings.token }}/{{ token.symbol }}</span></p>
            <p class="text-[10px] text-fiatDim truncate">
              {{ t("mkt.remaining") }} <span class="mono text-fiat">{{ tokenAmount(o.remaining, dec) }}</span> ·
              <span class="mono" :class="o.seller === auth.address ? 'text-cyan-voltGlow' : ''">{{ o.seller === auth.address ? t("mkt.you") : shortAddress(o.seller, 5, 5) }}</span>
            </p>
          </div>
          <button v-if="o.seller === auth.address" @click="go('cancel', o)" class="forge-btn h-8 px-3 text-[10px] uppercase tracking-[0.15em] text-rust border-rust/50 shrink-0" data-testid="market-cancel-btn">{{ t("mkt.cancel") }}</button>
          <button v-else @click="go('buy', o)" class="forge-btn-primary h-8 px-3 text-[10px] uppercase tracking-[0.15em] shrink-0" data-testid="market-buy-btn">{{ t("mkt.buy") }}</button>
        </div>
        <p v-if="!orders.length" class="text-[11px] text-fiatDim text-center py-2" data-testid="market-empty">{{ t("mkt.noOrders") }}</p>
      </div>
      <span class="forge-label !mb-0">{{ t("mkt.trades") }}</span>
      <div class="flex flex-col gap-0.5" data-testid="market-trades">
        <div v-for="tr in trades" :key="tr.txId" class="flex items-center justify-between text-[11px] py-1 border-b border-gunmetal-400/60 last:border-0">
          <span class="mono text-fiat">{{ tokenAmount(tr.amount, dec) }} {{ token.symbol }} × {{ sth(tr.pricePerToken, 8) }} {{ settings.token }}</span>
          <span class="text-fiatDim">{{ tr.time ? timeAgo(Math.floor(Date.parse(tr.time) / 1000)) : "" }}</span>
        </div>
        <p v-if="!trades.length" class="text-[11px] text-fiatDim text-center py-1">{{ t("mkt.noTrades") }}</p>
      </div>
      <a :href="explorerUrl(settings.activeNetwork.explorer, 'market')" target="_blank" rel="noopener" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow text-center" data-testid="market-explorer-link">{{ t("mkt.openExplorer") }} ↗</a>
    </template>

    <template v-else>
      <button @click="mode = 'list'" class="self-start text-[10px] uppercase tracking-[0.18em] text-fiat hover:text-bone" data-testid="market-back-btn">← {{ t("mkt.orders") }}</button>

      <template v-if="mode === 'sell'">
        <div>
          <label class="forge-label">{{ t("mkt.amount") }} ({{ token.symbol }})</label>
          <input v-model="amount" inputmode="decimal" class="forge-input mono" placeholder="0" data-testid="market-sell-amount" />
          <p class="text-[10px] text-fiatDim mt-1">{{ t("tok.available") }}: <span class="mono">{{ tokenAmount(balance, dec) }}</span></p>
        </div>
        <div>
          <label class="forge-label">{{ t("mkt.price") }} ({{ settings.token }})</label>
          <input v-model="price" inputmode="decimal" class="forge-input mono" placeholder="0" data-testid="market-sell-price" />
          <p v-if="step > 1n" class="text-[10px] text-fiatDim mt-1" data-testid="market-price-step">{{ t("mkt.priceStep").replace("{step}", `${sth(step, 8)} ${settings.token}`) }}</p>
        </div>
        <p v-if="sellErr" class="text-[10px] text-rust" data-testid="market-sell-error">{{ sellErr }}</p>
        <p class="text-[10px] text-fiatDim leading-relaxed">{{ t("mkt.locked") }}</p>
        <OpSummary :rows="[{ label: t('mkt.amount'), value: `${amount || '0'} ${token.symbol}` }, { label: t('mkt.price'), value: `${price || '0'} ${settings.token}` }, { label: t('mkt.total'), value: `${sth(sellTotal, 8)} ${settings.token}` }]" :fee="tokens.market.fees.sell" :label="t('mkt.holdSell')" :disabled="!canSell" testid="market-sell-hold-btn" @fired="doSell" />
      </template>

      <template v-else-if="mode === 'buy' && sel">
        <div class="forge-card p-2.5 text-[11px] flex justify-between"><span class="text-fiatDim">{{ t("mkt.seller") }}</span><span class="mono text-bone">{{ shortAddress(sel.seller, 8, 8) }}</span></div>
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="forge-label !mb-0">{{ t("mkt.amount") }} ({{ token.symbol }})</label>
            <button @click="amount = fromUnits(sel.remaining, dec)" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow" data-testid="market-buy-max">MAX</button>
          </div>
          <input v-model="amount" inputmode="decimal" class="forge-input mono" data-testid="market-buy-amount" />
          <p class="text-[10px] text-fiatDim mt-1">{{ t("mkt.remaining") }}: <span class="mono">{{ tokenAmount(sel.remaining, dec) }}</span> · {{ sth(perToken(sel), 8) }} {{ settings.token }}/{{ token.symbol }}</p>
        </div>
        <p v-if="buyErr" class="text-[10px] text-rust" data-testid="market-buy-error">{{ buyErr }}</p>
        <OpSummary :rows="[{ label: t('mkt.youGet'), value: `${amount || '0'} ${token.symbol}` }, { label: t('mkt.youPay'), value: `${sth(buyCost, 8)} ${settings.token}` }]" :fee="tokens.market.fees.buy" :spend="buyCost" :label="t('mkt.holdBuy')" :disabled="!canBuy" testid="market-buy-hold-btn" @fired="doBuy" />
      </template>

      <template v-else-if="mode === 'cancel' && sel">
        <OpSummary :rows="[{ label: t('mkt.remaining'), value: `${tokenAmount(sel.remaining, dec)} ${token.symbol}` }, { label: t('mkt.price'), value: `${sth(perToken(sel), 8)} ${settings.token}` }]" :fee="tokens.market.fees.cancel" :label="t('mkt.holdCancel')" variant="rust" :disabled="busy" testid="market-cancel-hold-btn" @fired="doCancel" />
      </template>
    </template>
  </ActionSheet>
</template>
