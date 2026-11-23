<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import TokenLogo from "@/components/token/TokenLogo.vue";
import ActionSheet from "@/components/token/ActionSheet.vue";
import TokenSendSheet from "@/components/token/TokenSendSheet.vue";
import TokenSupplySheet from "@/components/token/TokenSupplySheet.vue";
import TokenMetaForm from "@/components/token/TokenMetaForm.vue";
import TokenTxList from "@/components/token/TokenTxList.vue";
import TokenMultiPaySheet from "@/components/token/TokenMultiPaySheet.vue";
import TokenMarketSheet from "@/components/token/TokenMarketSheet.vue";
import { useSettingsStore } from "@/stores/settings";
import { explorerUrl } from "@/lib/network";
import { useAuthStore } from "@/stores/auth";
import { useTokensStore } from "@/stores/tokens";
import { tokenAmount, tokenName, supplyPct } from "@/lib/tokenUi";
import { pushToast, shortAddress } from "@/lib/utils";
import { useT } from "@/locales";

const route = useRoute();
const router = useRouter();
const t = useT();
const auth = useAuthStore();
const tokens = useTokensStore();
const settings = useSettingsStore();
const explorer = (kind: "token" | "wallet", key: string) => explorerUrl(settings.activeNetwork.explorer, kind, key);

const id = computed(() => String(route.params.id));
const token = computed(() => tokens.details[id.value]);
const balance = computed(() => tokens.forAddress(auth.address).find((w) => w.id === id.value)?.balance ?? "0");
const isOwner = computed(() => token.value?.owner === auth.address);
const pending = computed(() => tokens.pendingFor(auth.address).filter((p) => p.id === id.value));

const txs = ref<any[]>([]);
const showAll = ref(false);
const holders = ref<{ address: string; balance: string }[] | null>(null);
const sheet = ref<null | "send" | "multi" | "market" | "burn" | "mint" | "meta" | "holders">(null);
const notFound = ref(false);

async function load() {
  notFound.value = false;
  const [d] = await Promise.all([tokens.fetchToken(id.value), tokens.refresh(auth.address)]);
  if (!d) { notFound.value = true; return; }
  if (d.id !== id.value) { router.replace(`/tokens/${d.id}`); return; } // symbol key → canonical id route
  txs.value = await tokens.fetchTokenTxs(auth.address, id.value, 50).catch(() => []);
}
async function openHolders() {
  sheet.value = "holders";
  holders.value = null;
  holders.value = await tokens.fetchHolders(id.value).catch(() => []);
}
function onDone() {
  sheet.value = null;
  setTimeout(load, 9500);
}
async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); pushToast(t.value("tok.copied"), "success"); } catch {}
}
onMounted(load);
watch(id, load);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="token-detail-view">
    <TopBar />
    <header class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800">
      <button @click="router.back()" class="w-8 h-8 -ml-1 grid place-items-center rounded-md text-fiat hover:text-bone hover:bg-gunmetal-700/60" data-testid="token-back-btn" :aria-label="t('top.back')">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">{{ t("tok.token") }}</span>
      <button @click="load" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" data-testid="token-refresh-btn">↻</button>
    </header>

    <div v-if="notFound" class="flex-1 grid place-items-center text-xs text-fiatDim" data-testid="token-not-found">{{ t("tok.notFound") }}</div>
    <div v-else-if="!token" class="flex-1 grid place-items-center text-xs text-fiatDim animate-pulse">{{ t("tok.loading") }}</div>

    <div v-else class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <!-- Head -->
      <section class="flex items-center gap-4">
        <TokenLogo :src="tokens.logoUrl(token)" :symbol="token.symbol" :size="64" />
        <div class="min-w-0 flex-1">
          <h1 class="text-base font-semibold text-bone truncate" data-testid="token-name">{{ tokenName(token) }}</h1>
          <div class="flex items-center gap-2">
            <span class="mono text-xs text-fiat">{{ token.symbol }}</span>
            <span v-if="isOwner" class="px-1.5 rounded bg-indigo-forge/15 border border-indigo-forge/40 text-indigo-forgeBright text-[9px] uppercase tracking-[0.15em]" data-testid="token-owner-badge">{{ t("tok.owner") }}</span>
          </div>
          <p class="mono text-xl text-bone mt-1" data-testid="token-balance">{{ tokenAmount(balance, token.decimals) }} <span class="text-xs text-fiat">{{ token.symbol }}</span></p>
        </div>
      </section>

      <!-- Holder actions -->
      <section class="grid grid-cols-3 gap-2">
        <button @click="sheet = 'send'" class="forge-btn-primary h-11 text-[10px] uppercase tracking-[0.18em] disabled:opacity-40 disabled:cursor-not-allowed" :disabled="BigInt(balance) === 0n" data-testid="token-action-send">{{ t("tok.send") }}</button>
        <button @click="sheet = 'multi'" class="forge-btn h-11 text-[10px] uppercase tracking-[0.15em] whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed" :disabled="BigInt(balance) === 0n" data-testid="token-action-multipay">{{ t("tok.multiPay") }}</button>
        <button @click="sheet = 'market'" class="forge-btn h-11 text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow border-cyan-volt/40" data-testid="token-action-market">{{ t("tok.market") }}</button>
        <button v-if="token.burnable" @click="sheet = 'burn'" class="col-span-3 forge-btn h-10 text-[10px] uppercase tracking-[0.18em] text-rust border-rust/50" :disabled="BigInt(balance) === 0n" data-testid="token-action-burn">{{ t("tok.burn") }}</button>
      </section>

      <!-- Owner actions -->
      <section v-if="isOwner" class="forge-card p-3 border-indigo-forge/40" data-testid="owner-actions">
        <span class="forge-label">{{ t("tok.ownerActions") }}</span>
        <div class="grid grid-cols-3 gap-2">
          <button @click="sheet = 'mint'" class="forge-btn h-10 text-[10px] uppercase tracking-[0.15em]" :disabled="!token.mintable || BigInt(token.supply) >= BigInt(token.supplyCap)" data-testid="token-action-mint">{{ t("tok.mint") }}</button>
          <button @click="sheet = 'meta'" class="forge-btn h-10 text-[10px] uppercase tracking-[0.15em]" data-testid="token-action-meta">{{ t("tok.showcase") }}</button>
          <button @click="openHolders" class="forge-btn h-10 text-[10px] uppercase tracking-[0.15em]" data-testid="token-action-holders">{{ t("tok.holders") }}</button>
        </div>
      </section>

      <!-- Meta -->
      <section class="forge-card p-3 flex flex-col gap-2 text-xs" data-testid="token-meta">
        <p v-if="token.meta?.description" class="text-fiat leading-relaxed" data-testid="token-description">{{ token.meta.description }}</p>
        <a v-if="token.meta?.website" :href="token.meta.website" target="_blank" rel="noopener" class="text-cyan-voltGlow underline break-all" data-testid="token-website">{{ token.meta.website }}</a>
        <div class="flex items-center justify-between"><span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.decimals") }}</span><span class="mono text-bone">{{ token.decimals }}</span></div>
        <div>
          <div class="flex items-center justify-between mb-1">
            <span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.supply") }}</span>
            <span class="mono text-bone" data-testid="token-supply">{{ tokenAmount(token.supply, token.decimals) }} / {{ tokenAmount(token.supplyCap, token.decimals) }}</span>
          </div>
          <div class="h-1.5 rounded bg-gunmetal-700 overflow-hidden"><div class="h-full bg-indigo-forge" :style="{ width: supplyPct(token) + '%' }" /></div>
        </div>
        <div class="flex gap-1.5 flex-wrap">
          <span class="px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-[0.15em]" :class="token.mintable ? 'border-indigo-forge/40 text-indigo-forgeBright' : 'border-gunmetal-400 text-fiatDim line-through'">{{ t("tok.mintable") }}</span>
          <span class="px-1.5 py-0.5 rounded border text-[9px] uppercase tracking-[0.15em]" :class="token.burnable ? 'border-indigo-forge/40 text-indigo-forgeBright' : 'border-gunmetal-400 text-fiatDim line-through'">{{ t("tok.burnable") }}</span>
        </div>
        <div class="flex items-center justify-between"><span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.ownerLabel") }}</span><span class="flex items-center gap-2"><button @click="copy(token.owner)" class="mono text-bone hover:text-cyan-voltGlow" data-testid="token-owner-addr">{{ shortAddress(token.owner, 8, 8) }}</button><a :href="explorer('wallet', token.owner)" target="_blank" rel="noopener" class="text-cyan-voltGlow" data-testid="token-owner-explorer-link">↗</a></span></div>
        <div class="flex items-center justify-between"><span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.initHeight") }}</span><span class="mono text-bone">#{{ token.initHeight.toLocaleString() }}</span></div>
        <div class="flex items-center justify-between gap-2"><span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">ID</span><button @click="copy(token.id)" class="mono text-[10px] text-fiat hover:text-cyan-voltGlow truncate" data-testid="token-id-copy">{{ token.id }}</button></div>
        <a :href="explorer('token', token.id)" target="_blank" rel="noopener" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt text-center pt-1" data-testid="token-explorer-link">{{ t("tok.explorer") }} ↗</a>
      </section>

      <!-- Ops -->
      <section>
        <div class="flex items-center justify-between mb-1.5">
          <span class="forge-label !mb-0">{{ t("tok.recentOps") }}</span>
          <button v-if="txs.length > 5" @click="showAll = !showAll" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow" data-testid="token-ops-toggle">{{ showAll ? t("tok.less") : t("tok.allOps") }}</button>
        </div>
        <TokenTxList :txs="showAll ? txs : txs.slice(0, 5)" :decimals="token.decimals" :symbol="token.symbol" :pending="pending" />
      </section>
    </div>

    <BottomDock />

    <template v-if="token">
      <TokenSendSheet :open="sheet === 'send'" :token="token" :balance="balance" @close="sheet = null" @done="onDone" />
      <TokenMultiPaySheet :open="sheet === 'multi'" :token="token" :balance="balance" @close="sheet = null" @done="onDone" />
      <TokenMarketSheet :open="sheet === 'market'" :token="token" :balance="balance" @close="sheet = null" @done="onDone" />
      <TokenSupplySheet v-if="sheet === 'burn' || sheet === 'mint'" :open="true" :mode="sheet" :token="token" :balance="balance" @close="sheet = null" @done="onDone" />
      <ActionSheet :open="sheet === 'meta'" :title="t('tok.showcase')" testid="token-meta-sheet" @close="sheet = null">
        <TokenMetaForm :token-id="token.id" :symbol="token.symbol" :current="token" @done="onDone" />
      </ActionSheet>
      <ActionSheet :open="sheet === 'holders'" :title="`${t('tok.holders')} · ${token.symbol}`" testid="token-holders-sheet" @close="sheet = null">
        <p v-if="!holders" class="text-[11px] text-fiatDim animate-pulse">{{ t("tok.loading") }}</p>
        <div v-else class="flex flex-col gap-1" data-testid="holders-list">
          <a v-for="h in holders" :key="h.address" :href="explorer('wallet', h.address)" target="_blank" rel="noopener" class="flex items-center justify-between text-xs py-1 border-b border-gunmetal-400/60 last:border-0 hover:bg-gunmetal-700/40">
            <span class="mono text-fiat">{{ shortAddress(h.address, 8, 8) }}<span v-if="h.address === auth.address" class="ml-1 text-cyan-voltGlow">·</span></span>
            <span class="mono text-bone">{{ tokenAmount(h.balance, token.decimals) }}</span>
          </a>
          <p v-if="!holders.length" class="text-[11px] text-fiatDim text-center py-2">{{ t("tok.noHolders") }}</p>
        </div>
      </ActionSheet>
    </template>
  </div>
</template>
