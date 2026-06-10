import React from "react";
import { View, StyleSheet, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../lib/theme";
import Skeleton from "./Skeleton";

/**
 * Faithful skeleton of the Home tab. Used instead of a blank/spinner
 * during cold-start auth hydration and login transition so users
 * immediately see what feels like the Home tab loading in.
 *
 * Keep the layout in lockstep with `app/(tabs)/home.tsx`.
 */
export default function HomeSkeleton() {
  const { width } = useWindowDimensions();
  const bannerW = width - 48;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, paddingBottom: 100 }}>
        {/* Header: avatar + name + points pill */}
        <View style={styles.headerRow}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={{ flex: 1, gap: 6, marginLeft: 12 }}>
            <Skeleton width={140} height={16} />
            <Skeleton width={90} height={12} />
          </View>
          <Skeleton width={90} height={32} radius={999} />
        </View>

        {/* Balance card */}
        <View style={styles.balanceCard}>
          <View style={{ gap: 8 }}>
            <Skeleton width={120} height={12} />
            <Skeleton width={180} height={28} />
            <Skeleton width={100} height={14} />
          </View>
          <View style={styles.balanceActions}>
            <Skeleton width="48%" height={44} radius={12} />
            <Skeleton width="48%" height={44} radius={12} />
          </View>
        </View>

        {/* Banner carousel placeholder */}
        <Skeleton width={bannerW} height={140} radius={16} style={{ marginTop: 16 }} />
        <View style={styles.dotsRow}>
          <Skeleton width={24} height={6} radius={3} />
          <Skeleton width={8} height={6} radius={3} />
          <Skeleton width={8} height={6} radius={3} />
        </View>

        {/* Section label */}
        <Skeleton width={140} height={20} style={{ marginTop: 22, marginBottom: 12 }} />

        {/* Campaign cards row */}
        <View style={styles.cardRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.campaignCard}>
              <Skeleton width={64} height={64} radius={16} />
              <Skeleton width="90%" height={12} style={{ marginTop: 10 }} />
              <Skeleton width="60%" height={10} style={{ marginTop: 6 }} />
              <Skeleton width="70%" height={20} radius={999} style={{ marginTop: 10 }} />
            </View>
          ))}
        </View>

        {/* Another section */}
        <Skeleton width={160} height={20} style={{ marginTop: 24, marginBottom: 12 }} />
        <View style={{ gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.taskRow}>
              <Skeleton width={56} height={56} radius={28} />
              <View style={{ flex: 1, gap: 8 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="40%" height={12} />
              </View>
              <Skeleton width={70} height={28} radius={999} />
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  balanceCard: {
    backgroundColor: theme.colors.surface,
    padding: 16, borderRadius: 16, gap: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  balanceActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  dotsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  cardRow: { flexDirection: "row", gap: 12 },
  campaignCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: "center",
  },
  taskRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface,
    padding: 12, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
});
