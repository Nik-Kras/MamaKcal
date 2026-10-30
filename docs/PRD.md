# Калорії (MamaKcal): Product Requirements

Status: **v1 in build** · Last updated: 2026-10-28
Approved prototype: https://claude.ai/artifact/25VmupG6vUxjJqnvnCeZiZ

## 1. User and goal

- **One user**: the developer's mother. Ukrainian UI only. Samsung Galaxy S21, latest Android.
- She wants to log calories **fast**, a few times a day, without learning an app.
- Her flow: photograph the plate → the app lists what's on it with guessed amounts → she re-weighs each item on a kitchen scale, fixes the numbers → one tap logs the meal.

## 2. Principles

- **Fewest buttons.** One big button on the main screen. No settings screen, stats, macros, tabs or onboarding.
- **Every number is editable** before saving, and every saved meal can be changed or deleted.
- **Undo instead of "are you sure"**: logging, editing and deleting show a 10-second toast with Скасувати / Повернути. The one confirmation is leaving the check screen with unsaved changes (that loses work for good).
- Large text (body 17–20 px, numbers 20–60 px), touch targets ≥ 48 dp, contrast ≥ 4.5:1, follows Android font size.
- Tone: short and friendly. Never praise eating less; no alarm colours when over the target.

## 3. Screens

1. **Головна (Today)**: kcal left (or "Понад норму"), one progress bar, "З’їдено X з N ккал" (tap N to change the daily target), today's meals (photo, meal name by time, dish, kcal), the big **Сфотографувати їжу** button, and the toast.
2. **Фото**: live camera, shutter, **Галерея**, **Без фото** (type it in).
3. **Розпізнавання**: the photo, "Дивлюся, що на тарілці…", Скасувати. Errors (no internet, no food seen, failed) offer **Спробувати ще раз** and **Вписати вручну**.
4. **Перевірка ваги**: photo, dish name, one card per product. AI guesses are yellow "≈ на око"; typing a weight or tapping −/+ turns the card "зважено". Tap a name to swap the product, × to remove (undo for a few seconds), **Додати продукт**, and **Записати · N ккал**. Unrecognised lines are listed first and block logging until she picks a food or removes them (the button then reads «Оберіть продукт» and opens the picker); so do lines with no weight («Впишіть вагу»). Weights may have one decimal («1,5»).
5. **Заміна / додавання продукту** (sheet): search, the AI's look-alikes and same-kind foods first; a name not in the list can be added with its kcal per 100 g.
6. Opening a logged meal shows the same check screen with **Зберегти** and **Видалити запис**.

## 4. Data

- Stored on the phone in SQLite (one JSON state row plus a backup row). Photos are files in the app's documents folder, resized to 1280 px.
- A logged meal keeps a snapshot of each line's name, kcal per 100 g and amount, so later changes to the food list don't rewrite history.
- kcal: known foods use the app's own list (`src/data/foods.ts`); unknown ones use the AI's estimate.

## 5. Recognition

- **On the phone**: Gemma 3n E2B through LiteRT-LM (decision D13). Photos and meals never leave the phone; only technical crash reports go to Sentry (D18). The model is downloaded once from the app (D19), and the app checks GitHub for a newer version (D20).
- The model names each food in English with grams (`food | grams` lines); code maps the names onto the
  food list (the MacroTrack spreadsheet), D14. Chosen by the benchmark in `bench/README.md`: about 55–58 %
  of foods found, 2–3 fixes per plate, a quarter of plates right first time.
- Because it is often wrong, fixing is part of the design:
  - **Wrong food** → tap its name: the picker starts with foods close to what the model saw, then her recent foods.
  - **Extra food** → ×, with "Повернути" for a few seconds.
  - **Missed food** → «Додати продукт», recent foods first, search in Ukrainian (or English), or a new product.
  - **A name that fits nothing** → an "Невідомий продукт" line she must resolve before logging (no calories are lost silently).
  - **Learning**: when she makes the same correction twice, that model name maps to her choice from then on.
- The model's answer is untrusted text: parsed line by line, numbers clamped (`src/lib/recognition.ts`).

## 6. Out of scope (v1)

History of past days, stats, macros, reminders, backup/export, multiple users, English UI.

## 7. Open questions for her

- Shared pot (borscht, varenyky): v1 assumes she weighs only what's on her plate.
- Frying oil: v1 folds it into "смажена" foods' kcal; the AI lists a visible sauce or oil separately.
- Does she want to see yesterday or a week?
