<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { copyToClipboard, shortAddress } from "@/lib/utils";
import LanguageDropdown from "@/components/LanguageDropdown.vue";
import { useT } from "@/locales";

const router = useRouter();
const auth = useAuthStore();
const settings = useSettingsStore();
const t = useT();

const networkLabel = computed(() => {
  const base = settings.isMainnet
    ? `${t.value("net.mainnet")} · ${settings.token}`
    : `${settings.networkName.toUpperCase()} · ${settings.token}`;
  if (settings.activeNodeStatus) {
    const h = settings.activeNodeStatus?.now ?? settings.activeNodeStatus?.blockchain?.block?.height;
    return h ? `${base} · #${h.toLocaleString()}` : base;
  }
  return base;
});

const networkOk = computed(() => !!settings.activeNodeStatus);

function lockNow() {
  auth.lock();
  router.replace("/lock");
}
</script>

<template>
  <header
    class="flex items-center justify-between px-3 py-2.5 border-b border-gunmetal-400 bg-gunmetal-800 relative"
  >
    <!-- Network status -->
    <div class="flex items-center gap-2 min-w-0" data-testid="network-status">
      <span
        class="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        :class="networkOk ? 'bg-indigo-forgeBright animate-pulse-glow' : 'bg-rust animate-pulse-glow'"
      />
      <span class="text-[10px] uppercase tracking-[0.18em] text-fiat font-semibold truncate">
        {{ networkLabel }}
      </span>
    </div>

    <!-- Right cluster: [address] -> [⚙ settings] -> [🔒 lock] -->
    <div class="flex items-center gap-1.5 flex-shrink-0">
      <button
        v-if="auth.address"
        @click="copyToClipboard(auth.address, 'Address copied')"
        class="text-[11px] mono px-2 py-1 rounded border border-gunmetal-400 text-fiat hover:border-cyan-volt/60 hover:text-cyan-voltGlow transition-colors"
        data-testid="copy-address-top"
        :title="auth.address"
      >
        {{ shortAddress(auth.address, 4, 4) }}
      </button>

      <!-- NEW: Language dropdown -->
      <LanguageDropdown />

      <!-- Manage connected dApps (Key icon) -->
      <!--
        Positioned between the language dropdown and settings cog per the
        product spec. Routes to /connected-sites — a dedicated full-screen
        management view backed by chrome.storage.local.authorizedOrigins.
        Amber/rust visual treatment to match the "ACCESS" semantics of the
        feature (granting and revoking origin trust).
      -->
      <button
        @click="router.push('/connected-sites')"
        class="w-8 h-8 rounded border border-gunmetal-400 text-fiat hover:border-rust/60 hover:text-rust grid place-items-center transition-colors"
        data-testid="connected-sites-top-button"
        :title="t('top.apps')"
        :aria-label="t('top.apps')"
      >
        <!-- Key icon — strokes match the gear/lock siblings for visual parity -->
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="8" cy="15" r="4" />
          <path d="M10.85 12.15 19 4" />
          <path d="m18 5 2 2" />
          <path d="m15 8 2 2" />
        </svg>
      </button>

      <!-- NEW: Settings cog -->
      <button
        @click="router.push('/settings')"
        class="w-8 h-8 rounded border border-gunmetal-400 text-fiat hover:border-indigo-forge/60 hover:text-indigo-forgeBright grid place-items-center transition-colors"
        data-testid="settings-top-button"
        :title="t('top.settings')"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3" />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
          />
        </svg>
      </button>

      <button
        @click="lockNow"
        class="w-8 h-8 rounded border border-gunmetal-400 text-fiat hover:border-rust/60 hover:text-rust grid place-items-center transition-colors"
        data-testid="lock-button"
        :title="t('top.lock')"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="11" width="16" height="9" rx="1.5" />
          <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
      </button>
    </div>
  </header>
</template>
