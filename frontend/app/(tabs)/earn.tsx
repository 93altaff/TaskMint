import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, Pressable, Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Coins, Sparkles } from "lucide-react-native";
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing,
} from "react-native-reanimated";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import MaintenanceCard from "../../src/components/MaintenanceCard";
import { useMaintenance } from "../../src/hooks/useMaintenance";

// ============================================================================
// TYPES
// ============================================================================
type EarnCardData = {
  id: string;
  key: string;
  title: string;
  image_url: string;
  route: string;
  hero: boolean;
  sort_order: number;
  hidden?: boolean;
};

// ============================================================================
// LAYOUT (responsive)
// Sizes are recomputed whenever the window dimensions change so the same
// component looks crisp on phones, foldables, and tablets.
// ============================================================================
const H_PADDING = 16;
const COL_GAP = 10;
const GRID_COLS = 3;
// Hero row keeps 2 columns but is much shorter — banner-style aspect ratio.
const HERO_ASPECT = 1.7; // width / height → shorter than a square
const MAX_CONTENT_W = 720; // cap on very wide screens (tablets/web)

function useGridSizes() {
  const [win, setWin] = useState(() => Dimensions.get("window"));
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setWin(window));
    return () => sub?.remove?.();
  }, []);
  const contentW = Math.min(win.width, MAX_CONTENT_W);
  const heroW = Math.floor((contentW - H_PADDING * 2 - COL_GAP) / 2);
  const heroH = Math.round(heroW / HERO_ASPECT);
  const gridW = Math.floor((contentW - H_PADDING * 2 - COL_GAP * (GRID_COLS - 1)) / GRID_COLS);
  return { winW: win.width, heroW, heroH, gridW };
}

// ============================================================================
// PRESS-STATE GLOW CARD
// On press: spring scale down + soft white overlay fade-in for a "lit" feel.
// Works identically across iOS / Android / web (no platform-specific code).
// ============================================================================
function PressGlowCard({
  width, height, onPress, testID, children,
}: {
  width: number; height: number;
  onPress: () => void; testID?: string;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);

  const animWrap = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const animOverlay = useAnimatedStyle(() => ({ opacity: overlay.value }));

  const onIn = () => {
    scale.value = withSpring(0.95, { damping: 14, stiffness: 240 });
    overlay.value = withTiming(0.22, { duration: 90, easing: Easing.out(Easing.quad) });
  };
  const onOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 240 });
    overlay.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });
  };

  return (
    <Animated.View style={[{ width, height, borderRadius: 20 }, animWrap]}>
      <Pressable
        onPressIn={onIn}
        onPressOut={onOut}
        onPress={onPress}
        testID={testID}
        style={[styles.cardInner, { width, height }]}
      >
        {children}
        {/* Soft white glow overlay — fades in on press for tactile feedback */}
        <Animated.View pointerEvents="none" style={[styles.glow, animOverlay]} />
      </Pressable>
    </Animated.View>
  );
}

function EarnImageCard({
  card, width, height, onPress,
}: {
  card: EarnCardData; width: number; height: number; onPress: () => void;
}) {
  return (
    <PressGlowCard
      width={width}
      height={height}
      onPress={onPress}
      testID={`earn-${card.key}`}
    >
      <Image
        source={{ uri: card.image_url }}
        style={{ width, height }}
        resizeMode="stretch"
      />
    </PressGlowCard>
  );
}

// ============================================================================
// SCREEN
// ============================================================================
export default function EarnScreen() {
  const maint = useMaintenance("/earn");
  const router = useRouter();
  const { user } = useAuth();
  const { heroW, heroH, gridW } = useGridSizes();

  const [cards, setCards] = useState<EarnCardData[] | null>(null);

  useEffect(() => {
    let alive = true;
    api<{ cards: EarnCardData[] }>("/earn-cards")
      .then((r) => { if (alive) setCards(r.cards || []); })
      .catch(() => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, []);

  // Prefetch artwork so the grid pops without staggered loads.
  useEffect(() => {
    if (cards) cards.forEach((c) => Image.prefetch(c.image_url).catch(() => {}));
  }, [cards]);

  const { heroes, grid } = useMemo(() => {
    const arr = (cards || []).filter((c) => !c.hidden);
    arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return {
      heroes: arr.filter((c) => c.hero),
      grid: arr.filter((c) => !c.hero),
    };
  }, [cards]);

  const open = (route: string) => router.push(route as any);
  const balance = user?.points ?? 0;

  if (maint.enabled) return <MaintenanceCard title="Earn" note={maint.note} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: H_PADDING,
          paddingTop: 12,
          paddingBottom: 100,
          alignSelf: "center",
          width: "100%",
          maxWidth: MAX_CONTENT_W,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Earn</Text>
              <Sparkles size={22} color="#F59E0B" />
            </View>
            <Text style={styles.sub}>Multiple ways to make money daily.</Text>
          </View>
          <Pressable
            style={styles.balancePill}
            onPress={() => open("/wallet")}
            testID="earn-balance-pill"
          >
            <Coins size={14} color="#F59E0B" />
            <Text style={styles.balancePillText}>{balance.toLocaleString()}</Text>
            <ChevronRight size={14} color={theme.colors.muted} />
          </Pressable>
        </View>

        {cards === null ? (
          <View style={{ paddingVertical: 60, alignItems: "center" }}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <>
            {/* HERO ROW — 2-col, shorter banner aspect */}
            {heroes.length > 0 && (
              <View style={styles.heroRow}>
                {heroes.map((c) => (
                  <EarnImageCard
                    key={c.id}
                    card={c}
                    width={heroW}
                    height={heroH}
                    onPress={() => open(c.route)}
                  />
                ))}
              </View>
            )}

            {/* 3-col grid (square cards) */}
            <View style={styles.grid}>
              {grid.map((c) => (
                <EarnImageCard
                  key={c.id}
                  card={c}
                  width={gridW}
                  height={gridW}
                  onPress={() => open(c.route)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9FC" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  title: { fontSize: 36, fontWeight: "900", color: "#111827", letterSpacing: -1.2 },
  sub: { color: "#6B7280", marginTop: 2, fontSize: 13, fontWeight: "500" },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  balancePillText: { color: "#111827", fontWeight: "800", fontSize: 13 },

  heroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COL_GAP,
    marginBottom: COL_GAP,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COL_GAP,
  },

  // Card — image IS the button.
  cardInner: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
  },

  // Soft tactile glow that appears on press (absolutely positioned overlay).
  glow: {
    position: "absolute",
    left: 0, right: 0, top: 0, bottom: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
  },
});
