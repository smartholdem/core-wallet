<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore, STH_FEE } from "@/stores/wallet";
import { pushToast, formatSth } from "@/lib/utils";
import HoldButton from "@/components/HoldButton.vue";
import BottomDock from "@/components/BottomDock.vue";
import { canScanQr, scanQr, parsePaymentQr } from "@/lib/qr";
import { useT } from "@/locales";

const router = useRouter();
const auth = useAuthStore();
const wallet = useWalletStore();
const t = useT();

const recipient = ref("");
const amount = ref("");
const memo = ref("");
const canScan = canScanQr();
const scanning = ref(false);

async function scan() {
  scanning.value = true;
  try {
    const raw = await scanQr(t.value("send.scanHint"));
    if (raw == null) return;
    const parsed = parsePaymentQr(raw);
    if (!parsed) {
      pushToast(t.value("send.scanInvalid"), "error");
      return;
    }
    recipient.value = parsed.address;
    if (parsed.amount) amount.value = parsed.amount;
    if (parsed.memo) memo.value = parsed.memo;
    pushToast(t.value("send.scanOk"), "success");
  } catch (e: any) {
    pushToast(e?.message || t.value("send.scanFailed"), "error");
  } finally {
    scanning.value = false;
  }
}
const sending = ref(false);
const lastTxId = ref<string | null>(null);

const amountNum = computed(() => parseFloat(amount.value || "0") || 0);
const totalDebit = computed(() => amountNum.value + STH_FEE);
const overdraft = computed(() => totalDebit.value > wallet.activeBalance);

const recipientValid = computed(() => {
  if (!recipient.value) return null;
  return wallet.validateAddress(recipient.value.trim());
});

const canSubmit = computed(
  () =>
    !sending.value &&
    amountNum.value > 0 &&
    recipientValid.value === true &&
    !overdraft.value
);

async function submit() {
  if (!canSubmit.value) {
    if (recipientValid.value === false) pushToast("Invalid STH address", "error");
    else if (overdraft.value) pushToast("Insufficient balance", "error");
    else if (amountNum.value <= 0) pushToast("Enter amount", "error");
    return;
  }
  sending.value = true;
  try {
    const r = await wallet.sendTransfer({
      recipient: recipient.value.trim(),
      amount: amountNum.value,
      memo: memo.value.trim() || undefined,
    });
    lastTxId.value = r.tx?.id ?? null;
    pushToast("Transaction broadcast", "success");
    // refresh
    await wallet.fetchBalance(auth.address);
    setTimeout(() => router.replace("/dashboard"), 900);
  } catch (e: any) {
    pushToast(e?.message || "Broadcast failed", "error");
  } finally {
    sending.value = false;
  }
}

function setMax() {
  const v = Math.max(0, wallet.activeBalance - STH_FEE);
  amount.value = v.toFixed(4);
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0" data-testid="transfer-view">
    <!-- header -->
    <header
      class="flex items-center justify-between px-4 py-3 border-b border-gunmetal-400 bg-gunmetal-800"
    >
      <button
        @click="router.back()"
        class="text-[11px] uppercase tracking-[0.18em] text-gunmetal-300 hover:text-bone"
        data-testid="back-btn"
      >
        ← Back
      </button>
      <span class="text-[10px] uppercase tracking-[0.3em] text-bone font-semibold">
        Cipher · Transfer
      </span>
      <span class="text-[10px] mono text-gunmetal-300">{{ formatSth(wallet.activeBalance, 2) }} STH</span>
    </header>

    <div class="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
      <!-- Recipient -->
      <div>
        <div class="flex items-center justify-between">
          <label class="forge-label">Recipient STH Address</label>
          <button
            v-if="canScan"
            type="button"
            @click="scan"
            :disabled="scanning"
            class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-bone disabled:opacity-40 flex items-center gap-1 mb-1.5"
            data-testid="scan-qr-btn"
          >
            <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
            </svg>
            {{ t("send.scan") }}
          </button>
        </div>
        <input
          v-model="recipient"
          spellcheck="false"
          autocomplete="off"
          class="forge-input"
          :class="{
            'border-rust focus:border-rust focus:shadow-glowRust':
              recipientValid === false,
          }"
          placeholder="S…"
          data-testid="recipient-input"
        />
        <p
          v-if="recipientValid === false"
          class="text-[11px] text-rust mt-1.5"
          data-testid="recipient-error"
        >
          Address checksum invalid.
        </p>
        <p
          v-else-if="recipientValid === true"
          class="text-[11px] text-cyan-voltGlow mt-1.5"
        >
          ✓ Valid SmartHoldem address.
        </p>
      </div>

      <!-- Amount -->
      <div>
        <div class="flex items-center justify-between mb-1.5">
          <label class="forge-label !mb-0">Amount (STH)</label>
          <button
            @click="setMax"
            class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow hover:text-cyan-volt"
            data-testid="max-btn"
          >
            MAX
          </button>
        </div>
        <input
          v-model="amount"
          type="number"
          inputmode="decimal"
          step="0.0001"
          min="0"
          class="forge-input"
          placeholder="0.0000"
          data-testid="amount-input"
        />
      </div>

      <!-- Memo -->
      <div>
        <label class="forge-label">Vendor Field / MEMO</label>
        <input
          v-model="memo"
          maxlength="64"
          class="forge-input"
          placeholder="Optional required for deposits…"
          data-testid="memo-input"
        />
        <p class="text-[10px] text-gunmetal-300 mt-1">
          Used for routing to dapps, exchanges &amp; services. {{ memo.length }}/64
        </p>
      </div>

      <!-- Fee box -->
      <div
        class="forge-card p-3 flex items-center justify-between text-xs"
        data-testid="fee-box"
      >
        <span class="text-rust uppercase tracking-[0.18em] text-[10px] font-semibold">
          Network Fee
        </span>
        <span class="mono text-rust font-semibold">{{ STH_FEE.toFixed(2) }} STH</span>
      </div>

      <!-- Total -->
      <div class="flex items-center justify-between text-xs">
        <span class="uppercase tracking-[0.18em] text-[10px] font-semibold">
          Total debit
        </span>
        <span
          class="mono font-semibold"
          :class="overdraft ? 'text-rust' : 'text-bone'"
        >
          {{ formatSth(totalDebit, 4) }} STH
        </span>
      </div>

      <div class="flex-1" />

      <HoldButton
        label="Hold to Transfer"
        variant="indigo"
        :disabled="!canSubmit"
        testid="send-hold-btn"
        @fired="submit"
      />
    </div>

    <BottomDock />
  </div>
</template>
