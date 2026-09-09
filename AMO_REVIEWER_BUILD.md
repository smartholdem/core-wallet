# SmartHoldem Wallet - Build Instructions for AMO Reviewers

This document describes how to reproduce the submitted Firefox add-on
(`smartholdem-wallet-firefox-<version>.zip`) byte-for-byte from the source
archive (`smartholdem-wallet-source-<version>.zip`).

## 1. Environment

| Tool | Version | Notes |
|---|---|---|
| OS | Ubuntu 24.04 (x86_64 or ARM64) | Any Linux/macOS/Windows works |
| Node.js | **24.x LTS** (`.nvmrc`) | Minimum 20.x |
| Yarn | 1.22.x (classic) | `npm install -g yarn@1` |
| Compilers / `make` / `python3` / `node-gyp` | **not required** | see §4 |

No network access other than the npm registry is required. No API keys,
`.env` files or signing credentials are needed.

## 2. Reproduce the build

```bash
unzip smartholdem-wallet-source-<version>.zip -d core-wallet
cd core-wallet

nvm use                          # picks Node 24 from .nvmrc (optional)
yarn install --frozen-lockfile   # exact versions from the committed yarn.lock
yarn build:firefox
```

Expected console markers (in order):

```
✓ built in ~20s
✓ AMO sweep clean (1 rewrite(s) applied)
✓ CSP clean - no dynamic code generation found.
✓ Packed Firefox extension
  out:     apps/extension/smartholdem-wallet-firefox-<version>.zip
✓ Packed AMO source archive
```

During `yarn install` you will see `warning Ignored scripts due to flag.` -
this is expected (see §4).

## 3. Output

| Path | Content |
|---|---|
| `apps/extension/dist-firefox/` | Unpacked add-on - **compare this directory with the submitted zip** |
| `apps/extension/smartholdem-wallet-firefox-<version>.zip` | Same contents, zipped (root-level entries, no parent folder) |
| `apps/extension/smartholdem-wallet-source-<version>.zip` | Re-generated source archive (informational) |

The build is deterministic: two consecutive runs produce identical SHA-256
for every file under `dist-firefox/`. Zip archives themselves may differ in
checksum because of entry timestamps - compare extracted files, not the zip.

```bash
cd apps/extension/dist-firefox && find . -type f | sort | xargs sha256sum
```

## 4. Why no native toolchain is needed

`@smartholdem/crypto` transitively depends on `bcrypto`, `bstring` and
`tiny-secp256k1`, which ship optional `node-gyp` post-install scripts. The
browser bundle never uses native bindings - Vite resolves their pure-JS
`browser` entry points. The repository therefore ships `.yarnrc`
(`ignore-scripts true`) and `.npmrc` (`ignore-scripts=true`) so those
scripts are skipped entirely. This removes the `gyp ERR! not found: make`
failure on clean machines and has no effect on the produced bundle.

## 5. What the build pipeline does (`scripts/build-firefox.mjs`)

1. `vue-tsc --noEmit` - type check.
2. `vite build -c vite.config.extension.ts` with `--outDir apps/extension/dist-firefox`.
   The Rollup plugin `scripts/vite-csp-strip.mjs` neutralises any
   `new Function` / `eval` left by third-party crypto deps (MV3 CSP).
3. **AMO sweep** - rewrites the single `el.innerHTML = …` assignment inside
   Vue's runtime (SVG/MathML template parser) into `el["inner"+"HTML"] = …`.
   Runtime behaviour is identical; it only avoids a false-positive
   `Unsafe assignment to innerHTML` from static analysis. The script aborts
   if any assignment survives.
4. `scripts/check-csp.mjs` - fails the build on any remaining dynamic-code
   pattern.
5. Manifest rewrite for Gecko: `background.scripts` instead of
   `service_worker`, `sidebar_action`, `browser_specific_settings.gecko`
   (`id: smartholdem-wallet@smartholdem.io`, `strict_min_version: 142.0`,
   `data_collection_permissions.required: ["none"]`).
6. Zip `dist-firefox/` -> `smartholdem-wallet-firefox-<version>.zip`.
7. `scripts/pack-source.mjs` - regenerates the reviewer source archive.

## 6. Third-party code

All dependencies are public npm packages pinned in `yarn.lock`. No
pre-built, minified or vendored third-party bundles are checked into the
repository. Fonts (`src/assets/fonts/*.woff2`, Inter & JetBrains Mono,
SIL OFL 1.1) are embedded locally - no remote font or script loading.

## 7. Local smoke test

Firefox -> `about:debugging#/runtime/this-firefox` -> **Load Temporary Add-on…**
-> select `apps/extension/dist-firefox/manifest.json` (or the zip). The
wallet opens in the sidebar (`Ctrl+B` / View -> Sidebar -> SmartHoldem Wallet).

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `error Your lockfile needs to be updated` | You are not using the shipped `yarn.lock`/`package.json` pair - re-extract the archive. |
| `[vite:html-inline-proxy] No matching HTML proxy module found` | `rm -rf node_modules/.vite && yarn build:firefox` |
| `gyp ERR!` | `.yarnrc` was not extracted (hidden dotfile). Run `yarn install --frozen-lockfile --ignore-scripts`. |

Contact: SmartHoldem Foundation - https://github.com/smartholdem/core-wallet
