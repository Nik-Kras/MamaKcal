import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AlertIcon } from "../components/icons";
import { PrimaryButton, T, Tap } from "../components/ui";
import { isDemo } from "../lib/recognize";
import { navOnce } from "../lib/navOnce";
import { useStore, type AnalysisStatus } from "../store/store";
import { C } from "../theme";

const ERRORS: Record<Exclude<AnalysisStatus, "working" | "done">, { title: string; hint: string }> = {
  nofood: { title: "Не бачу їжі на фото", hint: "Сфотографуйте тарілку ближче й зверху. Або впишіть продукти вручну." },
  failed: { title: "Не вдалося розпізнати", hint: "Спробуйте ще раз. Або впишіть продукти вручну." },
  nomodel: { title: "Розпізнавання ще не завантажене", hint: "Завантажте його на головному екрані (кнопка «Завантажити»). А поки впишіть продукти вручну." },
};

/** The Скасувати button sits where the camera shutter was: ignore taps from a double-tapped shutter. */
const CANCEL_GUARD_MS = 1000;
/** After this long the wait text changes so she knows it hasn't frozen. */
const SLOW_MS = 15_000;

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={{ minHeight: 56, alignItems: "center", justifyContent: "center", borderRadius: 16 }}>
      <T w="sb" size={19} color={C.accent}>
        {label}
      </T>
    </Tap>
  );
}

export default function Analyzing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { analysis, retryAnalysis, cancelAnalysis, draftFromAnalysis } = useStore();

  useEffect(() => {
    if (analysis?.status === "done") router.replace("/review");
  }, [analysis?.status, router]);

  // Leaving this screen (Back or Скасувати) stops the request.
  useEffect(() => () => cancelAnalysis(), [cancelAnalysis]);

  const shownAt = useRef(Date.now());
  const [slow, setSlow] = useState(false);
  const runId = analysis?.id;
  const working = analysis?.status === "working";
  useEffect(() => {
    setSlow(false);
    if (!working) return;
    const t = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(t);
  }, [runId, working]);

  // No analysis at all = we are leaving (e.g. after «Вписати вручну»): show a blank screen, not an error.
  const blank = !analysis;
  const status = analysis?.status ?? "working";
  const error = status === "working" || status === "done" ? null : ERRORS[status];
  const toCamera = () => router.replace("/camera");

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: insets.bottom + 16, gap: 18 }}>
      <StatusBar style="dark" />
      {analysis?.photo ? (
        <Image
          source={{ uri: analysis.photo }}
          accessibilityLabel="Фото страви"
          style={{ height: 300, borderRadius: 24, backgroundColor: C.track }}
          resizeMode="cover"
        />
      ) : (
        <View style={{ height: 300, borderRadius: 24, backgroundColor: C.track }} />
      )}

      {blank ? null : error ? (
        <View style={{ gap: 10, paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AlertIcon size={34} color={C.ink} />
            <T w="m" size={22} style={{ flex: 1 }}>
              {error.title}
            </T>
          </View>
          <T size={17} color={C.muted}>
            {error.hint}
          </T>
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4 }} accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={C.accent} />
          <View style={{ flex: 1 }}>
            <T w="m" size={22}>
              Дивлюся, що на тарілці…
            </T>
            <T size={16} color={C.muted} style={{ marginTop: 2 }}>
              {isDemo() ? "Демо: показую приклад" : slow ? "Ще дивлюся, зачекайте…" : "Це може тривати до хвилини"}
            </T>
          </View>
        </View>
      )}

      <View style={{ flex: 1 }} />

      {blank ? null : error ? (
        <View style={{ gap: 6 }}>
          {status === "nomodel" ? (
            <PrimaryButton label="На головну" onPress={() => router.replace("/")} />
          ) : (
            <PrimaryButton label="Сфотографувати ще раз" onPress={toCamera} />
          )}
          {status === "failed" && analysis?.canRetry && <TextButton label="Спробувати ще раз" onPress={retryAnalysis} />}
          <TextButton
            label="Вписати вручну"
            onPress={() => {
              navOnce(() => {
                draftFromAnalysis();
                router.replace({ pathname: "/review", params: { add: "1" } });
              });
            }}
          />
        </View>
      ) : (
        <TextButton
          label="Скасувати"
          onPress={() => {
            if (Date.now() - shownAt.current < CANCEL_GUARD_MS) return;
            navOnce(toCamera);
          }}
        />
      )}
    </View>
  );
}
