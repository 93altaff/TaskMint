import React, { useEffect, useRef, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { theme } from "../lib/theme";
import { getAdUnitId } from "../lib/adConfig";

let InterstitialAd: any = null;
let AdEventType: any = null;
let TestIds: any = null;
try {
  if (Platform.OS !== "web") {
    const mod = require("react-native-google-mobile-ads");
    InterstitialAd = mod.InterstitialAd;
    AdEventType = mod.AdEventType;
    TestIds = mod.TestIds;
  }
} catch {}

type Props = {
  visible: boolean;
  onDone: () => void;
  duration?: number;
  testID?: string;
};

export default function InterstitialAdModal({
  visible, onDone, duration = 3, testID = "interstitial-ad",
}: Props) {
  const handledRef = useRef(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!visible) { handledRef.current = false; setLoaded(false); return; }
    if (!InterstitialAd) return;

    handledRef.current = false;
    const unitId = __DEV__ ? TestIds.INTERSTITIAL : getAdUnitId("interstitial");

    const ad = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    const finish = () => {
      if (handledRef.current) return;
      handledRef.current = true;
      onDone();
    };

    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      setLoaded(true);
      try { ad.show(); } catch (e) { console.log("[Interstitial] show failed:", e); finish(); }
    });
    const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, finish);
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (e: any) => {
      console.log("[Interstitial] error:", e?.message || e);
      finish();
    });

    ad.load();
    const safety = setTimeout(finish, (duration + 12) * 1000);

    return () => {
      clearTimeout(safety);
      unsubLoaded(); unsubClosed(); unsubError();
    };
  }, [visible, duration, onDone]);

  // Native: show a "Loading ad…" overlay until the real ad takes over.
  if (InterstitialAd) {
    if (!visible || loaded) return null;
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay} testID={`${testID}-loading`}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingTitle}>Loading ad…</Text>
            <Text style={styles.loadingSub}>Just a sec — preparing your next reward.</Text>
          </View>
        </View>
      </Modal>
    );
  }

  // Web / Expo Go fallback
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay} testID={testID}>
        <View style={styles.card}>
          <Text style={styles.tag}>SPONSORED</Text>
          <Text style={styles.title}>TaskMint partners</Text>
          <Text style={styles.body}>
            Real ads show in the installed app. Tap continue to proceed.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onDone} testID="interstitial-continue-btn">
            <Text style={styles.btnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surface, width: "100%", maxWidth: 360, borderRadius: theme.radii.xl, padding: theme.spacing.lg, alignItems: "center" },
  tag: { color: theme.colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginBottom: theme.spacing.sm },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.text },
  body: { fontSize: 14, color: theme.colors.muted, textAlign: "center", marginVertical: theme.spacing.md },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: theme.radii.lg, marginTop: theme.spacing.sm },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  loadingCard: { backgroundColor: theme.colors.surface, width: "100%", maxWidth: 320, borderRadius: theme.radii.xl, padding: theme.spacing.lg, alignItems: "center", gap: 12 },
  loadingTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.text, marginTop: 8 },
  loadingSub: { fontSize: 12, color: theme.colors.muted, textAlign: "center" },
});
