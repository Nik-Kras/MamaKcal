# Калорії (MamaKcal)

A calorie tracker in Ukrainian for one person: photograph the plate, a model **on the phone** lists what's on it with guessed amounts, re-weigh each item on a kitchen scale, fix what it got wrong (swap, remove, add a food), tap **Записати**. Built for a Samsung Galaxy S21. Photos and meals never leave the phone.

- Product scope: [docs/PRD.md](docs/PRD.md) · decisions: [docs/decisions.md](docs/decisions.md)
- Approved prototype: https://claude.ai/artifact/25VmupG6vUxjJqnvnCeZiZ

## Install on the phone

<img src="docs/install-qr.png" width="200" alt="QR code: download MamaKcal.apk">

**1. The app.** Scan the QR with the phone camera (or open
[MamaKcal.apk](https://github.com/Nik-Kras/MamaKcal/releases/latest/download/MamaKcal.apk) on the phone), open the
downloaded file and tap **Install**. If Samsung blocks it: allow **Install unknown apps** for Chrome, or switch off
**Auto Blocker** (Settings → Security and privacy). Then **open the app once**, so its folder exists.

**2. The photo model (once, 3.7 GB, over Wi‑Fi).** On the home screen tap **Завантажити** in the card
«Розпізнавання їжі на фото». Android downloads it in the background (a notification shows the progress; the app can be
closed), then the app joins and checks the file and says «Готово». It comes from the
[model release](https://github.com/Nik-Kras/MamaKcal/releases/tag/model-gemma-3n-e2b-int4) of this repo: Google's
unmodified `gemma-3n-E2B-it-int4.litertlm`, split in two because GitHub limits files to 2 GiB. Gemma is provided under
and subject to the Gemma Terms of Use found at [ai.google.dev/gemma/terms](https://ai.google.dev/gemma/terms).

**3. Use it.** Open «Калорії», tap **Сфотографувати їжу**, photograph the plate from above. The first photo also loads
the model, so it takes longer. Without the model the app still works with manual entry («Без фото»).

Updates: when a newer release exists, the home screen shows «Є нова версія Калорій · Оновити». Оновити opens the new `MamaKcal.apk` in the browser; open it and tap **Install**. Her meals and the model stay.

## Layout

```
src/app/            screens (Expo Router): index · camera · analyzing · review
src/components/     Sheet, PickSheet (add / fix a food), NormSheet (daily target), icons, ui
src/store/          store.tsx (state + actions), persistence.ts (SQLite)
src/lib/            match (model name → food, port of bench/match.py), recognition (parse the model's answer),
                    recognize (calls the on-device model), format, nutrition, search, photo
src/data/           foods.json (Ukrainian home food, sourced kcal: bench/catalogue, `pnpm foods`), foods.ts
modules/litert-lm/  Expo native module: Gemma 3n E2B through LiteRT-LM, on the phone's GPU
bench/              the food-photo benchmark that chose the model and the approach (bench/README.md)
```

## Develop

```bash
pnpm install
pnpm test          # unit tests, incl. the matcher agreeing with the benchmarked Python one
pnpm typecheck
pnpm foods         # regenerate src/data/foods.json after editing bench/catalogue (see its README)
```

Gradle needs JDK 17 and the SDK path:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
npx expo run:android --port 8083     # 8081 is taken by Docker on this Mac
```

The emulator matches the S21's 360 dp width after `adb shell wm density 480`. `MamaKcal_API_35` (8 GB RAM) has room for the model file.

## The photo model

Recognition runs on the phone: **Gemma 3n E2B** (`gemma-3n-E2B-it-int4.litertlm`, 3.7 GB) through Google's
LiteRT-LM, image encoder on the GPU. The model names the foods in English (`food | grams` lines); `src/lib/match.ts`
maps the names onto the food list; her corrections are remembered (after the same correction twice). Why this
model and this approach: `bench/README.md`.

The model file is not in the APK. The app downloads it itself (the **Завантажити** card on the home screen,
`modules/litert-lm/…/ModelDownload.kt` + `src/components/ModelCard.tsx`; URLs and SHA-256 in `src/lib/modelFiles.ts`).
For development it can also be copied over USB into the app's own folder:

```bash
adb push bench/data/models/gemma-3n-E2B-it-int4.litertlm \
  /sdcard/Android/data/com.nikkras.mamakcal/files/models/gemma-3n-E2B-it-int4.litertlm
```

(Install the app and open it once first, so the folder exists. Download the file with
`huggingface_hub` from `google/gemma-3n-E2B-it-litert-lm`; the repo is gated: accept Google's licence on
Hugging Face first.) Without the file, a **debug** build answers every photo with a sample plate ("Демо") so the
flow can be tried; a release build says recognition isn't installed and offers manual entry.

**The model needs a real phone GPU with OpenCL.** On the Android emulator it loads (about 40 s the first time) but the
image step stops with "Can not find OpenCL library on this device", and the app shows «Не вдалося розпізнати». Test
recognition on the S21 itself (Samsung ships OpenCL); check `adb logcat | grep -iE "litert|LiteRtLm"` if it fails.

## Release builds

Release builds are signed by `plugins/withReleaseSigning.js` with the keystore at `~/.android/mamakcal-release.jks`; its passwords are in `~/.gradle/gradle.properties` (`MAMAKCAL_*`). **Back up both.** Without them no update can ever be installed over her copy.

```bash
pnpm release:android   # prebuild + arm64 release APK, source maps uploaded to Sentry
# → android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk   # over USB
```

New version: bump `version` and `android.versionCode` in `app.json`, build, then attach the APK to a release tagged `vX.Y.Z` under the fixed name `MamaKcal.apk`. The QR (`pnpm qr` redraws it) and the in-app «Є нова версія» banner both use the latest release. The model release (`model-gemma-3n-e2b-int4`) must never become "latest" (`--latest=false`).

```bash
cp android/app/build/outputs/apk/release/app-release.apk /tmp/MamaKcal.apk
GH_TOKEN=$(gh auth token --user Nik-Kras) gh release create v1.0.1 /tmp/MamaKcal.apk --repo Nik-Kras/MamaKcal --target main
```

Or send her the APK file. On the S21: allow **Install unknown apps** for the app that opens the file, and switch off **Auto Blocker** (Settings → Security and privacy) for the install. Always sign with the same keystore, or an update will refuse to install over the old version and her data would be lost.

## Crash reports

Release builds send crash reports to Sentry (EU region, org `mykyta-krasnytskyi`, project `mamakcal`; decision D18). Technical data only: no photos, food names, weights, screenshots or touch breadcrumbs. The IP isn't stored (project setting "Prevent Storing of IP Addresses"); Sentry still derives an approximate city from it. `src/diag/` holds the setup and a black box that, on the next start, reports a kill in the middle of loading or running the photo model (likely out of memory); model load/run times show up as `model.load` / `model.describe` spans.

- DSN: `.env.production` (a DSN can only send events, so it's committed).
- Source maps: `pnpm release:android` reads `SENTRY_AUTH_TOKEN` from the git-ignored `.env.sentry-build-plugin`. Without that file it builds without uploading.
- Check that reporting works: `adb shell am start -a android.intent.action.VIEW -d mamakcal://sentry-test` throws "MamaKcal Sentry verification error".
