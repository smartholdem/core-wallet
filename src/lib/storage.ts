/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
/**
 * Chrome storage / localStorage adapter for Pinia persistence.
 * Works in both extension (chrome.storage.local) and dev preview (localStorage).
 */
const isExtension =
  typeof chrome !== "undefined" && !!chrome.storage && !!chrome.storage.local;

export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (res) => resolve(res[key] ?? null));
      });
    }
    return localStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => resolve());
      });
    }
    localStorage.setItem(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (isExtension) {
      return new Promise((resolve) => {
        chrome.storage.local.remove([key], () => resolve());
      });
    }
    localStorage.removeItem(key);
  },
};

/**
 * Synchronous Pinia-compatible storage adapter. Pinia persist plugin requires
 * a sync API; we wrap an in-memory mirror and lazily hydrate from chrome.storage.
 */
const memoryCache: Record<string, string> = {};
let hydrated = false;

export async function hydrateStorageMirror(keys: string[]) {
  if (hydrated || !isExtension) return;
  hydrated = true;
  await new Promise<void>((resolve) => {
    chrome.storage.local.get(keys, (res) => {
      for (const k of keys) {
        if (typeof res[k] === "string") memoryCache[k] = res[k];
      }
      resolve();
    });
  });
}

export const syncStorage: Storage = {
  get length() {
    return Object.keys(memoryCache).length;
  },
  clear() {
    Object.keys(memoryCache).forEach((k) => delete memoryCache[k]);
    if (isExtension) chrome.storage.local.clear();
    else localStorage.clear();
  },
  getItem(key: string) {
    if (isExtension) return memoryCache[key] ?? null;
    return localStorage.getItem(key);
  },
  key(i: number) {
    return Object.keys(memoryCache)[i] ?? null;
  },
  removeItem(key: string) {
    delete memoryCache[key];
    if (isExtension) chrome.storage.local.remove([key]);
    else localStorage.removeItem(key);
  },
  setItem(key: string, value: string) {
    memoryCache[key] = value;
    if (isExtension) chrome.storage.local.set({ [key]: value });
    else localStorage.setItem(key, value);
  },
};

// ── Native vault storage (Capacitor) ──────────────────────────────────────
// On Android/iOS the encrypted vault lives in Keystore/Keychain-backed secure
// storage instead of WebView localStorage. Pinia needs a sync Storage, so we
// keep an in-memory mirror that is hydrated once before the app mounts.
const isNative =
  !!(globalThis as any).Capacitor?.isNativePlatform?.() === true;
const VAULT_KEYS = ["sth.auth"];
const nativeMirror: Record<string, string> = {};

async function secure() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

export async function hydrateNativeVault() {
  if (!isNative) return;
  const fallback = () => {
    for (const k of VAULT_KEYS) {
      const v = localStorage.getItem(k);
      if (v) nativeMirror[k] = v;
    }
  };
  let timer: any;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error("secure storage timeout")), 4000);
  });
  try {
    await Promise.race([hydrateFromSecure(), timeout]);
  } catch (e) {
    console.warn("[SmartHoldem Wallet] secure storage unavailable, falling back to localStorage", e);
    fallback();
  } finally {
    clearTimeout(timer);
  }
}

async function hydrateFromSecure() {
  const s = await secure();
  for (const k of VAULT_KEYS) {
    let v = await s.get(k);
    if (typeof v !== "string" && v != null) v = JSON.stringify(v);
    if (v == null) {
      // one-time migration from WebView localStorage (Phase 1 builds)
      const legacy = localStorage.getItem(k);
      if (legacy) {
        await s.set(k, legacy);
        localStorage.removeItem(k);
        v = legacy;
      }
    }
    if (typeof v === "string") nativeMirror[k] = v;
  }
}

const nativeVaultStorage: Storage = {
  get length() {
    return Object.keys(nativeMirror).length;
  },
  clear() {
    for (const k of Object.keys(nativeMirror)) this.removeItem(k);
  },
  getItem(key: string) {
    return nativeMirror[key] ?? null;
  },
  key(i: number) {
    return Object.keys(nativeMirror)[i] ?? null;
  },
  removeItem(key: string) {
    delete nativeMirror[key];
    secure().then((s) => s.remove(key)).catch(() => {});
  },
  setItem(key: string, value: string) {
    nativeMirror[key] = value;
    secure().then((s) => s.set(key, value)).catch(() => localStorage.setItem(key, value));
  },
};

/** Storage for the encrypted vault: Keystore on native, localStorage elsewhere. */
export const vaultStorage: Storage =
  isNative ? nativeVaultStorage : (typeof localStorage !== "undefined" ? localStorage : nativeVaultStorage);
