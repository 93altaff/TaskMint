import React from "react";
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity } from "react-native";
import { Wallet, ArrowDownToLine } from "lucide-react-native";
import { theme, pointsToInr } from "../lib/theme";

const BG = "https://images.pexels.com/photos/7135024/pexels-photo-7135024.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

export default function BalanceCard({
  points,
  onWithdraw,
  testID = "balance-card",
}: {
  points: number;
  onWithdraw?: () => void;
  testID?: string;
}) {
  return (
    <ImageBackground
      source={{ uri: BG }}
      imageStyle={{ borderRadius: theme.radii.xl }}
      style={styles.card}
      testID={testID}
    >
      <View style={styles.tint} />
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Wallet size={20} color="#fff" />
        </View>
        <Text style={styles.label}>BALANCE</Text>
      </View>
      <Text style={styles.points} testID="balance-points">
        {points.toLocaleString()} pts
      </Text>
      <Text style={styles.inr}>≈ ₹ {pointsToInr(points)}</Text>
      {onWithdraw && (
        <TouchableOpacity
          style={styles.btn}
          onPress={onWithdraw}
          testID="balance-withdraw-btn"
          activeOpacity={0.85}
        >
          <ArrowDownToLine size={16} color={theme.colors.primary} />
          <Text style={styles.btnText}>Withdraw to Cash</Text>
        </TouchableOpacity>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: "hidden",
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    minHeight: 180,
    justifyContent: "space-between",
    backgroundColor: theme.colors.primary,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(28, 17, 89, 0.55)",
    borderRadius: theme.radii.xl,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  label: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 1.4 },
  points: {
    color: "#fff", fontSize: 36, fontWeight: "800", letterSpacing: -1, marginTop: 12,
    textShadowColor: "rgba(0,0,0,0.25)", textShadowRadius: 6,
  },
  inr: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600", marginTop: 4 },
  btn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", alignSelf: "flex-start",
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: theme.radii.pill, marginTop: 16,
  },
  btnText: { color: theme.colors.primary, fontWeight: "800", fontSize: 14 },
});
