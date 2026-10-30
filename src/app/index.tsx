import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiteRtLm } from "../../modules/litert-lm";
import { CameraIcon, CheckIcon, PencilIcon } from "../components/icons";
import { ModelCard } from "../components/ModelCard";
import { UpdateBanner } from "../components/UpdateBanner";
import { NormSheet } from "../components/NormSheet";
import { PrimaryButton, T, Tap } from "../components/ui";
import { dayLabel, fmt, mealTitle, todayISO } from "../lib/format";
import { dayMeals, mealKcal } from "../lib/nutrition";
import { navOnce } from "../lib/navOnce";
import { useStore, useToday } from "../store/store";
import { C } from "../theme";
import type { Meal } from "../types";

function MealRow({ meal, onPress }: { meal: Meal; onPress: () => void }) {
  const kcal = fmt(mealKcal(meal.items));
  const title = mealTitle(meal.time);
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={`Відкрити запис: ${title}, ${meal.time}, ${meal.dishName}, ${kcal} ккал`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        padding: 10,
        paddingRight: 16,
        backgroundColor: C.surface,
        borderRadius: 20,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: C.track,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {meal.photo ? (
          <Image source={{ uri: meal.photo }} style={{ width: 64, height: 64 }} accessibilityIgnoresInvertColors />
        ) : (
          <PencilIcon size={28} color={C.muted} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <T size={15} color={C.muted}>
          {title} · {meal.time}
        </T>
        <T w="m" size={18} numberOfLines={2}>
          {meal.dishName}
        </T>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <T w="sb" size={21}>
          {kcal}
        </T>
        <T size={14} color={C.muted}>
          ккал
        </T>
      </View>
    </Tap>
  );
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { meals, settings, toast, dismissToast, openMeal } = useStore();
  const now = useToday();
  const [normOpen, setNormOpen] = useState(false);
  // The photo model isn't on the phone yet: offer the download (the card then shows its progress).
  const [modelMissing] = useState(() => {
    try {
      return !!LiteRtLm && !LiteRtLm.modelInfo().exists;
    } catch {
      return false;
    }
  });
  const scroll = useRef<ScrollView>(null);

  const today = dayMeals(meals, todayISO(now));
  const eaten = today.reduce((s, m) => s + mealKcal(m.items), 0);
  const left = settings.norm - eaten;
  const pct = Math.min(100, Math.round((eaten / settings.norm) * 100));

  // After logging, bring the new meal into view instead of leaving it under the toast.
  const count = useRef(today.length);
  useEffect(() => {
    if (today.length > count.current) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
    count.current = today.length;
  }, [today.length]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 4 }}>
        <T w="sb" size={32} accessibilityRole="header">
          Сьогодні
        </T>
        <T size={17} color={C.muted} style={{ marginTop: 2 }}>
          {dayLabel(now)}
        </T>
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ padding: 16, paddingTop: 14, gap: 12 }}>
        <UpdateBanner />
        <View
          accessible
          accessibilityLabel={`${left >= 0 ? "Залишилось" : "Понад норму"} ${fmt(Math.abs(left))} ккал. З’їдено ${fmt(eaten)} з ${fmt(settings.norm)}.`}
          style={{ backgroundColor: C.surface, borderRadius: 24, padding: 20, paddingTop: 18, gap: 10 }}
        >
          <T size={17} color={C.muted}>
            {left >= 0 ? "Залишилось на сьогодні" : "Понад норму"}
          </T>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <T w="sb" size={60} maxFontSizeMultiplier={1.4} style={{ letterSpacing: -1 }}>
              {fmt(Math.abs(left))}
            </T>
            <T w="m" size={22}>
              ккал
            </T>
          </View>
          <View style={{ height: 14, borderRadius: 7, backgroundColor: C.track, overflow: "hidden", marginTop: 4 }}>
            <View style={{ height: "100%", width: `${pct}%`, borderRadius: 7, backgroundColor: C.accent }} />
          </View>
          <Tap
            onPress={() => setNormOpen(true)}
            accessibilityLabel={`Денна норма ${fmt(settings.norm)} ккал. Змінити`}
            style={{ minHeight: 48, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", borderRadius: 12, paddingRight: 8 }}
          >
            <T size={17} color={C.muted} style={{ flexShrink: 1 }}>
              З’їдено{" "}
              <T w="m" size={17}>
                {fmt(eaten)}
              </T>{" "}
              з{" "}
              <T w="m" size={17} color={C.accent}>
                {fmt(settings.norm)}
              </T>{" "}
              ккал
            </T>
            <PencilIcon size={20} color={C.accent} />
          </Tap>
        </View>

        {modelMissing && <ModelCard />}

        <T w="sb" size={21} accessibilityRole="header" style={{ marginTop: 8, marginHorizontal: 4 }}>
          Що з’їдено
        </T>
        {today.length === 0 ? (
          <T size={18} color={C.muted} style={{ marginHorizontal: 4 }}>
            Ще нічого не записано. Натисніть велику кнопку внизу й сфотографуйте тарілку.
          </T>
        ) : (
          today.map((m) => (
            <MealRow
              key={m.id}
              meal={m}
              onPress={() => {
                navOnce(() => {
                  if (openMeal(m.id)) router.push("/review");
                });
              }}
            />
          ))
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: insets.bottom + 16, gap: 10 }}>
        {toast && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 56,
              paddingVertical: 4,
              paddingLeft: 14,
              paddingRight: 6,
              backgroundColor: C.toast,
              borderRadius: 16,
            }}
          >
            <CheckIcon size={22} color={C.toastAction} />
            <T size={17} color="#FFFFFF" style={{ flex: 1 }}>
              {toast.text}
            </T>
            {toast.action && (
              <Tap
                onPress={() => {
                  toast.action?.run();
                  dismissToast();
                }}
                ripple="rgba(255,255,255,0.15)"
                style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12 }}
              >
                <T w="sb" size={17} color={C.toastAction}>
                  {toast.action.label}
                </T>
              </Tap>
            )}
          </View>
        )}
        <PrimaryButton
          testID="photo-button"
          label="Сфотографувати їжу"
          height={72}
          icon={<CameraIcon size={28} color="#FFFFFF" />}
          onPress={() => {
            navOnce(() => {
              dismissToast();
              router.push("/camera");
            });
          }}
        />
      </View>

      <NormSheet visible={normOpen} onClose={() => setNormOpen(false)} />
    </View>
  );
}
