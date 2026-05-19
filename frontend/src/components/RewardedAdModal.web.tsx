import React, { useEffect, useState } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Play, Gift } from "lucide-react-native";
import { theme } from "../lib/theme";

type Props = {
  visible: boolean;
  onReward: () => void;
  onClose?: () => void;
  duration?: number;
  testID?: string;
};

export default function RewardedAdModal({ visible, onReward, onClose, duration = 5, testID = "rewarded-ad" }: Props) {
  const [count, setCount] = useState(duration);
  const [watched, setWatched] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setCount(duration); setWatched(false);
    const t = setInterval(() => {
      setCount((c) => { if (c <= 1) { clearInterval(t); setWatched(true); return 0; } return c - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, [visible, duration]);

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
            {watched ? "Thanks for watching. Tap claim to get your reward and continue." : "Real video ads show in the installed app."}
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
});
