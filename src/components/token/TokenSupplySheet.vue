<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed, ref, watch } from "vue";
import ActionSheet from "./ActionSheet.vue";
import OpSummary from "./OpSummary.vue";
import RecipientPicker from "@/components/RecipientPicker.vue";
import { useTokensStore, type TokenDetail } from "@/stores/tokens";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { useTokenOp, tokenAmount } from "@/lib/tokenUi";
import { toUnits } from "@/lib/tokenTx";
import { shortAddress } from "@/lib/utils";
import { useT } from "@/locales";

const props = defineProps<{ open: boolean; mode: "mint" | "burn"; token: TokenDetail; balance: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "done", txId: string): void }>();
const t = useT();
const tokens = useTokensStore();
const wallet = useWalletStore();
const auth = useAuthStore();
const { busy, run } = useTokenOp();

const amount = ref("");
const recipient = ref("");
const pickerOpen = ref(false);
watch(() => props.open, (o) => { if (o) { amount.value = ""; recipient.value = auth.address; } });

const units = computed(() => { try { return toUnits(amount.value, props.token.decimals); } catch { return null; } });
const headroom = computed(() => BigInt(props.token.supplyCap) - BigInt(props.token.supply));
const limit = computed(() => (props.mode === "mint" ? headroom.value : BigInt(props.balance)));
const over = computed(() => units.value != null && units.value > limit.value);
const recipientValid = computed(() => (recipient.value ? wallet.validateAddress(recipient.value.trim()) : null));
const fee = computed(() => (props.mode === "mint" ? tokens.fees!.mint : tokens.fees!.burn));
const canSubmit = computed(() => !busy.value && units.value != null && units.value > 0n && !over.value && (props.mode === "burn" || recipientValid.value === true));

function setMax() { amount.value = tokenAmount(limit.value.toString(), props.token.decimals, props.token.decimals).replace(/\s|,/g, ""); }

async function submit() {
  const tx = await run(() =>
    props.mode === "mint"
      ? tokens.mint({ id: props.token.id, recipient: recipient.value.trim(), amount: units.value! })
      : tokens.burn({ id: props.token.id, amount: units.value! }),
  );
  if (tx) emit("done", tx.id!);
}
</script>

<template>
  <ActionSheet :open="open" :title="`${t(mode === 'mint' ? 'tok.mint' : 'tok.burn')} ${token.symbol}`" :testid="`token-${mode}-sheet`" @close="emit('close')">
    <p class="text-[11px] text-fiatDim leading-relaxed">{{ t(mode === 'mint' ? 'tok.mintHint' : 'tok.burnHint') }}</p>
    <div v-if="mode === 'mint'">
      <div class="flex items-center justify-between mb-1.5">
        <label class="forge-label !mb-0">{{ t("tok.recipient") }}</label>
        <button type="button" @click="pickerOpen = true" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-bone" data-testid="mint-pick-recipient-btn">{{ t("book.pick") }}</button>
      </div>
      <input v-model="recipient" class="forge-input mono text-xs" spellcheck="false" data-testid="mint-recipient-input" />
      <p v-if="recipientValid === false" class="text-[10px] text-rust mt-1">{{ t("tok.badAddress") }}</p>
    </div>
    <div>
      <div class="flex items-center justify-between mb-1.5">
        <label class="forge-label !mb-0">{{ t("tok.amount") }} ({{ token.symbol }})</label>
        <button @click="setMax" class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt" :data-testid="`${mode}-max-btn`">MAX</button>
      </div>
      <input v-model="amount" type="text" inputmode="decimal" class="forge-input mono" placeholder="0" :data-testid="`${mode}-amount-input`" />
      <p class="text-[10px] text-fiatDim mt-1">
        {{ t(mode === 'mint' ? 'tok.headroom' : 'tok.available') }}: <span class="mono">{{ tokenAmount(limit.toString(), token.decimals) }}</span>
      </p>
      <p v-if="over" class="text-[10px] text-rust mt-1" :data-testid="`${mode}-over`">{{ t(mode === 'mint' ? 'tok.errMintCap' : 'tok.errInsufficientTokens') }}</p>
    </div>
    <OpSummary
      :rows="[
        { label: t('tok.what'), value: `${mode === 'mint' ? '+' : '−'}${amount || '0'} ${token.symbol}` },
        ...(mode === 'mint' ? [{ label: t('tok.to'), value: recipient ? shortAddress(recipient.trim(), 8, 8) : '—' }] : []),
        { label: t('tok.supplyAfter'), value: tokenAmount((BigInt(token.supply) + (mode === 'mint' ? 1n : -1n) * (units ?? 0n)).toString(), token.decimals) },
      ]"
      :fee="fee"
      :label="t(mode === 'mint' ? 'tok.holdMint' : 'tok.holdBurn')"
      :variant="mode === 'burn' ? 'rust' : 'indigo'"
      :warning="mode === 'burn' ? t('tok.burnWarn').replace('{n}', `${amount || '0'} ${token.symbol}`) : undefined"
      :disabled="!canSubmit"
      :testid="`${mode}-hold-btn`"
      @fired="submit"
    />
    <RecipientPicker v-if="mode === 'mint'" :open="pickerOpen" :current="recipient" @close="pickerOpen = false" @pick="(a) => (recipient = a)" />
  </ActionSheet>
</template>
