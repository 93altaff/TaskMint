import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Platform, Image, ImageSourcePropType,
  Pressable, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { RefreshCw, ChevronRight, Coins, Sparkles } from "lucide-react-native";
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withRepeat, withTiming,
  withSequence, Easing,
} from "react-native-reanimated";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import MaintenanceCard from "../../src/components/MaintenanceCard";
import { useMaintenance } from "../../src/hooks/useMaintenance";

type ReferralInfo = { hero_title: string; hero_subtitle: string };
type AppConfig = Record<string, number>;

const { width: SCREEN_W } = Dimensions.get("window");

// ============================================================================
// 3D ASSETS — Microsoft Fluent UI Emoji (MIT-licensed, transparent PNGs)
// Hosted on jsdelivr CDN — verified 200 OK at build time.
// ============================================================================
const FLUENT = "https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets";
const IMG = {
  trophy:    { uri: `${FLUENT}/Trophy/3D/trophy_3d.png` },
  brain:     { uri: `${FLUENT}/Brain/3D/brain_3d.png` },
  die:       { uri: `${FLUENT}/Game%20die/3D/game_die_3d.png` },
  abacus:    { uri: `${FLUENT}/Abacus/3D/abacus_3d.png` },
  bullseye:  { uri: `${FLUENT}/Bullseye/3D/bullseye_3d.png` },
  coin:      { uri: `${FLUENT}/Coin/3D/coin_3d.png` },
  bulb:      { uri: `${FLUENT}/Light%20bulb/3D/light_bulb_3d.png` },
  slot:      { uri: `${FLUENT}/Slot%20machine/3D/slot_machine_3d.png` },
  moneyWings:{ uri: `${FLUENT}/Money%20with%20wings/3D/money_with_wings_3d.png` },
  tv:        { uri: `${FLUENT}/Television/3D/television_3d.png` },
  globe:     { uri: `${FLUENT}/Globe%20with%20meridians/3D/globe_with_meridians_3d.png` },
  clipboard: { uri: `${FLUENT}/Clipboard/3D/clipboard_3d.png` },
  notebook:  { uri: `${FLUENT}/Notebook%20with%20decorative%20cover/3D/notebook_with_decorative_cover_3d.png` },
  gift:      { uri: `${FLUENT}/Wrapped%20gift/3D/wrapped_gift_3d.png` },
  hugging:   { uri: `${FLUENT}/People%20hugging/3D/people_hugging_3d.png` },
  calendar:  { uri: `${FLUENT}/Calendar/3D/calendar_3d.png` },
  moneyBag:  { uri: `${FLUENT}/Money%20bag/3D/money_bag_3d.png` },
};

type Cfg = {
  key: string;
  title: string;
  rewardKey: keyof AppConfig | null;
  rewardOverride?: number;
  image: ImageSourcePropType;
  // Three-stop gradient (top-left → mid → bottom-right)
  gradient: readonly [string, string, string];
  shadow: string;
  route: string;
};

const G = {
  blue:    ["#60A5FA", "#3B82F6", "#1D4ED8"] as const,
  purple:  ["#C084FC", "#9333EA", "#6B21A8"] as const,
  indigo:  ["#818CF8", "#4F46E5", "#3730A3"] as const,
  green:   ["#4ADE80", "#16A34A", "#15803D"] as const,
  rose:    ["#FB7185", "#E11D48", "#9F1239"] as const,
  amber:   ["#FBBF24", "#F59E0B", "#B45309"] as const,
  teal:    ["#5EEAD4", "#14B8A6", "#0F766E"] as const,
  orange:  ["#FB923C", "#EA580C", "#9A3412"] as const,
  cyan:    ["#22D3EE", "#0891B2", "#155E75"] as const,
  red:     ["#F87171", "#DC2626", "#991B1B"] as const,
  violet:  ["#A78BFA", "#7C3AED", "#5B21B6"] as const,
  lime:    ["#A3E635", "#65A30D", "#365314"] as const,
  pink:    ["#F472B6", "#DB2777", "#9D174D"] as const,
};

const CARDS: Cfg[] = [
  // ---- Games ----
  { key: "hl",      title: "Higher or Lower", rewardKey: "hl_reward_streak_7", rewardOverride: 5000, image: IMG.trophy,    gradient: G.blue,    shadow: G.blue[1],    route: "/higher-lower" },
  { key: "memory",  title: "Memory Match",    rewardKey: "memory_completion",  rewardOverride: 5000, image: IMG.brain,     gradient: G.purple,  shadow: G.purple[1],  route: "/memory-match" },
  { key: "ttt",     title: "Tic-Tac-Toe",     rewardKey: "ttt_win",            rewardOverride: 5000, image: IMG.die,       gradient: G.indigo,  shadow: G.indigo[1],  route: "/tic-tac-toe" },
  { key: "math",    title: "Math Sprint",     rewardKey: "math_per_correct",   rewardOverride: 5000, image: IMG.abacus,    gradient: G.green,   shadow: G.green[1],   route: "/math-sprint" },
  { key: "daily",   title: "Daily Challenge", rewardKey: null,                 rewardOverride: 1000, image: IMG.bullseye,  gradient: G.rose,    shadow: G.rose[1],    route: "/daily-challenge" },
  { key: "tap",     title: "Tap-the-Coin",    rewardKey: "tap_per_diamond",    rewardOverride: 1000, image: IMG.coin,      gradient: G.amber,   shadow: G.amber[1],   route: "/tap-rush" },
  { key: "trivia",  title: "Trivia Streak",   rewardKey: "trivia_streak_bonus",rewardOverride: 1000, image: IMG.bulb,      gradient: G.teal,    shadow: G.teal[1],    route: "/trivia-streak" },
  { key: "spin",    title: "Spin & Win",      rewardKey: "spin_max",           rewardOverride: 1000, image: IMG.slot,      gradient: G.violet,  shadow: G.violet[1],  route: "/spin" },
  // ---- Quick tasks ----
  { key: "scratch", title: "Scratch & Earn",  rewardKey: "scratch_max",        rewardOverride: 1000, image: IMG.moneyWings,gradient: G.orange,  shadow: G.orange[1],  route: "/scratch" },
  { key: "visit",   title: "Visit & Earn",    rewardKey: "visit_max",          rewardOverride: 1000, image: IMG.globe,     gradient: G.cyan,    shadow: G.cyan[1],    route: "/visit-earn" },
  { key: "watch",   title: "Watch & Earn",    rewardKey: "watch_max",          rewardOverride: 1000, image: IMG.tv,        gradient: G.red,     shadow: G.red[1],     route: "/watch-earn" },
  { key: "surveys", title: "Surveys",         rewardKey: "survey_max",         rewardOverride: 1000, image: IMG.clipboard, gradient: G.pink,    shadow: G.pink[1],    route: "/surveys" },
  { key: "quizzes", title: "Quizzes",         rewardKey: "quiz_max",           rewardOverride: 1000, image: IMG.notebook,  gradient: G.lime,    shadow: G.lime[1],    route: "/quizzes" },
];

// ============================================================================
// Helpers
// ============================================================================
function formatReward(pts: number): string {
  if (!pts || pts <= 0) return "Earn now";
  if (pts >= 1000) return `Upto +${Math.round(pts / 1000)}K PTS`;
  if (pts >= 100) return `Upto +${pts} PTS`;
  return `Upto +${pts} PTS`;
}

// ============================================================================
// Animated press wrapper — spring scale on tap
// ============================================================================
function PressCard({
  children, onPress, style, testID,
}: { children: React.ReactNode; onPress: () => void; style?: any; testID?: string }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={[animStyle, style]}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 14, stiffness: 240 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 14, stiffness: 240 }); }}
        onPress={onPress}
        testID={testID}
        style={{ flex: 1 }}
        android_ripple={undefined}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// Floating 3D illustration with gentle bob animation
// ============================================================================
function FloatingIllustration({
  source, size = 92, offset = 0,
}: { source: ImageSourcePropType; size?: number; offset?: number }) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(4, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, true,
    );
  }, [y]);
  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: y.value + offset }] }));
  return (
    <Animated.View style={[{ width: size, height: size }, bob]}>
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// ============================================================================
// Decorative star/dot scatter overlay
// ============================================================================
function Stardust({ count = 8 }: { count?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: count }).map((_, i) => {
        const top = ((i * 17) % 90) + 8;
        const left = ((i * 41) % 88) + 8;  // percent
        const size = 3 + (i % 3);
        const op = 0.25 + ((i * 0.13) % 0.4);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              top: `${top}%`,
              left: `${left}%`,
              width: size, height: size, borderRadius: size / 2,
              backgroundColor: "#fff",
              opacity: op,
            }}
          />
        );
      })}
    </View>
  );
}

// ============================================================================
// EARN CARD — premium gradient + 3D illustration
// ============================================================================
function EarnCard({ cfg, reward, onPress, testID }: {
  cfg: Cfg; reward: number; onPress: () => void; testID: string;
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
        {/* Diagonal highlight (top-left → center) for clay morphism */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0.0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Decorative stars */}
        <Stardust count={9} />

        {/* Content — text left, illustration right (floating, no box) */}
        <View style={styles.cardBody}>
          <View style={styles.cardText}>
            <Text
              style={styles.cardTitle}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {cfg.title}
            </Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{formatReward(reward)}</Text>
            </View>
          </View>

          <View style={styles.illustrationSlot}>
            {/* Drop shadow underneath the floating illustration */}
            <View style={styles.illustrationShadow} pointerEvents="none" />
            <FloatingIllustration source={cfg.image} size={86} />
          </View>
        </View>
      </LinearGradient>
    </PressCard>
  );
}

// ============================================================================
// DAILY CHECK-IN HERO
// ============================================================================
function CheckinHero({ streak, onPress }: { streak: number; onPress: () => void }) {
  // Subtle continuous shimmer sweep across the hero
  const shimmer = useSharedValue(-1);
  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.cubic) }),
      -1, false,
    );
  }, [shimmer]);
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmer.value * (SCREEN_W * 0.9) }],
  }));

  return (
    <PressCard
      onPress={onPress}
      testID="earn-checkin"
      style={[styles.heroWrap, { shadowColor: "#6366F1" }]}
    >
      <LinearGradient
        colors={["#8B5CF6", "#6366F1", "#4338CA"] as const}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Soft top highlight */}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0.0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Shimmer stripe */}
        <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none" />

        <Stardust count={14} />

        {/* Calendar on left */}
        <View style={styles.heroCalendarWrap}>
          <Image source={IMG.calendar} style={styles.heroCalendar} resizeMode="contain" />
        </View>

        {/* Text center */}
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>Daily Check-in</Text>
          <View style={styles.heroSubRow}>
            <Sparkles size={11} color="#FCD34D" />
            <Text style={styles.heroStreak}>Day {streak || 0} streak</Text>
          </View>
          <View style={styles.heroPill}>
            <Coins size={11} color="#FCD34D" />
            <Text style={styles.heroPillText}>20 – 100 pts</Text>
          </View>
        </View>

        {/* Gift on right */}
        <View style={styles.heroGiftWrap}>
          <View style={styles.heroGiftShadow} pointerEvents="none" />
          <FloatingIllustration source={IMG.gift} size={92} offset={2} />
        </View>
      </LinearGradient>
    </PressCard>
  );
}

// ============================================================================
// REFERRAL BANNER — premium violet
// ============================================================================
function ReferralBanner({ perFriendInr, onPress }: { perFriendInr: number; onPress: () => void }) {
  return (
    <PressCard
      onPress={onPress}
      testID="earn-refer"
      style={[styles.referWrap, { shadowColor: "#8B5CF6" }]}
    >
      <LinearGradient
        colors={["#A855F7", "#7C3AED", "#5B21B6"] as const}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.refer}
      >
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(255,255,255,0.30)", "rgba(255,255,255,0.0)"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.7 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Stardust count={12} />

        {/* People hugging illustration on left */}
        <View style={styles.referLeft}>
          <View style={styles.referShadow} pointerEvents="none" />
          <FloatingIllustration source={IMG.hugging} size={86} />
        </View>

        <View style={styles.referCenter}>
          <Text style={styles.referLine}>Invite Friends & Earn</Text>
          <View style={styles.referAmountRow}>
            <Text style={styles.referAmount}>₹{perFriendInr || 31}</Text>
            <Text style={styles.referPer}> / friend</Text>
          </View>
          <View style={styles.referCta}>
            <Text style={styles.referCtaText}>Invite Now</Text>
            <ChevronRight size={14} color="#7C3AED" />
          </View>
        </View>

        {/* Floating coin top-right */}
        <View style={styles.referFloatCoin}>
          <FloatingIllustration source={IMG.moneyBag} size={52} offset={-2} />
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
  void refer; // hero title currently not used — kept for future
  const [config, setConfig] = useState<AppConfig>({});
  const [perFriendInr, setPerFriendInr] = useState<number>(31);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAll = React.useCallback(() => {
    api<ReferralInfo>("/referrals/me").then(setRefer).catch(() => {});
    api<AppConfig>("/app-config", { auth: false }).then(setConfig).catch(() => {});
    api<{ streak_7_reward_points?: number }>("/referral-settings", { auth: false })
      .then((s) => {
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
        contentContainerStyle={{ padding: 18, paddingBottom: 100 }}
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

        {/* Daily Check-in HERO */}
        <CheckinHero streak={user?.streak ?? 0} onPress={() => open("/checkin")} />

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

        {/* 2-col grid */}
        <View style={styles.grid} key={refreshKey}>
          {cardsWithRewards.map((it) => (
            <EarnCard
              key={it.cfg.key}
              cfg={it.cfg}
              reward={it.reward}
              onPress={() => open(it.cfg.route)}
              testID={`earn-${it.cfg.key}`}
            />
          ))}
        </View>

        {/* Referral banner */}
        <ReferralBanner
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
  ios: { shadowOpacity: 0.38, shadowOffset: { width: 0, height: 12 }, shadowRadius: 20 },
  android: { elevation: 10 },
  default: {},
});

const heroShadow = Platform.select({
  ios: { shadowOpacity: 0.45, shadowOffset: { width: 0, height: 14 }, shadowRadius: 24 },
  android: { elevation: 12 },
  default: {},
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F9FC" },

  // Header
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  title: { fontSize: 36, fontWeight: "900", color: "#111827", letterSpacing: -1.2 },
  sub: { color: "#111827", marginTop: 2, fontSize: 14, fontWeight: "500" },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#E5E7EB",
    ...Platform.select({ ios: { shadowOpacity: 0.06, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowColor: "#000" }, android: { elevation: 1 } }),
  },
  balancePillText: { color: "#111827", fontWeight: "800", fontSize: 13 },

  // Daily check-in hero
  heroWrap: { borderRadius: 24, marginBottom: 18, ...heroShadow },
  hero: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 24, overflow: "hidden",
    minHeight: 124,
  },
  shimmer: {
    position: "absolute", top: 0, bottom: 0,
    width: 80,
    backgroundColor: "rgba(255,255,255,0.16)",
    transform: [{ skewX: "-20deg" }],
  },
  heroCalendarWrap: { width: 78, height: 90, alignItems: "center", justifyContent: "center" },
  heroCalendar: { width: 78, height: 78 },
  heroText: { flex: 1, paddingLeft: 4 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 },
  heroStreak: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "700" },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.22)",
    alignSelf: "flex-start",
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, marginTop: 8,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  heroPillText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  heroGiftWrap: {
    width: 94, height: 94, marginLeft: 8,
    alignItems: "center", justifyContent: "center",
  },
  heroGiftShadow: {
    position: "absolute", bottom: 4,
    width: 70, height: 10, borderRadius: 35,
    backgroundColor: "rgba(0,0,0,0.28)",
    opacity: 0.6,
  },

  // Section header
  sectionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginTop: 4, marginBottom: 14,
  },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: "#111827", letterSpacing: -0.6 },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1, borderColor: "#E5E7EB",
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
    padding: 14,
    overflow: "hidden",
    minHeight: 144,
  },
  cardBody: { flexDirection: "row", flex: 1, alignItems: "stretch" },
  cardText: { flex: 1, justifyContent: "space-between", paddingRight: 4 },
  cardTitle: {
    color: "#fff", fontSize: 16, fontWeight: "900",
    letterSpacing: -0.2, lineHeight: 19,
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  badge: {
    backgroundColor: "rgba(0,0,0,0.28)",
    alignSelf: "flex-start",
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    marginTop: 6,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "900", letterSpacing: 0.3 },
  illustrationSlot: {
    width: 86, height: 86,
    alignItems: "center", justifyContent: "center",
    alignSelf: "center",
  },
  illustrationShadow: {
    position: "absolute", bottom: 0,
    width: 64, height: 8, borderRadius: 32,
    backgroundColor: "rgba(0,0,0,0.32)",
    opacity: 0.55,
  },

  // Referral banner
  referWrap: { borderRadius: 24, marginTop: 8, ...heroShadow },
  refer: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 16, paddingHorizontal: 16,
    borderRadius: 24, overflow: "hidden",
    minHeight: 124,
  },
  referLeft: { width: 92, height: 92, alignItems: "center", justifyContent: "center" },
  referShadow: {
    position: "absolute", bottom: 4,
    width: 70, height: 10, borderRadius: 35,
    backgroundColor: "rgba(0,0,0,0.28)",
    opacity: 0.6,
  },
  referCenter: { flex: 1, paddingLeft: 8 },
  referLine: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  referAmountRow: { flexDirection: "row", alignItems: "baseline", marginTop: 4 },
  referAmount: {
    color: "#FCD34D", fontSize: 28, fontWeight: "900", letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.22)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  referPer: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "700" },
  referCta: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999, marginTop: 10,
  },
  referCtaText: { color: "#7C3AED", fontWeight: "900", fontSize: 13 },
  referFloatCoin: {
    position: "absolute", top: 8, right: 8,
    width: 52, height: 52,
  },
});
