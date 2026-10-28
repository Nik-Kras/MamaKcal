import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, TextInput, View } from "react-native";

import { fmt } from "../lib/format";
import { cleanAmount, parseAmount } from "../lib/nutrition";
import { norm, searchFoods } from "../lib/search";
import { useStore } from "../store/store";
import { C, F } from "../theme";
import type { Food, Item } from "../types";
import { CheckIcon, PlusIcon, SearchIcon } from "./icons";
import { Sheet, useFocusWhenShown } from "./Sheet";
import { PrimaryButton, T, Tap } from "./ui";

type Row = { kind: "header"; key: string; title: string } | { kind: "food"; key: string; food: Food; current: boolean };

function sub(f: Food): string {
  return f.pcGrams ? `${fmt((f.kcal100 * f.pcGrams) / 100)} ккал за 1 шт` : `${fmt(f.kcal100)} ккал у 100 г`;
}

/**
 * Pick a food: to fix a line ("Що це за продукт?") or to add one the photo model
 * missed. With nothing typed, a fix starts with the foods closest to what the
 * model saw, then her recent foods; adding starts with her recent foods. A name
 * that isn't in the list can be added with its kcal per 100 g.
 */
export function PickSheet({
  visible,
  replacing,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** The line being fixed; undefined when adding. */
  replacing?: Item;
  onClose: () => void;
  onPick: (food: Food) => void;
}) {
  const { foods, matcher, recentFoodIds, addCustomFood } = useStore();
  const [query, setQuery] = useState("");
  const [newKcal, setNewKcal] = useState<string | null>(null);
  const kcalInput = useRef<TextInput>(null);
  useFocusWhenShown(kcalInput, newKcal !== null);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setNewKcal(null);
    }
  }, [visible]);

  const byId = useMemo(() => new Map(foods.map((f) => [f.id, f])), [foods]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const seen = new Set<string>();
    // Each food appears once, in the first section that has it.
    const section = (title: string, list: (Food | undefined)[]) => {
      const fresh: Food[] = [];
      for (const f of list) {
        if (!f || seen.has(f.id)) continue;
        seen.add(f.id);
        fresh.push(f);
      }
      if (!fresh.length) return;
      out.push({ kind: "header", key: `h-${title}`, title });
      for (const f of fresh) out.push({ kind: "food", key: f.id, food: f, current: f.id === replacing?.foodId });
    };
    if (query.trim()) {
      section("Знайдено", searchFoods(foods, query).slice(0, 40));
      return out;
    }
    if (replacing) {
      const current = replacing.foodId ? byId.get(replacing.foodId) : undefined;
      // What the model saw, else the food's English name: the closest foods to that.
      const seenAs = replacing.aiName ?? current?.nameEn ?? "";
      section("Схожі", [current, ...matcher.similar(seenAs, 6).map((id) => byId.get(id))]);
    }
    section("Нещодавні", recentFoodIds.map((id) => byId.get(id)));
    section("Усі продукти", foods);
    return out;
  }, [query, replacing, foods, byId, matcher, recentFoodIds]);

  const typed = query.trim();
  const exact = !!typed && foods.some((f) => norm(f.name) === norm(typed));
  const kcalOk = newKcal !== null && parseAmount(newKcal) > 0 && parseAmount(newKcal) <= 900;
  const title = !replacing ? "Додати продукт" : replacing.unknown ? "Що це за продукт?" : "Замінити продукт";

  return (
    <Sheet visible={visible} onClose={onClose} title={title} tall>
      {newKcal === null ? (
        <>
          {replacing?.aiName && (
            <T size={15} color={C.muted} style={{ marginHorizontal: 4, marginTop: -4, marginBottom: 10 }}>
              На фото, схоже: «{replacing.aiName}»
            </T>
          )}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 56,
              paddingHorizontal: 14,
              borderWidth: 2,
              borderColor: "#CFCBC2",
              borderRadius: 16,
              backgroundColor: C.bg,
            }}
          >
            <SearchIcon size={22} color={C.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Пошук, наприклад: гречка"
              placeholderTextColor="#7A7E85"
              accessibilityLabel="Пошук продукту"
              autoCorrect={false}
              returnKeyType="search"
              style={{ flex: 1, fontFamily: F.r, fontSize: 18, color: C.ink, paddingVertical: 8 }}
            />
          </View>
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            keyboardShouldPersistTaps="handled"
            style={{ marginTop: 6 }}
            ListFooterComponent={
              typed && !exact ? (
                <Tap
                  onPress={() => setNewKcal("")}
                  style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, paddingHorizontal: 4 }}
                >
                  <PlusIcon size={22} color={C.accent} />
                  <T w="m" size={18} color={C.accent} style={{ flex: 1 }}>
                    Додати «{typed}» як новий продукт
                  </T>
                </Tap>
              ) : typed ? null : (
                <View style={{ height: 8 }} />
              )
            }
            ListEmptyComponent={
              typed ? (
                <T size={17} color={C.muted} style={{ margin: 4, marginTop: 12 }}>
                  Нічого не знайдено.
                </T>
              ) : null
            }
            renderItem={({ item }) =>
              item.kind === "header" ? (
                <T size={15} color={C.muted} accessibilityRole="header" style={{ marginTop: 14, marginBottom: 2, marginHorizontal: 4 }}>
                  {item.title}
                </T>
              ) : (
                <Tap
                  onPress={() => onPick(item.food)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 64,
                    paddingVertical: 8,
                    paddingHorizontal: 4,
                    borderBottomWidth: 1,
                    borderBottomColor: "#ECEAE4",
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <T w="m" size={19}>
                      {item.food.name}
                    </T>
                    <T size={15} color={C.muted}>
                      {sub(item.food)}
                    </T>
                  </View>
                  {item.current && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <CheckIcon size={20} color={C.accent} />
                      <T w="sb" size={15} color={C.accent}>
                        Обрано
                      </T>
                    </View>
                  )}
                </Tap>
              )
            }
          />
        </>
      ) : (
        <View style={{ gap: 14, paddingHorizontal: 4 }}>
          <T w="m" size={20}>
            {typed}
          </T>
          <T size={17} color={C.muted}>
            Скільки калорій у 100 г? Число є на упаковці.
          </T>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TextInput
              value={newKcal}
              onChangeText={(t) => setNewKcal(cleanAmount(t).slice(0, 3))}
              ref={kcalInput}
              keyboardType="number-pad"
              accessibilityLabel="Калорій у 100 грамах"
              style={{
                minWidth: 120,
                minHeight: 60,
                paddingVertical: 4,
                borderRadius: 14,
                borderWidth: 2,
                borderColor: C.accent,
                textAlign: "center",
                fontFamily: F.sb,
                fontSize: 26,
                color: C.ink,
              }}
            />
            <T size={20}>ккал у 100 г</T>
          </View>
          <PrimaryButton label="Додати" disabled={!kcalOk} onPress={() => onPick(addCustomFood(typed, parseAmount(newKcal ?? "")))} />
          <Tap onPress={() => setNewKcal(null)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
            <T w="m" size={17} color={C.accent}>
              Назад до пошуку
            </T>
          </Tap>
        </View>
      )}
    </Sheet>
  );
}
