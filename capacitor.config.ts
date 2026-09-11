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
    allowMixedContent: false,
    backgroundColor: "#121315",
    buildOptions: {
      releaseType: "AAB",
    },
  },
  plugins: {
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
