<script setup lang="ts">
/* oxlint-disable no-undef -- Vue compiler macros */
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useSettingsStore } from "@/stores/settings";
import { explorerTxUrl } from "@/lib/network";
import { shortAddress, timeAgo } from "@/lib/utils";
import { tokenAmount } from "@/lib/tokenUi";
import { TOKEN } from "@/lib/tokenTx";
import { useT } from "@/locales";

const props = defineProps<{ txs: any[]; decimals: number; symbol: string; pending?: { kind: string; txId: string }[] }>();
const t = useT();
const auth = useAuthStore();
const settings = useSettingsStore();

const KIND: Record<number, string> = { [TOKEN.INIT]: "tok.opInit", [TOKEN.TRANSFER]: "tok.opTransfer", [TOKEN.MINT]: "tok.opMint", [TOKEN.BURN]: "tok.opBurn", [TOKEN.META]: "tok.opMeta", [TOKEN.SELL]: "tok.opSell", [TOKEN.SELL_V2]: "tok.opSell", [TOKEN.BUY]: "tok.opBuy", [TOKEN.CANCEL]: "tok.opCancel" };

const rows = computed(() =>
  props.txs.map((tx) => {
    const a = tx.asset?.token ?? {};
    const me = auth.address;
    let amount = 0n;
    let dir: "in" | "out" | "none" = "none";
    if (tx.type === TOKEN.TRANSFER) {
      const mine = (a.transfers ?? []).filter((x: any) => x.recipientId === me);
      if (tx.sender === me) { amount = (a.transfers ?? []).reduce((s: bigint, x: any) => s + BigInt(x.amount), 0n); dir = "out"; }
      else { amount = mine.reduce((s: bigint, x: any) => s + BigInt(x.amount), 0n); dir = "in"; }
    } else if (tx.type === TOKEN.MINT) { amount = BigInt(a.amount ?? 0); dir = a.recipientId === me ? "in" : "none"; }
    else if (tx.type === TOKEN.BURN) { amount = BigInt(a.amount ?? 0); dir = "out"; }
    else if (tx.type === TOKEN.BUY) { amount = BigInt(a.amount ?? 0); dir = tx.sender === me ? "in" : "out"; }
    else if (tx.type === TOKEN.INIT) { amount = BigInt(a.initialSupply ?? 0); dir = "in"; }
    const n = a.transfers?.length ?? 0;
    const peer = tx.type === TOKEN.TRANSFER ? (tx.sender === me ? (n > 1 ? `×${n}` : a.transfers?.[0]?.recipientId) : tx.sender) : tx.type === TOKEN.MINT ? a.recipientId : "";
    return { id: tx.id, kind: t.value(KIND[tx.type] ?? "tok.opOther"), amount, dir, peer, memo: a.memo ?? "", ts: tx.timestamp?.unix ?? 0, confirmed: tx.confirmations != null };
  }),
);
</script>

<template>
  <div class="flex flex-col gap-1.5" data-testid="token-tx-list">
    <div v-for="p in pending ?? []" :key="p.txId" class="forge-card p-2.5 flex items-center justify-between text-xs border-dashed" data-testid="token-tx-pending">
      <span class="text-fiat">{{ t(`tok.op${p.kind[0].toUpperCase()}${p.kind.slice(1)}`) }}</span>
      <span class="text-[10px] uppercase tracking-[0.15em] text-cyan-voltGlow animate-pulse">{{ t("tok.inQueue") }}</span>
    </div>
    <a
      v-for="r in rows"
      :key="r.id"
      :href="explorerTxUrl(settings.activeNetwork.explorer, r.id)"
      target="_blank"
      rel="noopener"
      class="forge-card p-2.5 flex items-center justify-between gap-2 text-xs hover:border-gunmetal-300 transition-colors"
      data-testid="token-tx-row"
    >
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-bone">{{ r.kind }}</span>
          <span v-if="r.peer" class="mono text-[10px] text-fiatDim truncate">{{ r.peer.startsWith("×") ? r.peer : shortAddress(r.peer, 5, 5) }}</span>
        </div>
        <div class="text-[10px] text-fiatDim mt-0.5 truncate">{{ r.memo ? `“${r.memo}” · ` : "" }}{{ r.ts ? timeAgo(r.ts) : "" }}</div>
      </div>
      <span v-if="r.dir !== 'none'" class="mono font-semibold shrink-0" :class="r.dir === 'in' ? 'text-indigo-forgeBright' : 'text-rust'">
        {{ r.dir === "in" ? "+" : "−" }}{{ tokenAmount(r.amount.toString(), decimals) }} {{ symbol }}
      </span>
    </a>
    <p v-if="!rows.length && !(pending?.length)" class="text-[11px] text-fiatDim text-center py-3" data-testid="token-tx-empty">{{ t("tok.noOps") }}</p>
  </div>
</template>
