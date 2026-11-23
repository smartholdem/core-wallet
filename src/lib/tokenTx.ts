/**
 * Wire format for SmartHoldem native tokens (typeGroup 3) and sObject ticker
 * registration (typeGroup 2 / type 6), mirroring sth-core `tx_serializer.rs`.
 * Pure functions — hashing/signing are injected so this file also runs in Node tests.
 */

export const TYPE_GROUP_SOBJ = 2;
export const TYPE_GROUP_TOKEN = 3;
export const SOBJ_TYPE = 6;
export const TICKER_SOBJ_TYPE = 5;
export const TOKEN = { INIT: 0, TRANSFER: 1, MINT: 2, BURN: 3, META: 4, SELL: 5, BUY: 6, CANCEL: 7, SELL_V2: 8 } as const;
export const FLAG_MINTABLE = 1;
export const FLAG_BURNABLE = 2;
export const LIMITS = { memo: 64, metaName: 64, metaDescription: 512, metaWebsite: 128, logo: 8192, decimals: 8 };

export interface TokenMetaAsset {
  name: string;
  description?: string;
  website?: string;
  logoType?: "svg" | "png";
  /** base64 */
  logo?: string;
}

export interface TokenAsset {
  id: string;
  decimals?: number;
  flags?: number;
  initialSupply?: string;
  supplyCap?: string;
  transfers?: { recipientId: string; amount: string }[];
  memo?: string;
  amount?: string;
  recipientId?: string;
  price?: string;
  orderId?: string;
  meta?: TokenMetaAsset;
}

export interface SObjectAsset {
  type: number;
  subType: number;
  action: number;
  registrationId?: string;
  data: { name?: string; ntfryData?: string };
}

export interface ChainTx {
  version: 2;
  network: number;
  typeGroup: number;
  type: number;
  nonce: string;
  senderPublicKey: string;
  fee: string;
  amount: string;
  asset: { token: TokenAsset } | SObjectAsset;
  signature?: string;
  id?: string;
}

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Decode(s: string): Uint8Array {
  const bytes: number[] = [0];
  for (const ch of s) {
    let carry = B58.indexOf(ch);
    if (carry < 0) throw new Error("bad base58");
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let k = 0; k < s.length && s[k] === "1"; k++) bytes.push(0);
  return Uint8Array.from(bytes.reverse());
}

/** 21-byte address payload (version + ripemd160), checksum stripped. */
export function addressToBytes(address: string): Uint8Array {
  const raw = base58Decode(address);
  if (raw.length !== 25) throw new Error(`bad address: ${address}`);
  return raw.slice(0, 21);
}

export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2) throw new Error("odd hex");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

class Writer {
  private parts: Uint8Array[] = [];
  u8(v: number) { this.parts.push(Uint8Array.of(v & 0xff)); return this; }
  u16(v: number) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); this.parts.push(b); return this; }
  u32(v: number) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.parts.push(b); return this; }
  u64(v: bigint | string | number) {
    const n = BigInt(v);
    if (n < 0n || n > 0xffffffffffffffffn) throw new Error("u64 overflow");
    const b = new Uint8Array(8); new DataView(b.buffer).setBigUint64(0, n, true); this.parts.push(b); return this;
  }
  bytes(b: Uint8Array) { this.parts.push(b); return this; }
  str(s: string) { return this.bytes(new TextEncoder().encode(s)); }
  out(): Uint8Array {
    const len = this.parts.reduce((a, p) => a + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

const utf8len = (s: string) => new TextEncoder().encode(s).length;

function writeTokenPayload(w: Writer, type: number, a: TokenAsset) {
  const id = hexToBytes(a.id);
  if (id.length !== 32) throw new Error("token id must be 32 bytes");
  w.bytes(id);
  switch (type) {
    case TOKEN.INIT:
      w.u8(a.decimals ?? 0).u8(a.flags ?? 0).u64(a.initialSupply ?? 0).u64(a.supplyCap ?? 0);
      break;
    case TOKEN.TRANSFER: {
      const items = a.transfers ?? [];
      const memo = a.memo ?? "";
      if (utf8len(memo) > 255) throw new Error("memo too long");
      w.u16(items.length);
      for (const it of items) { w.u64(it.amount); w.bytes(addressToBytes(it.recipientId)); }
      w.u8(utf8len(memo)).str(memo);
      break;
    }
    case TOKEN.MINT:
      if (!a.recipientId) throw new Error("missing recipientId");
      w.u64(a.amount ?? 0).bytes(addressToBytes(a.recipientId));
      break;
    case TOKEN.SELL:
    case TOKEN.SELL_V2:
      w.u64(a.amount ?? 0).u64(a.price ?? 0);
      break;
    case TOKEN.BUY:
    case TOKEN.CANCEL: {
      const oid = hexToBytes(a.orderId ?? "");
      if (oid.length !== 32) throw new Error("orderId must be 32 bytes");
      w.bytes(oid);
      if (type === TOKEN.BUY) w.u64(a.amount ?? 0);
      break;
    }
    case TOKEN.META: {
      const m = a.meta;
      if (!m) throw new Error("missing meta");
      const desc = m.description ?? "";
      const site = m.website ?? "";
      const logo = m.logo ? base64ToBytes(m.logo) : new Uint8Array();
      const logoType = m.logoType === "svg" ? 1 : m.logoType === "png" ? 2 : 0;
      w.u8(utf8len(m.name)).str(m.name);
      w.u16(utf8len(desc)).str(desc);
      w.u8(utf8len(site)).str(site);
      w.u8(logoType).u16(logo.length).bytes(logo);
      break;
    }
    default:
      w.u64(a.amount ?? 0);
  }
}

function writeSObjectPayload(w: Writer, e: SObjectAsset) {
  const reg = e.registrationId ? hexToBytes(e.registrationId) : new Uint8Array();
  const name = e.data?.name ?? "";
  const ptr = e.data?.ntfryData ?? "";
  w.u8(e.type).u8(e.subType).u8(e.action);
  w.u8(reg.length).bytes(reg);
  w.u8(utf8len(name)).str(name);
  w.u8(utf8len(ptr)).str(ptr);
}

/** Full v2 wire bytes; `excludeSignature` yields the bytes that get hashed for signing. */
export function serializeChainTx(tx: ChainTx, excludeSignature = false): Uint8Array {
  const w = new Writer();
  w.u8(0xff).u8(tx.version).u8(tx.network).u32(tx.typeGroup).u16(tx.type);
  w.u64(tx.nonce);
  w.bytes(hexToBytes(tx.senderPublicKey));
  w.u64(tx.fee);
  w.u8(0x00); // no vendorField for sObject / token types
  if (tx.typeGroup === TYPE_GROUP_TOKEN) writeTokenPayload(w, tx.type, (tx.asset as { token: TokenAsset }).token);
  else if (tx.typeGroup === TYPE_GROUP_SOBJ && tx.type === SOBJ_TYPE) writeSObjectPayload(w, tx.asset as SObjectAsset);
  else throw new Error(`unsupported typeGroup ${tx.typeGroup}/${tx.type}`);
  if (tx.signature && !excludeSignature) w.bytes(hexToBytes(tx.signature));
  return w.out();
}

export interface Signer {
  sha256(data: Uint8Array): Uint8Array;
  /** schnorr (64-byte) signature over the 32-byte hash, hex */
  sign(hash: Uint8Array): string;
}

/** Sign + assign id (= sha256 of the full bytes). */
export function signChainTx(tx: ChainTx, signer: Signer): ChainTx {
  const hash = signer.sha256(serializeChainTx(tx, true));
  const signed: ChainTx = { ...tx, signature: signer.sign(hash) };
  signed.id = bytesToHex(signer.sha256(serializeChainTx(signed)));
  return signed;
}

/** Recompute the id of a chain transaction (dry-run check against the node). */
export function chainTxId(tx: ChainTx, sha256: (d: Uint8Array) => Uint8Array): string {
  return bytesToHex(sha256(serializeChainTx(tx)));
}

/* ───────────── amount helpers (token units ↔ human) ───────────── */

export function toUnits(human: string | number, decimals: number): bigint {
  const s = String(human).trim().replace(",", ".");
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") throw new Error("invalid amount");
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) throw new Error("too many decimals");
  const v = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (v > 0xffffffffffffffffn) throw new Error("amount overflows u64");
  return v;
}

export function fromUnits(units: string | bigint | number, decimals: number, maxFrac = decimals): string {
  const n = BigInt(units ?? 0);
  const base = 10n ** BigInt(decimals);
  const whole = n / base;
  let frac = (n % base).toString().padStart(decimals, "0").slice(0, maxFrac).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}
