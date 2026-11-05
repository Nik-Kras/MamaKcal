import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import { Image, ScrollView, Share, useWindowDimensions, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShareImage } from "../../modules/share-image";
import { BackIcon, CheckIcon, SendIcon } from "../components/icons";
import { WeekCard } from "../components/ShareCard";
import { PrimaryButton, T, Tap } from "../components/ui";
import { record, reportError } from "../diag/diagnostics";
import { todayISO } from "../lib/format";
import { navOnce } from "../lib/navOnce";
import {
  addDays,
  boldParts,
  dayMessage,
  dayPhotos,
  dayReport,
  weekReport,
  weekText,
  type SharePeriod,
} from "../lib/share";
import { useStore, useToday } from "../store/store";
import { C } from "../theme";

const PERIODS: { id: SharePeriod; label: string }[] = [
  { id: "today", label: "Сьогодні" },
  { id: "yesterday", label: "Вчора" },
  { id: "week", label: "Тиждень" },
];

const TITLE = "Надіслати через";

/**
 * «Поділитися», sent through Android's share menu (D23, D24).
 * A day: its meal photos as an album, then the formatted text as a second message
 * (Telegram drops text sent with several photos). The week: a picture with a caption.
 */
export default function ShareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { meals, settings } = useStore();
  const now = useToday();
  const [period, setPeriod] = useState<SharePeriod>("today");
  const [busy, setBusy] = useState(false);
  /** The period whose photos she already sent, so the text becomes the next step. */
  const [photosSent, setPhotosSent] = useState<SharePeriod | null>(null);
  const shot = useRef<View>(null);

  const today = todayISO(now);
  const day = period === "week" ? null : dayReport(meals, period === "today" ? today : addDays(today, -1), settings.norm);
  const week = period === "week" ? weekReport(meals, today, settings.norm) : null;
  const empty = day ? day.meals.length === 0 : week!.average === null;
  const photos = day ? dayPhotos(day) : [];
  const message = day ? dayMessage(day) : "";
  const sentPhotos = photosSent === period;
  const cardWidth = Math.min(width - 32, 440);
  const thumb = Math.floor((Math.min(width, 472) - 32 - 2 * 8) / 3);

  const run = async (step: string, fn: () => Promise<void>) => {
    if (busy || empty) return;
    setBusy(true);
    record("share", { period, step });
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const sendPhotos = () =>
    run("photos", async () => {
      try {
        if (!ShareImage) throw new Error("ShareImage module missing");
        await ShareImage.shareMany(photos, TITLE);
        setPhotosSent(period);
      } catch (err) {
        reportError(err, "share");
      }
    });

  const sendText = () => run("text", () => Share.share({ message }, { dialogTitle: TITLE }).then(() => undefined, () => undefined));

  const sendWeek = () =>
    run("week", async () => {
      const text = weekText(week!);
      try {
        if (!ShareImage) throw new Error("ShareImage module missing");
        const uri = await captureRef(shot, { format: "jpg", quality: 0.92, result: "tmpfile" });
        await ShareImage.share(uri, text, TITLE);
      } catch (err) {
        // The picture failed: the words alone still tell him what she ate.
        reportError(err, "share");
        await Share.share({ message: text }).catch(() => undefined);
      }
    });

  const hint = empty
    ? period === "week"
      ? "За тиждень нічого не записано"
      : "За цей день нічого не записано"
    : day && photos.length
      ? sentPhotos
        ? "Тепер текст: знову Telegram і кому надіслати"
        : "Спершу фото, потім текст. Обидва рази виберіть Telegram і кому надіслати"
      : "Далі виберіть Telegram і кому надіслати";

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
        {week ? (
          <View style={{ borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: C.line }}>
            {/* Captured as the picture: no rounded corners of its own (a JPEG has no transparency). */}
            <View ref={shot} collapsable={false}>
              <WeekCard r={week} width={cardWidth} />
            </View>
          </View>
        ) : (
          <View style={{ width: cardWidth, gap: 14 }}>
            {photos.length ? (
              <View style={{ gap: 8 }}>
                <T w="m" size={17} color={C.muted}>
                  Фото: {photos.length}
                </T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {photos.map((uri, i) => (
                    <View key={uri} style={{ width: thumb, height: thumb, borderRadius: 12, overflow: "hidden", backgroundColor: C.track }}>
                      <Image source={{ uri }} style={{ width: thumb, height: thumb }} accessibilityIgnoresInvertColors />
                      <View
                        style={{
                          position: "absolute",
                          left: 6,
                          top: 6,
                          minWidth: 26,
                          height: 26,
                          borderRadius: 13,
                          paddingHorizontal: 6,
                          backgroundColor: C.toast,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <T w="sb" size={14} color="#FFFFFF" maxFontSizeMultiplier={1.3}>
                          {i + 1}
                        </T>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {empty ? null : (
              <View style={{ gap: 8 }}>
                <T w="m" size={17} color={C.muted}>
                  Текст
                </T>
                <View style={{ backgroundColor: C.surface, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 14 }}>
                  {message.split("\n").map((line, i) => (
                    <T key={i} size={15} style={{ lineHeight: 21 }}>
                      {line
                        ? boldParts(line).map((p, j) =>
                            p.bold ? (
                              <T key={j} w="sb" size={15}>
                                {p.text}
                              </T>
                            ) : (
                              p.text
                            ),
                          )
                        : " "}
                    </T>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16, gap: 10 }}>
        <T size={16} color={C.muted} style={{ textAlign: "center" }}>
          {hint}
        </T>
        {week ? (
          <PrimaryButton
            testID="share-send"
            label="Надіслати"
            height={72}
            icon={<SendIcon size={26} color="#FFFFFF" />}
            disabled={empty || busy}
            onPress={() => void sendWeek()}
          />
        ) : photos.length ? (
          <>
            {sentPhotos ? (
              <OutlineButton testID="share-photos" label="Фото надіслано" icon={<CheckIcon size={24} color={C.accent} />} onPress={() => void sendPhotos()} disabled={busy} />
            ) : (
              <PrimaryButton
                testID="share-photos"
                label={`1. Надіслати фото (${photos.length})`}
                height={64}
                icon={<SendIcon size={24} color="#FFFFFF" />}
                disabled={busy}
                onPress={() => void sendPhotos()}
              />
            )}
            {sentPhotos ? (
              <PrimaryButton
                testID="share-text"
                label="2. Надіслати текст"
                height={64}
                icon={<SendIcon size={24} color="#FFFFFF" />}
                disabled={busy}
                onPress={() => void sendText()}
              />
            ) : (
              <OutlineButton testID="share-text" label="2. Надіслати текст" onPress={() => void sendText()} disabled={busy} />
            )}
          </>
        ) : (
          <PrimaryButton
            testID="share-text"
            label="Надіслати"
            height={72}
            icon={<SendIcon size={26} color="#FFFFFF" />}
            disabled={empty || busy}
            onPress={() => void sendText()}
          />
        )}
      </View>
    </View>
  );
}

/** The step that is not next: same size as the big button, outlined. */
function OutlineButton({
  label,
  onPress,
  disabled,
  icon,
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
  testID?: string;
}) {
  return (
    <Tap
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        minHeight: 64,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 22,
        borderWidth: 2,
        borderColor: C.accent,
        backgroundColor: C.surface,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      {icon}
      <T w="sb" size={20} color={C.accent} style={{ textAlign: "center", flexShrink: 1 }}>
        {label}
      </T>
    </Tap>
  );
}
