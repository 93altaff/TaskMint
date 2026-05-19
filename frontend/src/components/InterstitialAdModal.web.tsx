import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { theme } from "../lib/theme";

type Props = {
  visible: boolean;
  onDone: () => void;
  duration?: number;
  testID?: string;
};

export default function InterstitialAdModal({ visible, onDone, testID = "interstitial-ad" }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay} testID={testID}>
        <View style={styles.card}>
          <Text style={styles.tag}>SPONSORED</Text>
          <Text style={styles.title}>TaskMint partners</Text>
          <Text style={styles.body}>Real ads show in the installed app. Tap continue to proceed.</Text>
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
});
