/* oxlint-disable no-undef -- `chrome` is the WebExtension runtime global */
import { isExtension } from "@/lib/runtime";

// dApp origins the user chose to trust ("silent getAccount"). Extension keeps
// them in chrome.storage.local (read by background.ts); every other surface
// (Android, PWA, web) uses localStorage.
const KEY = "authorizedOrigins";
const LS_KEY = "sth.authorizedOrigins";

function readLocal(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function getAuthorizedOrigins(): Promise<string[]> {
  if (isExtension() && chrome.storage?.local) {
    return new Promise((resolve) =>
      chrome.storage.local.get(KEY, (res: any) =>
        resolve(Array.isArray(res?.[KEY]) ? res[KEY] : []),
      ),
    );
  }
  return Promise.resolve(readLocal());
}

export async function setAuthorizedOrigins(list: string[]): Promise<void> {
  if (isExtension() && chrome.storage?.local) {
    return new Promise((resolve) =>
      chrome.storage.local.set({ [KEY]: list }, () => resolve()),
    );
  }
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

export async function addAuthorizedOrigin(origin: string) {
  const cur = await getAuthorizedOrigins();
  if (!cur.includes(origin)) await setAuthorizedOrigins([...cur, origin]);
}

export async function removeAuthorizedOrigin(origin: string) {
  const cur = await getAuthorizedOrigins();
  await setAuthorizedOrigins(cur.filter((o) => o !== origin));
}
