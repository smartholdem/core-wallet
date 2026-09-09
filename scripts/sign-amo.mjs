/**
 * sign-amo.mjs — submit the Firefox build to addons.mozilla.org via web-ext.
 *
 * Runs as the last step of `yarn build:firefox:sign` and standalone via
 * `yarn sign:amo`. Plain `yarn build:firefox` never invokes it. It is a
 * NO-OP (exit 0, prints a hint) when AMO credentials are absent.
 *
 * Credentials (AMO → Tools → Manage API Keys), read from env or ./.env:
 *   AMO_JWT_ISSUER   e.g. user:12345678:123
 *   AMO_JWT_SECRET   64-hex secret
 * Optional:
 *   AMO_CHANNEL             listed (default) | unlisted
 *   AMO_APPROVAL_TIMEOUT    ms to wait for the signed .xpi. Default: 0 for
 *                           listed (human review takes days), 900000 for
 *                           unlisted (auto-signed within minutes).
 *   AMO_UPLOAD_SOURCE       "false" to skip attaching the source archive.
 *
 * Artefacts: signed .xpi (unlisted, or listed once approved) is written to
 * apps/extension/. The reviewer source zip from `pack-source.mjs` is attached
 * to the submission (`--upload-source-code`) so AMO never asks for it again.
 */
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PKG = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const VERSION = PKG.version;

// Minimal .env loader (no dotenv dependency; existing env always wins).
const ENV_FILE = resolve(ROOT, ".env");
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  }
}

const apiKey = process.env.AMO_JWT_ISSUER;
const apiSecret = process.env.AMO_JWT_SECRET;

if (!apiKey || !apiSecret) {
  console.log(
    "\u001b[33m○ AMO signing skipped\u001b[0m — set AMO_JWT_ISSUER and AMO_JWT_SECRET " +
      "(addons.mozilla.org → Tools → Manage API Keys) in .env to enable `yarn sign:amo`.",
  );
  process.exit(0);
}

const channelArg = process.argv.find((a) => a.startsWith("--channel="));
const channel = (channelArg ? channelArg.slice(10) : process.env.AMO_CHANNEL) || "listed";
if (!["listed", "unlisted"].includes(channel)) {
  console.error(`\u001b[31m✗ AMO_CHANNEL must be "listed" or "unlisted", got "${channel}"\u001b[0m`);
  process.exit(1);
}

const approvalTimeout =
  process.env.AMO_APPROVAL_TIMEOUT !== undefined
    ? Number(process.env.AMO_APPROVAL_TIMEOUT)
    : channel === "unlisted"
      ? 900_000
      : 0;

const sourceDir = resolve(ROOT, "apps/extension/dist-firefox");
const artifactsDir = resolve(ROOT, "apps/extension");
const sourceZip = resolve(ROOT, `apps/extension/smartholdem-wallet-source-${VERSION}.zip`);
const metadataFile = resolve(ROOT, "amo-metadata.json");

if (!existsSync(resolve(sourceDir, "manifest.json"))) {
  console.error(`\u001b[31m✗ ${sourceDir}/manifest.json not found — run \`yarn build:firefox\` first.\u001b[0m`);
  process.exit(1);
}
const uploadSource = process.env.AMO_UPLOAD_SOURCE !== "false" && existsSync(sourceZip);
mkdirSync(artifactsDir, { recursive: true });

console.log(`\u001b[1m\u001b[35m▶ AMO submission (web-ext sign)\u001b[0m`);
console.log(`  version:  ${VERSION}`);
console.log(`  channel:  ${channel}`);
console.log(`  issuer:   ${apiKey}`);
console.log(`  source:   ${uploadSource ? sourceZip : "(not attached)"}`);
console.log(`  wait:     ${approvalTimeout ? `${approvalTimeout / 1000}s for signed .xpi` : "submit only (no wait)"}`);

const { default: webExt } = await import("web-ext");

try {
  const result = await webExt.cmd.sign(
    {
      apiKey,
      apiSecret,
      amoBaseUrl: "https://addons.mozilla.org/api/v5/",
      sourceDir,
      artifactsDir,
      channel,
      approvalTimeout,
      timeout: 300_000,
      ...(uploadSource ? { uploadSourceCode: sourceZip } : {}),
      ...(existsSync(metadataFile) ? { amoMetadata: metadataFile } : {}),
      userAgentString: `smartholdem-wallet-release/${VERSION}`,
    },
    { shouldExitProgram: false },
  );
  console.log("");
  console.log("\u001b[32m✓ AMO submission accepted\u001b[0m");
  if (result?.id) console.log(`  add-on id: ${result.id}`);
  if (result?.downloadedFiles?.length) {
    for (const f of result.downloadedFiles) console.log(`  signed xpi: ${resolve(artifactsDir, f)}`);
  } else {
    console.log(
      channel === "listed"
        ? "  Version is now \"Awaiting Review\" on AMO. The signed .xpi becomes\n" +
          "  available after human review (typically 1–10 days)."
        : "  Signed .xpi not downloaded yet — re-run `yarn sign:amo` later or\n" +
          "  raise AMO_APPROVAL_TIMEOUT.",
    );
  }
} catch (err) {
  const msg = String(err?.message || err);
  console.error("");
  console.error(`\u001b[31m✗ AMO submission failed:\u001b[0m ${msg}`);
  if (/409|already exists|Duplicate/i.test(msg)) {
    console.error(`  Version ${VERSION} already exists on AMO — bump "version" in package.json + manifest.json.`);
  } else if (/401|403|JWT|Authentication|credentials/i.test(msg)) {
    console.error("  Check AMO_JWT_ISSUER / AMO_JWT_SECRET (Manage API Keys) and the server clock (JWT is time-bound).");
  } else if (/approval timeout|timed out/i.test(msg)) {
    console.error("  The upload itself succeeded — check https://addons.mozilla.org/developers/ before retrying.");
  }
  process.exit(1);
}
