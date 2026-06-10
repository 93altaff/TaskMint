import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useSegments, usePathname } from "expo-router";
import { Wrench } from "lucide-react-native";
import { theme } from "../lib/theme";
import { api } from "../lib/api";

type MaintenanceMap = Record<string, { enabled?: boolean; note?: string }>;

let cached: { at: number; data: MaintenanceMap } = { at: 0, data: {} };
const TTL = 30 * 1000; // 30s cache to avoid hammering the backend on every screen.

async function fetchMaintenance(): Promise<MaintenanceMap> {
  const now = Date.now();
  if (now - cached.at < TTL) return cached.data;
  try {
    const r = await api<{ maintenance: MaintenanceMap }>("/maintenance");
    cached = { at: now, data: r?.maintenance || {} };
  } catch {
    // fail-open: if we can't reach the API, don't block any screen.
    cached = { at: now, data: {} };
  }
  return cached.data;
}

/**
 * Wraps any route. If the admin enabled maintenance for the current route,
 * renders a "Coming Soon / Under Maintenance" screen instead of `children`.
 *
 * `routeKey` is optional — if provided we use it; otherwise we derive from
 * the current pathname so the same wrapper can be used everywhere.
 */
export default function MaintenanceGate({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey?: string;
}) {
  const pathname = usePathname();
  const segments = useSegments();
  const [maintenance, setMaintenance] = useState<MaintenanceMap>(cached.data);
  const [ready, setReady] = useState(cached.at > 0);

  useEffect(() => {
    let alive = true;
    fetchMaintenance().then((m) => {
      if (!alive) return;
      setMaintenance(m);
      setReady(true);
    });
    return () => { alive = false; };
  }, [pathname]);

  if (!ready) return <>{children}</>;

  // Resolve which key to check (in order of specificity).
  const candidates: string[] = [];
  if (routeKey) candidates.push(routeKey);
  if (pathname) candidates.push(pathname);
  // For tabs: "/(tabs)/earn" → also try "/earn"
  if (pathname?.includes("(tabs)")) {
    candidates.push(pathname.replace("/(tabs)", ""));
  }
  // Tab segment fallback e.g. "earn" → "/earn"
  const lastSeg = segments[segments.length - 1];
  if (lastSeg) candidates.push(`/${lastSeg}`);

  const match = candidates
    .map((k) => maintenance[k])
    .find((entry) => entry && entry.enabled);

  if (!match) return <>{children}</>;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.center}>
        <LinearGradient
          colors={["#4F46E5", "#7C3AED"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <Wrench size={48} color="#fff" />
        </LinearGradient>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.body}>
          {match.note?.trim() ||
            "This feature is undergoing improvements. Please check back later — your earnings are safe."}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>Under Maintenance</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: theme.spacing.lg, gap: 18,
  },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  body: {
    fontSize: 14, color: theme.colors.muted, textAlign: "center",
    lineHeight: 21, maxWidth: 340,
  },
  badge: {
    backgroundColor: "rgba(99,102,241,0.12)",
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  badgeTxt: {
    color: theme.colors.primary, fontWeight: "800", fontSize: 12,
    letterSpacing: 0.8, textTransform: "uppercase",
  },
});
