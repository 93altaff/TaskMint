import React, { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Alert, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Sparkles, Gift, Check } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import InterstitialAdModal from "../src/components/InterstitialAdModal";
import NativeAd from "../src/components/NativeAd";

export default function ScratchScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const { width: winW } = useWindowDimensions();
  // Scratch card scales with viewport (caps at 360px on tablets, min 220px on small phones).
  const cardSize = Math.min(360, Math.max(220, winW - 64));
  const [reward, setReward] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const [phase, setPhase] = useState<"ready" | "claim">("ready");
  const [adVisible, setAdVisible] = useState(false);

  const used = user?.daily_scratches_used ?? 0;
  const left = Math.max(0, 5 - used);

  // Restore unclaimed scratch reward on mount (user went back / closed app
  // mid-ad). Keeps the Claim button visible until they actually watch the ad.
  useEffect(() => {
    const pending = user?.pending_scratch_reward ?? 0;
    if (pending > 0 && phase === "ready") {
      setReward(pending);
      overlayOpacity.setValue(0);
      setPhase("claim");
    }
  }, [user?.pending_scratch_reward, phase, overlayOpacity]);

  const onScratch = async () => {
    if (busy || left <= 0 || phase !== "ready") return;
    setBusy(true);
    try {
      const res = await api<{ reward: number }>("/tasks/scratch", { method: "POST" });
      setReward(res.reward);
      Animated.timing(overlayOpacity, {
        toValue: 0, duration: 800, useNativeDriver: true,
      }).start(() => {
        setPhase("claim");
        setBusy(false);
      });
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Scratch failed", e?.message || "Try again");
    }
  };

  const onClaim = () => setAdVisible(true);

  const onAdReward = async () => {
    setAdVisible(false);
    try {
      await api("/tasks/scratch/claim", { method: "POST" });
      await refreshUser();
    } catch {}
    setReward(null);
    overlayOpacity.setValue(1);
    setPhase("ready");
  };

  // When the daily limit is reached and there's no pending claim, show the
  // "All Done!" card instead of the scratch tile.
  if (left <= 0 && phase !== "claim") {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Scratch & Win</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.doneWrap}>
          <NativeAd testID="scratch-native-ad-done" />
          <View style={styles.doneCard} testID="scratch-limit-reached">
            <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
            <Text style={styles.doneTitle}>All Done!</Text>
            <Text style={styles.doneBody}>Daily limit reached. Come back tomorrow.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Scratch & Win</Text>
        <Text style={styles.counter}>{left}/5 left</Text>
      </View>

      <View style={styles.body}>
        <View style={[styles.cardWrap, { width: cardSize, height: cardSize }]}>
          <View style={styles.cardBg}>
            <Sparkles size={56} color={theme.colors.secondary} />
            <Text style={styles.cardWin}>You won</Text>
            <Text style={styles.cardPoints}>+{reward ?? "?"} pts</Text>
          </View>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} pointerEvents="none">
            <Text style={styles.overlayText}>SCRATCH HERE</Text>
            <Sparkles size={42} color="#fff" />
          </Animated.View>
        </View>

        {phase === "claim" ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: theme.colors.success }]}
            onPress={onClaim}
            testID="scratch-claim-btn"
          >
            <Gift size={20} color="#fff" />
            <Text style={styles.btnText}>Claim Reward</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btn, (busy || left <= 0) && styles.btnDisabled]}
            onPress={onScratch}
            disabled={busy || left <= 0}
            testID="scratch-btn"
          >
            <Text style={styles.btnText}>
              {left <= 0 ? "Come back tomorrow" : busy ? "Revealing..." : "Tap to Scratch"}
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>5 cards/day • 30-100 pts each • Watch ad to claim</Text>
        <NativeAd testID="scratch-native-ad" />
      </View>

      <InterstitialAdModal visible={adVisible} onDone={onAdReward} duration={3} />
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
  cardWrap: {
    borderRadius: theme.radii.xl, overflow: "hidden", marginTop: 24,
    ...theme.shadow.soft,
  },
  cardBg: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#fff", gap: 6,
  },
  cardWin: { fontSize: 16, color: theme.colors.muted, fontWeight: "700" },
  cardPoints: { fontSize: 42, color: theme.colors.success, fontWeight: "800" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.primary,
    alignItems: "center", justifyContent: "center", gap: 12,
  },
  overlayText: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  btn: {
    width: "100%", height: 60, borderRadius: theme.radii.lg,
    backgroundColor: theme.colors.primary, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 10,
  },
  btnDisabled: { backgroundColor: theme.colors.muted },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
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
