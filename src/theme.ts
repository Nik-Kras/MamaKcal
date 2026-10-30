// Tokens from the approved prototype (claude.ai/artifact/25VmupG6vUxjJqnvnCeZiZ).

export const C = {
  bg: "#F4F3EF",
  surface: "#FFFFFF",
  ink: "#1A1C20",
  muted: "#565A61",
  icon: "#6B6F76",
  line: "#E3E1DB",
  track: "#E6E4DE",
  soft: "#F0EEE9",
  dashed: "#C9C6BE",
  // Borders of inputs and outlined controls: 3.7:1 on white, 3.3:1 on bg (WCAG 1.4.11). Hairlines/dividers keep `line`.
  border: "#8A857B",
  accent: "#1650B8",
  // "на око" — the AI's guess, not yet weighed
  estBg: "#FFF3BF",
  estBorder: "#D9B42E",
  estText: "#6E5200",
  toast: "#23252A",
  toastAction: "#A9C4FF",
  disabled: "#6B6F76",
  camera: "#0F1012",
  scrim: "rgba(20,22,26,0.48)",
} as const;

// Rubik has full Cyrillic. On Android a custom font needs one family per weight.
export const F = {
  r: "Rubik_400Regular",
  m: "Rubik_500Medium",
  sb: "Rubik_600SemiBold",
} as const;
