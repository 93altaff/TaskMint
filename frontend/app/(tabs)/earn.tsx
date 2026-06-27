import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform, Image, ImageSourcePropType,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { RefreshCw, ChevronRight, Coins, Check } from "lucide-react-native";
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withRepeat, withTiming,
  withSequence,
} from "react-native-reanimated";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import MaintenanceCard from "../../src/components/MaintenanceCard";
import { useMaintenance } from "../../src/hooks/useMaintenance";

type ReferralInfo = { hero_title: string; hero_subtitle: string };
type AppConfig = Record<string, number>;

const W = (url: string) => `${url}?auto=format&fit=crop&w=400&q=85`;
const P = (url: string) => `${url}?auto=compress&cs=tinysrgb&dpr=2&w=400`;

// ---------- Card configuration ----------
type CardCfg = {
  key: string;
  title: string;
  rewardKey: keyof AppConfig | null;
  rewardOverride?: number;       // fallback when no app-config key
  image: ImageSourcePropType;
  gradient: readonly [string, string, string]; // top, mid, bottom (or 3-stop)
  shadow: string;                // glow shadow color (matches gradient)
  route: string;
};

const IMG = {
  hl:        { uri: W("https://images.unsplash.com/photo-1578269174936-2709b6aeb913") },
  memory:    { uri: W("https://images.unsplash.com/photo-1644648479153-2a3dbee76212") },
  ttt:       { uri: W("https://images.unsplash.com/photo-1667687435942-4fdff73a3ed6") },
  math:      { uri: W("https://images.unsplash.com/photo-1668930185267-1f3c19851b5b") },
  daily:     { uri: W("https://images.unsplash.com/photo-1629721671030-a83edbb11211") },
  tap:       { uri: P("https://images.pexels.com/photos/12198525/pexels-photo-12198525.jpeg") },
  trivia:    { uri: W("https://images.unsplash.com/photo-1708286405576-bdab8e2c092f") },
  spin:      { uri: W("https://images.unsplash.com/photo-1648727247252-5b03f05a3416") },
  scratch:   { uri: W("https://images.unsplash.com/photo-1741649416183-67f629128edb") },
  watch:     { uri: W("https://images.unsplash.com/photo-1611162616475-46b635cb6868") },
  visit:     { uri: W("https://images.unsplash.com/photo-1661705969607-cde73828023d") },
  surveys:   { uri: W("https://images.unsplash.com/photo-1598791318878-10e76d178023") },
  quizzes:   { uri: W("https://images.unsplash.com/photo-1665789318391-6057c533005e") },
  giftHero:  { uri: W("https://images.unsplash.com/photo-1647221598272-9aa015392c81") },
  referHero: { uri: W("https://images.unsplash.com/photo-1633104318039-e41a8acc000a") },
};

const GRADIENTS = {
  blue:    ["#3B82F6", "#2563EB", "#1D4ED8"] as const,
  purple:  ["#A855F7", "#9333EA", "#7E22CE"] as const,
  orange:  ["#FB923C", "#F97316", "#C2410C"] as const,
  green:   ["#22C55E", "#16A34A", "#15803D"] as const,
  pink:    ["#F472B6", "#EC4899", "#BE185D"] as const,
  gold:    ["#FBBF24", "#F59E0B", "#D97706"] as const,
  cyan:    ["#22D3EE", "#0EA5E9", "#0369A1"] as const,
  indigo:  ["#818CF8", "#6366F1", "#4338CA"] as const,
  amber:   ["#F59E0B", "#D97706", "#B45309"] as const,
  red:     ["#F87171", "#EF4444", "#B91C1C"] as const,
  teal:    ["#2DD4BF", "#14B8A6", "#0F766E"] as const,
  violet:  ["#A78BFA", "#8B5CF6", "#6D28D9"] as const,
  lime:    ["#A3E635", "#84CC16", "#4D7C0F"] as const,
  rose:    ["#FB7185", "#F43F5E", "#9F1239"] as const,
};

const GLOW = {
  blue: "#3B82F6", purple: "#A855F7", orange: "#FB923C", green: "#22C55E",
  pink: "#F472B6", gold: "#F59E0B", cyan: "#22D3EE", indigo: "#6366F1",
  amber: "#F59E0B", red: "#EF4444", teal: "#14B8A6", violet: "#8B5CF6",
  lime: "#84CC16", rose: "#F43F5E",
};

// Reward keys map to AppConfig fields (already used elsewhere). null = static override.
const CARDS: CardCfg[] = [
  // ---- Games ----
  { key: "hl",      title: "Higher or Lower", rewardKey: "hl_reward_streak_7",      image: IMG.hl,      gradient: GRADIENTS.blue,   shadow: GLOW.blue,   route: "/higher-lower" },
  { key: "memory",  title: "Memory Match",    rewardKey: "memory_completion",       image: IMG.memory,  gradient: GRADIENTS.purple, shadow: GLOW.purple, route: "/memory-match" },
  { key: "ttt",     title: "Tic-Tac-Toe",     rewardKey: "ttt_win",                 image: IMG.ttt,     gradient: GRADIENTS.orange, shadow: GLOW.orange, route: "/tic-tac-toe" },
  { key: "math",    title: "Math Sprint",     rewardKey: "math_per_correct", rewardOverride: 5000, image: IMG.math,    gradient: GRADIENTS.green,  shadow: GLOW.green,  route: "/math-sprint" },
  { key: "daily",   title: "Daily Challenge", rewardKey: null, rewardOverride: 1000, image: IMG.daily,   gradient: GRADIENTS.rose,   shadow: GLOW.rose,   route: "/daily-challenge" },
  { key: "tap",     title: "Tap-the-Coin",    rewardKey: "tap_per_diamond",  rewardOverride: 1000, image: IMG.tap,     gradient: GRADIENTS.gold,   shadow: GLOW.gold,   route: "/tap-rush" },
  { key: "trivia",  title: "Trivia Streak",   rewardKey: "trivia_streak_bonus", rewardOverride: 1000, image: IMG.trivia,  gradient: GRADIENTS.cyan,   shadow: GLOW.cyan,   route: "/trivia-streak" },
  { key: "spin",    title: "Spin & Win",      rewardKey: "spin_max",                image: IMG.spin,    gradient: GRADIENTS.indigo, shadow: GLOW.indigo, route: "/spin" },

  // ---- Quick tasks ----
  { key: "scratch", title: "Scratch & Earn",  rewardKey: "scratch_max",             image: IMG.scratch, gradient: GRADIENTS.amber,  shadow: GLOW.amber,  route: "/scratch" },
  { key: "visit",   title: "Visit & Earn",    rewardKey: "visit_max",               image: IMG.visit,   gradient: GRADIENTS.teal,   shadow: GLOW.teal,   route: "/visit-earn" },
  { key: "watch",   title: "Watch & Earn",    rewardKey: "watch_max",               image: IMG.watch,   gradient: GRADIENTS.red,    shadow: GLOW.red,    route: "/watch-earn" },
  { key: "surveys", title: "Surveys",         rewardKey: "survey_max",              image: IMG.surveys, gradient: GRADIENTS.violet, shadow: GLOW.violet, route: "/surveys" },
  { key: "quizzes", title: "Quizzes",         rewardKey: "quiz_max",                image: IMG.quizzes, gradient: GRADIENTS.lime,   shadow: GLOW.lime,   route: "/quizzes" },
];

// ---------- Helpers ----------
function formatReward(pts: number): string {
  if (!pts || pts <= 0) return "Earn now";
  if (pts >= 1000) return `Upto +${Math.round(pts / 1000)}K PTS`;
  return `Upto +${pts} PTS`;
}

// ---------- Animated press wrapper ----------
function PressCard({
  children, onPress, style, testID,
}: {
  children: React.ReactNode; onPress: () => void; style?: any; testID?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.96, { damping: 14, stiffness: 220 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 220 }); }}
        onPress={onPress}
        testID={testID}
        style={{ flex: 1 }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ---------- Reward badge (with pulse on hero only) ----------
function RewardBadge({ label, pulse }: { label: string; pulse?: boolean }) {
  const op = useSharedValue(1);
  useEffect(() => {
    if (!pulse) return;
    op.value = withRepeat(withSequence(withTiming(0.65, { duration: 900 }), withTiming(1, { duration: 900 })), -1, false);
  }, [pulse, op]);
  const animStyle = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View style={[styles.badge, pulse && animStyle]}>
      <Coins size={11} color="#fff" />
      <Text style={styles.badgeText} numberOfLines={1}>{label}</Text>
    </Animated.View>
  );
}

// ---------- Game/Task card ----------
function EarnCard({ cfg, reward, onPress, testID }: {
  cfg: CardCfg; reward: number; onPress: () => void; testID: string;
}) {
  return (
    <PressCard
      onPress={onPress}
      testID={testID}
      style={[styles.cardWrap, { shadowColor: cfg.shadow }]}
    >
      <LinearGradient
        colors={cfg.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        {/* Decorative starfield overlay */}
        <View pointerEvents="none" style={styles.dots}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  top: 8 + (i * 13) % 90,
                  left: 10 + (i * 27) % 140,
                  opacity: 0.18 + (i * 0.06) % 0.3,
                },
              ]}
            />
          ))}
        </View>

        {/* Soft inner glow */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.18)", "rgba(255,255,255,0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        <View style={styles.cardBody}>
          <View style={{ flex: 1, justifyContent: "space-between", paddingVertical: 4 }}>
            <Text style={styles.cardTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {cfg.title}
            </Text>
            <RewardBadge label={formatReward(reward)} />
          </View>
          <View style={styles.illustrationWrap}>
            <Image source={cfg.image} style={styles.illustration} resizeMode="cover" />
          </View>
        </View>
      </LinearGradient>
    </PressCard>
  );
}

// ---------- Daily Check-in HERO ----------
function CheckinHero({ streak, claimed, onPress }: {
  streak: number; claimed: boolean; onPress: () => void;
}) {
  const sparkle = useSharedValue(0);
  useEffect(() => {
    sparkle.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 1400 })),
      -1, false,
    );
  }, [sparkle]);
  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + sparkle.value * 0.55,
    transform: [{ scale: 0.9 + sparkle.value * 0.2 }],
  }));
  return (
    <PressCard onPress={onPress} testID="earn-checkin" style={[styles.heroWrap, { shadowColor: "#6366F1" }]}>
      <LinearGradient
        colors={["#7C3AED", "#6366F1", "#4F46E5"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Decorative sparkle dots */}
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          {Array.from({ length: 14 }).map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.heroSparkle,
                {
                  top: 8 + (i * 11) % 100,
                  left: 16 + (i * 41) % 320,
                  opacity: 0.4 + (i * 0.07) % 0.5,
                },
                sparkleStyle,
              ]}
            />
          ))}
        </View>

        {/* Calendar icon block (left) */}
        <View style={styles.heroLeft}>
          <View style={styles.heroCalendar}>
            <View style={styles.heroCalendarTop} />
            <Text style={styles.heroCalendarDay}>{streak || 1}</Text>
            <Text style={styles.heroCalendarLabel}>DAY</Text>
          </View>
        </View>

        {/* Center text */}
        <View style={styles.heroCenter}>
          <Text style={styles.heroTitle}>Daily Check-in</Text>
          <Text style={styles.heroSub}>Day {streak || 0} streak</Text>
          <View style={styles.heroRange}>
            <Coins size={12} color="#FCD34D" />
            <Text style={styles.heroRangeText}>20 - 100 pts</Text>
          </View>
        </View>

        {/* Gift box (right) */}
        <View style={styles.heroRight}>
          <Image
            source={IMG.giftHero}
            style={styles.heroGift}
            resizeMode="cover"
          />
          {claimed ? (
            <View style={styles.heroBadge}>
              <Check size={12} color="#fff" strokeWidth={3} />
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </PressCard>
  );
}

// ---------- Referral Banner ----------
function ReferralBanner({ heroTitle, perFriendInr, onPress }: {
  heroTitle?: string; perFriendInr: number; onPress: () => void;
}) {
  return (
    <PressCard onPress={onPress} testID="earn-refer" style={[styles.referWrap, { shadowColor: "#8B5CF6" }]}>
      <LinearGradient
        colors={["#8B5CF6", "#7C3AED", "#5B21B6"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.refer}
      >
        <View style={styles.referLeft}>
          <Image
            source={IMG.referHero}
            style={styles.referKids}
            resizeMode="cover"
          />
        </View>

        <View style={styles.referCenter}>
          <Text style={styles.referTitle} numberOfLines={2}>Invite Friends & Earn</Text>
          <Text style={styles.referAmount}>
            ₹{perFriendInr || 31}
            <Text style={styles.referPer}> per friend</Text>
          </Text>
          <View style={styles.referCta}>
            <Text style={styles.referCtaText}>Invite Now</Text>
            <ChevronRight size={14} color="#7C3AED" />
          </View>
        </View>
      </LinearGradient>
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
  const [refer, setRefer] = useState<ReferralInfo | null>(null);
  const [config, setConfig] = useState<AppConfig>({});
  const [perFriendInr, setPerFriendInr] = useState<number>(31);
  const [refreshKey, setRefreshKey] = useState(0);
  // checkin: assume not claimed today if streak hasn't been updated today;
  // backend already handles the real state, this is purely visual.
  const claimedToday = false;

  const loadAll = React.useCallback(() => {
    api<ReferralInfo>("/referrals/me").then(setRefer).catch(() => {});
    api<AppConfig>("/app-config", { auth: false }).then(setConfig).catch(() => {});
    api<{ streak_7_reward_points?: number }>("/referral-settings", { auth: false })
      .then((s) => {
        // Approximate ₹ per friend = points / exchange_ratio (default 100)
        const pts = s?.streak_7_reward_points || 3100;
        const ratio = 100;
        setPerFriendInr(Math.round(pts / ratio));
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const open = (route: string) => router.push(route as any);

  const cardsWithRewards = useMemo(() => CARDS.map((c) => {
    let reward = c.rewardOverride ?? 0;
    if (c.rewardKey && config[c.rewardKey] != null) {
      reward = Number(config[c.rewardKey]) || reward;
    }
    return { cfg: c, reward };
  }), [config]);

  const balance = user?.points ?? 0;

  if (maint.enabled) return <MaintenanceCard title="Earn" note={maint.note} />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Earn ✨</Text>
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

        {/* Daily Check-in HERO */}
        <CheckinHero
          streak={user?.streak ?? 0}
          claimed={claimedToday}
          onPress={() => open("/checkin")}
        />

        {/* Section header */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Games & Tasks</Text>
          <Pressable
            style={styles.refreshBtn}
            onPress={() => { setRefreshKey((k) => k + 1); loadAll(); }}
            testID="earn-refresh"
          >
            <RefreshCw size={14} color={theme.colors.primary} />
            <Text style={styles.refreshTxt}>Refresh</Text>
          </Pressable>
        </View>

        {/* 2-column grid (last card spans full width if total is odd) */}
        <View style={styles.grid} key={refreshKey}>
          {cardsWithRewards.map((it, idx) => {
            const isLastSolo = (cardsWithRewards.length % 2 === 1) && idx === cardsWithRewards.length - 1;
            return (
              <EarnCard
                key={it.cfg.key}
                cfg={it.cfg}
                reward={it.reward}
                onPress={() => open(it.cfg.route)}
                testID={`earn-${it.cfg.key}`}
                {...(isLastSolo ? { /* full-width handled in style */ } : {})}
              />
            );
          })}
        </View>

        {/* Referral Banner */}
        <ReferralBanner
          heroTitle={refer?.hero_title}
          perFriendInr={perFriendInr}
          onPress={() => open("/refer")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const cardShadow = Platform.select({
  ios: {
    shadowOpacity: 0.32,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
  },
  android: { elevation: 8 },
  default: {},
});

const heroShadow = Platform.select({
  ios: {
    shadowOpacity: 0.38,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 22,
  },
  android: { elevation: 10 },
  default: {},
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },

  // Header
  headerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 32, fontWeight: "900", color: theme.colors.text,
    marginTop: 6, letterSpacing: -1,
  },
  sub: { color: theme.colors.muted, marginTop: 4, fontSize: 14, fontWeight: "500" },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border,
    ...Platform.select({ ios: { shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowColor: "#000" }, android: { elevation: 1 } }),
  },
  balancePillText: { color: theme.colors.text, fontWeight: "800", fontSize: 13 },

  // Daily Check-in HERO
  heroWrap: {
    borderRadius: 24,
    overflow: "visible",
    marginBottom: 18,
    ...heroShadow,
  },
  hero: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 116,
  },
  heroSparkle: {
    position: "absolute",
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: "#FCD34D",
  },
  heroLeft: { width: 76, alignItems: "center", justifyContent: "center" },
  heroCalendar: {
    width: 64, height: 72,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    paddingTop: 12,
    ...Platform.select({ ios: { shadowOpacity: 0.15, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, shadowColor: "#000" }, android: { elevation: 4 } }),
  },
  heroCalendarTop: {
    position: "absolute", top: 0, left: 0, right: 0, height: 8,
    backgroundColor: "#F59E0B",
  },
  heroCalendarDay: {
    fontSize: 24, fontWeight: "900", color: "#4F46E5", marginTop: 6,
  },
  heroCalendarLabel: {
    fontSize: 9, fontWeight: "800", color: "#6B7280", letterSpacing: 1.2, marginTop: 2,
  },
  heroCenter: { flex: 1, paddingLeft: 4 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  heroSub: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600", marginTop: 2 },
  heroRange: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.18)",
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999, marginTop: 6,
  },
  heroRangeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  heroRight: {
    width: 92, height: 96,
    marginLeft: 8,
    alignItems: "center", justifyContent: "center",
  },
  heroGift: {
    width: 92, height: 96,
    borderRadius: 16,
  },
  heroBadge: {
    position: "absolute", top: -4, right: -4,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },

  // Section row
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 4, marginBottom: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: theme.colors.text, letterSpacing: -0.5 },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  refreshTxt: { color: theme.colors.primary, fontWeight: "800", fontSize: 12 },

  // Grid
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  // Card
  cardWrap: {
    width: "48.5%",
    marginBottom: 14,
    borderRadius: 22,
    ...cardShadow,
  },
  card: {
    borderRadius: 22,
    padding: 12,
    overflow: "hidden",
    minHeight: 132,
  },
  dots: { ...StyleSheet.absoluteFillObject },
  dot: {
    position: "absolute",
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: "#fff",
  },
  cardBody: {
    flexDirection: "row", flex: 1, alignItems: "stretch",
  },
  cardTitle: {
    color: "#fff", fontSize: 15, fontWeight: "900",
    letterSpacing: -0.2, lineHeight: 18,
  },
  illustrationWrap: {
    width: 70, height: 70,
    alignSelf: "flex-end",
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  illustration: { width: "100%", height: "100%" },

  // Reward badge
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
  },
  badgeText: {
    color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.2,
  },

  // Referral banner
  referWrap: {
    borderRadius: 24,
    marginTop: 8,
    ...heroShadow,
  },
  refer: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    minHeight: 116,
  },
  referLeft: { width: 88, height: 88, marginRight: 12, alignItems: "center" },
  referKids: {
    width: 88, height: 88, borderRadius: 16,
  },
  referCenter: { flex: 1 },
  referTitle: {
    color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: -0.2,
  },
  referAmount: {
    color: "#FCD34D", fontSize: 24, fontWeight: "900",
    marginTop: 2, letterSpacing: -0.5,
  },
  referPer: {
    color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600",
  },
  referCta: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, marginTop: 8,
  },
  referCtaText: {
    color: "#7C3AED", fontWeight: "900", fontSize: 13,
  },
});
