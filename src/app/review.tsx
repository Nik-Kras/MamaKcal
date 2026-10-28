import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, ChevronDown, CloseIcon, MinusIcon, PlusIcon, SearchIcon, TrashIcon } from "../components/icons";
import { PickSheet } from "../components/PickSheet";
import { useKeyboardHeight } from "../components/Sheet";
import { PrimaryButton, T, Tap } from "../components/ui";
import { fmt, plural } from "../lib/format";
import { cleanAmount, convertAmount, itemKcal, listNames, mealKcal, parseAmount, stepPieces } from "../lib/nutrition";
import { navOnce } from "../lib/navOnce";
import { useStore } from "../store/store";
import { C, F } from "../theme";
import type { Food, Item } from "../types";

/** A food the model named but the list doesn't have: she picks what it is, or removes it. */
function UnknownRow({ item, onRemove, onPick }: { item: Item; onRemove: () => void; onPick: () => void }) {
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: C.estBorder,
        paddingTop: 6,
        paddingRight: 6,
        paddingBottom: 14,
        paddingLeft: 16,
        gap: 4,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <T w="m" size={20} style={{ flex: 1 }}>
          Невідомий продукт
        </T>
        <Tap
          onPress={onRemove}
          accessibilityLabel={`Прибрати невідомий продукт: ${item.aiName ?? ""}`}
          style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 }}
        >
          <CloseIcon size={22} color={C.icon} />
        </Tap>
      </View>
      <T size={16} color={C.muted} style={{ paddingRight: 10 }}>
        На фото, схоже: «{item.aiName}»
      </T>
      <Tap
        onPress={onPick}
        style={{
          alignSelf: "flex-start",
          marginTop: 8,
          minHeight: 48,
          paddingHorizontal: 16,
          borderRadius: 14,
          backgroundColor: C.estBg,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
        }}
      >
        <SearchIcon size={20} color={C.estText} />
        <T w="sb" size={17} color={C.estText}>
          Вибрати продукт
        </T>
      </Tap>
    </View>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
  onPick,
}: {
  item: Item;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
  onPick: () => void;
}) {
  if (item.unknown) return <UnknownRow item={item} onRemove={onRemove} onPick={onPick} />;
  const est = !item.weighed;
  const fieldStyle = {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: est ? C.estBorder : C.accent,
    backgroundColor: est ? C.estBg : C.surface,
  };
  return (
    <View style={{ backgroundColor: C.surface, borderRadius: 20, paddingTop: 6, paddingRight: 6, paddingBottom: 14, paddingLeft: 16, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
        <Tap
          onPress={onPick}
          accessibilityLabel={`Змінити продукт: ${item.name}`}
          style={{ flex: 1, minHeight: 48, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10 }}
        >
          <T w="m" size={20} style={{ flexShrink: 1 }}>
            {item.name}
          </T>
          <ChevronDown size={20} color={C.icon} />
        </Tap>
        <Tap
          onPress={onRemove}
          accessibilityLabel={`Прибрати: ${item.name}`}
          style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 }}
        >
          <CloseIcon size={22} color={C.icon} />
        </Tap>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingRight: 10, flexWrap: "wrap" }}>
        {item.unit === "g" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={item.amount}
              onChangeText={(t) => onChange({ amount: cleanAmount(t), weighed: true })}
              keyboardType="number-pad"
              selectTextOnFocus
              maxLength={4}
              accessibilityLabel={`Вага в грамах: ${item.name}`}
              style={[
                fieldStyle,
                { minWidth: 116, paddingHorizontal: 8, paddingVertical: 4, textAlign: "center", fontFamily: F.sb, fontSize: 26, color: C.ink },
              ]}
            />
            <T size={20}>г</T>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Tap
              onPress={() => onChange({ amount: stepPieces(item.amount, -1), weighed: true })}
              accessibilityLabel={`Менше: ${item.name}`}
              style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}
            >
              <MinusIcon size={24} color={C.ink} />
            </Tap>
            <View style={[fieldStyle, { minWidth: 76, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" }]} accessibilityLiveRegion="polite">
              <T w="sb" size={22}>
                {item.amount} шт
              </T>
            </View>
            <Tap
              onPress={() => onChange({ amount: stepPieces(item.amount, 1), weighed: true })}
              accessibilityLabel={`Більше: ${item.name}`}
              style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: C.soft, alignItems: "center", justifyContent: "center" }}
            >
              <PlusIcon size={24} color={C.ink} />
            </Tap>
          </View>
        )}
        <View style={{ alignItems: "flex-end", gap: 2, marginLeft: "auto" }}>
          <T w="sb" size={20}>
            {fmt(itemKcal(item))}{" "}
            <T size={15} color={C.muted}>
              ккал
            </T>
          </T>
          <T w="m" size={14} color={est ? C.estText : C.accent}>
            {est ? "≈ на око" : "зважено"}
          </T>
        </View>
      </View>
    </View>
  );
}

let keySeq = 0;

export default function Review() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const params = useLocalSearchParams<{ add?: string }>();
  const { draft, updateDraft, clearDraft, logDraft, deleteDraftMeal } = useStore();
  const [sheet, setSheet] = useState<{ key?: string } | null>(params.add ? {} : null);

  // Back with unsaved changes asks first; logging, deleting or leaving clean does not.
  const leaving = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = !!draft?.dirty;
  useEffect(() => {
    const sub = navigation.addListener("beforeRemove", (e) => {
      if (leaving.current || !dirtyRef.current) return;
      e.preventDefault();
      Alert.alert("Вийти без запису?", "Зміни не збережуться.", [
        { text: "Залишитися", style: "cancel" },
        {
          text: "Вийти",
          style: "destructive",
          onPress: () => {
            leaving.current = true;
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return sub;
  }, [navigation]);
  // Leaving drops this screen's own draft only, never one another screen started.
  const ownId = useRef(draft?.id);
  useEffect(
    () => () => {
      if (ownId.current) clearDraft(ownId.current);
    },
    [clearDraft],
  );

  // × moves the next card under her finger; ignore a quick second tap. A removal
  // can be undone for a few seconds (she may have tapped the wrong card).
  const lastRemove = useRef(0);
  const [removed, setRemoved] = useState<{ item: Item; index: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  const removeItem = (key: string) => {
    const now = Date.now();
    if (now - lastRemove.current < 500) return;
    lastRemove.current = now;
    const index = draft?.items.findIndex((it) => it.key === key) ?? -1;
    if (!draft || index < 0) return;
    setRemoved({ item: draft.items[index], index });
    updateDraft((d) => ({ ...d, dishName: "", items: d.items.filter((it) => it.key !== key) }));
  };
  const undoRemove = () => {
    if (!removed) return;
    updateDraft((d) => {
      if (d.items.some((it) => it.key === removed.item.key)) return d;
      const items = [...d.items];
      items.splice(Math.min(removed.index, items.length), 0, removed.item);
      return { ...d, items };
    });
    setRemoved(null);
  };

  if (!draft) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: insets.top + 4, paddingHorizontal: 8 }}>
        <Tap onPress={() => navOnce(() => router.back())} accessibilityLabel="Назад" style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 }}>
          <BackIcon size={28} color={C.ink} />
        </Tap>
      </View>
    );
  }

  const items = draft.items;
  const total = mealKcal(items);
  const hasAmount = items.some((it) => parseAmount(it.amount) > 0);
  const editing = !!draft.mealId;
  const anyGuess = items.some((it) => !it.weighed && !it.unknown);
  const unknown = items.filter((it) => it.unknown).length;
  const fromPhoto = !editing && !!draft.photo && items.length > 0;

  const setItem = (key: string, patch: Partial<Item>) =>
    updateDraft((d) => ({ ...d, items: d.items.map((it) => (it.key === key ? { ...it, ...patch } : it)) }));

  const pick = (food: Food) => {
    const target = sheet?.key !== undefined ? items.find((it) => it.key === sheet.key) : undefined;
    const unit = food.pcGrams ? "pcs" : "g";
    if (target) {
      // aiName / aiFoodId stay on the line: logging the meal learns from the change.
      updateDraft((d) => ({
        ...d,
        dishName: "",
        items: d.items.map((it) =>
          it.key === target.key
            ? {
                ...it,
                foodId: food.id,
                name: food.name,
                kcal100: food.kcal100,
                pcGrams: food.pcGrams,
                unit,
                unknown: false,
                amount: convertAmount(it.amount, it, { unit, pcGrams: food.pcGrams }),
                // A weight she set stays "зважено"; a converted grams↔pieces estimate does not.
                weighed: unit === it.unit ? it.weighed : false,
              }
            : it,
        ),
      }));
    } else {
      const item: Item = {
        key: `n${Date.now().toString(36)}${keySeq++}`,
        foodId: food.id,
        name: food.name,
        kcal100: food.kcal100,
        pcGrams: food.pcGrams,
        unit,
        amount: unit === "pcs" ? "1" : "100",
        weighed: false,
      };
      updateDraft((d) => ({ ...d, dishName: "", items: [...d.items, item] }));
    }
    setSheet(null);
  };

  const count = `${items.length} ${plural(items.length, ["продукт", "продукти", "продуктів"])}`;
  const label = !items.length
    ? "Додайте продукт"
    : unknown
      ? `Уточніть ${unknown} ${plural(unknown, ["продукт", "продукти", "продуктів"])}`
      : !hasAmount
        ? "Впишіть вагу"
        : `${editing ? "Зберегти" : "Записати"} · ${fmt(total)} ккал`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Tap onPress={() => navOnce(() => router.back())} accessibilityLabel="Назад" style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 }}>
          <BackIcon size={28} color={C.ink} />
        </Tap>
        <T w="sb" size={24} accessibilityRole="header">
          {editing ? "Змінити запис" : "Перевірте вагу"}
        </T>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingBottom: 2 }}>
          {draft.photo && (
            <Image source={{ uri: draft.photo }} accessibilityLabel="Фото страви" style={{ width: 84, height: 84, borderRadius: 18, backgroundColor: C.track }} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T w="m" size={19}>
              {draft.dishName || listNames(items.filter((it) => !it.unknown)) || "Що ви з’їли?"}
            </T>
            <T size={15} color={C.muted} style={{ marginTop: 4 }}>
              {count}
            </T>
          </View>
        </View>

        {anyGuess && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 4, paddingBottom: 4 }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: C.estBorder, backgroundColor: C.estBg }} />
            <T size={16} color="#3A3D42" style={{ flex: 1 }}>
              Жовте — це на око. Зважте продукт і виправте число.
            </T>
          </View>
        )}
        {fromPhoto && (
          <T size={16} color="#3A3D42" style={{ paddingHorizontal: 4, paddingBottom: 4 }}>
            Не той продукт — торкніться назви. Зайвий — ×. Чогось бракує — «Додати продукт».
          </T>
        )}

        {items.map((it) => (
          <ItemRow
            key={it.key}
            item={it}
            onChange={(p) => setItem(it.key, p)}
            onRemove={() => removeItem(it.key)}
            onPick={() => setSheet({ key: it.key })}
          />
        ))}

        <Tap
          onPress={() => setSheet({})}
          style={{
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: C.dashed,
            borderRadius: 20,
          }}
        >
          <PlusIcon size={22} color={C.accent} />
          <T w="sb" size={18} color={C.accent}>
            Додати продукт
          </T>
        </Tap>

        {editing && (
          <Tap
            onPress={() => {
              leaving.current = true;
              deleteDraftMeal();
              router.dismissTo("/");
            }}
            style={{ minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 16 }}
          >
            <TrashIcon size={22} color={C.muted} />
            <T size={17} color={C.muted}>
              Видалити запис
            </T>
          </Tap>
        )}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: kb > 0 ? 10 : insets.bottom + 16,
          marginBottom: kb,
          backgroundColor: C.bg,
          borderTopWidth: 1,
          borderTopColor: C.line,
        }}
      >
        {removed && (
          <View
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 52,
              marginBottom: 10,
              paddingLeft: 14,
              paddingRight: 6,
              borderRadius: 14,
              backgroundColor: C.toast,
            }}
          >
            <T size={16} color="#FFFFFF" style={{ flex: 1 }} numberOfLines={2}>
              Прибрано: {removed.item.unknown ? removed.item.aiName : removed.item.name}
            </T>
            <Tap onPress={undoRemove} ripple="rgba(255,255,255,0.15)" style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12 }}>
              <T w="sb" size={16} color={C.toastAction}>
                Повернути
              </T>
            </Tap>
          </View>
        )}
        <PrimaryButton
          testID="log-button"
          label={label}
          disabled={!hasAmount || unknown > 0}
          onPress={() => {
            leaving.current = true;
            if (logDraft()) router.dismissTo("/");
            else leaving.current = false;
          }}
        />
      </View>

      <PickSheet
        visible={!!sheet}
        replacing={sheet?.key !== undefined ? items.find((it) => it.key === sheet.key) : undefined}
        onClose={() => setSheet(null)}
        onPick={pick}
      />
    </View>
  );
}
