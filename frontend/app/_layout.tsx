import React, { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as Application from "expo-application";
import { AuthProvider } from "../src/context/AuthContext";
import NoInternetGate from "../src/components/NoInternetGate";
import UpdateGate from "../src/components/UpdateGate";
import UpdateGateWrapper from "../src/components/UpdateGateWrapper";
import MaintenanceGate from "../src/components/MaintenanceGate";
import { api } from "../src/lib/api";
import { loadAdSettings } from "../src/lib/adConfig";
// Metro picks initAdMob.web.ts on web (no-op) and initAdMob.ts on native (real init).
import "../src/lib/initAdMob";

type VersionInfo = {
  latest_version: string;
  min_supported_version: string;
  play_store_url: string;
  force_update: boolean;
  release_notes?: string;
};

function cmpVersion(a: string, b: string) {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export default function RootLayout() {
  const [versionGate, setVersionGate] = useState<VersionInfo | null>(null);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    (async () => {
      try {
        await NavigationBar.setBehaviorAsync("overlay-swipe");
        await NavigationBar.setVisibilityAsync("hidden");
      } catch {}
    })();
  }, []);

  // Check app version on launch — show animated update screen if outdated
  useEffect(() => {
    // Refresh AdMob unit IDs from the backend (admin can update them at any time).
    loadAdSettings();
    (async () => {
      try {
        const info = await api<VersionInfo>("/version", { auth: false });
        const installed =
          (Platform.OS === "web" ? "1.0.0" : Application.nativeApplicationVersion) || "1.0.0";
        const minOk = cmpVersion(installed, info.min_supported_version) >= 0;
        const latestOk = cmpVersion(installed, info.latest_version) >= 0;
        if (!minOk || (!latestOk && info.force_update)) {
          setVersionGate({ ...info, force_update: true });
        } else if (!latestOk) {
          setVersionGate({ ...info, force_update: false });
        }
      } catch {}
    })();
  }, []);

  if (false) {
    return null; // Force-update is now overlaid via UpdateGateWrapper so Profile remains reachable.
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NoInternetGate>
            <MaintenanceGate>
            <StatusBar style="dark" hidden />
            <UpdateGateWrapper
              active={!!versionGate && (versionGate.force_update || !skipped)}
              latestVersion={versionGate?.latest_version || ""}
              playStoreUrl={versionGate?.play_store_url || ""}
              forceUpdate={!!versionGate?.force_update}
              releaseNotes={versionGate?.release_notes}
              onSkip={() => setSkipped(true)}
            >
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F7F9FC" } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="auth-callback" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="withdraw" options={{ presentation: "card" }} />
              <Stack.Screen name="checkin" />
              <Stack.Screen name="spin" />
              <Stack.Screen name="scratch" />
              <Stack.Screen name="quizzes" />
              <Stack.Screen name="surveys" />
              <Stack.Screen name="watch-earn" />
              <Stack.Screen name="visit-earn" />
              <Stack.Screen name="offers" />
              <Stack.Screen name="task/[id]" />
              <Stack.Screen name="refer" />
              <Stack.Screen name="admin/index" />
              <Stack.Screen name="admin/banners" />
              <Stack.Screen name="admin/campaigns" />
              <Stack.Screen name="admin/withdrawals" />
              <Stack.Screen name="admin/links" />
              <Stack.Screen name="admin/users" />
              <Stack.Screen name="admin/campaign-completions" />
              <Stack.Screen name="admin/withdraw-settings" />
              <Stack.Screen name="admin/referral-settings" />
              <Stack.Screen name="admin/version" />
              <Stack.Screen name="admin/admob" />
              <Stack.Screen name="admin/settings" />
              <Stack.Screen name="higher-lower" />
            </Stack>
            </UpdateGateWrapper>
            </MaintenanceGate>
          </NoInternetGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
