import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Linking, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CloseIcon, GalleryIcon, PencilIcon } from "../components/icons";
import { PrimaryButton, T, Tap } from "../components/ui";
import { navOnce } from "../lib/navOnce";
import { warmUp } from "../lib/recognize";
import { useStore } from "../store/store";
import { C } from "../theme";

function SideButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      ripple="rgba(255,255,255,0.15)"
      style={{ width: 84, alignItems: "center", gap: 6, paddingVertical: 4, borderRadius: 16, opacity: disabled ? 0.4 : 1 }}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <T size={15} color="#FFFFFF">
        {label}
      </T>
    </Tap>
  );
}

type Side = "top" | "bottom";
type End = "left" | "right";

/** A white corner on a dark outline, so it stays visible over a white plate or tablecloth. */
function Corner({ v, h }: { v: Side; h: End }) {
  const cap = (s: Side) => (s === "top" ? "Top" : "Bottom");
  const end = (e: End) => (e === "left" ? "Left" : "Right");
  const line = (width: number, color: string, inset: number, size: number) => ({
    position: "absolute" as const,
    [v]: inset,
    [h]: inset,
    width: size,
    height: size,
    borderColor: color,
    [`border${cap(v)}Width`]: width,
    [`border${end(h)}Width`]: width,
    [`border${cap(v)}${end(h)}Radius`]: 16,
  });
  return (
    <>
      <View pointerEvents="none" style={line(8, "rgba(0,0,0,0.45)", -2, 50)} />
      <View pointerEvents="none" style={line(4, "#FFFFFF", 0, 46)} />
    </>
  );
}

export default function Camera() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startAnalysis, startManual } = useStore();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // False once this screen is gone: a late photo result must not navigate from a closed camera.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Load the photo model while she frames the shot (several seconds the first time),
  // but only after the camera is up, so the camera gets the memory/GPU first.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => warmUp(), 400);
    return () => clearTimeout(t);
  }, [ready]);

  // First time: go straight to Android's own question instead of our explanation screen.
  useEffect(() => {
    if (permission?.status === "undetermined" && permission.canAskAgain) void requestPermission();
  }, [permission?.status, permission?.canAskAgain, requestPermission]);

  // Coming back from Android settings after allowing the camera: re-check.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => s === "active" && void getPermission());
    return () => sub.remove();
  }, [getPermission]);

  // Not through navOnce: its global 700 ms lock could swallow this and leave the shutter dead.
  // `busy` (a ref plus state) already stops double taps.
  const locked = useRef(false);
  const lock = () => {
    locked.current = true;
    setBusy(true);
  };
  const unlock = () => {
    locked.current = false;
    if (alive.current) setBusy(false);
  };

  const analyze = (uri: string, width: number, height: number) => {
    if (!alive.current) return;
    startAnalysis(uri, width, height);
    router.replace("/analyzing");
  };

  const shoot = async () => {
    if (!camera.current || !ready || locked.current) return;
    lock();
    try {
      const pic = await camera.current.takePictureAsync({ quality: 0.8 });
      if (pic && alive.current) analyze(pic.uri, pic.width, pic.height);
      else unlock();
    } catch {
      unlock();
    }
  };

  const fromGallery = async () => {
    if (locked.current) return;
    lock();
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      const a = res.canceled ? undefined : res.assets?.[0];
      if (a && alive.current) {
        analyze(a.uri, a.width, a.height);
        return;
      }
    } catch {
      // picker failed: fall through and re-enable the buttons
    }
    unlock();
  };

  const noPhoto = () => {
    if (locked.current) return;
    lock();
    startManual();
    router.replace({ pathname: "/review", params: { add: "1" } });
  };

  const close = (
    <Tap
      onPress={() => navOnce(() => router.back())}
      disabled={busy}
      accessibilityLabel="Закрити"
      ripple="rgba(255,255,255,0.15)"
      style={{ width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: 26, opacity: busy ? 0.4 : 1 }}
    >
      <CloseIcon size={28} color="#FFFFFF" />
    </Tap>
  );

  let view: React.ReactNode;
  if (!permission || (permission.status === "undetermined" && permission.canAskAgain)) {
    // Still loading, or Android's own permission question is on screen.
    view = <View style={{ flex: 1 }} />;
  } else if (!permission.granted) {
    view = (
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 24, gap: 18 }}>
        <T w="m" size={22} color="#FFFFFF">
          Щоб фотографувати їжу, дозвольте доступ до камери.
        </T>
        <PrimaryButton
          label={permission.canAskAgain ? "Дозволити камеру" : "Відкрити налаштування"}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
        />
      </View>
    );
  } else {
    view = (
      <View style={{ flex: 1, marginVertical: 8, overflow: "hidden" }}>
        <CameraView ref={camera} style={{ flex: 1 }} facing="back" onCameraReady={() => setReady(true)} />
        <View pointerEvents="none" style={{ position: "absolute", top: 14, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: "rgba(15,16,18,0.72)" }}>
            <T size={17} color="#FFFFFF" accessibilityLiveRegion="polite">
              {busy ? "Роблю фото…" : !ready ? "Камера готується…" : "Сфотографуйте тарілку зверху"}
            </T>
          </View>
        </View>
        <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, left: 28, right: 28, justifyContent: "center" }}>
          <View style={{ aspectRatio: 1 }}>
            <Corner v="top" h="left" />
            <Corner v="top" h="right" />
            <Corner v="bottom" h="left" />
            <Corner v="bottom" h="right" />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.camera }}>
      <StatusBar style="light" />
      <View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8 }}>{close}</View>
      {view}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 4,
          paddingBottom: insets.bottom + 24,
        }}
      >
        <SideButton label="Галерея" icon={<GalleryIcon size={26} color="#FFFFFF" />} onPress={fromGallery} disabled={busy} />
        <Tap
          testID="shutter"
          onPress={shoot}
          disabled={!permission?.granted || !ready || busy}
          accessibilityLabel="Зробити фото"
          ripple="rgba(255,255,255,0.2)"
          style={{
            width: 88,
            height: 88,
            borderRadius: 44,
            borderWidth: 5,
            borderColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            opacity: permission?.granted && ready ? 1 : 0.5,
          }}
        >
          {busy ? <ActivityIndicator color={C.ink} /> : null}
          <View style={{ position: "absolute", width: 66, height: 66, borderRadius: 33, backgroundColor: "#FFFFFF", opacity: busy ? 0.6 : 1 }} />
        </Tap>
        <SideButton label="Без фото" icon={<PencilIcon size={26} color="#FFFFFF" />} onPress={noPhoto} disabled={busy} />
      </View>
    </View>
  );
}
