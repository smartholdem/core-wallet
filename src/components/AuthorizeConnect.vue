<script setup lang="ts">
import { completeAuthorize } from "@/lib/dappBus";
import { addAuthorizedOrigin } from "@/lib/origins";
/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
/**
 * AuthorizeConnect — modal shown when a dApp invokes
 * `window.smartholdem.getAccount()` (a.k.a. sth_requestAccounts) and its
 * origin is NOT already in `chrome.storage.local.authorizedOrigins`.
 *
 * Layout mirrors AuthorizeTx so the visual language stays consistent.
 *
 * Approve flow:
 *   1. Optionally tick "Trust this site" → origin is persisted to the
 *      whitelist; future getAccount calls from the same origin resolve
 *      silently in the background without re-prompting the user.
 *   2. Send `UI_AUTHORIZE_COMPLETE` with the active wallet address as
 *      payload. background.ts looks the request up by `requestId` and
 *      forwards `{ address }` to the dApp through the still-open
 *      sendResponse channel.
 *
 * Reject flow:
 *   `UI_AUTHORIZE_COMPLETE { approved: false, error }` — the dApp's
 *   Promise rejects with `Error("User rejected the connection.")`.
 */
import { computed, ref } from "vue";
import { useIntentStore } from "@/stores/intent";
import { useAuthStore } from "@/stores/auth";
import { pushToast, shortAddress } from "@/lib/utils";

const intent = useIntentStore();
const auth = useAuthStore();

const trustSite = ref(true);
const req = computed(() => intent.pendingConnect);

const originHost = computed(() => {
  if (!req.value?.origin) return "unknown dApp";
  try {
    return new URL(req.value.origin).host;
  } catch {
    return req.value.origin;
  }
});

function sendUiComplete(approved: boolean, payload: any, error?: string) {
  void completeAuthorize(req.value?.id, approved, payload, error);
}

async function persistTrustedOrigin(origin: string) {
  await addAuthorizedOrigin(origin);
}

async function approve() {
  if (!req.value || !auth.address) {
    pushToast("Unlock wallet to connect", "error");
    return;
  }
  if (trustSite.value && req.value.origin) {
    await persistTrustedOrigin(req.value.origin);
  }
  sendUiComplete(true, { address: auth.address });
  pushToast(`Connected to ${originHost.value}`, "success");
  intent.clearConnect();
}

function reject() {
  sendUiComplete(false, null, "User rejected the connection.");
  pushToast("Connection denied", "info");
  intent.clearConnect();
}
</script>

<template>
  <div
    v-if="req"
    class="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end p-3"
    data-testid="authorize-connect-modal"
  >
    <div class="forge-card w-full p-4 border-cyan-volt/40">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-cyan-voltGlow animate-pulse-glow"
          />
          <span
            class="text-[10px] uppercase tracking-[0.18em] text-cyan-voltGlow font-semibold"
          >
            Connection Request
          </span>
        </div>
        <button
          @click="reject"
          class="text-fiatDim hover:text-rust text-xs"
          data-testid="authorize-connect-close"
        >
          ✕
        </button>
      </div>

      <p class="text-[11px] text-fiatDim mb-3">
        <span class="mono text-fiat">{{ originHost }}</span>
        wants to view your SmartHoldem address.
      </p>

      <div
        class="forge-card p-2.5 flex flex-col gap-1.5 text-[12px]"
        data-testid="authorize-connect-summary"
      >
        <div class="flex items-center justify-between">
          <span
            class="text-fiatDim uppercase tracking-[0.18em] text-[10px]"
          >Account</span>
          <span
            class="mono text-fiat text-[11px]"
            data-testid="authorize-connect-address"
          >
            {{ shortAddress(auth.address || "", 8, 8) }}
          </span>
        </div>
        <div class="flex items-center justify-between">
          <span
            class="text-fiatDim uppercase tracking-[0.18em] text-[10px]"
          >Permissions</span>
          <span class="text-fiat text-[11px]">View address only</span>
        </div>
      </div>

      <label
        class="flex items-center gap-2 mt-3 text-[11px] text-fiat cursor-pointer select-none"
        data-testid="authorize-connect-trust-label"
      >
        <input
          type="checkbox"
          v-model="trustSite"
          class="accent-cyan-volt w-3.5 h-3.5"
          data-testid="authorize-connect-trust-checkbox"
        />
        Trust this site — skip prompt next time
      </label>

      <div class="flex gap-2 mt-3">
        <button
          @click="reject"
          class="forge-btn flex-1 h-11"
          data-testid="authorize-connect-reject-btn"
        >
          Reject
        </button>
        <button
          @click="approve"
          class="forge-btn-cyan flex-1 h-11"
          data-testid="authorize-connect-approve-btn"
        >
          Connect
        </button>
      </div>
    </div>
  </div>
</template>
