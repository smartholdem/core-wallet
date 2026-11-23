<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { explorerUrl } from "@/lib/network";
import { copyToClipboard } from "@/lib/utils";
import QrDisplay from "@/components/QrDisplay.vue";
import BottomDock from "@/components/BottomDock.vue";

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="receive-view">
    <header
      class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800"
    >
      <button
        @click="router.back()"
        class="text-[11px] uppercase tracking-[0.18em] text-gunmetal-300 hover:text-bone"
        data-testid="back-btn"
      >
        ← Back
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-bone font-semibold">
        STH · Receive
      </span>
      <span class="w-12" />
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center">
      <p class="text-xs text-cyan-voltGlow leading-relaxed text-center max-w-[280px] mb-4">
        Scan or copy your SmartHoldem address. Funds arrive once the network confirms.
      </p>

      <QrDisplay :value="auth.address" :size="224" />

      <div class="mt-5 w-full">
        <span class="forge-label">Your STH Address</span>
        <button
          @click="copyToClipboard(auth.address, 'Address Secured')"
          class="forge-card w-full p-3 text-left transition-colors hover:border-cyan-volt/60"
          data-testid="copy-address-card"
        >
          <p class="mono text-xs text-bone break-all leading-relaxed">{{ auth.address }}</p>
          <div class="flex items-center gap-1.5 mt-2">
            <svg viewBox="0 0 24 24" class="w-3 h-3 text-cyan-voltGlow" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="11" height="11" rx="1.5" />
              <path d="M5 15V5a1 1 0 0 1 1-1h10" />
            </svg>
            <span class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow">
              Tap to copy
            </span>
          </div>
        </button>
        <a :href="explorerUrl(settings.activeNetwork.explorer, 'wallet', auth.address)" target="_blank" rel="noopener" class="block mt-3 text-center text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" data-testid="receive-explorer-link">Explorer ↗</a>
      </div>

      <!--
      <div class="mt-4 w-full forge-card p-3 text-[11px] text-gunmetal-300 leading-relaxed">
        <span class="text-cyan-voltGlow uppercase tracking-[0.18em] text-[10px] font-semibold">
          MEMO
        </span>
        <span class="block mt-1">
          When receiving from exchanges, include any required MEMO in the sender's vendor field.
        </span>
      </div>
      -->
    </div>

    <BottomDock />
  </div>
</template>
