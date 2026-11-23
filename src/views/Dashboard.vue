<script setup lang="ts">
import { onMounted, computed, watch, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useExchangeStore } from "@/stores/exchange";
import { useSettingsStore } from "@/stores/settings";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import TxRow from "@/components/TxRow.vue";
import AccountSwitcher from "@/components/AccountSwitcher.vue";
import { formatSth, formatUsdt } from "@/lib/utils";
import { useT } from "@/locales";
import { haptic } from "@/lib/ui";

const router = useRouter();
const auth = useAuthStore();
const wallet = useWalletStore();
const exchange = useExchangeStore();
const settings = useSettingsStore();
const t = useT();

// Pull-to-refresh (touch): drag the scroll container down from the top.
const pull = ref(0);
const pulling = ref(false);
let pullY0 = 0;
let pullArmed = false;
function onPullStart(e: TouchEvent) {
  const el = e.currentTarget as HTMLElement;
  pullArmed = el.scrollTop <= 0;
  pullY0 = e.touches[0].clientY;
}
function onPullMove(e: TouchEvent) {
  if (!pullArmed || pulling.value) return;
  pull.value = Math.min(96, Math.max(0, (e.touches[0].clientY - pullY0) * 0.6));
}
async function onPullEnd() {
  if (!pullArmed) return;
  pullArmed = false;
  if (pull.value >= 56 && !pulling.value) {
    pulling.value = true;
    pull.value = 48;
    haptic();
    await refreshActive();
    pulling.value = false;
  }
  pull.value = 0;
}

async function refreshActive() {
  if (!auth.address) return;
  await Promise.allSettled([
    wallet.fetchBalance(auth.address),
    wallet.fetchTransactions(auth.address, 8),
  ]);
}

onMounted(async () => {
  await Promise.allSettled([refreshActive(), exchange.refreshDashboardPrice()]);
  // background: load other accounts' balances for the switcher
  wallet.fetchAllBalances();
});

// Re-fetch when the active account changes via the switcher.
watch(() => auth.activeIndex, refreshActive);

const balance = computed(() => wallet.activeBalance);
const fiatValue = computed(() => balance.value * (exchange.sthUsdtPrice || 0));
const recentTxs = computed(() => wallet.transactions.slice(0, 3));
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="dashboard-view">
    <TopBar />

    <div
      class="flex-1 overflow-y-auto px-4 py-4 relative"
      @touchstart.passive="onPullStart"
      @touchmove.passive="onPullMove"
      @touchend="onPullEnd"
      data-testid="dashboard-scroll"
    >
      <div
        class="flex items-center justify-center overflow-hidden transition-[height] duration-150"
        :style="{ height: pull + 'px' }"
        data-testid="pull-indicator"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4 text-cyan-voltGlow" :class="pulling ? 'animate-spin' : ''" :style="!pulling ? { transform: `rotate(${pull * 4}deg)` } : undefined" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-3-6.7M21 3v6h-6" />
        </svg>
      </div>
      <!-- Account switcher -->
      <AccountSwitcher class="mb-3" />

      <!-- Asset showcase -->
      <section
        class="forge-card p-4 relative overflow-hidden"
        data-testid="balance-card"
      >
        <!-- diagonal hatch accent -->
        <div
          class="absolute inset-0 opacity-[0.06] pointer-events-none"
          :style="{
            backgroundImage:
              'repeating-linear-gradient(45deg, #fff 0 1px, transparent 1px 8px)',
          }"
        />

        <div class="relative flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-[0.24em] text-fiatDim font-semibold">
            {{ t('dash.totalBalance') }}
          </span>
          <button
            @click="refreshActive()"
            class="text-[10px] mono text-fiat hover:text-cyan-voltGlow transition-colors"
            data-testid="refresh-balance-btn"
          >
            {{ wallet.loadingBalance ? t('dash.syncing') : t('dash.refresh') }}
          </button>
        </div>

        <div class="relative mt-3 flex items-baseline gap-2">
          <span
            class="mono text-[34px] leading-none font-semibold text-bone tracking-tight"
            data-testid="balance-amount"
          >
            {{ formatSth(balance, 4) }}
          </span>
          <span class="text-sm mono text-fiat" data-testid="balance-token">{{ settings.token }}</span>
        </div>

        <!-- Fiat row — high-contrast bright text (mainnet only: exchange quotes STH) -->
        <div v-if="settings.isMainnet" class="relative mt-3 flex items-center gap-2 text-xs">
          <span
            class="mono text-base font-semibold text-fiat"
            data-testid="fiat-value"
          >
            ≈ ${{ formatUsdt(fiatValue) }}
          </span>
          <span class="text-fiat uppercase tracking-[0.18em] text-[10px] font-semibold">
            USDT
          </span>
          <span
            v-if="exchange.sthUsdtPrice"
            class="ml-auto text-[11px] text-fiat mono"
            data-testid="exchange-rate"
          >
            1 STH = ${{ exchange.sthUsdtPrice.toFixed(4) }}
          </span>
        </div>
      </section>

      <!-- Quick Action Dock -->
      <section class="grid gap-2 mt-4" :class="settings.isMainnet ? 'grid-cols-4' : 'grid-cols-3'" data-testid="quick-actions">
        <button
          @click="router.push('/send')"
          class="forge-btn-primary h-16 flex-col gap-1 px-1"
          data-testid="action-send"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          <span class="text-[10px] uppercase tracking-[0.15em]">{{ t('action.send') }}</span>
        </button>
        <button
          @click="router.push('/receive')"
          class="forge-btn-cyan h-16 flex-col gap-1 px-1"
          data-testid="action-receive"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
          <span class="text-[10px] uppercase tracking-[0.15em]">{{ t('action.receive') }}</span>
        </button>
        <button
          v-if="settings.isMainnet"
          @click="router.push('/swap')"
          class="forge-btn-primary h-16 flex-col gap-1 px-1"
          data-testid="action-swap"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 7h13M16 3l4 4-4 4" />
            <path d="M17 17H4M8 21l-4-4 4-4" />
          </svg>
          <span class="text-[10px] uppercase tracking-[0.15em]">Swap</span>
        </button>
        <button
          @click="router.push('/history')"
          class="forge-btn h-16 flex-col gap-1 px-1"
          data-testid="action-history"
        >
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span class="text-[10px] uppercase tracking-[0.15em]">{{ t('action.history') }}</span>
        </button>
      </section>

      <!-- Activity feed -->
      <section class="mt-5" data-testid="activity-feed">
        <div class="flex items-center justify-between mb-2.5">
          <span class="text-[10px] uppercase tracking-[0.24em] text-fiatDim font-semibold">
            {{ t('dash.recent') }}
          </span>
          <button
            @click="router.push('/history')"
            class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt"
            data-testid="view-all-tx"
          >
            {{ t('dash.viewAll') }}
          </button>
        </div>

        <div
          v-if="wallet.loadingTxs && recentTxs.length === 0"
          class="forge-card p-4 text-center text-xs text-fiatDim"
        >
          {{ t('dash.fetching') }}
        </div>
        <div
          v-else-if="recentTxs.length === 0"
          class="forge-card p-4 text-center text-xs text-fiatDim"
          data-testid="no-tx-empty"
        >
          {{ t('dash.empty') }}
        </div>
        <div v-else class="flex flex-col gap-2">
          <TxRow v-for="t in recentTxs" :key="t.id" :tx="t" />
        </div>
      </section>
    </div>

    <BottomDock />
  </div>
</template>
