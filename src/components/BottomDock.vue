<script setup lang="ts">
import { useRouter, useRoute } from "vue-router";
import { computed } from "vue";
import { useT } from "@/locales";
import { isNativeApp } from "@/lib/runtime";

const router = useRouter();
const route = useRoute();
const t = useT();

interface DockItem {
  path: string;
  /** Translation key — looked up at render time so the label reacts to locale changes. */
  labelKey: string;
  icon: "vault" | "ledger" | "dapps" | "core";
  /** All sub-routes that should keep this item highlighted. */
  matches: (p: string) => boolean;
}

// VAULT: dashboard + every wallet sub-flow (Send / Receive / Swap)
// LEDGER: history
// CORE: settings tree
const items: DockItem[] = [
  {
    path: "/dashboard",
    labelKey: "nav.vault",
    icon: "vault",
    matches: (p) =>
      p.startsWith("/dashboard") ||
      p.startsWith("/send") ||
      p.startsWith("/receive") ||
      p.startsWith("/swap"),
  },
  { path: "/history", labelKey: "nav.ledger", icon: "ledger", matches: (p) => p.startsWith("/history") },
  // dApp browser exists only inside the native app (no extension bridge there)
  ...(isNativeApp()
    ? [{ path: "/dapps", labelKey: "nav.dapps", icon: "dapps" as const, matches: (p: string) => p.startsWith("/dapps") }]
    : []),
  { path: "/settings", labelKey: "nav.core", icon: "core", matches: (p) => p.startsWith("/settings") },
];

const active = computed(() => route.path);

function go(it: DockItem) {
  // VAULT taps from any sub-flow clear the flow and snap to /dashboard.
  router.push(it.path);
}
</script>

<template>
  <nav
    class="flex items-stretch border-t border-gunmetal-400 bg-gunmetal-800"
    data-testid="bottom-dock"
  >
    <button
      v-for="it in items"
      :key="it.path"
      @click="go(it)"
      :data-testid="`nav-${it.icon}`"
      class="flex-1 flex flex-col items-center justify-center py-2.5 gap-1
             border-r last:border-r-0 border-gunmetal-400
             transition-colors relative"
      :class="it.matches(active)
        ? 'text-indigo-forgeBright bg-gunmetal-700'
        : 'text-fiatDim hover:text-bone hover:bg-gunmetal-700/60'"
    >
      <span
        v-if="it.matches(active)"
        class="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-px bg-indigo-forge"
      />
      <svg
        v-if="it.icon === 'vault'"
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <rect x="3" y="5" width="18" height="14" rx="1.5" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 9v-2M12 17v-2M9 12h-2M17 12h-2" />
      </svg>
      <svg
        v-else-if="it.icon === 'ledger'"
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <path d="M4 5h16v14H4z" />
        <path d="M8 9h8M8 13h8M8 17h5" />
      </svg>
      <svg
        v-else-if="it.icon === 'dapps'"
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <svg
        v-else
        viewBox="0 0 24 24"
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      >
        <circle cx="12" cy="12" r="3" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1A2 2 0 1 1 4.4 17l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 4.4l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
        />
      </svg>
      <span class="text-[10px] uppercase tracking-[0.18em] font-semibold">{{ t(it.labelKey) }}</span>
    </button>
  </nav>
</template>
