# Калорії (MamaKcal)

A calorie tracker in Ukrainian for one person: photograph the plate, a model **on the phone** lists what's on it with guessed amounts, re-weigh each item on a kitchen scale, fix what it got wrong (swap, remove, add a food), tap **Записати**. Built for a Samsung Galaxy S21. Nothing leaves the phone.

- Product scope: [docs/PRD.md](docs/PRD.md) · decisions: [docs/decisions.md](docs/decisions.md)
- Approved prototype: https://claude.ai/artifact/25VmupG6vUxjJqnvnCeZiZ

## Layout

```
src/app/            screens (Expo Router): index · camera · analyzing · review
src/components/     Sheet, PickSheet (add / fix a food), NormSheet (daily target), icons, ui
src/store/          store.tsx (state + actions), persistence.ts (SQLite)
src/lib/            match (model name → food, port of bench/match.py), recognition (parse the model's answer),
                    recognize (calls the on-device model), format, nutrition, search, photo
src/data/           foods.json (from the MacroTrack spreadsheet: `pnpm foods`), foods.ts (pieces, Ukrainian names)
modules/litert-lm/  Expo native module: Gemma 3n E2B through LiteRT-LM, on the phone's GPU
bench/              the food-photo benchmark that chose the model and the approach (bench/README.md)
```

## Develop

```bash
pnpm install
pnpm test          # unit tests, incl. the matcher agreeing with the benchmarked Python one
pnpm typecheck
pnpm foods         # regenerate src/data/foods.json after editing the MacroTrack spreadsheet
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

The model file is not in the APK. Copy it onto the phone once, over USB, into the app's own folder:

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

## Install on her phone

Release builds are signed by `plugins/withReleaseSigning.js` with the keystore at `~/.android/mamakcal-release.jks`; its passwords are in `~/.gradle/gradle.properties` (`MAMAKCAL_*`). **Back up both.** Without them no update can ever be installed over her copy.

```bash
CI=1 npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk   # over USB
```

Or send her the APK file. On the S21: allow **Install unknown apps** for the app that opens the file, and switch off **Auto Blocker** (Settings → Security and privacy) for the install. Always sign with the same keystore, or an update will refuse to install over the old version and her data would be lost.
