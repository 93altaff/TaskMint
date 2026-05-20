import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform, AppState, AppStateStatus } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Globe, Check, Gift, Clock } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import InterstitialAdModal from "../src/components/InterstitialAdModal";
import NativeAd from "../src/components/NativeAd";

type Site = { id: string; title: string; url: string; active: boolean };
type Phase = "idle" | "waiting_return" | "countdown" | "claim_ready";

const COUNTDOWN_SECONDS = 3;

export default function VisitEarn() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [doneIds, setDoneIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adVisible, setAdVisible] = useState(false);
  const [active, setActive] = useState<Site | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, done] = await Promise.all([
        api<Site[]>("/visit-sites"),
        api<{ site_ids: string[] }>("/tasks/visit/completed-today"),
      ]);
      setSites(list);
      setDoneIds(done.site_ids || []);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load sites");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Detect when the user returns to the app after visiting a site.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      // App came back to foreground while waiting for the visit to complete.
      if (prev.match(/inactive|background/) && next === "active" && phase === "waiting_return") {
        setPhase("countdown");
        setCountdown(COUNTDOWN_SECONDS);
      }
    });
    return () => sub.remove();
  }, [phase]);

  // 3-second countdown after returning.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("claim_ready");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Web fallback (no AppState background event on web): start countdown
  // shortly after opening the URL in a new tab.
  const start = async (s: Site) => {
    if (phase !== "idle") return; // disable while another visit is in progress
    if (doneIds.includes(s.id)) {
      Alert.alert("Already completed", "You've already earned from this site today. Try another.");
      return;
    }
    setActive(s);
    setPhase("waiting_return");
    try {
      const supported = await Linking.canOpenURL(s.url);
      if (supported) {
        await Linking.openURL(s.url);
      } else if (Platform.OS === "web") {
        window.open(s.url, "_blank");
      } else {
        Alert.alert("Invalid URL", `Cannot open ${s.url}`);
        setActive(null);
        setPhase("idle");
        return;
      }
    } catch {
      Alert.alert("Error", `Could not open ${s.url}`);
      setActive(null);
      setPhase("idle");
      return;
    }
    // On web (or if AppState doesn't fire) start the countdown after a short delay.
    if (Platform.OS === "web") {
      setTimeout(() => {
        setPhase("countdown");
        setCountdown(COUNTDOWN_SECONDS);
      }, 800);
    }
  };

  const onClaim = () => {
    if (phase !== "claim_ready") return;
    setAdVisible(true);
  };

  const onReward = async () => {
    setAdVisible(false);
    if (!active) {
      setPhase("idle");
      return;
    }
    try {
      const r = await api<{ reward: number }>("/tasks/visit", {
        method: "POST",
        body: { site_id: active.id },
      });
      setDoneIds((d) => [...d, active.id]);
      await refreshUser();
      Alert.alert("Reward earned", `+${r.reward} points!`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Try again");
    } finally {
      setActive(null);
      setPhase("idle");
      setCountdown(COUNTDOWN_SECONDS);
    }
  };
  const allCompleted = !loading && sites.length > 0 && doneIds.length >= sites.length;
  const otherTasksDisabled = phase !== "idle";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Visit & Earn</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12, paddingBottom: 100 }}>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : sites.length === 0 ? (
          <Text style={styles.empty}>No sites available right now. Check back soon.</Text>
        ) : allCompleted ? (
          <>
            <View style={styles.doneCard} testID="visit-all-done">
              <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
              <Text style={styles.doneTitle}>All Done!</Text>
              <Text style={styles.doneBody}>Daily limit reached. Come back tomorrow.</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.intro}>Visit partner sites to earn 30-100 points each. One reward per site per day.</Text>

            {/* Active visit pending — countdown or claim banner */}
            {active && phase !== "idle" && (
              <View style={styles.pendingCard} testID="visit-pending">
                <View style={styles.pendingIcon}>
                  {phase === "claim_ready"
                    ? <Gift size={28} color={theme.colors.success} />
                    : <Clock size={28} color={theme.colors.primary} />}
                </View>
                <Text style={styles.pendingTitle} numberOfLines={1}>{active.title}</Text>
                {phase === "waiting_return" && (
                  <Text style={styles.pendingSub}>Return to the app after visiting…</Text>
                )}
                {phase === "countdown" && (
                  <Text style={styles.pendingSub}>
                    Verifying… <Text style={styles.countdownNum} testID="visit-countdown">{countdown}s</Text>
                  </Text>
                )}
                {phase === "claim_ready" && (
                  <TouchableOpacity
                    style={styles.claimBtn}
                    onPress={onClaim}
                    testID="visit-claim-btn"
                    activeOpacity={0.85}
                  >
                    <Gift size={18} color="#fff" />
                    <Text style={styles.claimBtnTxt}>Claim Reward</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <NativeAd testID="visit-native-ad" />
            {sites.map((s) => {
              const d = doneIds.includes(s.id);
              const isActiveItem = active?.id === s.id;
              const disabled = d || (otherTasksDisabled && !isActiveItem) || isActiveItem;
              return (
                <TouchableOpacity
                  key={s.id} onPress={() => start(s)} disabled={disabled}
                  activeOpacity={0.85}
                  style={[styles.row, (d || disabled) && { opacity: 0.55 }]}
                  testID={`visit-${s.id}`}
                >
                  <View style={[styles.icon, d && { backgroundColor: "rgba(16,185,129,0.12)" }]}>
                    {d ? <Check size={24} color={theme.colors.success} /> : <Globe size={28} color={theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rtitle} numberOfLines={1}>{s.title}</Text>
                    <Text style={styles.rsub} numberOfLines={1}>{s.url}</Text>
                  </View>
                  <Text style={styles.rwd}>+30-100</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      <InterstitialAdModal visible={adVisible} onDone={onReward} duration={3} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  icon: {
    width: 56, height: 56, borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  rtitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  rsub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  rwd: { color: theme.colors.success, fontSize: 14, fontWeight: "800" },
  empty: { textAlign: "center", color: theme.colors.muted, marginTop: 12, fontWeight: "600" },
  pendingCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  pendingIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  pendingTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  pendingSub: { color: theme.colors.muted, fontSize: 13, textAlign: "center" },
  countdownNum: { color: theme.colors.primary, fontWeight: "900", fontSize: 16 },
  claimBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: 999, marginTop: 6,
  },
  claimBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  doneCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl, padding: theme.spacing.lg,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.colors.border,
    marginTop: 24,
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center",
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.success },
  doneBody: { color: theme.colors.muted, textAlign: "center" },
});
