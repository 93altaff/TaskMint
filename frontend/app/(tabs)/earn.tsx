import React, { useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform, Image, Pressable, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Coins, Sparkles } from "lucide-react-native";
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring,
} from "react-native-reanimated";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import MaintenanceCard from "../../src/components/MaintenanceCard";
import { useMaintenance } from "../../src/hooks/useMaintenance";

const { width: SCREEN_W } = Dimensions.get("window");

// ============================================================================
// LAYOUT
// ============================================================================
const H_PADDING = 16;
const COL_GAP = 10;

// 2-column hero row size
const HERO_COLS = 2;
const HERO_SIZE = Math.floor(
  (SCREEN_W - H_PADDING * 2 - COL_GAP * (HERO_COLS - 1)) / HERO_COLS,
);

// 3-column grid card size
const GRID_COLS = 3;
const CARD_SIZE = Math.floor(
  (SCREEN_W - H_PADDING * 2 - COL_GAP * (GRID_COLS - 1)) / GRID_COLS,
);

// Inner padding removed — images are now full-bleed buttons.

// ============================================================================
// ASSETS — user-uploaded premium card artwork
// ============================================================================
type Card = { key: string; image: { uri: string }; route: string };

const HEROES: Card[] = [
  { key: "checkin", image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/x6hdp4u9_Daily%20Check-in.png" }, route: "/checkin" },
  { key: "refer",   image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/vw3e26bj_Refer%20%26%20Earn.png" }, route: "/refer" },
];

// Order per user spec:
// Higher Lower, Memory Match, Tic-Tac-Toe, Math Sprint, Daily Challenge,
// Tap the Coins, Trivia Streak, Spin & Win, Scratch & Earn, Watch & Earn,
// Visit & Earn, Surveys, Quizzes
const GRID: Card[] = [
  { key: "hl",      image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/etpdwkkd_higher%20Lower.png" },     route: "/higher-lower" },
  { key: "memory",  image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/xi30kh1e_memory%20Match.png" },     route: "/memory-match" },
  { key: "ttt",     image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/xw0uyd0n_Tic%20Tac%20Toe.png" },    route: "/tic-tac-toe" },
  { key: "math",    image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/uplo3z6d_Match%20Sprint.png" },     route: "/math-sprint" },
  { key: "daily",   image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/dlv7fgvt_Daily%20Challenge.png" },  route: "/daily-challenge" },
  { key: "tap",     image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/ltvcekrs_Tap%20The%20Coins.png" },  route: "/tap-rush" },
  { key: "trivia",  image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/1egvrie3_Trivia%20Streak.png" },    route: "/trivia-streak" },
  { key: "spin",    image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/n8x5w80e_Spin%20%26%20Win.png" },   route: "/spin" },
  { key: "scratch", image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/kkh28geq_Scratch%20%26%20Earn.png" }, route: "/scratch" },
  { key: "watch",   image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/plghot37_Watch%20%26%20Earn.png" }, route: "/watch-earn" },
  { key: "visit",   image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/wx3xbupj_Visit%20%26%20Earn.png" }, route: "/visit-earn" },
  { key: "surveys", image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/gg1c12jm_Surveys.png" },            route: "/surveys" },
  { key: "quizzes", image: { uri: "https://customer-assets.emergentagent.com/job_task-importer/artifacts/2jx1gvcy_Quizzes.png" },            route: "/quizzes" },
];

// ============================================================================
// PRESS CARD — spring scale on tap
// ============================================================================
function PressCard({
  children, onPress, style, testID,
}: { children: React.ReactNode; onPress: () => void; style?: any; testID?: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.94, { damping: 14, stiffness: 240 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 240 }); }}
        onPress={onPress}
        testID={testID}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// IMAGE BUTTON — the artwork IS the button. No white card, no padding, full bleed.
// Rounded corners come from clipping the image with overflow:hidden.
// ============================================================================
function EarnImageCard({
  card, size, onPress,
}: { card: Card; size: number; onPress: () => void }) {
  return (
    <PressCard
      onPress={onPress}
      testID={`earn-${card.key}`}
      style={[styles.cardWrap, { width: size, height: size }]}
    >
      <View style={[styles.cardInner, { width: size, height: size }]}>
        <Image
          source={card.image}
          style={{ width: size, height: size }}
          resizeMode="stretch"
        />
      </View>
    </PressCard>
  );
}

// ============================================================================
// SCREEN
// ============================================================================
export default function EarnScreen() {
  const maint = useMaintenance("/earn");
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    [...HEROES, ...GRID].forEach((c) => Image.prefetch(c.image.uri).catch(() => {}));
  }, []);

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

        {/* HERO ROW — 2 column */}
        <View style={styles.heroRow}>
          {HEROES.map((c) => (
            <EarnImageCard
              key={c.key}
              card={c}
              size={HERO_SIZE}
              onPress={() => open(c.route)}
            />
          ))}
        </View>

        {/* 3-column grid */}
        <View style={styles.grid}>
          {GRID.map((c) => (
            <EarnImageCard
              key={c.key}
              card={c}
              size={CARD_SIZE}
              onPress={() => open(c.route)}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9FC" },

  // Header
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
    ...Platform.select({
      ios: {
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        shadowColor: "#000",
      },
      android: { elevation: 1 },
    }),
  },
  balancePillText: { color: "#111827", fontWeight: "800", fontSize: 13 },

  // 2-col hero row
  heroRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COL_GAP,
    marginBottom: COL_GAP,
  },

  // 3-col grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: COL_GAP,
  },

  // Card — image IS the button. No white card, no padding, full-bleed artwork.
  cardWrap: {
    borderRadius: 20,
  },
  cardInner: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "transparent",
  },
});
