import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronLeft, PlayCircle, Check, Clock, Coins, Lock } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import RewardedAdModal from "../src/components/RewardedAdModal";
import NativeAd from "../src/components/NativeAd";

const CYCLE_LIMIT = 5;
const CYCLE_HOURS = 6;
const NEXT_VIDEO_COOLDOWN_SECONDS = 60; // 60-second timer between watches

const VIDEOS = [
  { id: 1, title: "Brand Spotlight",     channel: "TaskMint Partners", duration: "0:30", gradient: ["#EF4444", "#991B1B"] as const },
  { id: 2, title: "App Showcase",         channel: "TaskMint Partners", duration: "0:30", gradient: ["#F59E0B", "#B45309"] as const },
  { id: 3, title: "Festive Offers",       channel: "TaskMint Partners", duration: "0:30", gradient: ["#3B82F6", "#1D4ED8"] as const },
  { id: 4, title: "Daily Deals",          channel: "TaskMint Partners", duration: "0:30", gradient: ["#10B981", "#047857"] as const },
  { id: 5, title: "Summer Picks",         channel: "TaskMint Partners", duration: "0:30", gradient: ["#A855F7", "#7E22CE"] as const },
];

function fmtHMS(ms: number) {
  if (ms <= 0) return "00:00:00";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function fmtMMSS(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export default function WatchEarn() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [adVisible, setAdVisible] = useState(false);
  const [watched, setWatched] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [crediting, setCrediting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [nextAvailableAt, setNextAvailableAt] = useState<number>(0); // epoch ms

  const cycleStartMs = useMemo(() => {
    const iso = user?.watch_cycle_started_at;
    if (!iso) return 0;
    const t = Date.parse(iso);
    return Number.isFinite(t) ? t : 0;
  }, [user?.watch_cycle_started_at]);

  const cycleEndMs = cycleStartMs ? cycleStartMs + CYCLE_HOURS * 3600 * 1000 : 0;
  const cycleExpired = cycleEndMs ? now >= cycleEndMs : true;
  const used = cycleExpired ? 0 : (user?.watch_cycle_used ?? 0);
  const left = Math.max(0, CYCLE_LIMIT - used);
  const cooldown = left <= 0 && cycleEndMs > now;
  const nextTimerActive = nextAvailableAt > now;
  const nextSecondsLeft = Math.max(0, Math.ceil((nextAvailableAt - now) / 1000));

  // Tick every second whenever any timer is showing.
  useEffect(() => {
    if (!cooldown && !nextTimerActive) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [cooldown, nextTimerActive]);

  useEffect(() => {
    if (cooldown || !cycleEndMs) return;
    if (now >= cycleEndMs) refreshUser().catch(() => {});
  }, [cooldown, cycleEndMs, now, refreshUser]);

  const start = (id: number) => {
    if (nextTimerActive || crediting) return; // block while inter-watch timer is running
    setActive(id);
    setAdVisible(true);
  };

  const onReward = async () => {
    setAdVisible(false);
    if (active === null) return;
    setCrediting(true);
    try {
      const r = await api<{ reward: number }>("/tasks/watch", { method: "POST" });
      setWatched((w) => [...w, active!]);
      setActive(null);
      await refreshUser();
      // Start the 60s cooldown so user can't spam the next watch immediately.
      setNextAvailableAt(Date.now() + NEXT_VIDEO_COOLDOWN_SECONDS * 1000);
      Alert.alert("Reward earned", `+${r.reward} points credited!`);
    } catch (e: any) {
      setActive(null);
      const msg = typeof e?.message === "string" ? e.message : "Try again";
      Alert.alert("Couldn't credit reward", msg);
    } finally {
      setCrediting(false);
    }
  };

  // ====== 6-hour cycle cooldown view ======
  if (cooldown) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Watch & Earn</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
          <View style={styles.doneCard} testID="watch-limit-reached">
            <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
            <Text style={styles.doneTitle}>All Done!</Text>
            <Text style={styles.doneBody}>
              You've used all {CYCLE_LIMIT} watches for this cycle.
            </Text>
            <View style={styles.timerPill}>
              <Clock size={16} color={theme.colors.primary} />
              <Text style={styles.timerLabel}>Resets in</Text>
              <Text style={styles.timerVal} testID="watch-cooldown-timer">
                {fmtHMS(cycleEndMs - now)}
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ====== Main feed ======
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Watch & Earn</Text>
        <View style={styles.counterPill}>
          <Text style={styles.counterTxt}>{left}/{CYCLE_LIMIT}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 14, paddingBottom: 100 }}>
        {/* Hero banner */}
        <LinearGradient
          colors={["#EF4444", "#991B1B"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.heroIcon}><PlayCircle size={28} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Watch & Earn</Text>
            <Text style={styles.heroSub}>50-100 pts per video • {CYCLE_LIMIT} watches every {CYCLE_HOURS}h</Text>
          </View>
          <View style={styles.heroBadge}>
            <Coins size={14} color="#fff" />
            <Text style={styles.heroBadgeTxt}>{left} left</Text>
          </View>
        </LinearGradient>

        {/* 60s next-video timer banner */}
        {nextTimerActive && (
          <View style={styles.timerBanner} testID="watch-next-timer">
            <View style={styles.timerBannerIcon}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.timerBannerTitle}>Next video unlocks soon</Text>
              <Text style={styles.timerBannerSub}>Take a quick break — fair-use cooldown is in effect.</Text>
            </View>
            <Text style={styles.timerCountdown}>{fmtMMSS(nextSecondsLeft)}</Text>
          </View>
        )}

        <NativeAd testID="watch-native-ad" />

        {VIDEOS.map((v) => {
          const done = watched.includes(v.id);
          const isActive = active === v.id;
          const locked = !done && (nextTimerActive || crediting) && !isActive;
          return (
            <TouchableOpacity
              key={v.id}
              style={[
                styles.videoCard,
                done && { opacity: 0.55 },
                locked && { opacity: 0.55 },
              ]}
              onPress={() => start(v.id)}
              disabled={done || locked}
              testID={`video-${v.id}`}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={v.gradient}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.videoThumb}
              >
                {done ? (
                  <Check size={42} color="#fff" />
                ) : locked ? (
                  <Lock size={36} color="rgba(255,255,255,0.85)" />
                ) : (
                  <PlayCircle size={48} color="#fff" />
                )}
                <View style={styles.durationPill}>
                  <Text style={styles.durationTxt}>{v.duration}</Text>
                </View>
              </LinearGradient>
              <View style={styles.videoInfo}>
                <Text style={styles.videoTitle} numberOfLines={1}>{v.title}</Text>
                <Text style={styles.videoChannel} numberOfLines={1}>{v.channel}</Text>
                <View style={styles.videoMetaRow}>
                  <View style={styles.rewardPill}>
                    <Coins size={11} color={theme.colors.success} />
                    <Text style={styles.rewardPillTxt}>+50-100 pts</Text>
                  </View>
                  {done && (
                    <View style={styles.donePill}>
                      <Check size={10} color={theme.colors.success} />
                      <Text style={styles.donePillTxt}>Done</Text>
                    </View>
                  )}
                  {locked && (
                    <View style={styles.lockedPill}>
                      <Lock size={10} color={theme.colors.muted} />
                      <Text style={styles.lockedPillTxt}>Wait {fmtMMSS(nextSecondsLeft)}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <RewardedAdModal visible={adVisible} onReward={onReward} duration={3} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  counterPill: {
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999,
  },
  counterTxt: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },

  heroBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: theme.radii.xl, overflow: "hidden",
  },
  heroIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroSub: { color: "rgba(255,255,255,0.88)", fontSize: 12, marginTop: 2, fontWeight: "500" },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
  },
  heroBadgeTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },

  timerBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1, borderColor: theme.colors.primary,
    padding: 12, borderRadius: theme.radii.lg,
  },
  timerBannerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  timerBannerTitle: { color: theme.colors.primary, fontWeight: "800", fontSize: 14 },
  timerBannerSub: { color: theme.colors.muted, fontSize: 11, marginTop: 2, fontWeight: "500" },
  timerCountdown: {
    color: theme.colors.primary, fontWeight: "900", fontSize: 18,
    fontVariant: ["tabular-nums"],
  },

  videoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl, overflow: "hidden",
    borderWidth: 1, borderColor: theme.colors.border,
  },
  videoThumb: {
    height: 160, alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  durationPill: {
    position: "absolute", right: 10, bottom: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  durationTxt: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
  videoInfo: { padding: 12, gap: 4 },
  videoTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  videoChannel: { fontSize: 12, color: theme.colors.muted, fontWeight: "500" },
  videoMetaRow: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  rewardPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(16,185,129,0.10)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  rewardPillTxt: { color: theme.colors.success, fontSize: 11, fontWeight: "800" },
  donePill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(16,185,129,0.14)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  donePillTxt: { color: theme.colors.success, fontSize: 11, fontWeight: "800" },
  lockedPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.bg,
    borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  lockedPillTxt: {
    color: theme.colors.muted, fontSize: 11, fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },

  doneCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl, padding: theme.spacing.lg,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.colors.border,
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center",
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.success },
  doneBody: { color: theme.colors.muted, textAlign: "center" },
  timerPill: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
    marginTop: 6,
  },
  timerLabel: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  timerVal: {
    color: theme.colors.primary, fontWeight: "800", fontSize: 18,
    fontVariant: ["tabular-nums"],
  },
});
