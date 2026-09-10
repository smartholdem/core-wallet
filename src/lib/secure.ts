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
  type: string;
}

export async function biometryInfo(): Promise<BiometryInfo> {
  if (!isNativeApp()) return { available: false, type: "none" };
  try {
    const { BiometricAuth, BiometryType } = await import("@aparajita/capacitor-biometric-auth");
    const r = await BiometricAuth.checkBiometry();
    const t = r.biometryType;
    const type =
      t === BiometryType.faceId || t === BiometryType.faceAuthentication
        ? "face"
        : t === BiometryType.touchId || t === BiometryType.fingerprintAuthentication
          ? "fingerprint"
          : t === BiometryType.irisAuthentication
            ? "iris"
            : "none";
    return { available: !!r.isAvailable, type };
  } catch {
    return { available: false, type: "none" };
  }
}

/** Shows the OS biometric prompt; resolves true on success, false on cancel/failure. */
export async function biometricPrompt(reason: string, title: string): Promise<boolean> {
  try {
    const { BiometricAuth } = await import("@aparajita/capacitor-biometric-auth");
    await BiometricAuth.authenticate({
      reason,
      androidTitle: title,
      androidSubtitle: reason,
      allowDeviceCredential: false,
      cancelTitle: "Cancel",
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false;
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
