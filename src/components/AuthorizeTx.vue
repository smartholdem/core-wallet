<script setup lang="ts">
/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
import { ref, computed } from "vue";
import axios from "axios";
import { useIntentStore } from "@/stores/intent";
import { useAuthStore } from "@/stores/auth";
import { useWalletStore } from "@/stores/wallet";
import { useSettingsStore } from "@/stores/settings";
import { pushToast, formatSth, shortAddress } from "@/lib/utils";
import PinPad from "@/components/PinPad.vue";

const intent = useIntentStore();
const auth = useAuthStore();
const wallet = useWalletStore();
const settings = useSettingsStore();

const pin = ref("");
const pinOpen = ref(false);
const pinError = ref(false);
/** Broadcast progress flag — drives PIN-pad replacement with a spinner. */
const broadcasting = ref(false);

const req = computed(() => intent.pendingSign);
const originHost = computed(() => {
  if (!req.value?.origin) return "unknown dApp";
  try { return new URL(req.value.origin).host; } catch { return req.value.origin; }
});
/**
 * Two modes:
 *   - signTransaction → `broadcast === false` → just sign, return payload.
 *   - sendTransaction → `broadcast === true`  → sign + POST to the active
 *     mainnet node in a single PIN entry.
 * Drives both the header label and the primary CTA copy.
 */
const isBroadcast = computed(() => !!req.value?.broadcast);
const headerLabel = computed(() =>
  isBroadcast.value ? "Authorize · Sign & Broadcast" : "Authorize Transaction",
);
const primaryCtaLabel = computed(() =>
  isBroadcast.value ? "Confirm, Sign & Broadcast" : "Confirm with PIN",
);

function rejectAndDismiss() {
  if (broadcasting.value) return; // ignore close during in-flight broadcast
  pushToast("Transaction rejected", "info");
  if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
    chrome.runtime.sendMessage({
      type: "UI_AUTHORIZE_COMPLETE",
      requestId: req.value?.id,
      approved: false,
      error: "User rejected the transaction.",
    });
  }
  intent.clearSign();
  pinOpen.value = false;
}

function startConfirm() {
  if (auth.isLocked) {
    pushToast("Unlock wallet first", "error");
    return;
  }
  pin.value = "";
  pinError.value = false;
  pinOpen.value = true;
}

function sendUiComplete(approved: boolean, payload: any, error?: string) {
  if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return;
  chrome.runtime.sendMessage({
    type: "UI_AUTHORIZE_COMPLETE",
    requestId: req.value?.id,
    approved,
    payload,
    error,
  });
}

/**
 * Broadcast the freshly-signed transaction to the active mainnet node.
 *
 * Contract: STH node's `POST /api/transactions` validates each array item
 * with an AJV `"type": "object"` schema — passing a hex string here yields
 * `should be object, ... should match some schema in anyOf`. We therefore
 * send the full toJson()-shaped object, identical to how `wallet.sendTransfer`
 * has always broadcast and which the network has been accepting since v1.0.
 *
 * `signRawTransaction` also returns the canonical `serialized` hex for any
 * dApp that wants to broadcast through a different transport — we just don't
 * use it here because the node's HTTP API expects JSON.
 */
async function broadcastSerialized(result: {
  tx: any;
  data: any;
  serialized: string;
}) {
  // `settings.activeNode` is a bare hostname (e.g. "node0.smartholdem.io").
  // Normalise to a fully-qualified HTTPS URL.
  const host = settings.activeNode || "node.smartholdem.io";
  const base = /^https?:\/\//i.test(host) ? host : `https://${host}`;
  const url = base.replace(/\/+$/, "") + "/api/transactions";

  // `result.tx` is the toJson() output: a plain JSON-serialisable object with
  // `{ id, type, network, senderPublicKey, fee, amount, recipientId,
  //    nonce, signature, ... }` — exactly the shape the node's schema accepts.
  const txObject = result.tx;

  const res = await axios.post(
    url,
    { transactions: [txObject] },
    { headers: { "Content-Type": "application/json" }, timeout: 15000 },
  );
  return res.data?.data ?? res.data;
}

async function onPinComplete(v: string) {
  if (!auth.verify(v)) {
    pinError.value = true;
    setTimeout(() => { pin.value = ""; pinError.value = false; }, 600);
    pushToast("Wrong PIN", "error");
    return;
  }
  if (!req.value) return;

  // ── 1. Sign (always) ────────────────────────────────────────────────
  let result;
  try {
    result = wallet.signRawTransaction({
      recipient: req.value.payload.recipient ?? "",
      amount: req.value.payload.amount ?? 0,
      vendorField: req.value.payload.vendorField,
      fee: req.value.payload.fee,
    });
  } catch (e: any) {
    pushToast(e?.message || "Sign failed", "error");
    sendUiComplete(false, null, e?.message || "Sign failed");
    intent.clearSign();
    pinOpen.value = false;
    return;
  }

  // ── 2a. signTransaction path — return signed payload, done. ─────────
  if (!isBroadcast.value) {
    pushToast("Transaction authorized", "success");
    sendUiComplete(true, {
      id: result.id,
      signature: result.signature,
      senderPublicKey: result.senderPublicKey,
      tx: result.tx,
      serialized: result.serialized,
      data: result.data,
    });
    intent.clearSign();
    pinOpen.value = false;
    return;
  }

  // ── 2b. sendTransaction path — sign + broadcast in one click. ───────
  broadcasting.value = true;
  try {
    const nodeResponse = await broadcastSerialized(result);

    // Surface a concise toast based on the node's verdict.
    const accepted = Array.isArray(nodeResponse?.accept) && nodeResponse.accept.length > 0;
    const invalid = Array.isArray(nodeResponse?.invalid) && nodeResponse.invalid.length > 0;
    if (accepted) {
      pushToast(`Broadcast OK · ${shortAddress(result.id, 6, 6)}`, "success");
    } else if (invalid) {
      pushToast("Node rejected transaction", "error");
    } else {
      pushToast("Broadcast accepted", "success");
    }

    sendUiComplete(true, {
      id: result.id,
      signature: result.signature,
      senderPublicKey: result.senderPublicKey,
      tx: result.tx,
      serialized: result.serialized,
      data: result.data,
      // Full node response — `{ accept[], broadcast[], excess[], invalid[], errors{} }`
      broadcast: nodeResponse,
    });
  } catch (e: any) {
    const errMsg =
      e?.response?.data?.message ||
      e?.message ||
      "Broadcast failed";
    pushToast(errMsg, "error");
    // The transaction WAS signed — return it alongside the broadcast error
    // so the dApp can retry broadcasting later without re-prompting PIN.
    sendUiComplete(false, {
      id: result.id,
      signature: result.signature,
      senderPublicKey: result.senderPublicKey,
      tx: result.tx,
      serialized: result.serialized,
      data: result.data,
    }, errMsg);
  } finally {
    broadcasting.value = false;
    intent.clearSign();
    pinOpen.value = false;
  }
}
</script>

<template>
  <div
    v-if="req"
    class="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end p-3"
    data-testid="authorize-tx-modal"
    :data-broadcast-mode="isBroadcast ? 'true' : 'false'"
  >
    <div class="forge-card w-full p-4 border-indigo-forge/40">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-voltGlow animate-pulse-glow" />
          <span class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow font-semibold">
            {{ headerLabel }}
          </span>
        </div>
        <button
          @click="rejectAndDismiss"
          class="text-fiatDim hover:text-rust text-xs disabled:opacity-40"
          :disabled="broadcasting"
          data-testid="authorize-tx-reject"
        >
          ✕
        </button>
      </div>

      <p class="text-[11px] text-fiatDim mb-3">
        <span class="mono text-fiat">{{ originHost }}</span>
        is requesting your signature.
      </p>

      <div class="forge-card p-2.5 flex flex-col gap-1.5 text-[12px]">
        <div class="flex items-center justify-between">
          <span class="text-fiatDim uppercase tracking-[0.18em] text-[10px]">Recipient</span>
          <span class="mono text-fiat text-[11px]" data-testid="authorize-tx-recipient">
            {{ shortAddress(req.payload.recipient ?? "", 8, 8) }}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-fiatDim uppercase tracking-[0.18em] text-[10px]">Amount</span>
          <span class="mono text-indigo-forgeBright font-semibold" data-testid="authorize-tx-amount">
            {{ formatSth(Number(req.payload.amount) || 0, 4) }} STH
          </span>
        </div>
        <div v-if="req.payload.vendorField" class="flex items-center justify-between">
          <span class="text-fiatDim uppercase tracking-[0.18em] text-[10px]">Memo</span>
          <span class="mono text-fiat text-[11px] truncate max-w-[60%] text-right">
            {{ req.payload.vendorField }}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-fiatDim uppercase tracking-[0.18em] text-[10px]">Fee</span>
          <span class="mono text-rust font-semibold">
            {{ Number(req.payload.fee ?? 0.25).toFixed(2) }} STH
          </span>
        </div>
        <div
          v-if="isBroadcast"
          class="flex items-center justify-between pt-1 mt-1 border-t border-gunmetal-400"
          data-testid="authorize-tx-broadcast-target"
        >
          <span class="text-fiatDim uppercase tracking-[0.18em] text-[10px]">Broadcast to</span>
          <span class="mono text-cyan-voltGlow text-[10px]">
            {{ (settings.activeNode || 'node.smartholdem.io').replace(/^https?:\/\//, '') }}
          </span>
        </div>
      </div>

      <div v-if="!pinOpen" class="flex gap-2 mt-3">
        <button @click="rejectAndDismiss" class="forge-btn flex-1 h-11" data-testid="authorize-tx-reject-btn">
          Reject
        </button>
        <button
          @click="startConfirm"
          class="forge-btn-primary flex-1 h-11"
          data-testid="authorize-tx-confirm-btn"
        >
          {{ primaryCtaLabel }}
        </button>
      </div>

      <div v-else class="mt-3">
        <div
          v-if="broadcasting"
          class="flex flex-col items-center gap-2 py-4"
          data-testid="authorize-tx-broadcasting"
        >
          <span class="inline-block w-6 h-6 border-2 border-cyan-voltGlow border-t-transparent rounded-full animate-spin" />
          <p class="text-[11px] text-fiatDim uppercase tracking-[0.18em]">
            broadcasting to mainnet…
          </p>
        </div>
        <template v-else>
          <p class="text-[11px] text-fiatDim mb-2">
            {{ isBroadcast ? "Enter your PIN to sign & broadcast." : "Enter your PIN to sign." }}
          </p>
          <PinPad v-model="pin" :length="6" :error="pinError" @complete="onPinComplete" />
        </template>
      </div>
    </div>
  </div>
</template>

