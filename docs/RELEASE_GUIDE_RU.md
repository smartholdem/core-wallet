# SmartHoldem Wallet — полная инструкция по сборке и публикации (RU)

Внутренний документ для мейнтейнера. Для ревьюеров Mozilla — `docs/AMO_REVIEWER_BUILD.md` (EN).

---

## 1. Окружение

- Node.js **24 LTS** (`.nvmrc`; минимум 20), Yarn 1.22.x.
- Компиляторы (`make`, `g++`, `python3`, `node-gyp`) **не нужны** — `.yarnrc`/`.npmrc` с `ignore-scripts` отключают нативные пост-инсталл скрипты `bcrypto`/`bstring`/`tiny-secp256k1`. Браузерный бандл использует только их JS-реализации.
- Первичная установка:

```bash
git clone https://github.com/smartholdem/core-wallet.git && cd core-wallet
nvm use
yarn install --frozen-lockfile
```

`warning Ignored scripts due to flag.` при установке — норма.

> Если меняешь зависимости (`yarn add …`) — обязательно коммить обновлённый `yarn.lock`. Без него сборка у ревьюера невоспроизводима (именно это стало причиной отказа по версии 1.4.7).

---

## 2. Команды

| Команда | Результат | Сеть |
|---|---|---|
| `yarn dev` | dev-сервер `http://localhost:3509` (UI в рамке 400×720) | — |
| `yarn build:extension` | Chrome: `apps/extension/dist/` + `smartholdem-wallet-chrome-<ver>.crx` | — |
| `yarn build:firefox` | Firefox: `apps/extension/dist-firefox/` + `smartholdem-wallet-firefox-<ver>.zip` + `smartholdem-wallet-source-<ver>.zip` | — |
| `yarn build:pwa` | PWA: `apps/dist-pwa/` | — |
| `yarn pack:source` | только архив исходников для AMO | — |
| `yarn sign:amo` | отправить уже собранный `dist-firefox/` на AMO через `web-ext sign` | AMO |
| `yarn build:firefox:sign` | `build:firefox` + `sign:amo` | AMO |
| `yarn check:csp` | аудит `apps/extension/dist` на `eval`/`new Function` | — |

`build:firefox` полностью офлайн и не требует ключей — именно её выполняет ревьюер.

---

## 3. Релиз новой версии (чеклист)

1. **Поднять версию в трёх местах** (AMO не принимает повторную версию — HTTP 409):
   - `package.json` → `"version"`
   - `manifest.json` → `"version"`
   - `src/locales/index.ts` → `welcome.version` во всех 4 локалях (EN/RU/ZH/ES)
2. `yarn build:firefox` — убедиться в выводе:
   ```
   ✓ AMO sweep clean (1 rewrite(s) applied)
   ✓ CSP clean — no dynamic code generation found.
   ✓ Packed Firefox extension
   ✓ Packed AMO source archive
   ```
3. Локальный тест (см. §5).
4. Закоммитить (Save to GitHub) — в репо должны быть `yarn.lock`, `.yarnrc`, `.npmrc`, `.nvmrc`.
5. Загрузить на AMO (§4).

---

## 4. Ручная публикация на AMO

1. https://addons.mozilla.org/developers/addon/submit/ (новый аддон) или
   https://addons.mozilla.org/developers/addons → SmartHoldem Wallet → **Upload New Version**.
2. Загрузить `apps/extension/smartholdem-wallet-firefox-<ver>.zip`. Валидатор должен показать **0 errors, 0 warnings**.
3. На вопрос «Do you need to submit source code?» → **Yes** → загрузить
   `apps/extension/smartholdem-wallet-source-<ver>.zip`.
4. В поле «Notes to Reviewer» вставить:
   ```
   Build instructions: see docs/AMO_REVIEWER_BUILD.md inside the source archive.
   Environment: Node 24 LTS, yarn 1.22. No native toolchain required.
   Commands: yarn install --frozen-lockfile && yarn build:firefox
   Output: apps/extension/dist-firefox/ (compare with the submitted zip).
   ```
5. Release notes → Submit. Статус станет **Awaiting Review** (обычно 1–10 дней).

Если ревьюер снова напишет «Build not reproducing» — сначала прогнать сборку в чистом контейнере:
```bash
docker run --rm -it -v "$PWD":/w -w /w node:24 bash -c "corepack enable && yarn install --frozen-lockfile && yarn build:firefox"
```

### 4.1. Автоматическая отправка (опционально)

Ключи: https://addons.mozilla.org/developers/addon/api/key/ → **JWT issuer** и **JWT secret**.
Положить в `.env` (файл в `.gitignore`, шаблон — `.env.example`):

```dotenv
AMO_JWT_ISSUER=user:XXXXXXXX:XXX
AMO_JWT_SECRET=<секрет>
AMO_CHANNEL=listed          # listed — публичный листинг с ревью; unlisted — самораспространение, автоподпись
AMO_APPROVAL_TIMEOUT=       # мс ожидания подписанного .xpi (по умолчанию 0 для listed, 900000 для unlisted)
```

Затем `yarn build:firefox:sign`. Скрипт отправляет `dist-firefox/` и прикрепляет архив исходников.
Ошибки: `409 / already exists` — версия уже загружена, поднять версию; `Unknown JWT iss` — неверный issuer/secret.
Секрет никуда не вставлять кроме `.env`.

---

## 5. Локальное тестирование

### Firefox (временная установка, без подписи)
1. Открыть **`about:debugging#/runtime/this-firefox`**
2. **Load Temporary Add-on…** → выбрать `apps/extension/dist-firefox/manifest.json` **или** `smartholdem-wallet-firefox-<ver>.zip`.
3. Кошелёк появляется в сайдбаре (`Ctrl+B` → выбрать SmartHoldem Wallet) и по клику на иконку.
4. Аддон живёт до перезапуска браузера. Кнопка **Reload** там же — после пересборки.

Подписанный `.xpi` (после ревью или из `unlisted`) ставится постоянно через `about:addons` → ⚙ → **Install Add-on From File…**.

### Chrome / Chromium
`chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist/`
(или перетащить `smartholdem-wallet-chrome-<ver>.crx`).

### Проверка dApp-интеграции в dev-режиме (консоль браузера)
```js
__sthDevConnect({ origin: "https://poker.smartholdem.io" })
__sthDevSendTx({ recipient: "S…", amount: 1, memo: "test" })
__sthDevSignMessage({ origin: "https://poker.smartholdem.io", message: "Login nonce" })
```

---

## 6. Что делает `build:firefox` под капотом (`scripts/build-firefox.mjs`)

1. `vue-tsc --noEmit`.
2. `vite build -c vite.config.extension.ts --outDir apps/extension/dist-firefox`; Rollup-плагин `vite-csp-strip.mjs` глушит `new Function`/`eval` в крипто-зависимостях (MV3 CSP).
3. **AMO sweep** — единственное присваивание `el.innerHTML = …` внутри рантайма Vue (парсер SVG/MathML-шаблонов) переписывается в `el["inner"+"HTML"] = …`. Поведение идентично, но статический анализатор AMO (`eslint-plugin-no-unsanitized`) больше не ругается. Делается **после** esbuild, потому что минификатор иначе сворачивает `"inner"+"HTML"` обратно. Не трогать.
4. `check-csp.mjs` — падает при любом оставшемся динамическом коде.
5. Переписывание манифеста под Gecko: `background.scripts` вместо `service_worker`, `sidebar_action`, `browser_specific_settings.gecko` (`id: smartholdem-wallet@smartholdem.io`, `strict_min_version: 142.0`, `data_collection_permissions.required: ["none"]`).
6. Zip `dist-firefox/` (записи в корне архива — требование AMO).
7. `pack-source.mjs` — архив исходников.

Сборка детерминирована: два прогона дают побайтово одинаковый `dist-firefox/` (сами zip могут отличаться из-за mtime — сравнивать распакованные файлы).

---

## 7. Типовые проблемы

| Симптом | Решение |
|---|---|
| `gyp ERR! not found: make` | Не подхватился `.yarnrc` (скрытый файл). `yarn install --frozen-lockfile --ignore-scripts` |
| `Your lockfile needs to be updated` | `package.json` изменён без обновления `yarn.lock` → `yarn install`, закоммитить lock |
| `[vite:html-inline-proxy] No matching HTML proxy module` | `rm -rf node_modules/.vite && yarn build:firefox` |
| AMO: `Version already exists` | поднять версию (§3, п.1) |
| AMO: `Unsafe assignment to innerHTML` | сломан AMO sweep в `build-firefox.mjs` — проверить, что в выводе `✓ AMO sweep clean` |
| Шрифты не отображаются | `src/assets/fonts/*.woff2` должны быть в репо; Google Fonts отключены намеренно (AMO/CSP) |

---

## 8. Полезные ссылки

- Кабинет разработчика: https://addons.mozilla.org/developers/addons
- API-ключи: https://addons.mozilla.org/developers/addon/api/key/
- Требования к исходникам: https://extensionworkshop.com/documentation/publish/source-code-submission/
- Временная установка: `about:debugging#/runtime/this-firefox`
- Chrome Web Store: https://chrome.google.com/webstore/devconsole
- Репозиторий: https://github.com/smartholdem/core-wallet
