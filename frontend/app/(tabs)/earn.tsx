import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
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

const GAME_HEROES = [
  {
    key: "higher-lower",
    title: "Higher or Lower",
    sub: "10/day • streak up to 100",
    icon: <Layers size={22} color="#fff" />,
    bg: "#06B6D4",
    route: "/higher-lower",
  },
  {
    key: "memory",
    title: "Memory Match",
    sub: "5/day • up to 200 pts",
    icon: <Grid3x3 size={22} color="#fff" />,
    bg: "#A855F7",
    route: "/memory-match",
  },
  {
    key: "tictactoe",
    title: "Tic-Tac-Toe",
    sub: "5/day • beat the AI",
    icon: <Hash size={22} color="#fff" />,
    bg: "#0EA5E9",
    route: "/tic-tac-toe",
  },
  {
    key: "math",
    title: "Math Sprint",
    sub: "3/day • 60s sprint",
    icon: <Calculator size={22} color="#fff" />,
    bg: "#22C55E",
    route: "/math-sprint",
  },
  {
    key: "daily-challenge",
    title: "Daily Challenge",
    sub: "1 box/day • up to 1000 pts",
    icon: <Award size={22} color="#fff" />,
    bg: "#F43F5E",
    route: "/daily-challenge",
  },
];

export default function EarnScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [refer, setRefer] = useState<ReferralInfo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api<ReferralInfo>("/referrals/me").then(setRefer).catch(() => {});
  }, []);

  const open = (route: string) => router.push(route as any);

  const tasks = [
    { key: "spin", title: "Spin & Win", sub: "5/day • 30-100 pts", icon: <RefreshCw size={22} color="#fff" />, bg: "#6366F1", route: "/spin" },
    { key: "scratch", title: "Scratch & Earn", sub: "5/day • 30-100 pts", icon: <Sparkles size={22} color="#fff" />, bg: "#F97316", route: "/scratch" },
    { key: "visit", title: "Visit & Earn", sub: "Daily • 30-100 pts", icon: <Globe size={22} color="#fff" />, bg: "#14B8A6", route: "/visit-earn" },
    { key: "watch", title: "Watch & Earn", sub: "5 / 6h • 50-100 pts", icon: <PlayCircle size={22} color="#fff" />, bg: "#EF4444", route: "/watch-earn" },
    { key: "surveys", title: "Surveys", sub: "5/day • 30-100 pts", icon: <ClipboardCheck size={22} color="#fff" />, bg: "#8B5CF6", route: "/surveys" },
    { key: "quizzes", title: "Quizzes", sub: "5/day • 30-100 pts", icon: <Brain size={22} color="#fff" />, bg: "#84CC16", route: "/quizzes" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}>
        <Text style={styles.title}>Earn</Text>
        <Text style={styles.sub}>Multiple ways to make money daily.</Text>

        {/* Compact Daily Check-in hero */}
        <TouchableOpacity
          onPress={() => open("/checkin")}
          activeOpacity={0.85}
          style={styles.heroCompact}
          testID="earn-checkin"
        >
          <View style={styles.heroIconCompact}><Calendar size={20} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitleCompact}>Daily Check-in</Text>
            <Text style={styles.heroSubCompact}>Day {user?.streak ?? 0} streak • 20-100 pts</Text>
          </View>
        </TouchableOpacity>

        {/* Games — 4 hero cards in a 2x2 grid */}
        <Text style={styles.sectionLabel}>Play & Earn</Text>
        <View style={styles.gameGrid}>
          {GAME_HEROES.map((g) => (
            <TouchableOpacity
              key={g.key}
              activeOpacity={0.85}
              onPress={() => open(g.route)}
              style={[styles.gameCard, { backgroundColor: g.bg }]}
              testID={`earn-game-${g.key}`}
            >
              <View style={styles.gameIconWrap}>{g.icon}</View>
              <Text style={styles.gameTitle} numberOfLines={1}>{g.title}</Text>
              <Text style={styles.gameSub} numberOfLines={1}>{g.sub}</Text>
            </TouchableOpacity>
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
          {tasks.map((t) => (
            <TouchableOpacity
              key={t.key}
              activeOpacity={0.85}
              onPress={() => open(t.route)}
              testID={`earn-${t.key}`}
              style={[styles.card, { backgroundColor: t.bg }]}
            >
              <View style={styles.iconWrap}>{t.icon}</View>
              <Text style={styles.cardTitle} numberOfLines={1}>{t.title}</Text>
              <Text style={styles.cardSub} numberOfLines={1}>{t.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Refer & Earn hero card — same as Refer screen, admin-controlled texts */}
        <TouchableOpacity
          onPress={() => open("/refer")}
          activeOpacity={0.85}
          style={styles.heroRefer}
          testID="earn-refer"
        >
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
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  title: { fontSize: 32, fontWeight: "800", color: theme.colors.text, marginTop: 6, letterSpacing: -1 },
  sub: { color: theme.colors.text, marginTop: 6, marginBottom: theme.spacing.md, fontSize: 14 },

  // Compact hero (Daily Check-in)
  heroCompact: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xl,
    paddingVertical: 14, paddingHorizontal: 16,
    marginTop: 6,
  },
  heroIconCompact: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitleCompact: { color: "#fff", fontSize: 17, fontWeight: "800" },
  heroSubCompact: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2, fontWeight: "500" },

  // Game hero grid (2x2)
  gameGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  gameCard: {
    width: "48.5%",
    minHeight: 110,
    marginBottom: 12,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    justifyContent: "space-between",
  },
  gameIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  gameTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: 10 },
  gameSub: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "600" },

  // Refer hero — full card matching Refer screen
  heroRefer: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    alignItems: "center",
    marginTop: 18,
  },
  heroIconBig: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "800", textAlign: "center" },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 18 },

  sectionLabel: {
    fontSize: 18, fontWeight: "800", color: theme.colors.text,
    marginTop: 20, marginBottom: 12,
  },
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
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  card: {
    width: "48.5%",
    minHeight: 130,
    marginBottom: 12,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    justifyContent: "space-between",
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginTop: 10 },
  cardSub: { fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 2, fontWeight: "600" },
});
