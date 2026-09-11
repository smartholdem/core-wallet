import { isNativeApp } from "@/lib/runtime";

/**
 * Android Keystore / iOS Keychain backed storage + biometric prompt.
 * Both plugins are loaded lazily and only on native — web/extension bundles
 * never touch them.
 */
const BIO_PIN_KEY = "sth.bio.pin";

async function storage() {
  const { SecureStorage } = await import("@aparajita/capacitor-secure-storage");
  return SecureStorage;
}

export async function secureGet(key: string): Promise<string | null> {
  const s = await storage();
  const v = await s.get(key);
  return typeof v === "string" ? v : v == null ? null : JSON.stringify(v);
}

export async function secureSet(key: string, value: string) {
  const s = await storage();
  await s.set(key, value);
}

export async function secureRemove(key: string) {
  const s = await storage();
  await s.remove(key);
}

export interface BiometryInfo {
  available: boolean;
  strong: boolean;
  type: string;
  /** Plugin-supplied explanation when unavailable (e.g. nothing enrolled). */
  reason: string;
  code: string;
}

export class BiometricError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

const CANCEL_CODES = new Set(["userCancel", "systemCancel", "appCancel", "userFallback"]);

export async function biometryInfo(): Promise<BiometryInfo> {
  const none: BiometryInfo = { available: false, strong: false, type: "none", reason: "", code: "" };
  if (!isNativeApp()) return none;
  try {
    const { BiometricAuth, BiometryType } = await import("@aparajita/capacitor-biometric-auth");
    const r: any = await BiometricAuth.checkBiometry();
    const t = r.biometryType;
    const type =
      t === BiometryType.faceId || t === BiometryType.faceAuthentication
        ? "face"
        : t === BiometryType.touchId || t === BiometryType.fingerprintAuthentication
          ? "fingerprint"
          : t === BiometryType.irisAuthentication
            ? "iris"
            : "none";
    return {
      available: !!r.isAvailable,
      strong: !!r.strongBiometryIsAvailable,
      type,
      reason: String(r.reason || ""),
      code: String(r.code || ""),
    };
  } catch (e: any) {
    console.warn("[SmartHoldem Wallet] checkBiometry failed", e);
    return { ...none, reason: String(e?.message || e), code: "pluginError" };
  }
}

/**
 * Shows the OS biometric prompt. Resolves true on success, false when the
 * user cancelled, and throws BiometricError for real failures so the UI can
 * show the plugin's code/message (lockout, not enrolled, hardware…).
 */
export async function biometricPrompt(reason: string, title: string): Promise<boolean> {
  const { BiometricAuth, AndroidBiometryStrength } = await import("@aparajita/capacitor-biometric-auth");
  try {
    await BiometricAuth.authenticate({
      reason,
      androidTitle: title,
      androidSubtitle: reason,
      allowDeviceCredential: false,
      cancelTitle: "Cancel",
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return true;
  } catch (e: any) {
    const code = String(e?.code || "");
    if (CANCEL_CODES.has(code)) return false;
    throw new BiometricError(String(e?.message || e || "Biometric authentication failed"), code || "unknown");
  }
}

export async function enableBiometricUnlock(pin: string, reason: string, title: string) {
  const ok = await biometricPrompt(reason, title);
  if (!ok) return false;
  await secureSet(BIO_PIN_KEY, pin);
  return true;
}

export async function disableBiometricUnlock() {
  try {
    await secureRemove(BIO_PIN_KEY);
  } catch {}
}

/** Biometric prompt → PIN from Keystore, or null. */
export async function biometricPin(reason: string, title: string): Promise<string | null> {
  const ok = await biometricPrompt(reason, title);
  if (!ok) return null;
  return secureGet(BIO_PIN_KEY);
}
