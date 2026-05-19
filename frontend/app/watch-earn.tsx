import React, { useEffect, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, PlayCircle, Check, Clock } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import RewardedAdModal from "../src/components/RewardedAdModal";
import NativeAd from "../src/components/NativeAd";

const CYCLE_LIMIT = 5;
const CYCLE_HOURS = 6;

const VIDEOS = [
  { id: 1, title: "Brand Spotlight", channel: "TaskMint Partners", duration: "0:30" },
  { id: 2, title: "App Showcase",     channel: "TaskMint Partners", duration: "0:30" },
  { id: 3, title: "Festive Offers",   channel: "TaskMint Partners", duration: "0:30" },
  { id: 4, title: "Daily Deals",      channel: "TaskMint Partners", duration: "0:30" },
  { id: 5, title: "Summer Picks",     channel: "TaskMint Partners", duration: "0:30" },
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

export default function WatchEarn() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [adVisible, setAdVisible] = useState(false);
  const [watched, setWatched] = useState<number[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

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

  // Tick the timer every second while a cooldown is showing.
  useEffect(() => {
    if (!cooldown) return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [cooldown]);

  // When the cooldown elapses, refresh the user so the screen unlocks itself.
  useEffect(() => {
    if (cooldown || !cycleEndMs) return;
    if (now >= cycleEndMs) refreshUser().catch(() => {});
  }, [cooldown, cycleEndMs, now, refreshUser]);

  const start = (id: number) => {
    setActive(id);
    setAdVisible(true);
  };

  const onReward = async () => {
    setAdVisible(false);
    if (active === null) return;
    try {
      const r = await api<{ reward: number }>("/tasks/watch", { method: "POST" });
      setWatched((w) => [...w, active]);
      setActive(null);
      await refreshUser();
      Alert.alert("Reward earned", `+${r.reward} points credited!`);
    } catch (e: any) {
      setActive(null);
      const msg = typeof e?.message === "string" ? e.message : "Try again";
      Alert.alert("Couldn't credit reward", msg);
    }
  };

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

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Watch & Earn</Text>
        <Text style={styles.counter}>{left}/{CYCLE_LIMIT} left</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12, paddingBottom: 100 }}>
        <Text style={styles.intro}>
          Watch short partner videos to earn 50-100 points each. {CYCLE_LIMIT} watches every {CYCLE_HOURS} hours.
        </Text>

        <NativeAd testID="watch-native-ad" />

        {VIDEOS.map((v) => {
          const done = watched.includes(v.id);
          return (
            <TouchableOpacity
              key={v.id}
              style={[styles.row, done && styles.rowDone]}
              onPress={() => start(v.id)}
              disabled={done}
              testID={`video-${v.id}`}
              activeOpacity={0.85}
            >
              <View style={[styles.thumb, done && { backgroundColor: "rgba(16,185,129,0.12)" }]}>
                {done ? <Check size={28} color={theme.colors.success} /> : <PlayCircle size={32} color={theme.colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.vTitle}>{v.title}</Text>
                <Text style={styles.vSub}>{v.channel} • {v.duration}</Text>
              </View>
              <Text style={styles.reward}>+50-100</Text>
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
  counter: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  rowDone: { opacity: 0.55 },
  thumb: {
    width: 60, height: 60, borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  vTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  vSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  reward: { color: theme.colors.success, fontSize: 14, fontWeight: "800" },
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
