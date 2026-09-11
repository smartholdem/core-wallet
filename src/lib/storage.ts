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
// On Android/iOS the encrypted vault is written to Keystore/Keychain-backed
// secure storage AND mirrored in WebView localStorage (the vault is already
// AES-256-GCM encrypted with the PIN, exactly like on the extension/PWA).
// Keystore is the primary read source; the localStorage copy guarantees the
// wallet survives a slow/failed Keystore read on cold start — losing the vault
// is far worse than the marginal gain of Keystore-only storage.
// Pinia needs a sync Storage, so an in-memory mirror is hydrated before mount.
const isNative =
  !!(globalThis as any).Capacitor?.isNativePlatform?.() === true;
const VAULT_KEYS = ["sth.auth"];
const SECURE_READ_TIMEOUT = 10000;
const nativeMirror: Record<string, string> = {};

async function secure() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

function localRead(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

export async function hydrateNativeVault() {
  if (!isNative) return;
  const t0 = Date.now();
  let timer: any;
  const timeout = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error(`secure storage timeout (${SECURE_READ_TIMEOUT} ms)`)), SECURE_READ_TIMEOUT);
  });
  let secureOk = false;
  try {
    await Promise.race([hydrateFromSecure(), timeout]);
    secureOk = true;
  } catch (e) {
    console.warn("[SmartHoldem Wallet] secure storage read failed — using localStorage mirror", e);
  } finally {
    clearTimeout(timer);
  }
  for (const k of VAULT_KEYS) {
    if (nativeMirror[k] === undefined) {
      const local = localRead(k);
      if (local) {
        nativeMirror[k] = local;
        // heal the secure copy when Keystore was empty/unreadable
        if (secureOk) secure().then((s) => s.set(k, local)).catch(() => {});
      }
    }
  }
  console.info(`[SmartHoldem Wallet] vault hydrated in ${Date.now() - t0} ms (secure=${secureOk}, keys=${Object.keys(nativeMirror).join(",") || "none"})`);
}

async function hydrateFromSecure() {
  const s = await secure();
  for (const k of VAULT_KEYS) {
    let v = await s.get(k);
    if (typeof v !== "string" && v != null) v = JSON.stringify(v);
    if (typeof v === "string" && v) nativeMirror[k] = v;
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
    try {
      localStorage.removeItem(key);
    } catch {}
    secure().then((s) => s.remove(key)).catch(() => {});
  },
  setItem(key: string, value: string) {
    nativeMirror[key] = value;
    try {
      localStorage.setItem(key, value);
    } catch {}
    secure()
      .then((s) => s.set(key, value))
      .catch((e) => console.warn("[SmartHoldem Wallet] secure storage write failed", e));
  },
};

/** Storage for the encrypted vault: Keystore + localStorage mirror on native, localStorage elsewhere. */
export const vaultStorage: Storage =
  isNative ? nativeVaultStorage : (typeof localStorage !== "undefined" ? localStorage : nativeVaultStorage);
