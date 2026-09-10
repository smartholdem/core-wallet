import { defineStore } from "pinia";
import { encryptSecret, decryptSecret, pinHash } from "@/lib/crypto";
import { useSettingsStore } from "@/stores/settings";
import { vaultStorage } from "@/lib/storage";

export interface AccountMeta {
  index: number;
  address: string;
  label: string;
}

interface EncryptedVault {
  cipher: string; // AES-encrypted mnemonic
  accounts: AccountMeta[]; // derived public metadata
  activeIndex: number;
  createdAt: number;
}

/**
 * Auth store — manages PIN lock and the in-memory unlocked mnemonic.
 *
 * Vault shape:
 *  - `cipher` is the AES(mnemonic, pin+sha384(pin)) ciphertext (the root seed).
 *  - `accounts[]` stores PUBLIC metadata only (index + address + label) for fast
 *    rendering of the address switcher without needing to decrypt.
 *  - `activeIndex` is the currently selected account in the UI.
 */
export const useAuthStore = defineStore("auth", {
  state: () => ({
    account: null as EncryptedVault | null,
    _pin: "" as string, // in-memory only, never persisted
    lastActivity: Date.now(),
  }),
  getters: {
    hasWallet: (s) => !!s.account,
    isLocked: (s) => !s._pin,
    accounts: (s) => s.account?.accounts ?? [],
    activeIndex: (s) => s.account?.activeIndex ?? 0,
    activeAccount(s): AccountMeta | null {
      if (!s.account) return null;
      return (
        s.account.accounts.find((a) => a.index === s.account!.activeIndex) ??
        s.account.accounts[0] ??
        null
      );
    },
    address(): string {
      return this.activeAccount?.address ?? "";
    },
  },
  actions: {
    bootstrap() {
      this._pin = "";
      this.lastActivity = Date.now();
      // migration: old shape had { address, cipher, createdAt } at the root
      if (this.account && (this.account as any).address && !this.account.accounts) {
        const legacy = this.account as any;
        this.account = {
          cipher: legacy.cipher,
          accounts: [{ index: 0, address: legacy.address, label: "Account 1" }],
          activeIndex: 0,
          createdAt: legacy.createdAt ?? Date.now(),
        };
      }
    },
    /** Persist a freshly forged or imported wallet (account #0 metadata only). */
    saveWallet(rootAddress: string, mnemonic: string, pin: string) {
      const settings = useSettingsStore();
      settings.savePinHash(pin);
      this.account = {
        cipher: encryptSecret(mnemonic, pin),
        accounts: [{ index: 0, address: rootAddress, label: "Account 1" }],
        activeIndex: 0,
        createdAt: Date.now(),
      };
      this._pin = pin;
      this.lastActivity = Date.now();
    },
    addAccount(meta: AccountMeta) {
      if (!this.account) return;
      if (this.account.accounts.some((a) => a.index === meta.index)) return;
      this.account.accounts.push(meta);
    },
    setActiveAccount(index: number) {
      if (!this.account) return;
      if (this.account.accounts.some((a) => a.index === index)) {
        this.account.activeIndex = index;
      }
    },
    renameAccount(index: number, label: string) {
      if (!this.account) return;
      const acct = this.account.accounts.find((a) => a.index === index);
      if (acct) acct.label = label;
    },
    unlock(pin: string): boolean {
      const settings = useSettingsStore();
      if (!this.account) return false;
      if (!settings.validatePin(pin)) return false;
      try {
        const plain = decryptSecret(this.account.cipher, pin);
        if (!plain) return false;
        this._pin = pin;
        this.lastActivity = Date.now();
        return true;
      } catch {
        return false;
      }
    },
    lock() {
      this._pin = "";
    },
    /** Returns the decrypted root mnemonic, or null if locked. */
    decryptSecret(): string | null {
      if (!this.account || !this._pin) return null;
      try {
        return decryptSecret(this.account.cipher, this._pin);
      } catch {
        return null;
      }
    },
    touch() {
      this.lastActivity = Date.now();
    },
    wipe() {
      this.account = null;
      this._pin = "";
      const settings = useSettingsStore();
      settings.pinHash = "";
      try {
        vaultStorage.removeItem("sth.auth");
        localStorage.removeItem("sth.auth");
        localStorage.removeItem("sth.settings");
        localStorage.removeItem("sth.wallet");
        localStorage.removeItem("sth.authorizedOrigins");
      } catch {}
      import("@/lib/secure").then((m) => m.disableBiometricUnlock()).catch(() => {});
    },
    verify(pin: string): boolean {
      const settings = useSettingsStore();
      return settings.validatePin(pin) && pinHash(pin) === settings.pinHash;
    },
  },
  persist: {
    key: "sth.auth",
    storage: vaultStorage,
    pick: ["account"],
  } as any,
});
