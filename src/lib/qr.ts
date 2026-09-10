import { isNativeApp } from "@/lib/runtime";

export interface PaymentRequest {
  address: string;
  amount?: string;
  memo?: string;
}

const ADDRESS_RE = /^S[1-9A-HJ-NP-Za-km-z]{33}$/;

/**
 * Accepts everything a payment QR may carry:
 *   S…                                  bare address
 *   smartholdem:S…?amount=1.5&memo=x    URI (also `sth:`; `vendorField=` alias)
 *   {"address":"S…","amount":..}        JSON
 */
export function parsePaymentQr(raw: string): PaymentRequest | null {
  const text = (raw || "").trim();
  if (!text) return null;
  if (ADDRESS_RE.test(text)) return { address: text };

  const uri = text.match(/^(?:smartholdem|sth):(?:\/\/)?([^?\s]+)(?:\?(.*))?$/i);
  if (uri) {
    const address = uri[1];
    if (!ADDRESS_RE.test(address)) return null;
    const q = new URLSearchParams(uri[2] || "");
    const amount = q.get("amount") || undefined;
    const memo = q.get("memo") ?? q.get("vendorField") ?? undefined;
    return { address, amount: amount || undefined, memo: memo || undefined };
  }

  if (text.startsWith("{")) {
    try {
      const j = JSON.parse(text);
      const address = j.address ?? j.recipientId ?? j.recipient;
      if (typeof address === "string" && ADDRESS_RE.test(address)) {
        return {
          address,
          amount: j.amount != null ? String(j.amount) : undefined,
          memo: j.memo ?? j.vendorField ?? undefined,
        };
      }
    } catch {}
  }
  return null;
}

/** Camera is usable natively (ML Kit) and in normal web tabs (html5-qrcode). */
export function canScanQr(): boolean {
  if (isNativeApp()) return true;
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
}

/** Opens the scanner; resolves with the decoded text or null when cancelled. */
export async function scanQr(instructions: string): Promise<string | null> {
  const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint, CapacitorBarcodeScannerAndroidScanningLibrary } = await import(
    "@capacitor/barcode-scanner"
  );
  try {
    const res = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      scanInstructions: instructions,
      scanButton: false,
      cameraDirection: 1,
      android: { scanningLibrary: CapacitorBarcodeScannerAndroidScanningLibrary.MLKIT },
    });
    return res?.ScanResult || null;
  } catch (e: any) {
    const m = String(e?.message || e).toLowerCase();
    if (m.includes("cancel") || m.includes("dismiss")) return null;
    throw e;
  }
}
