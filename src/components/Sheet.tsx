import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Modal, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "../theme";
import { CloseIcon } from "./icons";
import { T, Tap } from "./ui";

/** Keyboard height. Inside a <Modal> Android does not resize the window, so sheets lift themselves. */
export function useKeyboardHeight() {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => setKb(e?.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return kb;
}

/**
 * Focus a field once its sheet has slid in. `autoFocus` inside a Modal focuses
 * the field on Android but often leaves the keyboard closed.
 */
export function useFocusWhenShown(ref: React.RefObject<TextInput | null>, shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => ref.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [ref, shown]);
}

/**
 * Bottom sheet: dimmed backdrop (tap to close), rounded top, title and a close
 * button. Android Back closes it too. `tall` gives a fixed height for lists.
 */
export function Sheet({
  visible,
  onClose,
  title,
  tall,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  tall?: boolean;
  children: React.ReactNode;
}) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const slide = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (!visible) return;
    slide.setValue(height);
    Animated.timing(slide, {
      toValue: 0,
      duration: 240,
      easing: Easing.bezier(0.2, 0.9, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, [visible, height, slide]);

  // The modal draws under the gesture bar, but Android reports the keyboard
  // height without it, so lift by both.
  const lift = kb > 0 ? kb + insets.bottom : 0;
  const space = height - lift - insets.top - 24;
  const sheetHeight = tall ? Math.min(space, height * 0.8) : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Закрити"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
        />
        <Animated.View
          accessibilityViewIsModal
          style={{
            height: sheetHeight,
            maxHeight: space,
            marginBottom: lift,
            paddingBottom: kb > 0 ? 12 : insets.bottom + 16,
            paddingHorizontal: 16,
            paddingTop: 10,
            backgroundColor: C.surface,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            transform: [{ translateY: slide }],
          }}
        >
          <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: "#D5D2CA" }} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, paddingTop: 6, paddingBottom: 10 }}>
            <T w="sb" size={22} accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </T>
            <Tap onPress={onClose} accessibilityLabel="Закрити" style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 24 }}>
              <CloseIcon size={24} color={C.ink} />
            </Tap>
          </View>
          {tall ? <View style={{ flex: 1 }}>{children}</View> : children}
        </Animated.View>
      </View>
    </Modal>
  );
}
