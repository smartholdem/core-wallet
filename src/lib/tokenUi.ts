import { ref } from "vue";
import { pushToast } from "@/lib/utils";
import { useT } from "@/locales";
import { nodeErrorKey, type TokenDetail, type WalletToken } from "@/stores/tokens";
import { fromUnits } from "@/lib/tokenTx";

/** smartoshi string → "1 234.5 STH" style number (no symbol). */
export function sth(units: string | bigint | number | null | undefined, maxFrac = 2): string {
  if (units == null) return "—";
  const s = fromUnits(BigInt(units), 8, maxFrac);
  const [w, f] = s.split(".");
  return f ? `${Number(w).toLocaleString()}.${f}` : Number(w).toLocaleString();
}

export function tokenAmount(units: string | bigint | undefined, decimals: number, maxFrac = Math.min(decimals, 4)): string {
  if (units == null) return "—";
  const s = fromUnits(BigInt(units), decimals, maxFrac);
  const [w, f] = s.split(".");
  return f ? `${Number(w).toLocaleString()}.${f}` : Number(w).toLocaleString();
}

export function tokenName(d: TokenDetail | undefined, fallback: WalletToken | null = null): string {
  return d?.meta?.name || d?.symbol || fallback?.symbol || "";
}

export function supplyPct(d: TokenDetail | undefined): number {
  if (!d) return 0;
  const cap = BigInt(d.supplyCap || "0");
  if (cap === 0n) return 0;
  return Number((BigInt(d.supply) * 1000n) / cap) / 10;
}

/** Execute a chain op with busy flag + humanized errors. Returns the tx or null. */
export function useTokenOp() {
  const busy = ref(false);
  const t = useT();
  async function run<T>(fn: () => Promise<T>, okKey = "tok.queued"): Promise<T | null> {
    if (busy.value) return null;
    busy.value = true;
    try {
      const r = await fn();
      pushToast(t.value(okKey), "success");
      return r;
    } catch (e: any) {
      const msg: string = e?.response?.data?.message || e?.message || "";
      const key = nodeErrorKey(msg);
      pushToast(key ? t.value(key) : msg || t.value("tok.errGeneric"), "error", 4200);
      return null;
    } finally {
      busy.value = false;
    }
  }
  return { busy, run };
}

/** Read a logo file; validates type + size and strips scripts from SVG. */
export async function readLogoFile(file: File, maxBytes: number): Promise<{ logoType: "svg" | "png"; logo: string; preview: string; size: number }> {
  const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
  const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
  if (!isSvg && !isPng) throw new Error("logo-type");
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length > maxBytes) throw new Error("logo-size");
  if (isSvg) {
    const text = new TextDecoder().decode(buf);
    if (/<script|on\w+\s*=|javascript:|<foreignObject/i.test(text)) throw new Error("logo-unsafe");
    if (!/<svg[\s>]/i.test(text)) throw new Error("logo-type");
  } else if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) {
    throw new Error("logo-type");
  }
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const logo = btoa(bin);
  return { logoType: isSvg ? "svg" : "png", logo, size: buf.length, preview: `data:${isSvg ? "image/svg+xml" : "image/png"};base64,${logo}` };
}
