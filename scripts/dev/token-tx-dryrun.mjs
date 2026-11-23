// Dry-run: re-serialize on-chain token / sObject transactions and compare sha256 with their ids.
// Usage: node scripts/dev/token-tx-dryrun.mjs
import { build } from "esbuild";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const out = join(mkdtempSync(join(tmpdir(), "tokentx-")), "tokenTx.mjs");
await build({ entryPoints: ["src/lib/tokenTx.ts"], outfile: out, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
const { chainTxId, serializeChainTx, bytesToHex } = await import(pathToFileURL(out).href);
const sha256 = (d) => new Uint8Array(createHash("sha256").update(d).digest());

const refs = JSON.parse(readFileSync(new URL("./token-tx-refs.json", import.meta.url), "utf8"));
let fail = 0;
for (const t of refs) {
  // On-chain JSON omits `network` for v2 txs of this chain — derive it from the sender address version.
  const version = t.typeGroup === 3 && t.asset.token?.transfers ? 63 : t.sender.startsWith("T") ? 65 : t.sender.startsWith("S") ? 63 : 30;
  const tx = { version: t.version, network: t.network ?? version, typeGroup: t.typeGroup, type: t.type, nonce: t.nonce, senderPublicKey: t.senderPublicKey, fee: t.fee, amount: "0", asset: t.asset, signature: t.signature };
  let id;
  try { id = chainTxId(tx, sha256); } catch (e) { id = "ERR " + e.message; }
  const ok = id === t.id;
  if (!ok) fail++;
  console.log(`${ok ? "OK  " : "FAIL"} group ${t.typeGroup} type ${t.type} ${t.id.slice(0, 16)}… ${ok ? "" : "→ " + id}`);
}
console.log(fail ? `\n${fail} mismatch(es)` : "\nAll reference transactions re-serialize byte-exact.");
process.exit(fail ? 1 : 0);
