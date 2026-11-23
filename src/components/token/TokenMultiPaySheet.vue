<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";
import ActionSheet from "./ActionSheet.vue";
import OpSummary from "./OpSummary.vue";
import { useTokensStore, type TokenDetail } from "@/stores/tokens";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { useTokenOp, tokenAmount, sth } from "@/lib/tokenUi";
import { toUnits, LIMITS } from "@/lib/tokenTx";
import { useSettingsStore } from "@/stores/settings";
import { useT } from "@/locales";

const props = defineProps<{ open: boolean; token: TokenDetail; balance: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "done", txId: string): void }>();
const t = useT();
const tokens = useTokensStore();
const wallet = useWalletStore();
const auth = useAuthStore();
const settings = useSettingsStore();
const { busy, run } = useTokenOp();

const text = ref("");
const memo = ref("");
watch(() => props.open, (o) => { if (o) { text.value = ""; memo.value = ""; } });

const max = computed(() => tokens.config?.maxRecipients ?? 64);

type Row = { raw: string; line: number; err: string; addr?: string; units?: bigint };
const parsed = computed((): Row[] => {
  const seen = new Set<string>();
  return text.value.split(/\r?\n/).map((raw, i) => ({ raw: raw.trim(), line: i + 1 })).filter((l) => l.raw).map((l) => {
    const m = l.raw.match(/^["']?([A-Za-z0-9]{25,40})["']?[\s,;\t]+["']?([^"'\s;]+)["']?$/);
    if (!m) return { ...l, err: t.value("mp.badAddr") };
    const [, addr, amt] = m;
    if (!wallet.validateAddress(addr)) return { ...l, addr, err: t.value("mp.badAddr") };
    if (addr === auth.address) return { ...l, addr, err: t.value("mp.self") };
    if (seen.has(addr)) return { ...l, addr, err: t.value("mp.dup") };
    seen.add(addr);
    let units: bigint | null = null;
    try { units = toUnits(amt, props.token.decimals); } catch { /* invalid */ }
    if (!units) return { ...l, addr, err: t.value("mp.badAmount") };
    return { ...l, addr, units, err: "" };
  });
});

const errors = computed(() => parsed.value.filter((p) => p.err));
const items = computed(() => parsed.value.filter((p) => !p.err).map((p) => ({ recipientId: p.addr!, amount: p.units! })));
const total = computed(() => items.value.reduce((s, i) => s + i.amount, 0n));
const tooMany = computed(() => parsed.value.length > max.value);
const overdraft = computed(() => total.value > BigInt(props.balance));
const memoBytes = computed(() => new TextEncoder().encode(memo.value).length);
const fee = computed(() => tokens.transferFee(Math.max(1, items.value.length)));
const canSubmit = computed(() => !busy.value && items.value.length > 0 && !errors.value.length && !tooMany.value && !overdraft.value && memoBytes.value <= LIMITS.memo);

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) text.value = (await f.text()).replace(/^\uFEFF/, "");
}

async function submit() {
  const tx = await run(() => tokens.transferMany({ id: props.token.id, items: items.value, memo: memo.value.trim() || undefined }));
  if (tx) emit("done", tx.id!);
}
</script>

<template>
  <ActionSheet :open="open" :title="`${t('mp.title')} · ${token.symbol}`" testid="token-multipay-sheet" @close="emit('close')">
    <p class="text-[11px] text-fiatDim leading-relaxed">{{ t("mp.hint") }}</p>
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="forge-label !mb-0">{{ t("mp.recipients") }}</label>
        <label class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-bone cursor-pointer" data-testid="multipay-file-btn">
          CSV<input type="file" accept=".csv,.txt,text/csv,text/plain" class="hidden" @change="onFile" data-testid="multipay-file-input" />
        </label>
      </div>
      <textarea v-model="text" rows="6" class="forge-input mono text-[11px] leading-relaxed resize-y min-h-[120px]" :placeholder="t('mp.placeholder')" spellcheck="false" data-testid="multipay-input" />
      <div class="flex items-center justify-between text-[10px] mt-1">
        <span :class="tooMany ? 'text-rust' : 'text-fiatDim'" data-testid="multipay-count">{{ t("mp.recipients") }}: <span class="mono">{{ items.length }}/{{ max }}</span></span>
        <span class="text-fiatDim">{{ t("tok.available") }}: <span class="mono">{{ tokenAmount(balance, token.decimals) }}</span></span>
      </div>
      <p v-if="tooMany" class="text-[10px] text-rust mt-1" data-testid="multipay-too-many">{{ t("mp.tooMany").replace("{n}", String(max)) }}</p>
      <div v-if="errors.length" class="mt-1.5 flex flex-col gap-0.5" data-testid="multipay-errors">
        <p v-for="e in errors.slice(0, 6)" :key="e.line" class="text-[10px] text-rust truncate">{{ t("mp.badLine") }} {{ e.line }}: {{ e.err }} — <span class="mono">{{ e.raw }}</span></p>
        <p v-if="errors.length > 6" class="text-[10px] text-rust">+{{ errors.length - 6 }}</p>
      </div>
      <p v-if="overdraft" class="text-[10px] text-rust mt-1" data-testid="multipay-overdraft">{{ t("tok.errInsufficientTokens") }}</p>
    </div>
    <div>
      <label class="forge-label">{{ t("tok.memo") }}</label>
      <input v-model="memo" class="forge-input" :placeholder="t('tok.memoPh')" data-testid="multipay-memo-input" />
      <p class="text-[10px] mt-1" :class="memoBytes > LIMITS.memo ? 'text-rust' : 'text-fiatDim'">{{ memoBytes }}/{{ LIMITS.memo }} {{ t("tok.bytes") }}</p>
    </div>
    <p v-if="tokens.fees" class="text-[10px] text-fiatDim" data-testid="multipay-fee-hint">
      {{ t("mp.feeHint") }}: <span class="mono">{{ sth(tokens.fees.transfer, 4) }} + {{ sth(tokens.fees.transferPerRecipient, 4) }} × {{ Math.max(0, items.length - 1) }} {{ settings.token }}</span>
    </p>
    <OpSummary
      :rows="[
        { label: t('mp.recipients'), value: String(items.length) },
        { label: t('mp.total'), value: `${tokenAmount(total.toString(), token.decimals, token.decimals)} ${token.symbol}` },
        ...(memo ? [{ label: t('tok.memo'), value: memo, mono: false }] : []),
      ]"
      :fee="fee"
      :label="t('mp.hold')"
      :disabled="!canSubmit"
      testid="multipay-hold-btn"
      @fired="submit"
    />
  </ActionSheet>
</template>
