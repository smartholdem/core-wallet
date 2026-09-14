<script setup lang="ts">
/* oxlint-disable no-undef -- defineProps/defineEmits are Vue compiler macros */
import { ref, computed } from "vue";
import { useSettingsStore } from "@/stores/settings";
import { useWalletStore } from "@/stores/wallet";
import { useAuthStore } from "@/stores/auth";
import { useT } from "@/locales";
import { pushToast } from "@/lib/utils";

const props = defineProps<{ open: boolean; current: string }>();
const emit = defineEmits<{ (e: "close"): void; (e: "pick", address: string): void }>();

const settings = useSettingsStore();
const wallet = useWalletStore();
const auth = useAuthStore();
const t = useT();

const tab = ref<"contacts" | "recent">("contacts");
const adding = ref(false);
const newName = ref("");
const newAddress = ref("");
const ADDRESS_RE = /^S[1-9A-HJ-NP-Za-km-z]{33}$/;

const recent = computed(() => {
  const seen = new Set<string>();
  const out: { address: string; when: number }[] = [];
  for (const tx of wallet.transactions) {
    if (tx.sender !== auth.address || !tx.recipient || seen.has(tx.recipient)) continue;
    seen.add(tx.recipient);
    out.push({ address: tx.recipient, when: (tx as any).timestamp ?? 0 });
  }
  return out.slice(0, 10);
});

function nameFor(address: string) {
  return settings.contacts.find((c) => c.address === address)?.name;
}

function short(a: string) {
  return a.length > 14 ? `${a.slice(0, 7)}…${a.slice(-6)}` : a;
}

function pick(address: string) {
  emit("pick", address);
  emit("close");
}

function startAdd(address = "") {
  newName.value = "";
  newAddress.value = address || props.current;
  adding.value = true;
}

function saveContact() {
  const name = newName.value.trim();
  const address = newAddress.value.trim();
  if (!name || !ADDRESS_RE.test(address)) {
    pushToast(t.value("book.invalid"), "error");
    return;
  }
  if (settings.contacts.some((c) => c.address === address)) {
    pushToast(t.value("book.exists"), "error");
    return;
  }
  settings.contacts = [...settings.contacts, { name, address }];
  adding.value = false;
  tab.value = "contacts";
  pushToast(t.value("book.saved"), "success");
}

function remove(address: string) {
  settings.contacts = settings.contacts.filter((c) => c.address !== address);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="props.open" class="fixed inset-0 z-40 flex flex-col justify-end" data-testid="recipient-picker" @click.self="emit('close')">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="emit('close')" />
        <div class="sheet-panel relative bg-gunmetal-800 border-t border-gunmetal-400 rounded-t-2xl px-3 pt-2 pb-3 max-h-[75vh] flex flex-col">
          <div class="w-10 h-1 rounded-full bg-gunmetal-400 mx-auto mb-3" />

          <div class="flex items-center gap-1 mb-3 px-1">
            <button
              v-for="tb in (['contacts', 'recent'] as const)"
              :key="tb"
              @click="tab = tb; adding = false"
              class="flex-1 py-1.5 rounded-md text-[10px] uppercase tracking-[0.18em] font-semibold transition-colors"
              :class="tab === tb ? 'bg-gunmetal-700 text-bone' : 'text-fiatDim hover:text-bone'"
              :data-testid="`picker-tab-${tb}`"
            >{{ t(tb === 'contacts' ? 'book.contacts' : 'book.recent') }}</button>
            <button
              @click="startAdd()"
              class="ml-1 w-8 h-8 grid place-items-center rounded-md border border-gunmetal-400 text-cyan-voltGlow hover:bg-gunmetal-700"
              :aria-label="t('book.add')"
              data-testid="picker-add-btn"
            >+</button>
          </div>

          <form v-if="adding" @submit.prevent="saveContact" class="forge-card p-3 mb-3 flex flex-col gap-2" data-testid="picker-add-form">
            <input v-model="newName" class="forge-input" :placeholder="t('book.name')" maxlength="32" autofocus data-testid="picker-name-input" />
            <input v-model="newAddress" class="forge-input font-mono text-xs" placeholder="S…" spellcheck="false" data-testid="picker-address-input" />
            <div class="flex gap-2">
              <button type="submit" class="flex-1 py-2 rounded-md bg-[#E25822] text-bone text-xs font-semibold" data-testid="picker-save-btn">{{ t('book.save') }}</button>
              <button type="button" @click="adding = false" class="px-3 py-2 rounded-md border border-gunmetal-400 text-fiat text-xs">{{ t('book.cancel') }}</button>
            </div>
          </form>

          <div class="overflow-y-auto flex flex-col gap-1.5 min-h-[120px]">
            <template v-if="tab === 'contacts'">
              <p v-if="!settings.contacts.length" class="text-xs text-fiatDim text-center py-8" data-testid="picker-empty">{{ t('book.emptyContacts') }}</p>
              <div v-for="c in settings.contacts" :key="c.address" class="forge-card p-3 flex items-center gap-2" :data-testid="`picker-contact-${c.address}`">
                <button @click="pick(c.address)" class="flex-1 text-left min-w-0">
                  <p class="text-sm text-bone truncate">{{ c.name }}</p>
                  <p class="text-[11px] text-fiatDim font-mono">{{ short(c.address) }}</p>
                </button>
                <button @click="remove(c.address)" class="text-fiatDim hover:text-rust text-xs px-1" :aria-label="t('book.remove')">✕</button>
              </div>
            </template>
            <template v-else>
              <p v-if="!recent.length" class="text-xs text-fiatDim text-center py-8" data-testid="picker-empty">{{ t('book.emptyRecent') }}</p>
              <div v-for="r in recent" :key="r.address" class="forge-card p-3 flex items-center gap-2" :data-testid="`picker-recent-${r.address}`">
                <button @click="pick(r.address)" class="flex-1 text-left min-w-0">
                  <p class="text-sm text-bone truncate">{{ nameFor(r.address) || short(r.address) }}</p>
                  <p v-if="nameFor(r.address)" class="text-[11px] text-fiatDim font-mono">{{ short(r.address) }}</p>
                </button>
                <button v-if="!nameFor(r.address)" @click="startAdd(r.address)" class="text-[10px] uppercase tracking-[0.15em] text-cyan-voltGlow px-1">{{ t('book.save') }}</button>
              </div>
            </template>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.2s ease; }
.sheet-enter-active .sheet-panel, .sheet-leave-active .sheet-panel { transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .sheet-panel, .sheet-leave-to .sheet-panel { transform: translateY(100%); }
</style>
