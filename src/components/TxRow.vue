<script setup lang="ts">
/* oxlint-disable no-undef -- defineProps/defineEmits/withDefaults are Vue compiler macros */
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { formatSth, shortAddress, timeAgo } from "@/lib/utils";

const props = defineProps<{ tx: any }>();
const auth = useAuthStore();

const isOut = computed(() => props.tx.sender === auth.address);
const counter = computed(() =>
  isOut.value ? props.tx.recipient : props.tx.sender
);
const explorerUrl = computed(
  // Explorer is a hashtag-routed SPA — the path MUST be prefixed with `#/`
  // or the page loads at the index without the tx detail panel.
  () => `https://explorer.smartholdem.io/#/transaction/${props.tx.id}`,
);
const time = computed(() => {
  if (props.tx.timestamp?.unix) return timeAgo(props.tx.timestamp.unix);
  return "";
});
</script>

<template>
  <a
    :href="explorerUrl"
    target="_blank"
    rel="noopener"
    class="block forge-card p-3 hover:border-gunmetal-300 transition-colors group"
    :data-testid="`tx-row-${tx.id}`"
  >
    <div class="flex items-center gap-3">
      <!-- direction badge -->
      <div
        class="w-9 h-9 rounded-md flex items-center justify-center text-base font-bold flex-shrink-0 border"
        :class="
          isOut
            ? 'bg-rust/10 text-rust border-rust/40'
            : 'bg-indigo-forge/10 text-indigo-forgeBright border-indigo-forge/40'
        "
      >
        <span v-if="isOut">↗</span>
        <span v-else>↙</span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs uppercase tracking-wider text-fiatDim font-semibold">
            {{ isOut ? "Sent" : "Received" }}
          </span>
          <span
            class="mono text-sm font-semibold"
            :class="isOut ? 'text-bone' : 'text-indigo-forgeBright'"
          >
            {{ isOut ? "-" : "+" }}{{ formatSth(tx.amount) }}
          </span>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5">
          <span class="mono text-[11px] text-fiat truncate">
            {{ shortAddress(counter) }}
          </span>
          <span class="text-[11px] text-fiatDim">{{ time }}</span>
        </div>
        <div
          v-if="tx.vendorField"
          class="mt-1.5 text-[11px] text-cyan-volt/80 mono truncate"
        >
          ▸ {{ tx.vendorField }}
        </div>
      </div>
    </div>
  </a>
</template>
