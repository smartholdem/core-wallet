<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";
import ActionSheet from "./ActionSheet.vue";
import OpSummary from "./OpSummary.vue";
import RecipientPicker from "@/components/RecipientPicker.vue";
import { useTokensStore, type TokenDetail } from "@/stores/tokens";
import { useWalletStore } from "@/stores/wallet";
import { useTokenOp, tokenAmount } from "@/lib/tokenUi";
import { toUnits, LIMITS } from "@/lib/tokenTx";
import { shortAddress } from "@/lib/utils";
import { useT } from "@/locales";

const props = defineProps<{ open: boolean; token: TokenDetail; balance: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "done", txId: string): void }>();
const t = useT();
const tokens = useTokensStore();
const wallet = useWalletStore();
const { busy, run } = useTokenOp();

const recipient = ref("");
const amount = ref("");
const memo = ref("");
const pickerOpen = ref(false);
watch(() => props.open, (o) => { if (o) { recipient.value = ""; amount.value = ""; memo.value = ""; } });

const recipientValid = computed(() => (recipient.value ? wallet.validateAddress(recipient.value.trim()) : null));
const units = computed(() => { try { return toUnits(amount.value, props.token.decimals); } catch { return null; } });
const memoBytes = computed(() => new TextEncoder().encode(memo.value).length);
const overdraft = computed(() => units.value != null && units.value > BigInt(props.balance));
const fee = computed(() => tokens.transferFee(1));
const canSubmit = computed(() => !busy.value && recipientValid.value === true && units.value != null && units.value > 0n && !overdraft.value && memoBytes.value <= LIMITS.memo);

function setMax() { amount.value = tokenAmount(props.balance, props.token.decimals, props.token.decimals).replace(/\s|,/g, ""); }

async function submit() {
  const tx = await run(() => tokens.transfer({ id: props.token.id, recipient: recipient.value.trim(), amount: units.value!, memo: memo.value.trim() || undefined }));
  if (tx) emit("done", tx.id!);
}
</script>

<template>
  <ActionSheet :open="open" :title="`${t('tok.send')} ${token.symbol}`" testid="token-send-sheet" @close="emit('close')">
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="forge-label !mb-0">{{ t("tok.recipient") }}</label>
        <button type="button" @click="pickerOpen = true" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-bone" data-testid="token-pick-recipient-btn">{{ t("book.pick") }}</button>
      </div>
      <input v-model="recipient" class="forge-input mono text-xs" :placeholder="t('tok.recipientPh')" spellcheck="false" data-testid="token-recipient-input" />
      <p v-if="recipientValid === false" class="text-[10px] text-rust mt-1" data-testid="token-recipient-invalid">{{ t("tok.badAddress") }}</p>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="forge-label !mb-0">{{ t("tok.amount") }} ({{ token.symbol }})</label>
        <button @click="setMax" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" data-testid="token-max-btn">MAX</button>
      </div>
      <input v-model="amount" type="text" inputmode="decimal" class="forge-input mono" placeholder="0" data-testid="token-amount-input" />
      <p class="text-[10px] text-fiatDim mt-1">{{ t("tok.available") }}: <span class="mono">{{ tokenAmount(balance, token.decimals) }}</span> · {{ t("tok.decimals") }}: {{ token.decimals }}</p>
      <p v-if="overdraft" class="text-[10px] text-rust mt-1" data-testid="token-overdraft">{{ t("tok.errInsufficientTokens") }}</p>
    </div>
    <div>
      <label class="forge-label">{{ t("tok.memo") }}</label>
      <input v-model="memo" class="forge-input" :placeholder="t('tok.memoPh')" data-testid="token-memo-input" />
      <p class="text-[10px] mt-1" :class="memoBytes > LIMITS.memo ? 'text-rust' : 'text-fiatDim'">{{ memoBytes }}/{{ LIMITS.memo }} {{ t("tok.bytes") }}</p>
    </div>
    <OpSummary
      :rows="[
        { label: t('tok.what'), value: `${amount || '0'} ${token.symbol}` },
        { label: t('tok.to'), value: recipient ? shortAddress(recipient.trim(), 8, 8) : '—' },
        ...(memo ? [{ label: t('tok.memo'), value: memo, mono: false }] : []),
      ]"
      :fee="fee"
      :label="t('tok.holdSend')"
      :disabled="!canSubmit"
      testid="token-send-hold-btn"
      @fired="submit"
    />
    <RecipientPicker :open="pickerOpen" :current="recipient" @close="pickerOpen = false" @pick="(a) => (recipient = a)" />
  </ActionSheet>
</template>
