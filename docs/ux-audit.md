# UX and bug audit (2026-10-29, v1.1.0 → v1.2.0)

Method, as for GymLog and iMannequin: five review-only agents ran in parallel with the globally installed
UX skills as checklists, then their findings were merged, de-duplicated and fixed by three agents with
separate files, and checked on the emulator (S21 density, demo recognition).

| Agent | Role | Skills used as checklists |
|---|---|---|
| ui-ux-tester | Live test on the emulator as a hurried, clumsy first-time user | android-emulator-skill, navigation-event |
| mobile-app-developer | Code review: back, keyboard, state, lifecycle, memory, performance | compose-state-and-effects, compose-focus-navigation, modern-jetpack-compose, anr-audit-and-fix, compose-performance, compose-performance-audit, jetpack-compose-performance |
| ux-researcher | Interaction design and flow (Nielsen) | interaction-design, mobile-android-design, compose-animations |
| accessibility-tester | TalkBack, targets, contrast, large text | android-accessibility, accessibility-compliance |
| ui-visual-validator | Visuals, insets, consistency | edge-to-edge |

✅ fixed in 1.2.0 · ⏸ left as is (reason) · 📱 needs a check on the real phone

## Wrong calories or lost work
1. ✅ P0 A decimal weight lost its comma: «1,5» was saved as 15 g, «0,5» as 5 (also in a new product's kcal). Weights now take one decimal.
2. ✅ P1 Naming an unknown food was learned for good after one pick (her first, often random pick decided every later plate). Now after the same pick twice, like other corrections (D21).
3. ✅ P1 The review draft lived only in memory: a kill or a font-size change dropped her on Home without the photo or the weights. The draft is saved and the review reopens.
4. ✅ P1 Back on a fresh, untouched result threw the photo's result away without asking. Now asks «Вийти без запису?».
5. ✅ P1 The 3.7 GB model stayed loaded in the background, making the app the first thing Android kills. It is freed when the app goes to the background.
6. ✅ P2 A line with an empty or 0 weight showed «0 ккал зважено» and vanished from the saved meal. It now blocks logging («Впишіть вагу»).
7. ✅ P2 Reopening a logged meal showed every line as «зважено». Each line keeps its state.
8. ✅ P2 "Fried potatoes" matched the potato-and-beans dish (via its alias "baked potato"). One-word foods now go to the everyday default. Benchmark unchanged (57 % found, 2.5 edits per plate).
9. ✅ P2 A logged meal and its cleared draft are written together, so a kill can't leave it to be logged twice.

## Blocked or confused
10. ✅ P1 The grey «Уточніть 1 продукт» button did nothing and the unknown line was off-screen. Unknown lines come first; the button reads «Оберіть продукт» and opens the picker.
11. ✅ P1 A double tap on the shutter hit «Скасувати» (same spot) and cancelled. Скасувати ignores taps for 1 s and returns to the camera.
12. ✅ P1 The wait screen promised «Кілька секунд» for up to a minute. Now «Це може тривати до хвилини», then «Ще дивлюся, зачекайте…».
13. ✅ P1 «Не бачу їжі» / «Не вдалося розпізнати» only retried the same photo. Now «Сфотографувати ще раз» first.
14. ✅ P1 The number keyboard cut the Записати bar; sheets left a gap above it. The keyboard height now includes the system bar. 📱
15. ✅ P1 The camera looked broken while starting (dim shutter, swallowed taps). Shows «Камера готується…»; buttons are disabled while a photo is taken.
16. ✅ P2 The shutter could stay dead after a fast first tap (global navigation lock), and a late photo after Close replaced Home. Both guarded.
17. ✅ P2 The model warmed up while the camera was still starting. Now after the camera is ready.
18. ✅ P2 After a model load failure every photo waited for the timeout. Fails fast; the next camera visit tries again. Timeout 90 s.
19. ✅ P2 English model names («Mixed vegetables», «Pork chop») were shown to her. Removed; the picker's «Схожі» does the work (unknown names now get suggestions).
20. ✅ P2 Only one removal could be undone, for 6 s. Up to 5, 10 s each.
21. ✅ P2 Typed-in meals were titled «Перевірте вагу» and added foods started at a silent 100 g. Title «Що ви з’їли?»; a picked food starts without a weight and its field gets focus.
22. ✅ P2 A new product's kcal above 900 disabled «Додати» without a word. Shows the range.
23. ✅ P2 The review header was mostly text (4-line dish name, legend, 3-sentence hint). Dish name 2 lines, one hint line.
24. ✅ P2 The daily target was an underlined number. Blue with a pencil, 48 dp target; the norm sheet opens the keyboard. 📱
25. ✅ P3 The analysis screen flashed «Не вдалося розпізнати» when she chose «Вписати вручну»; the review went blank while sliding away after logging. Both fixed.
26. ✅ P3 The piece stepper's + moved at 2 digits. Fixed width.

## Accessibility and visuals
27. ✅ P2 «≈ на око» / «зважено» were 14 sp. Now 16 sp.
28. ✅ P2 TalkBack: grams field labels say «на око» / «зважено» / «вага не вписана»; meal rows include the dish; the sheet backdrop is no longer a full-screen «Закрити» read first.
29. ✅ P3 Search field and outlined buttons had 1.6:1 borders. New `C.border` (3.7:1). Search field 52 dp.
30. ✅ P3 Number fields have a Done key. «3,7 ГБ» no longer breaks across lines.

## Left as is
- ⏸ The big kcal number on Home is capped at 1.4× font scale (60 sp × 1.4 is already 84 sp).
- ⏸ Meal titles by log time (Сніданок/Обід/Вечеря): a design choice in the prototype.
- ⏸ «Записано» vs «Збережено» toasts: different actions (new meal vs edit).
- ⏸ Store context not memoized; history rewritten on each save; backup is only the previous save: no measurable cost at this size (revisit after months of data).
- ⏸ Grams up to 9 999 without a warning; a recent wrong match shows up in «Нещодавні».
- 📱 Photo thumbnails were black on the emulator (its virtual camera); check on the S21. Gallery pick while the model is loaded, and the 1.3× Samsung font scale, also need the phone.
