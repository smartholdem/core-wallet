<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import TopBar from "@/components/TopBar.vue";
import BottomDock from "@/components/BottomDock.vue";
import { pushToast } from "@/lib/utils";
import { useSettingsStore, DEFAULT_NODES } from "@/stores/settings";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { nodeLabel, type NodeInfo } from "@/lib/network";
import { useT } from "@/locales";

const router = useRouter();
const t = useT();
const settings = useSettingsStore();
const auth = useAuthStore();
const wallet = useWalletStore();

const probing = ref(false);
const viewNet = ref(settings.activeNetwork.nethash);
const newNode = ref("");
const adding = ref(false);
const addError = ref("");
const added = ref<NodeInfo | null>(null);

const networks = computed(() => settings.networks);
const rows = computed(() =>
  settings.nodesOf(viewNet.value).map((url) => {
    const s = settings.nodesStatus.find((x) => x.node === url);
    return {
      url,
      info: settings.nodeInfo[url],
      latency: s?.latency ?? Infinity,
      synced: s?.synced ?? false,
      height: (s?.status?.now ?? s?.status?.blockchain?.block?.height) as number | undefined,
      custom: !DEFAULT_NODES.includes(url),
    };
  }),
);

function netLabel(n: { name: string; token: string; symbol: string }) {
  const name = (n.name || "custom").toUpperCase();
  return `${name} · ${n.token}${n.symbol && n.symbol !== n.token ? ` [${n.symbol}]` : ""}`;
}

async function rescan() {
  probing.value = true;
  try {
    await settings.updateNodes();
    pushToast(t.value("nodes.refreshed"), "success");
  } catch {
    pushToast(t.value("nodes.errUnreachable"), "error");
  } finally {
    probing.value = false;
  }
}

function afterNetworkSwitch() {
  wallet.ensureNetworkAddresses();
  if (auth.address) {
    wallet.fetchBalance(auth.address);
    wallet.fetchTransactions(auth.address);
  }
  pushToast(`${t.value("nodes.switchedNet")} ${netLabel(settings.activeNetwork)}`, "success");
}

function pickNetwork(nethash: string) {
  viewNet.value = nethash;
  if (nethash === settings.activeNetwork.nethash) return;
  if (settings.switchNetwork(nethash)) afterNetworkSwitch();
}

function pickNode(url: string) {
  const changed = settings.setActiveNode(url);
  if (changed) afterNetworkSwitch();
  else pushToast(`${t.value("nodes.switched")} ${nodeLabel(url)}`, "success");
}

async function addNode() {
  if (!newNode.value.trim() || adding.value) return;
  adding.value = true;
  addError.value = "";
  added.value = null;
  try {
    const info = await settings.addNode(newNode.value);
    added.value = info;
    viewNet.value = info.nethash;
    newNode.value = "";
    pushToast(t.value("nodes.added"), "success");
  } catch (e: any) {
    const code = e?.message;
    addError.value =
      code === "invalid-url" ? t.value("nodes.errInvalid")
      : code === "exists" ? t.value("nodes.errExists")
      : code === "mixed-content" ? t.value("nodes.errMixed")
      : code === "permission" ? t.value("nodes.errPermission")
      : t.value("nodes.errUnreachable");
  } finally {
    adding.value = false;
  }
}

function removeNode(url: string) {
  settings.removeNode(url);
  if (!settings.nodesOf(viewNet.value).length) viewNet.value = settings.activeNetwork.nethash;
  if (settings.activeNetwork.nethash !== viewNet.value) afterNetworkSwitch();
  pushToast(t.value("nodes.removed"), "success");
}

onMounted(() => { if (!settings.nodesStatus.length) rescan(); });
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="nodes-view">
    <TopBar />

    <header class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800">
      <button
        @click="router.back()"
        class="w-8 h-8 -ml-1 grid place-items-center rounded-md text-fiat hover:text-bone hover:bg-gunmetal-700/60 transition-colors"
        data-testid="nodes-back-btn"
        :aria-label="t('top.back')"
      >
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">{{ t("nodes.title") }}</span>
      <button
        @click="rescan"
        class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt"
        data-testid="rescan-nodes-btn"
      >
        {{ probing ? t("nodes.probing") : t("nodes.rescan") }}
      </button>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <!-- Network switcher -->
      <section>
        <span class="forge-label">{{ t("nodes.network") }}</span>
        <div class="flex gap-1.5 flex-wrap" data-testid="network-tabs">
          <button
            v-for="n in networks"
            :key="n.nethash"
            @click="pickNetwork(n.nethash)"
            class="px-3 h-8 rounded border text-[10px] uppercase tracking-[0.15em] font-semibold transition-colors"
            :class="[
              viewNet === n.nethash
                ? 'border-indigo-forge/60 bg-indigo-forge/10 text-bone shadow-glowIndigo'
                : 'border-gunmetal-400 bg-gunmetal-700 text-fiat hover:border-gunmetal-300',
            ]"
            :data-testid="`network-tab-${n.name || 'custom'}`"
          >
            <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
              :class="settings.activeNetwork.nethash === n.nethash ? 'bg-indigo-forgeBright' : 'bg-gunmetal-300'" />
            {{ netLabel(n) }}
          </button>
        </div>
        <p class="text-[11px] text-fiatDim mt-2 leading-relaxed">{{ t("nodes.networkHint") }}</p>
      </section>

      <!-- Node list -->
      <section>
        <div class="flex items-center justify-between mb-1.5">
          <span class="forge-label !mb-0">{{ t("nodes.list") }}</span>
          <span v-if="settings.pinnedNode" class="text-[10px] uppercase tracking-[0.15em] text-rust" data-testid="pinned-badge">
            {{ t("nodes.pinned") }}
          </span>
        </div>
        <div class="flex flex-col gap-1.5" data-testid="node-list">
          <div
            v-for="n in rows"
            :key="n.url"
            class="flex items-stretch rounded border transition-colors"
            :class="n.url === settings.activeNode
              ? 'border-indigo-forge/60 bg-indigo-forge/10 shadow-glowIndigo'
              : 'border-gunmetal-400 bg-gunmetal-700 hover:border-gunmetal-300'"
            :data-testid="`node-${nodeLabel(n.url)}`"
          >
            <button @click="pickNode(n.url)" class="flex-1 min-w-0 flex items-center justify-between gap-2 p-2.5 text-left">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                    :class="n.synced ? 'bg-indigo-forgeBright' : isFinite(n.latency) ? 'bg-rust' : 'bg-gunmetal-300'" />
                  <span class="mono text-xs text-fiat truncate">{{ nodeLabel(n.url) }}</span>
                </div>
                <div class="flex items-center gap-2 mt-1 pl-3.5 text-[10px] mono text-fiatDim">
                  <span class="px-1.5 rounded bg-gunmetal-800 border border-gunmetal-400 text-cyan-voltGlow" :data-testid="`node-token-${nodeLabel(n.url)}`">
                    {{ n.info?.token ?? "…" }}
                  </span>
                  <span v-if="n.info?.coreVersion">core {{ n.info.coreVersion }}</span>
                  <span v-if="n.height">#{{ n.height.toLocaleString() }}</span>
                  <span v-if="n.custom" class="text-rust/80">{{ t("nodes.personal") }}</span>
                </div>
              </div>
              <span class="mono text-[10px] text-fiatDim shrink-0">
                {{ isFinite(n.latency) ? `${n.latency}ms` : "—" }}
              </span>
            </button>
            <button
              v-if="n.custom"
              @click="removeNode(n.url)"
              class="w-9 grid place-items-center border-l border-gunmetal-400 text-fiatDim hover:text-rust transition-colors"
              :data-testid="`remove-node-${nodeLabel(n.url)}`"
              :aria-label="t('nodes.remove')"
            >
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p v-if="!rows.length" class="forge-card p-3 text-center text-[11px] text-fiatDim">{{ t("nodes.empty") }}</p>
        </div>
      </section>

      <!-- Add personal node -->
      <section>
        <span class="forge-label">{{ t("nodes.addTitle") }}</span>
        <form class="flex gap-1.5" @submit.prevent="addNode">
          <input
            v-model="newNode"
            type="text"
            class="forge-input flex-1 h-10 mono text-xs"
            :placeholder="t('nodes.addPlaceholder')"
            autocomplete="off"
            spellcheck="false"
            data-testid="add-node-input"
          />
          <button type="submit" class="forge-btn-primary h-10 px-4 text-[10px] uppercase tracking-[0.15em]"
            :disabled="adding || !newNode.trim()" data-testid="add-node-btn">
            {{ adding ? t("nodes.checking") : t("nodes.add") }}
          </button>
        </form>
        <p v-if="addError" class="text-[11px] text-rust mt-1.5" data-testid="add-node-error">{{ addError }}</p>
        <div v-if="added" class="forge-card p-3 mt-2 text-[11px] flex flex-col gap-1" data-testid="add-node-result">
          <span class="text-fiat">{{ t("nodes.addedInfo") }}</span>
          <span class="mono text-cyan-voltGlow">{{ netLabel(added) }}</span>
          <span class="mono text-fiatDim">core {{ added.coreVersion || "?" }} · nethash {{ added.nethash.slice(0, 12) }}…</span>
        </div>
        <p class="text-[11px] text-fiatDim mt-2 leading-relaxed">{{ t("nodes.addHint") }}</p>
      </section>
    </div>

    <BottomDock />
  </div>
</template>
