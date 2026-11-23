<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed } from "vue";
import HoldButton from "@/components/HoldButton.vue";
import { useWalletStore } from "@/stores/wallet";
import { useSettingsStore } from "@/stores/settings";
import { sth } from "@/lib/tokenUi";
import { useT } from "@/locales";

const props = withDefaults(
  defineProps<{
    rows: { label: string; value: string; mono?: boolean }[];
    /** fee in smartoshi */
    fee: string | bigint;
    /** extra STH (smartoshi) leaving the wallet besides the fee, e.g. a market buy */
    spend?: string | bigint;
    label: string;
    disabled?: boolean;
    variant?: "indigo" | "rust";
    warning?: string;
    testid?: string;
  }>(),
  { variant: "indigo" },
);
const emit = defineEmits<{ (e: "fired"): void }>();
const t = useT();
const wallet = useWalletStore();
const settings = useSettingsStore();

const balanceUnits = computed(() => BigInt(Math.round(wallet.activeBalance * 1e8)));
const feeUnits = computed(() => BigInt(props.fee));
const after = computed(() => balanceUnits.value - feeUnits.value - BigInt(props.spend ?? 0));
const enough = computed(() => after.value >= 0n);
</script>

<template>
  <div class="forge-card p-3 flex flex-col gap-1.5 text-xs" data-testid="op-summary">
    <div v-for="r in rows" :key="r.label" class="flex items-start justify-between gap-3">
      <span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim shrink-0">{{ r.label }}</span>
      <span class="text-bone text-right break-all" :class="r.mono !== false ? 'mono' : ''">{{ r.value }}</span>
    </div>
    <div class="border-t border-gunmetal-400 my-1" />
    <div class="flex items-center justify-between">
      <span class="text-[10px] uppercase tracking-[0.15em] text-rust font-semibold">{{ t("tok.fee") }}</span>
      <span class="mono text-rust font-semibold" data-testid="op-fee">{{ sth(fee) }} {{ settings.token }}</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-[10px] uppercase tracking-[0.15em] text-fiatDim">{{ t("tok.afterFee") }}</span>
      <span class="mono" :class="enough ? 'text-fiat' : 'text-rust'" data-testid="op-after">{{ sth(after < 0n ? 0n : after) }} {{ settings.token }}</span>
    </div>
    <p v-if="!enough" class="text-[11px] text-rust" data-testid="op-insufficient">{{ t("tok.errInsufficientSth") }}</p>
    <p v-if="warning" class="text-[11px] text-rust/90 leading-relaxed" data-testid="op-warning">{{ warning }}</p>
  </div>
  <HoldButton :label="label" :variant="variant" :disabled="disabled || !enough" :testid="testid ?? 'op-hold-btn'" @fired="emit('fired')" />
</template>
