import type { CapacitorConfig } from "@capacitor/cli";

// Android / iOS wrapper around the same Vue bundle that ships as PWA.
// Build: `yarn build:android` (vite --mode android → apps/dist-android → cap sync).
const config: CapacitorConfig = {
  appId: "cx.sth.wallet",
  appName: "STH Wallet",
  webDir: "apps/dist-android",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    backgroundColor: "#121315",
    buildOptions: {
      releaseType: "AAB",
    },
  },
  plugins: {
    // Route fetch/XHR through the native layer: personal nodes without CORS
    // headers and plain-http LAN relays work inside the app.
    CapacitorHttp: {
      enabled: true,
    },
    // OTA from GitHub Releases (see src/lib/ota.ts). No Capgo cloud.
    CapacitorUpdater: {
      autoUpdate: false,
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      resetWhenUpdate: true,
      directUpdate: false,
    },
  },
};

export default config;
