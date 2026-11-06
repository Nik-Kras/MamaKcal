import React from "react";
import { View } from "react-native";

import { fmtG } from "../lib/format";
import { C, MC } from "../theme";
import type { Macros } from "../types";
import { T } from "./ui";

export const MACRO_ROWS: { key: keyof Macros; label: string; color: string }[] = [
  { key: "p", label: "Білки", color: MC.p },
  { key: "f", label: "Жири", color: MC.f },
  { key: "c", label: "Вуглеводи", color: MC.c },
  { key: "fib", label: "Клітковина", color: MC.fib },
];

/**
 * The day's protein, fat, carbs and fibre against targets worked out from her kcal norm.
 * Over a target the bar is just full: no alarm colour (PRD: no alarm when over).
 */
export function MacroBars({ eaten, targets }: { eaten: Macros; targets: Macros }) {
  return (
    <View style={{ gap: 14 }}>
      {MACRO_ROWS.map((r) => {
        const cur = eaten[r.key];
        const tgt = targets[r.key];
        const pct = tgt > 0 ? Math.min(100, (cur / tgt) * 100) : 0;
        return (
          <View key={r.key} accessible accessibilityLabel={`${r.label}: ${fmtG(cur)} з ${fmtG(tgt)} грамів`} style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <T w="m" size={17}>
                {r.label}
              </T>
              <T size={17} color={C.muted}>
                <T w="m" size={17}>
                  {fmtG(cur)}
                </T>{" "}
                з {fmtG(tgt)} г
              </T>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: C.track, overflow: "hidden" }}>
              <View style={{ height: "100%", width: `${pct}%`, borderRadius: 4, backgroundColor: r.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
