import React, { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { fmt, fmtG } from "../lib/format";
import { cleanAmount, FIBRE_PER_1000, macroTargets, MACRO_SPLIT, parseAmount } from "../lib/nutrition";
import { useStore } from "../store/store";
import { C, F } from "../theme";
import { MACRO_ROWS } from "./Macros";
import { Sheet } from "./Sheet";
import { PrimaryButton, T } from "./ui";

const MIN = 1000;
const MAX = 4000;

const pc = (x: number) => `${Math.round(x * 100)} %`;

/** Change the daily calorie target; the macro targets follow from it and are shown as she types. */
export function NormSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, setNorm } = useStore();
  const [text, setText] = useState(String(settings.norm));
  const input = useRef<TextInput>(null);

  // Focus after the sheet's slide-in; try again once if the keyboard didn't come up.
  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => input.current?.focus(), 400);
    const t2 = setTimeout(() => {
      if (!input.current?.isFocused()) input.current?.focus();
    }, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  useEffect(() => {
    if (visible) setText(String(settings.norm));
  }, [visible, settings.norm]);

  const n = parseAmount(text);
  const ok = n >= MIN && n <= MAX;
  const targets = macroTargets(ok ? n : settings.norm);

  return (
    <Sheet visible={visible} onClose={onClose} title="Денна норма">
      <View style={{ gap: 14, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TextInput
            value={text}
            onChangeText={(t) => setText(cleanAmount(t))}
            keyboardType="number-pad"
            ref={input}
            selectTextOnFocus
            maxLength={4}
            accessibilityLabel="Денна норма, кілокалорій"
            accessibilityHint={ok ? "Від 1 000 до 4 000 ккал." : "Впишіть число від 1 000 до 4 000."}
            style={{
              minWidth: 140,
              minHeight: 60,
              paddingVertical: 4,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: ok ? C.accent : C.ink,
              textAlign: "center",
              fontFamily: F.sb,
              fontSize: 28,
              color: C.ink,
            }}
          />
          <T size={20}>ккал на день</T>
        </View>
        <T size={16} color={ok ? C.muted : C.ink}>
          {ok ? "Від 1 000 до 4 000 ккал." : "Впишіть число від 1 000 до 4 000."}
        </T>
        <View
          accessible
          accessibilityLabel={`З цієї норми на день: ${MACRO_ROWS.map((r) => `${r.label.toLocaleLowerCase("uk")} ${fmtG(targets[r.key])} грамів`).join(", ")}.`}
          style={{ backgroundColor: C.soft, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 10 }}
        >
          <T size={17} color={C.muted}>
            З цієї норми на день:
          </T>
          {MACRO_ROWS.map((r) => (
            <View key={r.key} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: r.color }} />
              <T size={18} style={{ flex: 1 }}>
                {r.label}
              </T>
              <T w="sb" size={18}>
                {fmtG(targets[r.key])} г
              </T>
            </View>
          ))}
        </View>
        <T size={15} color={C.muted}>
          Білки — {pc(MACRO_SPLIT.p)} калорій, жири — {pc(MACRO_SPLIT.f)}, вуглеводи — {pc(MACRO_SPLIT.c)}. Клітковина — {FIBRE_PER_1000} г на кожну {fmt(1000)} ккал.
        </T>
        <PrimaryButton
          label="Зберегти"
          disabled={!ok}
          onPress={() => {
            setNorm(n);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}
