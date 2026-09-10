import { createRouter, createWebHashHistory } from "vue-router";
import { useAuthStore } from "@/stores/auth";

import Welcome from "@/views/Welcome.vue";
import CreateWallet from "@/views/CreateWallet.vue";
import ImportWallet from "@/views/ImportWallet.vue";
import Gatekeeper from "@/views/Gatekeeper.vue";
import Dashboard from "@/views/Dashboard.vue";
import Transfer from "@/views/Transfer.vue";
import Receive from "@/views/Receive.vue";
import History from "@/views/History.vue";
import Settings from "@/views/Settings.vue";
import RevealKeys from "@/views/RevealKeys.vue";
import Swap from "@/views/Swap.vue";
import ConnectedSites from "@/views/ConnectedSites.vue";
import DappBrowser from "@/views/DappBrowser.vue";

const routes = [
  { path: "/", redirect: "/dashboard" },
  { path: "/welcome", component: Welcome, meta: { public: true } },
  { path: "/create", component: CreateWallet, meta: { public: true } },
  { path: "/import", component: ImportWallet, meta: { public: true } },
  { path: "/lock", component: Gatekeeper, meta: { public: true } },
  { path: "/dashboard", component: Dashboard },
  { path: "/send", component: Transfer },
  { path: "/receive", component: Receive },
  { path: "/swap", component: Swap },
  { path: "/history", component: History },
  { path: "/connected-sites", component: ConnectedSites },
  { path: "/dapps", component: DappBrowser },
  { path: "/settings", component: Settings },
  { path: "/settings/keys", component: RevealKeys },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (!auth.hasWallet && !to.meta.public) return "/welcome";
  if (auth.hasWallet && auth.isLocked && to.path !== "/lock") return "/lock";
  if (auth.hasWallet && !auth.isLocked && (to.path === "/welcome" || to.path === "/lock")) {
    return "/dashboard";
  }
});
