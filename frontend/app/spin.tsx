import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing, useWindowDimensions,
} from "react-native";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { G, Path, Text as SvgText, Polygon } from "react-native-svg";
import { ChevronLeft, RefreshCw, Gift, Check } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import RewardedAdModal from "../src/components/RewardedAdModal";
import InterstitialAdModal from "../src/components/InterstitialAdModal";
import NativeAd from "../src/components/NativeAd";
import MaintenanceCard from "../src/components/MaintenanceCard";
import { useMaintenance } from "../src/hooks/useMaintenance";

const SEGMENTS = [30, 45, 60, 70, 80, 85, 95, 100];
const COLORS = ["#4F46E5", "#7C6FF1", "#FFC107", "#FF8A65", "#10B981", "#06B6D4", "#FF6B6B", "#A855F7"];

export default function SpinScreen() {
  const maint = useMaintenance("/spin");
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { width: winW } = useWindowDimensions();
  // Wheel scales with viewport so it looks right on both small phones and tablets.
  const wheelSize = Math.min(360, Math.max(220, winW - 64));
  const hubSize = Math.round(wheelSize * 0.2);
  const [busy, setBusy] = useState(false);
  const rotate = useRef(new Animated.Value(0)).current;
  const [reward, setReward] = useState<number | null>(null);
  const [phase, setPhase] = useState<"ready" | "spinning" | "claim" | "ad">("ready");
  const [adVisible, setAdVisible] = useState(false);

  const used = user?.daily_spins_used ?? 0;
  const left = Math.max(0, 5 - used);

  // If the user has a pending (unclaimed) spin reward on the server — e.g. they
  // closed the app mid-ad or went back without claiming — restore the claim
  // state so the Claim button persists until they actually watch the ad.
  useEffect(() => {
    const pending = user?.pending_spin_reward ?? 0;
    if (pending > 0 && phase === "ready") {
      setReward(pending);
      setPhase("claim");
      // Land the wheel on the matching segment so the UI looks consistent.
      const segIdx = Math.max(0, Math.round(((pending - 30) / 70) * 7));
      const target = 360 - (segIdx * 45) - 22.5;
      rotate.setValue(target);
    }
  }, [user?.pending_spin_reward, phase, rotate]);

  const onSpin = async () => {
    if (busy || left <= 0 || phase !== "ready") return;
    setBusy(true);
    setPhase("spinning");
    setReward(null);
    try {
      const res = await api<{ reward: number }>("/tasks/spin", { method: "POST" });
      // pick nearest segment for visual effect (30-100 mapped over 8 segments)
      const segIdx = Math.max(0, Math.round(((res.reward - 30) / 70) * 7));
      const target = 360 * 5 + (360 - (segIdx * 45) - 22.5);
      Animated.timing(rotate, {
        toValue: target,
        duration: 3500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setReward(res.reward);
        setPhase("claim");
        setBusy(false);
      });
    } catch (e: any) {
      setBusy(false);
      setPhase("ready");
      toast.error("Spin failed", { description: e?.message || "Try again" });
    }
  };

  const onClaim = () => {
    setAdVisible(true);
  };

  const onAdReward = async () => {
    setAdVisible(false);
    try {
      await api("/tasks/spin/claim", { method: "POST" });
      await refreshUser();
    } catch {}
    rotate.setValue(0);
    setReward(null);
    setPhase("ready");
  };

  const spin = rotate.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  // When the daily limit is reached and there's no pending claim, show the
  // "All Done!" card instead of the spinning wheel.
  if (left <= 0 && phase !== "claim") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Spin & Win</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.doneWrap}>
          <View style={styles.doneCard} testID="spin-limit-reached">
            <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
            <Text style={styles.doneTitle}>All Done!</Text>
            <Text style={styles.doneBody}>Daily limit reached. Come back tomorrow.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (maint.enabled) return <MaintenanceCard title="Spin & Win" note={maint.note} />;
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Spin & Win</Text>
        <Text style={styles.counter}>{left}/5 left</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.wheelWrap}>
          <View style={styles.pointer}>
            <Svg width={28} height={32}>
              <Polygon points="14,32 0,0 28,0" fill={theme.colors.danger} />
            </Svg>
          </View>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Svg width={wheelSize} height={wheelSize} viewBox="-150 -150 300 300">
              <G>
                {SEGMENTS.map((val, i) => {
                  const startA = (i * 360) / SEGMENTS.length;
                  const endA = ((i + 1) * 360) / SEGMENTS.length;
                  const r = 145;
                  const x1 = r * Math.cos((startA - 90) * Math.PI / 180);
                  const y1 = r * Math.sin((startA - 90) * Math.PI / 180);
                  const x2 = r * Math.cos((endA - 90) * Math.PI / 180);
                  const y2 = r * Math.sin((endA - 90) * Math.PI / 180);
                  const d = `M0,0 L${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2} Z`;
                  const midA = (startA + endA) / 2;
                  const tx = (r * 0.65) * Math.cos((midA - 90) * Math.PI / 180);
                  const ty = (r * 0.65) * Math.sin((midA - 90) * Math.PI / 180);
                  return (
                    <G key={i}>
                      <Path d={d} fill={COLORS[i]} stroke="#fff" strokeWidth={2} />
                      <SvgText x={tx} y={ty} fill="#fff" fontSize="20" fontWeight="800" textAnchor="middle">
                        {val}
                      </SvgText>
                    </G>
                  );
                })}
              </G>
            </Svg>
          </Animated.View>
          <View style={[styles.hub, { width: hubSize, height: hubSize, borderRadius: hubSize / 2 }]}><RefreshCw color={theme.colors.primary} size={Math.round(hubSize * 0.45)} /></View>
        </View>

        {phase === "claim" && reward !== null && (
          <View style={styles.rewardChip} testID="spin-reward">
            <Gift size={18} color={theme.colors.success} />
            <Text style={styles.rewardText}>You won +{reward} points!</Text>
          </View>
        )}

        {phase === "claim" ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.colors.success }]}
            onPress={onClaim}
            testID="spin-claim-btn"
          >
            <Gift size={20} color="#fff" />
            <Text style={styles.btnText}>Claim Reward</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, (busy || left <= 0) && styles.btnDisabled]}
            onPress={onSpin}
            disabled={busy || left <= 0}
            testID="spin-btn"
          >
            <Text style={styles.btnText}>
              {left <= 0 ? "Come back tomorrow" : busy ? "Spinning..." : "SPIN NOW"}
            </Text>
          </TouchableOpacity>
        )}

      <Text style={styles.hint}>5 spins/day • 30-100 pts each • Watch a short ad to claim</Text>
      <NativeAd testID="spin-native-ad" />
      </View>

      <InterstitialAdModal
        visible={adVisible}
        onDone={onAdReward}
        duration={3}
      />
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
  body: { flex: 1, padding: theme.spacing.lg, alignItems: "center", gap: 24 },
  doneWrap: { flex: 1, padding: theme.spacing.lg, gap: 16 },
  wheelWrap: { alignItems: "center", justifyContent: "center", marginTop: 24 },
  pointer: { position: "absolute", top: -16, zIndex: 5 },
  hub: {
    position: "absolute",
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    ...theme.shadow.card,
  },
  rewardChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(16,185,129,0.10)",
    borderWidth: 1, borderColor: "rgba(16,185,129,0.3)",
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999,
  },
  rewardText: { color: theme.colors.success, fontWeight: "800", fontSize: 14 },
  btn: {
    width: "100%", height: 60, borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 10,
  },
  btnDisabled: { backgroundColor: theme.colors.muted },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 1 },
  hint: { color: theme.colors.muted, fontSize: 12, textAlign: "center" },
  doneCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl, padding: theme.spacing.lg,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.colors.border,
    width: "100%", marginTop: 24,
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center",
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.success },
  doneBody: { color: theme.colors.muted, textAlign: "center" },
});
