import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Keyboard, Modal, Pressable, TextInput, View, useWindowDimensions, type EmitterSubscription } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { C } from "../theme";
import { CloseIcon } from "./icons";
import { T, Tap } from "./ui";

/**
 * Keyboard height as React Native reports it on Android: without the gesture
 * bar, and measured only when the keyboard appears (see `focusFresh`).
 */
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
 * How far to lift what sits at the bottom of the screen so it rests right on
 * top of the keyboard; 0 while it is closed. The app draws edge to edge (the
 * window is not resized for the keyboard, in a <Modal> or not) and the reported
 * height leaves out the gesture bar, so lift by both.
 */
export function useKeyboardLift() {
  const kb = useKeyboardHeight();
  const insets = useSafeAreaInsets();
  return kb > 0 ? kb + insets.bottom : 0;
}

/**
 * Run `focus` after `delay` ms with a keyboard that opens fresh. Android tells
 * the app the keyboard height only when it appears, so a text keyboard that
 * turns into a number pad without closing keeps the taller height (a gap above
 * the keyboard, or a button under it). A keyboard still open is closed first.
 * Returns a cancel function.
 */
export function focusFresh(focus: () => void, delay = 350): () => void {
  let done = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sub: EmitterSubscription | undefined;
  const run = () => {
    if (done) return;
    done = true;
    sub?.remove();
    focus();
  };
  timer = setTimeout(() => {
    if (!Keyboard.isVisible()) return run();
    sub = Keyboard.addListener("keyboardDidHide", () => {
      clearTimeout(timer);
      timer = setTimeout(run, 150);
    });
    Keyboard.dismiss();
    timer = setTimeout(run, 800); // never left waiting if the hide is not reported
  }, delay);
  return () => {
    done = true;
    clearTimeout(timer);
    sub?.remove();
  };
}

/**
 * Focus a field once its sheet has slid in. `autoFocus` inside a Modal focuses
 * the field on Android but often leaves the keyboard closed.
 */
export function useFocusWhenShown(ref: React.RefObject<TextInput | null>, shown: boolean) {
  useEffect(() => {
    if (!shown) return;
    return focusFresh(() => ref.current?.focus());
  }, [ref, shown]);
}

/**
 * Bottom sheet: dimmed backdrop (tap to close), rounded top, title and a close
 * button. Android Back closes it too. `tall` gives a fixed height for lists.
 * With the keyboard open the sheet sits right on top of it.
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
  const lift = useKeyboardLift();
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

  const space = height - lift - insets.top - 24;
  const sheetHeight = tall ? Math.min(space, height * 0.8) : undefined;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* A tap beside the sheet closes it; TalkBack skips it and uses the close button. */}
        <Pressable
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.scrim }}
        />
        <Animated.View
          accessibilityViewIsModal
          style={{
            height: sheetHeight,
            maxHeight: space,
            marginBottom: lift,
            paddingBottom: lift > 0 ? 12 : insets.bottom + 16,
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
