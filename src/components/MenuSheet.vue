<script setup lang="ts">
/* oxlint-disable no-undef -- __APP_VERSION__ is a Vite compile-time define; defineProps/defineEmits are Vue macros */
import { useRouter, useRoute } from "vue-router";
import { useT } from "@/locales";
import { useAuthStore } from "@/stores/auth";
import { isNativeApp } from "@/lib/runtime";

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const router = useRouter();
const route = useRoute();
const t = useT();
const auth = useAuthStore();
const appVersion = __APP_VERSION__;

interface MenuItem {
  id: string;
  labelKey: string;
  hintKey?: string;
  path?: string;
  action?: () => void;
  danger?: boolean;
  native?: boolean;
}

// Future: delegate registration, voting, crypto signatures — add rows here.
const items: MenuItem[] = [
  { id: "settings", labelKey: "menu.settings", hintKey: "menu.settingsHint", path: "/settings" },
  { id: "access", labelKey: "menu.access", hintKey: "menu.accessHint", path: "/connected-sites" },
  { id: "dapps", labelKey: "menu.dapps", hintKey: "menu.dappsHint", path: "/dapps", native: true },
  {
    id: "lock",
    labelKey: "menu.lock",
    action: () => {
      auth.lock();
      router.replace("/lock");
    },
    danger: true,
  },
];
const visible = items.filter((i) => !i.native || isNativeApp());

function pick(it: MenuItem) {
  emit("close");
  if (it.action) it.action();
  else if (it.path) router.push(it.path);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="props.open"
        class="fixed inset-0 z-40 flex flex-col justify-end"
        data-testid="menu-sheet"
        @click.self="emit('close')"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm sheet-backdrop" @click="emit('close')" />
        <div
          class="sheet-panel relative bg-gunmetal-800 border-t border-gunmetal-400 rounded-t-2xl px-3 pt-2 pb-3 shadow-[0_-12px_40px_rgba(0,0,0,0.6)]"
          role="dialog"
          aria-modal="true"
        >
          <div class="w-10 h-1 rounded-full bg-gunmetal-400 mx-auto mb-3" />
          <div class="flex items-center justify-between px-2 mb-2">
            <span class="text-[10px] uppercase tracking-[0.3em] text-fiatDim">{{ t("menu.title") }}</span>
            <span class="text-[10px] font-mono text-cyan-voltGlow" data-testid="menu-version">v{{ appVersion }}</span>
          </div>

          <div class="flex flex-col gap-1">
            <button
              v-for="it in visible"
              :key="it.id"
              @click="pick(it)"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
              :class="[
                it.danger ? 'text-rust hover:bg-rust/10' : 'text-bone hover:bg-gunmetal-700',
                it.path && route.path.startsWith(it.path) ? 'bg-gunmetal-700/70' : '',
              ]"
              :data-testid="`menu-${it.id}`"
            >
              <span
                class="w-9 h-9 rounded-lg grid place-items-center shrink-0 border"
                :class="it.danger ? 'border-rust/40 bg-rust/10' : 'border-gunmetal-400 bg-gunmetal-700'"
              >
                <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8">
                  <template v-if="it.id === 'settings'">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
                  </template>
                  <template v-else-if="it.id === 'access'">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4M12 15v2" />
                  </template>
                  <template v-else-if="it.id === 'dapps'">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                  </template>
                  <template v-else>
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
                  </template>
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-semibold">{{ t(it.labelKey) }}</span>
                <span v-if="it.hintKey" class="block text-[11px] text-fiatDim truncate">{{ t(it.hintKey) }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.26s cubic-bezier(0.32, 0.72, 0, 1);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
