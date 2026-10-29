import Constants from "expo-constants";
import * as Linking from "expo-linking";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, View } from "react-native";

import { record, reportError } from "../diag/diagnostics";
import { isNewer, LATEST_APK_URL, LATEST_RELEASE_API, releaseVersion } from "../lib/update";
import { C } from "../theme";
import { T, Tap } from "./ui";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * "Є нова версія Калорій · Оновити" at the top of Home, as in RHP. Checks the latest GitHub
 * release when the app starts and comes back to the screen (at most hourly); Оновити opens
 * the new APK in the browser, which downloads it and offers Install. Release builds only.
 */
export function UpdateBanner() {
  const [latest, setLatest] = useState<string | null>(null);
  const lastCheck = useRef(0);
  const current = Constants.expoConfig?.version ?? null;

  const check = useCallback(async () => {
    if (__DEV__ || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = Date.now();
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 10_000);
    try {
      const res = await fetch(LATEST_RELEASE_API, { headers: { Accept: "application/vnd.github+json" }, signal: abort.signal });
      if (!res.ok) return;
      const version = releaseVersion(await res.json());
      if (version && isNewer(version, current)) {
        setLatest(version);
        record("update.available", { version, current });
      }
    } catch {
      // Offline or GitHub unreachable: try again next time.
    } finally {
      clearTimeout(timer);
    }
  }, [current]);

  useEffect(() => {
    void check();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!latest) return null;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 8,
        paddingLeft: 18,
        paddingRight: 8,
        backgroundColor: C.surface,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: C.accent,
      }}
    >
      <T w="m" size={18} style={{ flex: 1 }}>
        Є нова версія Калорій
      </T>
      <Tap
        onPress={() => {
          record("update.open", { version: latest });
          Linking.openURL(LATEST_APK_URL).catch((e) => reportError(e, "update.open"));
        }}
        accessibilityLabel={`Оновити Калорії до версії ${latest.replace(/^v/, "")}`}
        ripple="rgba(255,255,255,0.18)"
        style={{ minHeight: 52, paddingHorizontal: 20, justifyContent: "center", borderRadius: 14, backgroundColor: C.accent }}
      >
        <T w="sb" size={18} color="#FFFFFF">
          Оновити
        </T>
      </Tap>
    </View>
  );
}
