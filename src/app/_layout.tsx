import { Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold, useFonts } from "@expo-google-fonts/rubik";
import { router, Stack, useRootNavigationState, type ErrorBoundaryProps } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { PrimaryButton, T } from "../components/ui";
import { reportError, Sentry, sentryEnabled, startDiagnostics } from "../diag/diagnostics";
import { StoreProvider, useStore } from "../store/store";
import { C } from "../theme";

// Before the first render, so a crash while starting up is reported too.
startDiagnostics();

/** A screen crashed: report it and offer to try again (shown in place of the whole app). */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => reportError(error, "render"), [error]);
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24, gap: 18 }}>
      <T w="m" size={22}>
        Щось пішло не так.
      </T>
      <T size={17} color={C.muted}>
        Записи не загублені. Спробуйте ще раз.
      </T>
      <PrimaryButton label="Спробувати ще раз" onPress={() => void retry()} />
    </View>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { hydrated, loadFailed, retryLoad, resumedDraft, ackResumedDraft } = useStore();
  const navReady = !!useRootNavigationState()?.key;
  // A draft survived the app being killed: reopen the check screen, once.
  useEffect(() => {
    if (!hydrated || !resumedDraft || !navReady) return;
    ackResumedDraft();
    router.push("/review");
  }, [hydrated, resumedDraft, navReady, ackResumedDraft]);
  if (hydrated) return <>{children}</>;
  if (loadFailed) {
    // Her saved meals exist but couldn't be read. Never continue with an empty day
    // here: the first save would write over them.
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center", padding: 24, gap: 18 }}>
        <T w="m" size={22}>
          Не вдалося відкрити записи.
        </T>
        <T size={17} color={C.muted}>
          Записи не загублені. Спробуйте ще раз, а якщо не допоможе — перезапустіть телефон.
        </T>
        <PrimaryButton label="Спробувати ще раз" onPress={retryLoad} />
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.bg, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" color={C.accent} />
    </View>
  );
}

function RootLayout() {
  const [fontsLoaded] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_600SemiBold });

  return (
    <SafeAreaProvider>
      <StoreProvider>
        {fontsLoaded ? (
          <Gate>
            <Stack
              screenOptions={{
                headerShown: false,
                animation: "slide_from_right",
                contentStyle: { backgroundColor: C.bg },
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="camera" options={{ animation: "fade", contentStyle: { backgroundColor: C.camera } }} />
              <Stack.Screen name="analyzing" options={{ animation: "fade" }} />
              <Stack.Screen name="review" />
              <Stack.Screen name="sentry-test" />
            </Stack>
          </Gate>
        ) : (
          <View style={{ flex: 1, backgroundColor: C.bg }} />
        )}
      </StoreProvider>
    </SafeAreaProvider>
  );
}

// Without a DSN (development) Sentry isn't started, and wrapping would only warn.
export default sentryEnabled() ? Sentry.wrap(RootLayout) : RootLayout;
