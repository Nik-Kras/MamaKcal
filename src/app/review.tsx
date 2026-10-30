import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Image, Keyboard, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon, ChevronDown, CloseIcon, MinusIcon, PlusIcon, SearchIcon, TrashIcon } from "../components/icons";
import { PickSheet } from "../components/PickSheet";
import { focusFresh, useKeyboardLift } from "../components/Sheet";
import { OUTLINE, PrimaryButton, T, Tap } from "../components/ui";
import { fmt, plural } from "../lib/format";
import { cleanAmount, convertAmount, itemKcal, listNames, mealKcal, parseAmount, stepPieces } from "../lib/nutrition";
import { navOnce } from "../lib/navOnce";
import {
  blocker,
  blockerLabel,
  hasPhotoGuess,
  lineState,
  orderLines,
  pushRemoved,
  removedName,
  restoreRemoved,
  type LineState,
  type Removed,
} from "../lib/review";
import { useStore } from "../store/store";
import { C, F } from "../theme";
import type { Draft, Food, Item } from "../types";

/** How long «Прибрано» with Повернути stays up, like the undo toast on Home. */
const UNDO_MS = 10_000;

const STATE_WORD: Record<Exclude<LineState, "unknown">, string> = {
  empty: "впишіть вагу",
  guess: "≈ на око",
  weighed: "зважено",
};
/** The same for TalkBack, without the "≈" sign. */
const STATE_SPOKEN: Record<Exclude<LineState, "unknown">, string> = {
  empty: "вага не вписана",
  guess: "на око",
  weighed: "зважено",
};

/** A food the model named but the list doesn't have: she picks what it is, or removes it. */
function UnknownRow({ onRemove, onPick }: { onRemove: () => void; onPick: () => void }) {
  return (
    <View
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: C.estBorder,
        flexDirection: "row",
        alignItems: "center",
        paddingRight: 6,
      }}
    >
      <Tap
        onPress={onPick}
        accessibilityLabel="Невідомий продукт. Вибрати продукт"
        style={{ flex: 1, minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingLeft: 14, borderRadius: 18 }}
      >
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: C.estBg, alignItems: "center", justifyContent: "center" }}>
          <SearchIcon size={22} color={C.estText} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T w="m" size={20}>
            Невідомий продукт
          </T>
          <T size={16} color={C.estText}>
            Торкніться, щоб вибрати
          </T>
        </View>
      </Tap>
      <Tap
        onPress={onRemove}
        accessibilityLabel="Прибрати невідомий продукт"
        style={{ width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: 14 }}
      >
        <CloseIcon size={22} color={C.icon} />
      </Tap>
    </View>
  );
}

function ItemRow({
  item,
  onChange,
  onRemove,
  onPick,
  inputRef,
}: {
  item: Item;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
  onPick: () => void;
  inputRef: (input: TextInput | null) => void;
}) {
  const state = lineState(item);
  if (state === "unknown") return <UnknownRow onRemove={onRemove} onPick={onPick} />;
  const est = state !== "weighed";
  const word = STATE_WORD[state];
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
              ref={inputRef}
              value={item.amount}
              onChangeText={(t) => {
                const amount = cleanAmount(t);
                // Typing a weight makes it "зважено"; an emptied field is nothing yet.
                onChange({ amount, weighed: parseAmount(amount) > 0 });
              }}
              inputMode="numeric"
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              selectTextOnFocus
              maxLength={6}
              accessibilityLabel={`Вага в грамах: ${item.name}, ${STATE_SPOKEN[state]}`}
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
            {/* Wide enough for "30 шт", so + stays put when the count gets a second digit. */}
            <View
              style={[fieldStyle, { minWidth: 84, paddingHorizontal: 6, alignItems: "center", justifyContent: "center" }]}
              accessibilityLiveRegion="polite"
            >
              <T w="sb" size={22} numberOfLines={1}>
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
            {state === "empty" ? "—" : fmt(itemKcal(item))}{" "}
            <T size={15} color={C.muted}>
              ккал
            </T>
          </T>
          <T w="m" size={16} color={est ? C.estText : C.accent}>
            {word}
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
  const lift = useKeyboardLift();
  const params = useLocalSearchParams<{ add?: string }>();
  const { draft: liveDraft, updateDraft, clearDraft, logDraft, deleteDraftMeal } = useStore();
  const [sheet, setSheet] = useState<{ key?: string } | null>(params.add ? {} : null);

  // Logging or deleting clears the draft at once; keep showing the meal while
  // the screen slides away instead of a blank page.
  const [exitDraft, setExitDraft] = useState<Draft | null>(null);
  const draft = liveDraft ?? exitDraft;

  // Lines the model couldn't name are shown first, and stay first once picked.
  const [pinned] = useState(() => new Set((liveDraft?.items ?? []).filter((it) => it.unknown).map((it) => it.key)));
  // Typing a meal in (no photo, or the photo couldn't be read) starts with no lines.
  const [typedIn] = useState(() => !!liveDraft && !liveDraft.mealId && liveDraft.items.length === 0);

  // Back with unsaved changes asks first; logging, deleting or leaving clean does not.
  const leaving = useRef(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = !!liveDraft?.dirty;
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
  const ownId = useRef(liveDraft?.id);
  useEffect(
    () => () => {
      if (ownId.current) clearDraft(ownId.current);
    },
    [clearDraft],
  );

  // Where each line is, to bring it into view, and the weight fields, to focus them.
  const scroll = useRef<ScrollView>(null);
  const rowY = useRef(new Map<string, number>());
  const inputs = useRef(new Map<string, TextInput>());
  const pendingFocus = useRef<(() => void) | null>(null);
  useEffect(() => () => pendingFocus.current?.(), []);
  const showLine = (key: string) => {
    const y = rowY.current.get(key);
    if (y !== undefined) scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
  };

  // The picker gets the keyboard to itself: a weight field left focused under it
  // would take the keyboard back when it closes.
  const openSheet = (s: { key?: string }) => {
    Keyboard.dismiss();
    setSheet(s);
  };

  // × moves the next card under her finger; ignore a quick second tap. Removals
  // can be undone for a while (she may have tapped the wrong card), newest first.
  const lastRemove = useRef(0);
  const [removed, setRemoved] = useState<Removed[]>([]);
  const lastRemoved = removed.length ? removed[removed.length - 1] : undefined;
  useEffect(() => {
    if (!lastRemoved) return;
    const t = setTimeout(() => setRemoved([]), UNDO_MS);
    return () => clearTimeout(t);
  }, [lastRemoved]);
  const removeItem = (key: string) => {
    const now = Date.now();
    if (now - lastRemove.current < 500) return;
    lastRemove.current = now;
    const index = liveDraft?.items.findIndex((it) => it.key === key) ?? -1;
    if (!liveDraft || index < 0) return;
    const entry = { item: liveDraft.items[index], index };
    setRemoved((s) => pushRemoved(s, entry));
    updateDraft((d) => ({ ...d, dishName: "", items: d.items.filter((it) => it.key !== key) }));
  };
  const undoRemove = () => {
    if (!lastRemoved) return;
    updateDraft((d) => ({ ...d, items: restoreRemoved(d.items, lastRemoved) }));
    setRemoved((s) => s.slice(0, -1));
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
  const lines = orderLines(items, pinned);
  const total = mealKcal(items);
  const editing = !!draft.mealId;
  const block = blocker(lines);
  const name = draft.dishName || listNames(items.filter((it) => !it.unknown));

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
      // A food she adds has no weight yet: she types what the scale shows
      // (pieces start at 1 шт). Nothing is logged as a silent 100 g.
      const item: Item = {
        key: `n${Date.now().toString(36)}${keySeq++}`,
        foodId: food.id,
        name: food.name,
        kcal100: food.kcal100,
        pcGrams: food.pcGrams,
        unit,
        amount: unit === "pcs" ? "1" : "",
        weighed: false,
      };
      updateDraft((d) => ({ ...d, dishName: "", items: [...d.items, item] }));
      if (unit === "g") {
        // Once the picker has closed, bring the new line up and open the number pad on it.
        pendingFocus.current?.();
        pendingFocus.current = focusFresh(() => {
          showLine(item.key);
          inputs.current.get(item.key)?.focus();
        }, 450);
      }
    }
    setSheet(null);
  };

  // The big button never just sits there greyed out: until the meal can be
  // logged it takes her to what is missing.
  const onMain = () => {
    if (leaving.current) return;
    if (!block) {
      leaving.current = true;
      setExitDraft(liveDraft);
      if (logDraft()) router.dismissTo("/");
      else {
        leaving.current = false;
        setExitDraft(null);
      }
    } else if (block.kind === "add") {
      openSheet({});
    } else if (block.kind === "unknown") {
      showLine(block.key);
      openSheet({ key: block.key });
    } else {
      showLine(block.key);
      inputs.current.get(block.key)?.focus();
    }
  };
  const label = block ? blockerLabel(block) : `${editing ? "Зберегти" : "Записати"} · ${fmt(total)} ккал`;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style="dark" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Tap onPress={() => navOnce(() => router.back())} accessibilityLabel="Назад" style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26 }}>
          <BackIcon size={28} color={C.ink} />
        </Tap>
        <T w="sb" size={24} accessibilityRole="header" style={{ flex: 1 }}>
          {editing ? "Змінити запис" : typedIn ? "Що ви з’їли?" : "Перевірте вагу"}
        </T>
      </View>

      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 }}>
        {(draft.photo || items.length > 0) && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 4, paddingBottom: 2 }}>
            {draft.photo && (
              <Image source={{ uri: draft.photo }} accessibilityLabel="Фото страви" style={{ width: 84, height: 84, borderRadius: 18, backgroundColor: C.track }} />
            )}
            {items.length > 0 && (
              <View style={{ flex: 1, minWidth: 0 }}>
                {!!name && (
                  <T w="m" size={19} numberOfLines={2}>
                    {name}
                  </T>
                )}
                <T size={15} color={C.muted} style={{ marginTop: name ? 4 : 0 }}>
                  {items.length} {plural(items.length, ["продукт", "продукти", "продуктів"])}
                </T>
              </View>
            )}
          </View>
        )}

        {hasPhotoGuess(items) && (
          <T size={16} color="#3A3D42" style={{ paddingHorizontal: 4, paddingBottom: 2 }}>
            <T w="sb" size={16} color={C.estText}>
              ≈
            </T>{" "}
            — число з фото. Зважте й виправте.
          </T>
        )}

        {lines.map((it) => (
          <View key={it.key} onLayout={(e) => rowY.current.set(it.key, e.nativeEvent.layout.y)}>
            <ItemRow
              item={it}
              onChange={(p) => setItem(it.key, p)}
              onRemove={() => removeItem(it.key)}
              onPick={() => openSheet({ key: it.key })}
              inputRef={(input) => {
                if (input) inputs.current.set(it.key, input);
                else inputs.current.delete(it.key);
              }}
            />
          </View>
        ))}

        <Tap
          onPress={() => openSheet({})}
          style={{
            minHeight: 56,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            borderWidth: 2,
            borderStyle: "dashed",
            borderColor: OUTLINE,
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
              if (leaving.current) return;
              leaving.current = true;
              setExitDraft(liveDraft);
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
          paddingBottom: lift > 0 ? 10 : insets.bottom + 16,
          marginBottom: lift,
          backgroundColor: C.bg,
          borderTopWidth: 1,
          borderTopColor: C.line,
        }}
      >
        {lastRemoved && (
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
              Прибрано: {removedName(lastRemoved.item)}
            </T>
            <Tap onPress={undoRemove} ripple="rgba(255,255,255,0.15)" style={{ minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12 }}>
              <T w="sb" size={16} color={C.toastAction}>
                Повернути
              </T>
            </Tap>
          </View>
        )}
        <PrimaryButton testID="log-button" label={label} onPress={onMain} />
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
