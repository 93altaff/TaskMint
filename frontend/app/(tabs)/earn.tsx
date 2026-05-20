import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Calendar, RefreshCw, Sparkles, ClipboardCheck, Brain, PlayCircle, Globe, Gift,
  Layers, Grid3x3, Hash, Calculator, Award,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type ReferralInfo = {
  hero_title: string;
  hero_subtitle: string;
};

type CardConfig = {
  key: string;
  title: string;
  sub: string;
  icon: React.ReactElement;
  // Decorative large watermark icon rendered on the right side of the card.
  bgIcon: React.ReactElement;
  // Top-left → bottom-right linear gradient.
  gradient: readonly [string, string];
  route: string;
};

const WATERMARK_COLOR = "rgba(255,255,255,0.18)";
const WATERMARK_SIZE = 110;

const GAME_HEROES: CardConfig[] = [
  {
    key: "higher-lower",
    title: "Higher or Lower",
    sub: "10/day • streak up to 100",
    icon: <Layers size={22} color="#fff" />,
    bgIcon: <Layers size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#0EA5E9", "#1D4ED8"],
    route: "/higher-lower",
  },
  {
    key: "memory",
    title: "Memory Match",
    sub: "5/day • up to 200 pts",
    icon: <Grid3x3 size={22} color="#fff" />,
    bgIcon: <Grid3x3 size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#A855F7", "#7E22CE"],
    route: "/memory-match",
  },
  {
    key: "tictactoe",
    title: "Tic-Tac-Toe",
    sub: "5/day • beat the AI",
    icon: <Hash size={22} color="#fff" />,
    bgIcon: <Hash size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#2563EB", "#4338CA"],
    route: "/tic-tac-toe",
  },
  {
    key: "math",
    title: "Math Sprint",
    sub: "3/day • 60s sprint",
    icon: <Calculator size={22} color="#fff" />,
    bgIcon: <Calculator size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#10B981", "#047857"],
    route: "/math-sprint",
  },
  {
    key: "daily-challenge",
    title: "Daily Challenge",
    sub: "1 box/day • up to 1000 pts",
    icon: <Award size={22} color="#fff" />,
    bgIcon: <Award size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#F43F5E", "#BE123C"],
    route: "/daily-challenge",
  },
];

const QUICK_TASKS: CardConfig[] = [
  {
    key: "spin", title: "Spin & Win", sub: "5/day • 30-100 pts",
    icon: <RefreshCw size={22} color="#fff" />,
    bgIcon: <RefreshCw size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#6366F1", "#4338CA"], route: "/spin",
  },
  {
    key: "scratch", title: "Scratch & Earn", sub: "5/day • 30-100 pts",
    icon: <Sparkles size={22} color="#fff" />,
    bgIcon: <Sparkles size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#F97316", "#C2410C"], route: "/scratch",
  },
  {
    key: "visit", title: "Visit & Earn", sub: "Daily • 30-100 pts",
    icon: <Globe size={22} color="#fff" />,
    bgIcon: <Globe size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#14B8A6", "#0F766E"], route: "/visit-earn",
  },
  {
    key: "watch", title: "Watch & Earn", sub: "5 / 6h • 50-100 pts",
    icon: <PlayCircle size={22} color="#fff" />,
    bgIcon: <PlayCircle size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#EF4444", "#991B1B"], route: "/watch-earn",
  },
  {
    key: "surveys", title: "Surveys", sub: "5/day • 30-100 pts",
    icon: <ClipboardCheck size={22} color="#fff" />,
    bgIcon: <ClipboardCheck size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#8B5CF6", "#6D28D9"], route: "/surveys",
  },
  {
    key: "quizzes", title: "Quizzes", sub: "5/day • 30-100 pts",
    icon: <Brain size={22} color="#fff" />,
    bgIcon: <Brain size={WATERMARK_SIZE} color={WATERMARK_COLOR} />,
    gradient: ["#84CC16", "#3F6212"], route: "/quizzes",
  },
];

function GradientCard({
  cfg, height, onPress, testID,
}: { cfg: CardConfig; height: number; onPress: () => void; testID: string }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} testID={testID} style={[styles.cardWrap, { minHeight: height }]}>
      <LinearGradient
        colors={cfg.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardGradient, { minHeight: height }]}
      >
        <View style={styles.watermark} pointerEvents="none">{cfg.bgIcon}</View>
        <View style={styles.cardInner}>
          <View style={styles.iconWrap}>{cfg.icon}</View>
          <Text style={styles.cardTitle} numberOfLines={1}>{cfg.title}</Text>
          <Text style={styles.cardSub} numberOfLines={1}>{cfg.sub}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

export default function EarnScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refer, setRefer] = useState<ReferralInfo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<ReferralInfo>("/referrals/me").then(setRefer).catch(() => {});
  }, []);

  const open = (route: string) => router.push(route as any);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.title}>Earn</Text>
        <Text style={styles.sub}>Multiple ways to make money daily.</Text>

        {/* Daily Check-in hero */}
        <TouchableOpacity
          onPress={() => open("/checkin")}
          activeOpacity={0.85}
          style={styles.heroCompactWrap}
          testID="earn-checkin"
        >
          <LinearGradient
            colors={["#6366F1", "#4338CA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCompact}
          >
            <View style={styles.heroWatermark} pointerEvents="none">
              <Calendar size={120} color={WATERMARK_COLOR} />
            </View>
            <View style={styles.heroIconCompact}><Calendar size={20} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitleCompact}>Daily Check-in</Text>
              <Text style={styles.heroSubCompact}>Day {user?.streak ?? 0} streak • 20-100 pts</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Games */}
        <Text style={styles.sectionLabel}>Play & Earn</Text>
        <View style={styles.gameGrid}>
          {GAME_HEROES.map((g) => (
            <GradientCard key={g.key} cfg={g} height={120} onPress={() => open(g.route)} testID={`earn-game-${g.key}`} />
          ))}
        </View>

        <View style={styles.quickHead}>
          <Text style={[styles.sectionLabel, { marginTop: 0, marginBottom: 0 }]}>Quick Tasks</Text>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={() => {
              setRefreshKey((k) => k + 1);
              api<ReferralInfo>("/referrals/me").then(setRefer).catch(() => {});
            }}
            testID="earn-refresh"
          >
            <RefreshCw size={16} color={theme.colors.primary} />
            <Text style={styles.refreshTxt}>Refresh</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.grid} key={refreshKey}>
          {QUICK_TASKS.map((t) => (
            <GradientCard key={t.key} cfg={t} height={140} onPress={() => open(t.route)} testID={`earn-${t.key}`} />
          ))}
        </View>

        {/* Refer & Earn hero */}
        <TouchableOpacity
          onPress={() => open("/refer")}
          activeOpacity={0.85}
          style={styles.heroReferWrap}
          testID="earn-refer"
        >
          <LinearGradient
            colors={["#4F46E5", "#7C3AED"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroRefer}
          >
            <View style={styles.heroReferWatermark} pointerEvents="none">
              <Gift size={160} color={WATERMARK_COLOR} />
            </View>
            <View style={styles.heroIconBig}>
              <Gift size={32} color="#fff" />
            </View>
            <Text
              style={styles.heroTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {refer?.hero_title || "Earn ₹10 per friend"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  android: { elevation: 5 },
  default: {},
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  title: { fontSize: 32, fontWeight: "800", color: theme.colors.text, marginTop: 6, letterSpacing: -1 },
  sub: { color: theme.colors.text, marginTop: 6, marginBottom: theme.spacing.md, fontSize: 14 },

  // Daily Check-in hero
  heroCompactWrap: {
    marginTop: 6,
    borderRadius: theme.radii.xl,
    overflow: "hidden",
    ...cardShadow,
  },
  heroCompact: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingVertical: 16, paddingHorizontal: 16,
    overflow: "hidden",
  },
  heroWatermark: {
    position: "absolute",
    right: -28, top: -36,
    transform: [{ rotate: "-12deg" }],
  },
  heroIconCompact: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitleCompact: { color: "#fff", fontSize: 17, fontWeight: "800" },
  heroSubCompact: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2, fontWeight: "500" },

  // Game / Task gradient card
  cardWrap: {
    width: "48.5%",
    marginBottom: 12,
    borderRadius: theme.radii.xl,
    overflow: "hidden",
    ...cardShadow,
  },
  cardGradient: {
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    overflow: "hidden",
  },
  cardInner: { justifyContent: "space-between", flex: 1, gap: 6 },
  watermark: {
    position: "absolute",
    right: -22, top: -22,
    transform: [{ rotate: "-15deg" }],
    opacity: 0.95,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: 10 },
  cardSub: { fontSize: 11, color: "rgba(255,255,255,0.88)", marginTop: 2, fontWeight: "600" },

  // Refer hero
  heroReferWrap: {
    marginTop: 18,
    borderRadius: theme.radii.xl,
    overflow: "hidden",
    ...cardShadow,
  },
  heroRefer: {
    padding: theme.spacing.lg,
    alignItems: "center",
    overflow: "hidden",
  },
  heroReferWatermark: {
    position: "absolute",
    right: -36, top: -40,
    transform: [{ rotate: "-12deg" }],
  },
  heroIconBig: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center" },

  // Sections
  sectionLabel: {
    fontSize: 18, fontWeight: "800", color: theme.colors.text,
    marginTop: 20, marginBottom: 12,
  },
  gameGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  quickHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 20, marginBottom: 12,
  },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  refreshTxt: { color: theme.colors.primary, fontWeight: "800", fontSize: 12 },
});
