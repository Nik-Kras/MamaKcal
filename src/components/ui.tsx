import React from "react";
import { PixelRatio, Pressable, PressableProps, StyleProp, Text, TextProps, ViewStyle } from "react-native";

import { C, F } from "../theme";

type W = keyof typeof F;

/** Outline of a field or an outlined button (C.dashed is 1.5:1, too faint to see the edge). */
export const OUTLINE = C.border;

/** Text in Rubik. `w` picks the weight (one font family per weight on Android). */
export function T({
  w = "r",
  size = 18,
  color = C.ink,
  style,
  ...rest
}: TextProps & { w?: W; size?: number; color?: string }) {
  return <Text {...rest} style={[{ fontFamily: F[w], fontSize: size, color }, style]} />;
}

/** Pressable with visible touch feedback (dimmed while pressed, Android ripple). */
export function Tap({
  style,
  ripple = "rgba(0,0,0,0.08)",
  ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; ripple?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      android_ripple={{ color: ripple, borderless: false, foreground: true }}
      style={({ pressed }) => [{ overflow: "hidden" }, style, pressed && { opacity: 0.75 }]}
      {...rest}
    />
  );
}

/** The big blue button. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  height = 68,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  height?: number;
  icon?: React.ReactNode;
  testID?: string;
}) {
  // With the phone's largest text the icon would squeeze the label into
  // mid-word breaks ("Сфотогр-афувати"); the words matter more than the icon.
  const large = PixelRatio.getFontScale() >= 1.5;
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      ripple="rgba(255,255,255,0.18)"
      style={{
        minHeight: height,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 22,
        backgroundColor: disabled ? C.disabled : C.accent,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
      }}
    >
      {large ? null : icon}
      <T w="sb" size={21} color="#FFFFFF" style={{ textAlign: "center", flexShrink: 1 }}>
        {label}
      </T>
    </Tap>
  );
}
