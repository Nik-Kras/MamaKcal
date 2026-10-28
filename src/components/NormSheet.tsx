import React, { useEffect, useRef, useState } from "react";
import { TextInput, View } from "react-native";

import { cleanAmount, parseAmount } from "../lib/nutrition";
import { useStore } from "../store/store";
import { C, F } from "../theme";
import { Sheet, useFocusWhenShown } from "./Sheet";
import { PrimaryButton, T } from "./ui";

const MIN = 1000;
const MAX = 4000;

/** Change the daily calorie target. */
export function NormSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { settings, setNorm } = useStore();
  const [text, setText] = useState(String(settings.norm));
  const input = useRef<TextInput>(null);
  useFocusWhenShown(input, visible);

  useEffect(() => {
    if (visible) setText(String(settings.norm));
  }, [visible, settings.norm]);

  const n = parseAmount(text);
  const ok = n >= MIN && n <= MAX;

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
            style={{
              minWidth: 140,
              minHeight: 60,
              paddingVertical: 4,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: C.accent,
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
