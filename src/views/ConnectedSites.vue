<script setup lang="ts">
/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
/**
 * ConnectedSites — dedicated full-screen view for managing the dApp origin
 * whitelist persisted at `chrome.storage.local.authorizedOrigins`.
 *
 * Entry points:
 *   - TopBar key icon (`/connected-sites`)
 *   - dApp first-call → AuthorizeConnect modal "Trust this site" populates
 *     this list; the user reviews & revokes here.
 *
 * Design note: this view duplicates the read/disconnect logic of the
 * `Settings.vue → Access · Connected Sites` card (now removed) so the user
 * has a single, focused surface for trust review instead of buried in
 * Core / Settings.
 */
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import { pushToast } from "@/lib/utils";
import { getAuthorizedOrigins, removeAuthorizedOrigin } from "@/lib/origins";
import { useT } from "@/locales";

const router = useRouter();
const t = useT();

const connectedOrigins = ref<string[]>([]);
const loadingOrigins = ref(false);

function loadConnectedOrigins() {
  loadingOrigins.value = true;
  getAuthorizedOrigins().then((list) => {
    connectedOrigins.value = list;
    loadingOrigins.value = false;
  });
}

function disconnectOrigin(origin: string) {
  removeAuthorizedOrigin(origin).then(() => {
    connectedOrigins.value = connectedOrigins.value.filter((o) => o !== origin);
    pushToast(`Disconnected ${prettyHost(origin)}`, "success");
  });
}

function prettyHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

onMounted(loadConnectedOrigins);
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="connected-sites-view">
    <TopBar />

    <header
      class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800"
    >
      <button
        @click="router.push('/dashboard')"
        class="w-8 h-8 -ml-1 grid place-items-center rounded-md text-fiat hover:text-bone hover:bg-gunmetal-700/60 transition-colors"
        data-testid="connected-sites-back-btn"
        :aria-label="t('top.back')"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">
        {{ t('apps.title') }}
      </span>
      <button
        v-if="connectedOrigins.length > 0"
        @click="loadConnectedOrigins"
        class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt"
        data-testid="connected-sites-refresh-btn"
      >
        {{ loadingOrigins ? t('apps.loading') : t('apps.refresh') }}
      </button>
      <span v-else class="w-8" />
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4" data-testid="connected-sites-card">
      <p class="text-[11px] text-fiatDim leading-relaxed">
        {{ t('apps.subtitle') }}
      </p>

      <div
        v-if="loadingOrigins"
        class="forge-card p-3 text-center text-[11px] text-fiatDim"
      >
        {{ t('apps.loading') }}
      </div>
      <div
        v-else-if="connectedOrigins.length === 0"
        class="forge-card p-5 text-center"
        data-testid="connected-sites-empty"
      >
        <div class="flex flex-col items-center gap-2">
          <svg viewBox="0 0 24 24" class="w-9 h-9 text-fiatDim/60" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="9" cy="9" r="5" />
            <path d="m13 13 6.5 6.5" />
            <path d="M19 11.5 21 9.5 18.5 7" />
          </svg>
          <p class="text-[12px] text-fiatDim">
            {{ t('apps.empty') }}
          </p>
        </div>
      </div>

      <div v-else class="flex flex-col gap-1.5" data-testid="connected-sites-list">
        <div
          v-for="origin in connectedOrigins"
          :key="origin"
          class="forge-card flex items-center justify-between gap-3 p-3 border-gunmetal-400"
          :data-testid="`connected-site-row-${prettyHost(origin)}`"
        >
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              class="inline-block w-1.5 h-1.5 rounded-full bg-indigo-forgeBright flex-shrink-0 animate-pulse-glow"
            />
            <div class="min-w-0">
              <p
                class="mono text-[12px] text-bone truncate"
                :title="origin"
              >
                {{ prettyHost(origin) }}
              </p>
              <p class="text-[10px] text-fiatDim uppercase tracking-[0.18em] mt-0.5">
                {{ t('apps.trusted') }}
              </p>
            </div>
          </div>
          <button
            @click="disconnectOrigin(origin)"
            class="flex-shrink-0 px-3 h-8 rounded border text-[10px] uppercase tracking-[0.18em] font-semibold transition-all border-rust/60 text-rust hover:bg-rust/15 hover:border-rust"
            :data-testid="`connected-site-disconnect-${prettyHost(origin)}`"
          >
            {{ t('apps.disconnect') }}
          </button>
        </div>
      </div>
    </div>

    <BottomDock />
  </div>
</template>
