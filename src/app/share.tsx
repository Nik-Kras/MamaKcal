import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import { ScrollView, Share, useWindowDimensions, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareImage } from "../../modules/share-image";
import { BackIcon, SendIcon } from "../components/icons";
import { DayCard, WeekCard } from "../components/ShareCard";
import { PrimaryButton, T, Tap } from "../components/ui";
import { record, reportError } from "../diag/diagnostics";
import { todayISO } from "../lib/format";
import { navOnce } from "../lib/navOnce";
import { addDays, dayReport, dayText, weekReport, weekText, type SharePeriod } from "../lib/share";
import { useStore, useToday } from "../store/store";
import { C } from "../theme";

const PERIODS: { id: SharePeriod; label: string }[] = [
  { id: "today", label: "Сьогодні" },
  { id: "yesterday", label: "Вчора" },
  { id: "week", label: "Тиждень" },
];

/** «Поділитися»: the day or the week as a picture with a caption, sent through Android's share menu. */
export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { meals, settings } = useStore();
  const now = useToday();
  const [period, setPeriod] = useState<SharePeriod>("today");
  const [busy, setBusy] = useState(false);
  const shot = useRef<View>(null);

  const today = todayISO(now);
  const day = period === "week" ? null : dayReport(meals, period === "today" ? today : addDays(today, -1), settings.norm);
  const week = period === "week" ? weekReport(meals, today, settings.norm) : null;
  const empty = day ? day.meals.length === 0 : week!.average === null;
  const text = day ? dayText(day) : weekText(week!);
  const cardWidth = Math.min(width - 32, 440);

  const send = async () => {
    if (busy || empty) return;
    setBusy(true);
    record("share", { period });
    try {
      if (!ShareImage) throw new Error("ShareImage module missing");
      const uri = await captureRef(shot, { format: "jpg", quality: 0.92, result: "tmpfile" });
      await ShareImage.share(uri, text, "Надіслати через");
    } catch (err) {
      // The picture failed: the words alone still tell him what she ate.
      reportError(err, "share");
      await Share.share({ message: text }).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Tap
          onPress={() => navOnce(() => router.back())}
          accessibilityLabel="Назад"
          style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 }}
        >
          <BackIcon size={28} color={C.ink} />
        </Tap>
        <T w="sb" size={28} accessibilityRole="header">
          Поділитися
        </T>
      </View>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <T w="m" size={19}>
          Що надіслати?
        </T>
        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
          {PERIODS.map((p) => {
            const on = p.id === period;
            return (
              <Tap
                key={p.id}
                testID={`share-${p.id}`}
                onPress={() => setPeriod(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={{
                  flex: 1,
                  minHeight: 56,
                  paddingHorizontal: 4,
                  borderRadius: 28,
                  borderWidth: 2,
                  borderColor: on ? C.accent : C.border,
                  backgroundColor: on ? C.accent : C.surface,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <T w="m" size={18} color={on ? "#FFFFFF" : C.ink} numberOfLines={1} adjustsFontSizeToFit>
                  {p.label}
                </T>
              </Tap>
            );
          })}
        </View>
      </View>

      <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ alignItems: "center", paddingBottom: 12 }}>
        <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
          {/* Captured as the picture: no rounded corners of its own (a JPEG has no transparency). */}
          <View ref={shot} collapsable={false}>
            {day ? <DayCard r={day} width={cardWidth} /> : <WeekCard r={week!} width={cardWidth} />}
          </View>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16, gap: 10 }}>
        <T size={16} color={C.muted} style={{ textAlign: "center" }}>
          {empty
            ? period === "week"
              ? "За тиждень нічого не записано"
              : "За цей день нічого не записано"
            : "Далі виберіть Telegram і кому надіслати"}
        </T>
        <PrimaryButton
          testID="share-send"
          label="Надіслати"
          height={72}
          icon={<SendIcon size={26} color="#FFFFFF" />}
          disabled={empty || busy}
          onPress={() => void send()}
        />
      </View>
    </View>
  );
}
