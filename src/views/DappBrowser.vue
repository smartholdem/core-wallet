<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import { useSettingsStore } from "@/stores/settings";
import { dappBrowser } from "@/lib/dappBrowser";
import { pushToast } from "@/lib/utils";
import { useT } from "@/locales";

const router = useRouter();
const settings = useSettingsStore();
const t = useT();

const FEATURED = [
  { name: "SmartHoldem Poker", url: "https://poker.smartholdem.io" },
  { name: "SmartHoldem Explorer", url: "https://explorer.smartholdem.io" },
  { name: "SmartHoldem.io", url: "https://smartholdem.io" },
];

const url = ref("");
const opening = ref(false);
const isOpen = computed(() => dappBrowser.isOpen);

function normalize(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = "https://" + v;
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

async function open(raw: string) {
  const target = normalize(raw);
  if (!target) {
    pushToast(t.value("dapps.badUrl"), "error");
    return;
  }
  opening.value = true;
  try {
    await dappBrowser.open(target);
    settings.recentDapps = [target, ...settings.recentDapps.filter((u) => u !== target)].slice(0, 8);
    url.value = "";
  } catch (e: any) {
    pushToast(e?.message || t.value("dapps.openFailed"), "error");
  } finally {
    opening.value = false;
  }
}

function host(u: string) {
  try {
    return new URL(u).host;
  } catch {
    return u;
  }
}

function forget(u: string) {
  settings.recentDapps = settings.recentDapps.filter((x) => x !== u);
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="dapps-view">
    <TopBar />
    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <div>
        <p class="text-[10px] uppercase tracking-[0.3em] text-fiatDim">{{ t("dapps.kicker") }}</p>
        <h1 class="text-lg font-semibold text-bone mt-1">{{ t("dapps.title") }}</h1>
        <p class="text-xs text-fiat mt-1 leading-relaxed">{{ t("dapps.intro") }}</p>
      </div>

      <button
        v-if="isOpen"
        @click="dappBrowser.show()"
        class="forge-card w-full p-3 text-left border-cyan-volt/60 flex items-center justify-between"
        data-testid="dapps-resume-btn"
      >
        <span class="text-sm text-bone">{{ t("dapps.resume") }} · {{ host(dappBrowser.currentUrl) }}</span>
        <span class="text-cyan-voltGlow text-xs">→</span>
      </button>

      <form @submit.prevent="open(url)" class="flex gap-2">
        <input
          v-model="url"
          type="url"
          inputmode="url"
          autocapitalize="off"
          autocomplete="off"
          spellcheck="false"
          class="forge-input flex-1"
          :placeholder="t('dapps.placeholder')"
          data-testid="dapps-url-input"
        />
        <button
          type="submit"
          :disabled="opening || !url.trim()"
          class="px-4 rounded-md bg-[#E25822] text-bone text-sm font-semibold disabled:opacity-40"
          data-testid="dapps-open-btn"
        >
          {{ t("dapps.open") }}
        </button>
      </form>

      <section>
        <span class="forge-label">{{ t("dapps.featured") }}</span>
        <div class="flex flex-col gap-2">
          <button
            v-for="d in FEATURED"
            :key="d.url"
            @click="open(d.url)"
            class="forge-card p-3 text-left flex items-center justify-between hover:border-cyan-volt/60 transition-colors"
            :data-testid="`dapps-featured-${host(d.url)}`"
          >
            <div>
              <p class="text-sm text-bone">{{ d.name }}</p>
              <p class="text-[11px] text-fiatDim font-mono">{{ host(d.url) }}</p>
            </div>
            <span class="text-fiatDim">›</span>
          </button>
        </div>
      </section>

      <section v-if="settings.recentDapps.length">
        <span class="forge-label">{{ t("dapps.recent") }}</span>
        <div class="flex flex-col gap-2">
          <div
            v-for="u in settings.recentDapps"
            :key="u"
            class="forge-card p-3 flex items-center justify-between gap-2"
            :data-testid="`dapps-recent-${host(u)}`"
          >
            <button @click="open(u)" class="text-left flex-1 min-w-0">
              <p class="text-sm text-bone truncate font-mono">{{ host(u) }}</p>
              <p class="text-[10px] text-fiatDim truncate">{{ u }}</p>
            </button>
            <button @click="forget(u)" class="text-fiatDim hover:text-rust text-xs px-1" :aria-label="t('dapps.forget')">✕</button>
          </div>
        </div>
      </section>

      <p class="text-[10px] text-fiatDim leading-relaxed">{{ t("dapps.note") }}</p>
    </div>
    <BottomDock />
  </div>
</template>
