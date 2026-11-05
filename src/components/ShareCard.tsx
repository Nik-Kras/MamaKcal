import React from "react";
import { TextProps, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { fmt, plural } from "../lib/format";
import { emptyDaysText, overText, type WeekReport } from "../lib/share";
import { C, F } from "../theme";
import { T } from "./ui";

/**
 * The week picture «Поділитися» sends (approved design: claude.ai/artifact/Qp5JTp3x7whG1r9LcGmWpS).
 * A day is sent as its meal photos and a text message instead (D24).
 * Drawn on screen as the preview and captured as it is, so what she sees is what is sent.
 * Text grows with her font size only up to 1.3×, so the picture keeps its layout.
 */

function CT(props: TextProps & { w?: keyof typeof F; size?: number; color?: string }) {
  return <T maxFontSizeMultiplier={1.3} {...props} />;
}

const card = { backgroundColor: C.surface, borderRadius: 20, padding: 16 } as const;

function Footer() {
  return (
    <CT size={12} color={C.muted} style={{ textAlign: "center", marginTop: 2 }}>
      Записано в застосунку «Калорії»
    </CT>
  );
}

const PLOT = 130;

export function WeekCard({ r, width }: { r: WeekReport; width: number }) {
  const over = overText(r);
  const empty = emptyDaysText(r);
  // The tallest bar, or a little above the target line, fills the plot.
  const top = Math.max(r.norm * 1.15, ...r.days.map((d) => d.kcal * 1.05));
  const normY = Math.round((r.norm / top) * PLOT);
  return (
    <View style={{ width, backgroundColor: C.bg, padding: 14, gap: 10 }}>
      <View style={{ ...card, gap: 8 }}>
        <CT size={16} color={C.muted}>
          {r.label}
        </CT>
        {r.average === null ? (
          <CT size={17} color={C.muted}>
            Нічого не записано
          </CT>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
              <CT w="sb" size={42} style={{ letterSpacing: -1 }}>
                {fmt(r.average)}
              </CT>
              <CT w="m" size={18}>
                ккал на день
              </CT>
            </View>
            <CT size={15} color={C.muted}>
              У середньому за {r.logged} {plural(r.logged, ["день", "дні", "днів"])} із записами. Норма {fmt(r.norm)}.
            </CT>
            {over ? <CT size={15}>Понад норму: {over}</CT> : null}
          </>
        )}
      </View>

      <View style={card}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 14 }}>
          <CT w="m" size={15}>
            Ккал за кожен день
          </CT>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Svg width={20} height={2}>
              <Line x1={0} y1={1} x2={20} y2={1} stroke={C.border} strokeWidth={2} strokeDasharray="4 3" />
            </Svg>
            <CT size={12} color={C.muted}>
              норма {fmt(r.norm)}
            </CT>
          </View>
        </View>
        <View style={{ height: PLOT, flexDirection: "row", alignItems: "flex-end" }}>
          {r.days.map((d) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  width: 22,
                  height: Math.round((d.kcal / top) * PLOT),
                  backgroundColor: C.accent,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                }}
              />
            </View>
          ))}
          <Svg width="100%" height={2} style={{ position: "absolute", left: 0, right: 0, bottom: normY - 1 }}>
            <Line x1={0} y1={1} x2="100%" y2={1} stroke={C.border} strokeWidth={2} strokeDasharray="6 5" />
          </Svg>
        </View>
        <View style={{ height: 2, backgroundColor: C.dashed }} />
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          {r.days.map((d, i) => (
            <View key={d.date} style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <CT w={i === r.days.length - 1 ? "sb" : "r"} size={14}>
                {d.short}
              </CT>
              <CT size={11} color={C.muted} numberOfLines={1}>
                {d.logged ? fmt(d.kcal) : "—"}
              </CT>
            </View>
          ))}
        </View>
        {empty && r.average !== null ? (
          <CT size={13} color={C.muted} style={{ marginTop: 10 }}>
            {empty}: нічого не записано
          </CT>
        ) : null}
      </View>
      <Footer />
    </View>
  );
}
