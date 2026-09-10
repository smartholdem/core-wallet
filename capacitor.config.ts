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
};

export default config;
