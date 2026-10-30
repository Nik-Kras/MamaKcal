import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View } from "react-native";

import { LiteRtLm, type ModelDownloadStatus } from "../../modules/litert-lm";
import { record, reportError } from "../diag/diagnostics";
import { downloadShare, gb, MODEL_BYTES, MODEL_PARTS, MODEL_SHA256 } from "../lib/modelFiles";
import { C } from "../theme";
import { CheckIcon } from "./icons";
import { PrimaryButton, T } from "./ui";

const POLL_MS = 1500;

/** "3,7 ГБ" with a non-breaking space, so the unit never wraps onto its own line. */
const gbu = (bytes: number) => `${gb(bytes)}\u00A0ГБ`;

/**
 * Home-screen card while the photo model isn't on the phone: one button downloads it
 * (Android's DownloadManager, Wi-Fi only, carries on with the app closed), then the app
 * joins and checks the file. Shown only when the model is missing.
 */
export function ModelCard() {
  const native = LiteRtLm;
  const [status, setStatus] = useState<ModelDownloadStatus | null>(null);
  const [needBytes, setNeedBytes] = useState(0);
  const [starting, setStarting] = useState(false);
  const finishing = useRef(false);
  const reported = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (!native) return;
    try {
      const s = await native.modelDownloadStatus();
      setStatus(s);
      if (s.state === "failed" && reported.current !== s.reason) {
        reported.current = s.reason ?? "failed";
        reportError(new Error(`Model download failed: ${s.reason}`), "model.download", { reason: s.reason ?? null });
      }
      if (s.state === "downloaded" && !finishing.current) {
        finishing.current = true;
        setStatus({ ...s, state: "assembling" });
        record("model.download.join");
        try {
          await native.finishModelDownload();
        } catch (e) {
          reportError(e, "model.download.join");
        } finally {
          finishing.current = false;
        }
        setStatus(await native.modelDownloadStatus());
      }
    } catch (e) {
      reportError(e, "model.download.status");
    }
  }, [native]);

  // Check now, then every 1.5 s while the app is on screen; the download itself runs in Android.
  useEffect(() => {
    void poll();
    let timer: ReturnType<typeof setInterval> | null = setInterval(() => void poll(), POLL_MS);
    const sub = AppState.addEventListener("change", (s) => {
      if (timer) clearInterval(timer);
      timer = s === "active" ? setInterval(() => void poll(), POLL_MS) : null;
      if (s === "active") void poll();
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [poll]);

  const start = async () => {
    if (!native || starting) return;
    setStarting(true);
    setNeedBytes(0);
    reported.current = null;
    try {
      record("model.download.start");
      const need = await native.startModelDownload(MODEL_PARTS, MODEL_SHA256);
      setNeedBytes(need);
      await poll();
    } catch (e) {
      reportError(e, "model.download.start");
      setStatus({ state: "failed", done: 0, total: MODEL_BYTES, reason: "start" });
    } finally {
      setStarting(false);
    }
  };

  if (!native || !status) return null;
  const state = status.state;
  const total = status.total || MODEL_BYTES;

  if (state === "done") {
    return (
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }} accessibilityLiveRegion="polite">
          <CheckIcon size={28} color={C.accent} />
          <T w="m" size={19} style={{ flex: 1 }}>
            Готово! Тепер фотографуйте тарілку — продукти з’являться самі.
          </T>
        </View>
      </Card>
    );
  }

  const progress = state === "running" || state === "waiting" || state === "downloaded" || state === "assembling";
  return (
    <Card>
      <T w="sb" size={20} accessibilityRole="header">
        Розпізнавання їжі на фото
      </T>
      {progress ? (
        <View style={{ gap: 10 }} accessibilityLiveRegion="polite">
          <View style={{ height: 14, borderRadius: 7, backgroundColor: C.track, overflow: "hidden" }}>
            <View
              style={{
                height: "100%",
                width: `${Math.round(downloadShare(status.done, total) * 100)}%`,
                borderRadius: 7,
                backgroundColor: C.accent,
              }}
            />
          </View>
          {state === "downloaded" || state === "assembling" ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={C.accent} />
              <T size={17} style={{ flex: 1 }}>
                Перевіряю файл… це до хвилини.
              </T>
            </View>
          ) : (
            <>
              <T w="m" size={18}>
                {state === "waiting" ? "Чекаю на Wi‑Fi" : "Завантажується"}: {gb(status.done)} з {gbu(total)}
              </T>
              <T size={16} color={C.muted}>
                {state === "waiting"
                  ? "Підключіть телефон до Wi‑Fi — завантаження продовжиться саме."
                  : "Можна закрити застосунок — завантаження продовжиться."}
              </T>
            </>
          )}
        </View>
      ) : (
        <>
          <T size={17} color={state === "failed" || needBytes > 0 ? C.ink : C.muted}>
            {needBytes > 0
              ? `Замало місця на телефоні. Звільніть ще ${gbu(needBytes)} (наприклад, видаліть старі відео) і натисніть ще раз.`
              : state === "failed"
                ? status.reason === "corrupt"
                  ? "Файл пошкодився під час завантаження. Спробуйте ще раз."
                  : "Не вдалося завантажити. Перевірте Wi‑Fi і спробуйте ще раз."
                : `Завантажте його один раз: ${gbu(MODEL_BYTES)}, тільки через Wi‑Fi. Поки його немає, продукти можна вписати вручну.`}
          </T>
          <PrimaryButton
            label={state === "failed" || needBytes > 0 ? "Спробувати ще раз" : "Завантажити"}
            onPress={() => void start()}
            disabled={starting}
            height={60}
          />
          <T size={14} color={C.muted}>
            Модель Gemma від Google. Умови: ai.google.dev/gemma/terms
          </T>
        </>
      )}
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: C.surface, borderRadius: 24, padding: 20, gap: 12 }}>{children}</View>;
}
