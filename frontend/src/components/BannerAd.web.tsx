import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

export default function BannerAd({ testID = "banner-ad" }: { testID?: string }) {
  return (
    <View style={styles.wrap} testID={testID}>
      <Text style={styles.label}>ADVERTISEMENT</Text>
      <Text style={styles.sub}>Banner ads show in the installed app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 60,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    backgroundColor: "#EEF1F6",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: theme.colors.muted },
  sub: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
});
