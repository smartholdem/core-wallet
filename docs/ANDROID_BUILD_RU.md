# SmartHoldem Wallet — Android (Capacitor) · инструкция (RU)

Android-приложение — это тот же Vue-бандл, что и PWA, завёрнутый в нативную оболочку **Capacitor 8** (системный Android WebView). Никакого отдельного мобильного кода UI нет: всё, что работает в PWA, работает и в APK.

---

## 1. Структура

| Путь | Что это |
|---|---|
| `capacitor.config.ts` | appId `io.smartholdem.wallet`, `webDir: apps/dist-android`, схема `https://localhost` |
| `android/` | нативный Gradle-проект (коммитится в репо, как и у всех Capacitor-приложений) |
| `assets/` | исходники иконок/сплэша (`icon-only.png` 1024², `icon-foreground/background.png`, `splash*.png` 2732²) |
| `scripts/android-version.mjs` | переносит `version` из `package.json` в `versionName`/`versionCode` (`1.4.8` → `10408`) |
| `.github/workflows/android.yml` | CI: debug-APK всегда, подписанный AAB/APK — если заданы secrets |
| `src/lib/runtime.ts → isNativeApp()` | детект Capacitor; `main.ts` меняет `preview-shell` → `native-shell` (полный экран + safe-area) |

Хранилище: Pinia-стора персистятся в `localStorage` WebView (директория данных приложения, живёт до «Очистить данные»/удаления). Vault и так зашифрован AES-256-GCM PIN-кодом. Перенос в Android Keystore + биометрия — Фаза 2.

---

## 2. Команды

| Команда | Результат |
|---|---|
| `yarn build:android` | `vue-tsc` → `vite build --mode android` → синк версии → `cap sync android` (копирует web-бандл в `android/app/src/main/assets/public`) |
| `yarn android:apk` | `build:android` + `gradlew assembleDebug` → `android/app/build/outputs/apk/debug/app-debug.apk` |
| `yarn android:aab` | `build:android` + `gradlew bundleRelease` → `.aab` для Play (нужна подпись, см. §4) |
| `yarn android:open` | открыть проект в Android Studio |
| `yarn android:assets` | перегенерировать иконки/сплэш из `assets/` (после смены логотипа) |

Debug-APK подписан debug-ключом Gradle — ставится на любой телефон через `adb install` или файловый менеджер («Установка из неизвестных источников»).

---

## 3. Локальное окружение

- Node 24 (`.nvmrc`), Yarn 1.22 — как для расширения. **Capacitor CLI требует Node ≥ 22.**
- **JDK 21** (Temurin): `sudo apt install openjdk-21-jdk-headless` или Android Studio (в комплекте).
- **Android SDK**: платформа 36, build-tools 36.0.0. Проще всего Android Studio Otter (2025.2+) → SDK Manager. Без Studio:
  ```bash
  mkdir -p ~/android-sdk/cmdline-tools && cd ~/android-sdk/cmdline-tools
  curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o t.zip && unzip -q t.zip && mv cmdline-tools latest
  yes | latest/bin/sdkmanager --sdk_root=$HOME/android-sdk --licenses
  latest/bin/sdkmanager --sdk_root=$HOME/android-sdk "platforms;android-36" "build-tools;36.0.0" "platform-tools"
  export ANDROID_HOME=$HOME/android-sdk
  ```
- Первый `gradlew` скачает Gradle 8.14 и зависимости (~500 МБ), далее кэш.

Быстрый старт:
```bash
yarn install --frozen-lockfile
yarn android:apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 4. Подпись релиза (Google Play)

Один раз создать keystore (хранить вне репо, бэкап обязателен — потерянный ключ = невозможность обновлять приложение):
```bash
keytool -genkeypair -v -keystore smartholdem-wallet.keystore -alias smartholdem \
  -keyalg RSA -keysize 4096 -validity 10000
```

Локальная подпись без правки `build.gradle` (после клона бит исполнения у `gradlew` может потеряться — `chmod +x` один раз):
```bash
cd android && chmod +x gradlew && ./gradlew bundleRelease \
  -Pandroid.injected.signing.store.file=/path/smartholdem-wallet.keystore \
  -Pandroid.injected.signing.store.password='…' \
  -Pandroid.injected.signing.key.alias=smartholdem \
  -Pandroid.injected.signing.key.password='…'
```

CI (GitHub → Settings → Secrets → Actions):

| Secret | Значение |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 smartholdem-wallet.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | пароль keystore |
| `ANDROID_KEY_ALIAS` | `smartholdem` |
| `ANDROID_KEY_PASSWORD` | пароль ключа |

Workflow запускается вручную (Actions → Android → Run workflow) или по тегу `v*`. Без secrets собирает только debug-APK; с secrets — плюс подписанные `.aab` и `.apk` в артефактах.

Google Play при первой публикации предложит **Play App Signing** — соглашаться: тогда наш ключ становится upload-key, а ключ подписи хранит Google.

---

## 5. Версионирование

`versionName` и `versionCode` не редактировать руками — они перезаписываются из `package.json` при каждом `yarn build:android`. Поднимать версию в одном месте (`package.json`, плюс `manifest.json`/локали для расширения). `versionCode = major·10000 + minor·100 + patch` — монотонно растёт, как требует Play.

---

## 6. Что отличается от расширения

- Нет `chrome.*` API → dApp-мост расширения (`inject.js`/`bridge.js`, background) в Android не участвует; вместо него — встроенный dApp-браузер (§7).
- Внешние ссылки открываются в системном браузере (Capacitor по умолчанию).
- Сетевые запросы идут напрямую к `*.smartholdem.io` (CSP расширения здесь не действует).
- `surfaceLabel()` возвращает `"android"`, `<html data-surface="android">` — можно вешать мобильные CSS-твики.

---

## 7. Фаза 2 — реализовано

| Фича | Где | Как работает |
|---|---|---|
| **dApp-браузер** | вкладка «dApps» в нижней панели (только в приложении), `views/DappBrowser.vue`, `lib/dappBrowser.ts` | Capgo InAppBrowser открывает сайт в нативном WebView и на `documentStart` инжектит `src/inject/mobile-provider.js` (тот же `window.smartholdem` API). Запрос из страницы → `window.mobileApp.postMessage` → кошелёк скрывает WebView, показывает ту же модалку (Connect / Sign / Message), результат уходит обратно через `postMessage` (`messageFromNative`), WebView возвращается. Доверенные сайты (`lib/origins.ts`, `localStorage`) получают `getAccount` без запроса; при заблокированном кошельке запрос отклоняется с понятной ошибкой. Кнопка «Вернуться к …» — если WebView скрыт. |
| **QR-сканер** | кнопка «Скан QR» над полем получателя в Transfer, `lib/qr.ts` | `@capacitor/barcode-scanner` (ML Kit на Android, html5-qrcode в web). Понимает голый адрес, `smartholdem:S…?amount=&memo=` (`sth:`, `vendorField=`), JSON `{address, amount, memo}`. Заполняет адрес/сумму/memo. |
| **Биометрия + Keystore** | Settings → «Биометрическая разблокировка» (только в приложении), кнопка на экране блокировки, `lib/secure.ts`, `lib/storage.ts` | Зашифрованный vault (`sth.auth`) хранится в `@aparajita/capacitor-secure-storage` (Android Keystore / iOS Keychain), не в `localStorage`; при первом запуске мигрирует автоматически. Включение биометрии: PIN → системный биометрический промпт → PIN сохраняется в Keystore. Разблокировка: промпт → PIN из Keystore → `auth.unlock`. Отключение/wipe удаляют запись. |

Требования: `minSdkVersion 26` (Android 8.0 — требование библиотеки сканера), permissions `CAMERA`, `USE_BIOMETRIC` (в `AndroidManifest.xml`). Debug-APK ≈ 42 МБ; release собирается с R8 (`minifyEnabled` + `shrinkResources`, правила в `app/proguard-rules.pro`) ≈ 28 МБ — остаток почти целиком нативные библиотеки ML Kit.

Ограничение: биометрия защищает *доступ* к PIN в Keystore на уровне ОС, но ключ Keystore не привязан к биометрии криптографически (плагин так не умеет). Для банковского уровня — Фаза 3: `setUserAuthenticationRequired` через собственный плагин.

---

## 8. Фаза 3 (план)

1. Авто-лок при уходе в фон и обработка кнопки «Назад» (`@capacitor/app`).
2. Deep links `smartholdem://` (вызов подписи из внешних приложений).
3. iOS-таргет (`npx cap add ios`, macOS/Xcode).

---

## 9. Типовые проблемы

| Симптом | Решение |
|---|---|
| `The Capacitor CLI requires NodeJS >=22` | `nvm use` (Node 24) |
| `SDK location not found` | `export ANDROID_HOME=…` или `android/local.properties` с `sdk.dir=` (файл в .gitignore) |
| `Could not determine java version` / AGP требует JDK 21 | `export JAVA_HOME=/path/jdk-21` |
| Белый экран после запуска | `yarn build:android` не выполнялся → пустой `assets/public`; либо ошибка JS — смотреть `chrome://inspect` при подключённом телефоне |
| Приложение показывает «рамку» 400×720 | `isNativeApp()` вернул false — проверить, что WebView открыт из Capacitor, а не через внешний браузер |
