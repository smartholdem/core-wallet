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
