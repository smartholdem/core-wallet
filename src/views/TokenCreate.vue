<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import TopBar from "@/components/TopBar.vue";
import OpSummary from "@/components/token/OpSummary.vue";
import TokenMetaForm from "@/components/token/TokenMetaForm.vue";
import TokenLogo from "@/components/token/TokenLogo.vue";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { useTokensStore, SOBJ_REGISTER_FEE } from "@/stores/tokens";
import { useTokenOp, tokenAmount, sth } from "@/lib/tokenUi";
import { toUnits } from "@/lib/tokenTx";
import { useT } from "@/locales";

const route = useRoute();
const router = useRouter();
const t = useT();
const auth = useAuthStore();
const settings = useSettingsStore();
const tokens = useTokensStore();
const { busy, run } = useTokenOp();

const DRAFT_KEY = "sth.tokenWizard";
const step = ref<1 | 2 | 3 | 4>(1);
const ticker = ref("");
const tickerId = ref("");
const waiting = ref<"" | "ticker" | "init">("");
const waitError = ref("");

/* step 1 */
const tickerStatus = ref<"" | "checking" | "free" | "taken" | "token" | "bad">("");
let checkTimer = 0;
const existing = computed(() => {
  const issued = new Set([...tokens.ownedIds(auth.address), ...tokens.forAddress(auth.address).map((w) => w.id)]);
  return tokens.myTickers(auth.address).filter((tk) => !issued.has(tk.id));
});
const ack1 = ref(false);
watch(ticker, (v) => {
  const up = v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (up !== v) { ticker.value = up; return; }
  ack1.value = false;
  clearTimeout(checkTimer);
  if (!up) { tickerStatus.value = ""; return; }
  if (!tokens.tickerRe.test(up)) { tickerStatus.value = "bad"; return; }
  tickerStatus.value = "checking";
  checkTimer = window.setTimeout(async () => {
    const r = await tokens.checkTicker(up);
    if (ticker.value !== up) return;
    tickerStatus.value = r ?? "free";
  }, 450);
});
const tickerPendingLocal = computed(() => tokens.pendingFor(auth.address).some((p) => p.kind === "ticker"));

async function registerTicker() {
  const tx = await run(() => tokens.registerTicker(ticker.value));
  if (!tx) return;
  tickerId.value = tx.id!;
  saveDraft();
  await waitFor("ticker", `${settings.apiBase}/sobj/${tx.id}`);
}
function useExisting(tk: { id: string; name: string }) {
  tickerId.value = tk.id;
  ticker.value = tk.name;
  step.value = 2;
  saveDraft();
}

/* step 2 */
const decimals = ref(8);
const supply = ref("");
const mintable = ref(false);
const burnable = ref(false);
const cap = ref("");
const ack2 = ref(false);
const supplyUnits = computed(() => { try { return toUnits(supply.value, decimals.value); } catch { return null; } });
const capUnits = computed(() => { if (!mintable.value) return supplyUnits.value; try { return toUnits(cap.value, decimals.value); } catch { return null; } });
const supplyOk = computed(() => supplyUnits.value != null && supplyUnits.value > 0n && capUnits.value != null && capUnits.value >= supplyUnits.value);
const initPendingLocal = computed(() => tokens.pendingFor(auth.address).some((p) => p.kind === "init" && p.id === tickerId.value));
const initBurn = computed(() => tokens.fees ? BigInt(tokens.fees.initBurn || "0") : 0n);

async function issue() {
  const tx = await run(() => tokens.initToken({ tickerId: tickerId.value, decimals: decimals.value, initialSupply: supplyUnits.value!, supplyCap: capUnits.value!, mintable: mintable.value, burnable: burnable.value }));
  if (!tx) return;
  saveDraft();
  await waitFor("init", `${settings.apiBase}/tokens/${tickerId.value}`);
}

/** Poll the node until the object exists (≈ one block), then advance. */
async function waitFor(kind: "ticker" | "init", url: string) {
  waiting.value = kind;
  waitError.value = "";
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const r = await axios.get(url, { timeout: 6000 });
      if (r.data?.data?.id) {
        waiting.value = "";
        step.value = kind === "ticker" ? 2 : 3;
        saveDraft();
        tokens.refresh(auth.address).catch(() => {});
        return;
      }
    } catch { /* not yet */ }
  }
  waiting.value = "";
  waitError.value = t.value("tok.waitTimeout");
}

/* step 3 / 4 */
const created = computed(() => tokens.details[tickerId.value]);
function onMetaDone() { step.value = 4; saveDraft(); setTimeout(() => tokens.fetchToken(tickerId.value), 9500); }
function finish() { localStorage.removeItem(DRAFT_KEY); router.replace(`/tokens/${tickerId.value}`); }
function toList() { localStorage.removeItem(DRAFT_KEY); router.replace("/tokens"); }
function reset() { localStorage.removeItem(DRAFT_KEY); step.value = 1; ticker.value = ""; tickerId.value = ""; supply.value = ""; cap.value = ""; ack1.value = false; ack2.value = false; }

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({ step: step.value, ticker: ticker.value, tickerId: tickerId.value, address: auth.address, net: settings.activeNetwork.nethash }));
}
function goStep(s: 1 | 2 | 3) {
  if (s === 1 || (tickerId.value && (s === 2 || created.value))) { step.value = s; saveDraft(); }
}

onMounted(async () => {
  await tokens.fetchConfig();
  tokens.refresh(auth.address).catch(() => {});
  const q = route.query.ticker as string | undefined;
  if (q) {
    const tk = tokens.myTickers(auth.address).find((x) => x.id === q) ?? (await axios.get(`${settings.apiBase}/sobj/${q}`).then((r) => ({ id: q, name: r.data?.data?.data?.name ?? "" })).catch(() => null));
    if (tk) useExisting(tk);
    return;
  }
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
    if (d && d.address === auth.address && d.net === settings.activeNetwork.nethash) {
      step.value = d.step; ticker.value = d.ticker; tickerId.value = d.tickerId;
      if (step.value >= 3 && tickerId.value) tokens.fetchToken(tickerId.value);
    }
  } catch {}
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="token-create-view">
    <TopBar />
    <header class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800">
      <button @click="router.back()" class="w-8 h-8 -ml-1 grid place-items-center rounded-md text-fiat hover:text-bone hover:bg-gunmetal-700/60" data-testid="wizard-back-btn" :aria-label="t('top.back')">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 5l-7 7 7 7" /></svg>
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-fiat font-semibold">{{ t("tok.wizardTitle") }}</span>
      <button v-if="step < 4" @click="reset" class="text-[10px] uppercase tracking-[0.18em] text-fiatDim hover:text-rust" data-testid="wizard-reset-btn">{{ t("tok.reset") }}</button>
      <span v-else class="w-8" />
    </header>

    <!-- Steps -->
    <div class="flex items-center gap-1 px-4 pt-3" data-testid="wizard-steps">
      <button v-for="s in [1, 2, 3, 4]" :key="s" @click="s < 4 && goStep(s as 1 | 2 | 3)" class="flex-1 flex flex-col items-start gap-1" :data-testid="`wizard-step-${s}`">
        <span class="h-1 w-full rounded" :class="step >= s ? 'bg-indigo-forge' : 'bg-gunmetal-600'" />
        <span class="text-[9px] uppercase tracking-[0.15em]" :class="step === s ? 'text-bone' : 'text-fiatDim'">{{ t(`tok.step${s}`) }}</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 [&>*]:shrink-0">
      <!-- waiting overlay -->
      <div v-if="waiting" class="forge-card p-4 text-center" data-testid="wizard-waiting">
        <p class="text-sm text-bone animate-pulse">{{ t(waiting === 'ticker' ? 'tok.waitTicker' : 'tok.waitInit') }}</p>
        <p class="text-[11px] text-fiatDim mt-1">{{ t("tok.waitHint") }}</p>
      </div>
      <p v-if="waitError" class="forge-card p-3 text-xs text-rust" data-testid="wizard-wait-error">{{ waitError }}</p>

      <!-- STEP 1 -->
      <template v-if="step === 1 && !waiting">
        <section v-if="existing.length" data-testid="existing-tickers">
          <span class="forge-label">{{ t("tok.useExisting") }}</span>
          <div class="flex flex-col gap-1.5">
            <button v-for="tk in existing" :key="tk.id" @click="useExisting(tk)" class="forge-card p-2.5 flex items-center justify-between hover:border-gunmetal-300" :data-testid="`use-ticker-${tk.name}`">
              <span class="mono text-sm text-bone font-semibold">{{ tk.name }}</span>
              <span class="text-[10px] uppercase tracking-[0.15em] text-cyan-voltGlow">{{ t("tok.issue") }} →</span>
            </button>
          </div>
          <p class="text-[10px] uppercase tracking-[0.18em] text-fiatDim text-center my-3">{{ t("tok.orNew") }}</p>
        </section>
        <section>
          <label class="forge-label">{{ t("tok.tickerLabel") }}</label>
          <input v-model="ticker" class="forge-input mono text-lg tracking-[0.2em] uppercase" maxlength="10" placeholder="MYTOKEN" autocomplete="off" spellcheck="false" data-testid="ticker-input" />
          <p class="text-[11px] mt-1.5 leading-relaxed" :class="tickerStatus === 'free' ? 'text-indigo-forgeBright' : tickerStatus === 'checking' || tickerStatus === '' ? 'text-fiatDim' : 'text-rust'" data-testid="ticker-status">
            {{ tickerStatus === 'free' ? t("tok.tickerFree") : tickerStatus === 'checking' ? t("tok.tickerChecking") : tickerStatus === 'taken' ? t("tok.errTickerTaken") : tickerStatus === 'token' ? t("tok.errAlreadyIssued") : tickerStatus === 'bad' ? t("tok.errTickerFormat") : t("tok.tickerHint") }}
          </p>
        </section>
        <label class="flex items-start gap-2 text-[11px] text-fiat cursor-pointer" data-testid="ticker-ack">
          <input type="checkbox" v-model="ack1" class="mt-0.5 accent-indigo-500" data-testid="ticker-ack-checkbox" />
          <span>{{ t("tok.ackCharge").replace("{amt}", `${sth(SOBJ_REGISTER_FEE)} ${settings.token}`) }}</span>
        </label>
        <p v-if="tickerPendingLocal" class="text-[11px] text-rust" data-testid="ticker-pending">{{ t("tok.tickerPending") }}</p>
        <OpSummary
          :rows="[{ label: t('tok.tickerLabel'), value: ticker || '—' }, { label: t('tok.network'), value: settings.networkName.toUpperCase(), mono: false }]"
          :fee="SOBJ_REGISTER_FEE"
          :label="t('tok.holdRegister')"
          :disabled="tickerStatus !== 'free' || !ack1 || busy || tickerPendingLocal"
          testid="register-hold-btn"
          @fired="registerTicker"
        />
      </template>

      <!-- STEP 2 -->
      <template v-else-if="step === 2 && !waiting">
        <section class="forge-card p-3 flex items-center justify-between">
          <span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.tickerLabel") }}</span>
          <span class="mono text-bone font-semibold" data-testid="issue-ticker">{{ ticker }}</span>
        </section>
        <section>
          <label class="forge-label">{{ t("tok.decimals") }} (0–8)</label>
          <input v-model.number="decimals" type="number" min="0" max="8" class="forge-input mono" data-testid="decimals-input" />
          <p class="text-[10px] text-fiatDim mt-1">{{ t("tok.decimalsHint") }}</p>
        </section>
        <section>
          <label class="forge-label">{{ t("tok.initialSupply") }}</label>
          <input v-model="supply" type="text" inputmode="decimal" class="forge-input mono" placeholder="1000000" data-testid="supply-input" />
          <p class="text-[10px] text-fiatDim mt-1">{{ t("tok.supplyHint") }}</p>
        </section>
        <label class="flex items-start gap-2 text-[11px] text-fiat cursor-pointer">
          <input type="checkbox" v-model="mintable" class="mt-0.5 accent-indigo-500" data-testid="mintable-checkbox" />
          <span>{{ t("tok.allowMint") }} <span class="text-fiatDim">— {{ t("tok.allowMintHint") }}</span></span>
        </label>
        <section v-if="mintable">
          <label class="forge-label">{{ t("tok.supplyCap") }}</label>
          <input v-model="cap" type="text" inputmode="decimal" class="forge-input mono" placeholder="10000000" data-testid="cap-input" />
          <p v-if="capUnits != null && supplyUnits != null && capUnits < supplyUnits" class="text-[10px] text-rust mt-1" data-testid="cap-error">{{ t("tok.capTooSmall") }}</p>
        </section>
        <label class="flex items-start gap-2 text-[11px] text-fiat cursor-pointer">
          <input type="checkbox" v-model="burnable" class="mt-0.5 accent-indigo-500" data-testid="burnable-checkbox" />
          <span>{{ t("tok.allowBurn") }} <span class="text-fiatDim">— {{ t("tok.allowBurnHint") }}</span></span>
        </label>
        <section class="forge-card p-3 flex items-center gap-3" data-testid="issue-preview">
          <TokenLogo :symbol="ticker" :size="40" />
          <div>
            <p class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.previewBalance") }}</p>
            <p class="mono text-bone">{{ supplyUnits != null ? tokenAmount(supplyUnits.toString(), decimals) : "0" }} {{ ticker }}</p>
          </div>
        </section>
        <p class="text-[11px] text-rust/90 leading-relaxed">{{ t("tok.immutableWarn") }}</p>
        <label class="flex items-start gap-2 text-[11px] text-fiat cursor-pointer">
          <input type="checkbox" v-model="ack2" class="mt-0.5 accent-indigo-500" data-testid="issue-ack-checkbox" />
          <span>{{ t("tok.ackCharge").replace("{amt}", `${sth(tokens.fees?.init ?? '0')} ${settings.token}`) }} {{ t("tok.ofWhichBurned").replace("{amt}", `${sth(initBurn)} ${settings.token}`) }}</span>
        </label>
        <p v-if="initPendingLocal" class="text-[11px] text-rust" data-testid="init-pending">{{ t("tok.initPending") }}</p>
        <OpSummary
          :rows="[
            { label: t('tok.tickerLabel'), value: ticker },
            { label: t('tok.initialSupply'), value: supplyUnits != null ? tokenAmount(supplyUnits.toString(), decimals) : '—' },
            { label: t('tok.supplyCap'), value: capUnits != null ? tokenAmount(capUnits.toString(), decimals) : '—' },
            { label: t('tok.flags'), value: [mintable ? t('tok.mintable') : '', burnable ? t('tok.burnable') : ''].filter(Boolean).join(', ') || '—', mono: false },
          ]"
          :fee="tokens.fees?.init ?? '0'"
          :label="t('tok.holdIssue')"
          :disabled="!supplyOk || !ack2 || busy || initPendingLocal || decimals < 0 || decimals > 8"
          testid="issue-hold-btn"
          @fired="issue"
        />
      </template>

      <!-- STEP 3 -->
      <template v-else-if="step === 3 && !waiting">
        <p class="text-[11px] text-fiatDim leading-relaxed">{{ t("tok.metaIntro") }}</p>
        <TokenMetaForm :token-id="tickerId" :symbol="ticker" :current="created" @done="onMetaDone" />
        <button @click="step = 4; saveDraft()" class="forge-btn h-10 text-[10px] uppercase tracking-[0.18em]" data-testid="meta-skip-btn">{{ t("tok.skipMeta") }}</button>
      </template>

      <!-- STEP 4 -->
      <template v-else-if="step === 4">
        <section class="forge-card p-5 text-center flex flex-col items-center gap-3" data-testid="wizard-done">
          <TokenLogo :src="tokens.logoUrl(created)" :symbol="ticker" :size="64" />
          <div>
            <p class="text-base text-bone font-semibold">{{ created?.meta?.name || ticker }}</p>
            <p class="mono text-xs text-fiat">{{ ticker }} · {{ created ? tokenAmount(created.supply, created.decimals) : "…" }}</p>
          </div>
          <p class="text-[11px] text-fiatDim">{{ t("tok.doneBody") }}</p>
        </section>
        <button @click="finish" class="forge-btn-primary h-11 text-[10px] uppercase tracking-[0.18em]" data-testid="done-open-btn">{{ t("tok.sendFirst") }}</button>
        <button @click="toList" class="forge-btn h-10 text-[10px] uppercase tracking-[0.18em]" data-testid="done-list-btn">{{ t("tok.toList") }}</button>
      </template>
    </div>
  </div>
</template>
