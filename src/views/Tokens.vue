<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import TokenLogo from "@/components/token/TokenLogo.vue";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { useTokensStore } from "@/stores/tokens";
import { usePullToRefresh } from "@/lib/pull";
import { tokenAmount, tokenName } from "@/lib/tokenUi";
import { useT } from "@/locales";
import { explorerUrl } from "@/lib/network";

const router = useRouter();
const t = useT();
const auth = useAuthStore();
const settings = useSettingsStore();
const tokens = useTokensStore();

const refresh = () => tokens.refresh(auth.address);
const { pull, pulling, onStart, onMove, onEnd } = usePullToRefresh(refresh);

const rows = computed(() => {
  const owned = new Set(tokens.ownedIds(auth.address));
  const seen = new Set<string>();
  const list = tokens.forAddress(auth.address).map((w) => {
    seen.add(w.id);
    const d = tokens.details[w.id];
    return { id: w.id, symbol: w.symbol ?? d?.symbol ?? "?", name: tokenName(d, w), balance: w.balance, decimals: w.decimals ?? d?.decimals ?? 0, owner: owned.has(w.id), logo: tokens.logoUrl(d) };
  });
  for (const id of owned) {
    if (seen.has(id)) continue;
    const d = tokens.details[id];
    if (d) list.push({ id, symbol: d.symbol, name: tokenName(d), balance: "0", decimals: d.decimals, owner: true, logo: tokens.logoUrl(d) });
  }
  return list.sort((a, b) => Number(b.owner) - Number(a.owner) || a.symbol.localeCompare(b.symbol));
});
const issuedIds = computed(() => new Set([...tokens.ownedIds(auth.address), ...tokens.forAddress(auth.address).map((w) => w.id)]));
const freeTickers = computed(() => tokens.myTickers(auth.address).filter((tk) => !issuedIds.value.has(tk.id)));
const pending = computed(() => tokens.pendingFor(auth.address));

onMounted(refresh);
watch(() => [auth.address, settings.activeNode], refresh);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="tokens-view">
    <TopBar />
    <div class="flex-1 overflow-y-auto px-4 py-4 relative" @touchstart.passive="onStart" @touchmove.passive="onMove" @touchend="onEnd" data-testid="tokens-scroll">
      <div class="flex items-center justify-center overflow-hidden transition-[height] duration-150" :style="{ height: pull + 'px' }">
        <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-voltGlow" :class="pulling ? 'animate-spin' : ''" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" /></svg>
      </div>

      <div class="flex items-center justify-between mb-3">
        <div>
          <h1 class="text-base font-semibold text-bone tracking-wide">{{ t("tok.title") }}</h1>
          <p class="text-[10px] uppercase tracking-[0.18em] text-fiatDim">{{ settings.networkName }} · {{ rows.length }} {{ t("tok.count") }}</p>
        </div>
        <button @click="router.push('/tokens/create')" class="forge-btn-primary h-9 px-4 text-[10px] uppercase tracking-[0.18em] whitespace-nowrap shrink-0 disabled:opacity-40" :disabled="!tokens.supported" data-testid="create-token-btn">
          + {{ t("tok.create") }}
        </button>
      </div>

      <div v-if="tokens.config && !tokens.supported" class="forge-card p-3 mb-3 border-rust/50 text-xs text-rust leading-relaxed" data-testid="tokens-unsupported">
        {{ t("tok.unsupported") }}
        <button @click="router.push('/nodes')" class="underline ml-1" data-testid="tokens-goto-nodes">{{ t("nodes.title") }}</button>
      </div>

      <div v-if="pending.length" class="flex flex-col gap-1.5 mb-3" data-testid="tokens-pending">
        <div v-for="p in pending" :key="p.txId" class="forge-card p-2.5 flex items-center justify-between text-xs border-dashed">
          <span class="text-fiat">{{ t(`tok.op${p.kind[0].toUpperCase()}${p.kind.slice(1)}`) }}<span v-if="p.ticker" class="mono ml-1">{{ p.ticker }}</span></span>
          <span class="text-[10px] uppercase tracking-[0.15em] text-cyan-voltGlow animate-pulse">{{ t("tok.inQueue") }}</span>
        </div>
      </div>

      <section v-if="freeTickers.length" class="mb-4" data-testid="my-tickers">
        <span class="forge-label">{{ t("tok.myTickers") }}</span>
        <div class="flex flex-col gap-1.5">
          <div v-for="tk in freeTickers" :key="tk.id" class="forge-card p-2.5 flex items-center justify-between gap-2" :data-testid="`ticker-${tk.name}`">
            <div class="min-w-0">
              <span class="mono text-sm text-bone font-semibold">{{ tk.name }}</span>
              <p class="text-[10px] text-fiatDim truncate">{{ t("tok.tickerRegistered") }}</p>
            </div>
            <button @click="router.push({ path: '/tokens/create', query: { ticker: tk.id } })" class="forge-btn-primary h-8 px-3 text-[10px] uppercase tracking-[0.15em]" :data-testid="`issue-${tk.name}`">{{ t("tok.issue") }}</button>
          </div>
        </div>
      </section>

      <section>
        <span v-if="rows.length" class="forge-label">{{ t("tok.mine") }}</span>
        <div class="flex flex-col gap-1.5" data-testid="token-list">
          <button
            v-for="r in rows"
            :key="r.id"
            @click="router.push(`/tokens/${r.id}`)"
            class="forge-card p-2.5 flex items-center gap-3 text-left hover:border-gunmetal-300 transition-colors"
            :data-testid="`token-row-${r.symbol}`"
          >
            <TokenLogo :src="r.logo" :symbol="r.symbol" :size="40" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="mono text-sm text-bone font-semibold">{{ r.symbol }}</span>
                <span v-if="r.owner" class="px-1.5 rounded bg-indigo-forge/15 border border-indigo-forge/40 text-indigo-forgeBright text-[9px] uppercase tracking-[0.15em]" data-testid="owner-badge">{{ t("tok.owner") }}</span>
              </div>
              <p class="text-[11px] text-fiatDim truncate">{{ r.name }}</p>
            </div>
            <span class="mono text-sm text-bone shrink-0" :data-testid="`token-balance-${r.symbol}`">{{ tokenAmount(r.balance, r.decimals) }}</span>
          </button>
        </div>
        <div v-if="!rows.length && !tokens.loading && tokens.supported" class="forge-card p-5 text-center mt-2" data-testid="tokens-empty">
          <p class="text-sm text-bone mb-1">{{ t("tok.emptyTitle") }}</p>
          <p class="text-[11px] text-fiatDim leading-relaxed mb-4">{{ t("tok.emptyBody") }}</p>
          <button @click="router.push('/tokens/create')" class="forge-btn-primary h-9 px-5 text-[10px] uppercase tracking-[0.18em]" data-testid="tokens-empty-create">{{ t("tok.create") }}</button>
        </div>
        <p v-if="tokens.loading && !rows.length" class="text-[11px] text-fiatDim text-center py-6 animate-pulse" data-testid="tokens-loading">{{ t("tok.loading") }}</p>
        <div class="flex items-center justify-center gap-4 pt-2" data-testid="tokens-explorer-links">
          <a :href="explorerUrl(settings.activeNetwork.explorer, 'tokens')" target="_blank" rel="noopener" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" data-testid="tokens-explorer-link">{{ t("tok.allTokens") }} ↗</a>
          <a :href="explorerUrl(settings.activeNetwork.explorer, 'market')" target="_blank" rel="noopener" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" data-testid="tokens-market-link">{{ t("tok.market") }} ↗</a>
        </div>
      </section>
    </div>
    <BottomDock />
  </div>
</template>
