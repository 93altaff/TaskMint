import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

export default function NativeAd({ testID = "native-ad" }: { testID?: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>SPONSORED</Text>
      <Text style={styles.title}>TaskMint partners</Text>
      <Text style={styles.sub}>Native ads show in the installed app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    alignSelf: "stretch",
    width: "100%",
    marginVertical: theme.spacing.md,
    backgroundColor: "#EEF1F6",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: theme.colors.muted },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  sub: { fontSize: 11, color: "#9CA3AF" },
});
