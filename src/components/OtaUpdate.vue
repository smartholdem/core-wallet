<script setup lang="ts">
import { computed } from "vue";
import { ota, checkForUpdate, downloadUpdate, applyReadyUpdate } from "@/lib/ota";
import { useT } from "@/locales";

const t = useT();

const busy = computed(() => ota.status === "checking" || ota.status === "downloading");
const badge = computed(() => {
  switch (ota.status) {
    case "available":
    case "native-required":
      return { text: t.value("ota.badge.new"), cls: "border-[#E25822]/70 text-[#F0A080]" };
    case "ready":
      return { text: t.value("ota.badge.ready"), cls: "border-cyan-volt/60 text-cyan-voltGlow" };
    case "downloading":
    case "checking":
      return { text: "…", cls: "border-gunmetal-400 text-fiatDim" };
    case "error":
      return { text: t.value("ota.badge.error"), cls: "border-rust/60 text-rust" };
    default:
      return { text: t.value("ota.badge.ok"), cls: "border-gunmetal-400 text-fiatDim" };
  }
});

function open(url: string) {
  window.open(url, "_blank", "noopener");
}
</script>

<template>
  <section data-testid="ota-card">
    <span class="forge-label">{{ t("ota.title") }}</span>
    <div class="forge-card p-3.5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-bone">{{ t("ota.title") }}</span>
            <span
              class="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border"
              :class="badge.cls"
              data-testid="ota-status-badge"
            >{{ badge.text }}</span>
          </div>
          <p class="text-[11px] text-fiatDim font-mono mt-1" data-testid="ota-versions">
            {{ t("ota.bundle") }} v{{ ota.bundleVersion }} · APK v{{ ota.nativeVersion || "—" }}
          </p>
        </div>
        <button
          @click="checkForUpdate(false)"
          :disabled="busy"
          class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-bone disabled:opacity-40 shrink-0"
          data-testid="ota-check-btn"
        >{{ ota.status === "checking" ? t("ota.checking") : t("ota.check") }}</button>
      </div>

      <!-- Update available -->
      <div v-if="ota.status === 'available' && ota.latest" class="mt-3 border-t border-gunmetal-500 pt-3" data-testid="ota-available">
        <p class="text-xs text-bone">{{ t("ota.available") }} <span class="font-mono">v{{ ota.latest.version }}</span></p>
        <p v-if="ota.notes" class="text-[11px] text-fiatDim mt-1 whitespace-pre-line leading-relaxed max-h-24 overflow-y-auto">{{ ota.notes }}</p>
        <div class="flex gap-2 mt-3">
          <button @click="downloadUpdate(true)" class="flex-1 py-2 rounded-md bg-[#E25822] text-bone text-xs font-semibold" data-testid="ota-update-now-btn">{{ t("ota.updateNow") }}</button>
          <button @click="downloadUpdate(false)" class="flex-1 py-2 rounded-md border border-gunmetal-400 text-fiat text-xs" data-testid="ota-update-later-btn">{{ t("ota.nextLaunch") }}</button>
        </div>
      </div>

      <!-- Downloading -->
      <div v-else-if="ota.status === 'downloading'" class="mt-3" data-testid="ota-progress">
        <div class="h-1.5 rounded bg-gunmetal-600 overflow-hidden">
          <div class="h-full bg-cyan-volt transition-[width]" :style="{ width: ota.progress + '%' }" />
        </div>
        <p class="text-[11px] text-fiatDim mt-1">{{ t("ota.downloading") }} {{ ota.progress }}%</p>
      </div>

      <!-- Ready on next launch -->
      <div v-else-if="ota.status === 'ready'" class="mt-3 border-t border-gunmetal-500 pt-3" data-testid="ota-ready">
        <p class="text-xs text-bone">{{ t("ota.ready") }} <span class="font-mono">v{{ ota.latest?.version }}</span></p>
        <button @click="applyReadyUpdate" class="mt-2 w-full py-2 rounded-md bg-[#E25822] text-bone text-xs font-semibold" data-testid="ota-restart-btn">{{ t("ota.restartNow") }}</button>
      </div>

      <!-- Needs a new APK -->
      <div v-else-if="ota.status === 'native-required' && ota.latest" class="mt-3 border-t border-gunmetal-500 pt-3" data-testid="ota-native-required">
        <p class="text-xs text-bone">{{ t("ota.nativeRequired") }} <span class="font-mono">v{{ ota.latest.version }}</span></p>
        <p class="text-[11px] text-fiatDim mt-1">{{ t("ota.nativeRequiredDesc") }}</p>
        <button @click="open(ota.apkUrl)" class="mt-2 w-full py-2 rounded-md bg-[#E25822] text-bone text-xs font-semibold" data-testid="ota-download-apk-btn">{{ t("ota.downloadApk") }}</button>
      </div>

      <p v-else-if="ota.status === 'error'" class="mt-2 text-[11px] text-rust" data-testid="ota-error">{{ ota.error }}</p>
      <p v-else-if="ota.status === 'up-to-date'" class="mt-2 text-[11px] text-fiatDim">{{ t("ota.upToDate") }}</p>
    </div>
  </section>
</template>
