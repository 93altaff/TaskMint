import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { Play, Gift } from "lucide-react-native";
import { theme } from "../lib/theme";
import { getAdUnitId } from "../lib/adConfig";

let RewardedAd: any = null;
let RewardedAdEventType: any = null;
let AdEventType: any = null;
let TestIds: any = null;
try {
  if (Platform.OS !== "web") {
    const mod = require("react-native-google-mobile-ads");
    RewardedAd = mod.RewardedAd;
    RewardedAdEventType = mod.RewardedAdEventType;
    AdEventType = mod.AdEventType;
    TestIds = mod.TestIds;
  }
} catch {}

type Props = {
  visible: boolean;
  onReward: () => void;
  onClose?: () => void;
  duration?: number;
  testID?: string;
};

/**
 * Real AdMob Rewarded ad. When `visible` becomes true we load + show the
 * ad. `onReward` is called only if the user actually completes the ad.
 * `onClose` is called if the user dismisses without earning the reward.
 * Web / Expo Go fallback: our old countdown modal so callers keep working.
 */
export default function RewardedAdModal({
  visible, onReward, onClose, duration = 5, testID = "rewarded-ad",
}: Props) {
  const earnedRef = useRef(false);
  const handledRef = useRef(false);
  const [loaded, setLoaded] = useState(false);

  // --- Native path ---------------------------------------------------------
  useEffect(() => {
    if (!visible) { earnedRef.current = false; handledRef.current = false; setLoaded(false); return; }
    if (!RewardedAd) return; // web fallback

    const unitId = __DEV__ ? TestIds.REWARDED : getAdUnitId("rewarded");

    const ad = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const finish = (earned: boolean) => {
      if (handledRef.current) return;
      handledRef.current = true;
      if (earned) onReward();
      else if (onClose) onClose();
    };

    const unsubLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setLoaded(true);
      try { ad.show(); } catch (e) { console.log("[Rewarded] show failed:", e); finish(false); }
    });
    const unsubEarned = ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      earnedRef.current = true;
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => finish(earnedRef.current));
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
      console.log("[Rewarded] error:", e?.message || e);
      finish(false);
    });

    ad.load();
    const safety = setTimeout(() => finish(earnedRef.current), (duration + 20) * 1000);

    return () => {
      clearTimeout(safety);
      unsubLoaded(); unsubEarned(); unsubClosed(); unsubError();
    };
  }, [visible, duration, onReward, onClose]);

  // --- Web / fallback modal ------------------------------------------------
  const [count, setCount] = useState(duration);
  const [watched, setWatched] = useState(false);
  useEffect(() => {
    if (RewardedAd) return;           // not fallback mode
    if (!visible) return;
    setCount(duration); setWatched(false);
    const t = setInterval(() => {
      setCount((c) => {
        if (c <= 1) { clearInterval(t); setWatched(true); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [visible, duration]);

  if (RewardedAd) {
    // Native: show a "Loading ad…" overlay while the rewarded ad fetches.
    // It disappears the moment the AdMob SDK takes over the screen.
    if (!visible || loaded) return null;
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay} testID={`${testID}-loading`}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingTitle}>Loading rewarded ad…</Text>
            <Text style={styles.loadingSub}>Hang tight — your reward is on the way.</Text>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay} testID={testID}>
        <View style={styles.card}>
          <View style={styles.icon}>
            {watched ? <Gift size={42} color={theme.colors.success} /> : <Play size={42} color={theme.colors.primary} />}
          </View>
          <Text style={styles.tag}>SPONSORED</Text>
          <Text style={styles.title}>{watched ? "You've earned your reward!" : "Watch this ad to claim"}</Text>
          <Text style={styles.body}>
            {watched
              ? "Thanks for watching. Tap claim to get your reward and continue."
              : "Real video ads show in the installed app. Your reward is waiting after the ad."}
          </Text>
          {watched ? (
            <TouchableOpacity style={[styles.btn, styles.success]} onPress={onReward} testID="rewarded-claim-btn">
              <Text style={styles.btnText}>Claim Reward</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timer}>Ad ends in {count}s...</Text>
          )}
          {onClose && !watched && (
            <TouchableOpacity onPress={onClose} testID="rewarded-cancel-btn">
              <Text style={styles.cancel}>Skip ad (no reward)</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, width: "100%", maxWidth: 360, borderRadius: theme.radii.xl, padding: theme.spacing.lg, alignItems: "center", gap: 6 },
  icon: { width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  tag: { color: theme.colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  body: { fontSize: 13, color: theme.colors.muted, textAlign: "center", marginVertical: theme.spacing.sm, lineHeight: 20 },
  timer: { fontSize: 14, color: theme.colors.primary, fontWeight: "700", marginVertical: theme.spacing.md },
  btn: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: theme.radii.lg, marginTop: theme.spacing.sm },
  success: { backgroundColor: theme.colors.success },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  cancel: { color: theme.colors.muted, fontSize: 12, marginTop: 8, textDecorationLine: "underline" },
  loadingCard: { backgroundColor: theme.colors.surface, width: "100%", maxWidth: 320, borderRadius: theme.radii.xl, padding: theme.spacing.lg, alignItems: "center", gap: 12 },
  loadingTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.text, marginTop: 8 },
  loadingSub: { fontSize: 12, color: theme.colors.muted, textAlign: "center" },
});
