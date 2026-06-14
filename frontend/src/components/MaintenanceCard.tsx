import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Wrench } from "lucide-react-native";
import { theme } from "../lib/theme";

type Props = {
  title?: string;     // shown on the top bar (e.g. "Quizzes")
  note?: string;      // admin-supplied note shown under the headline
  testID?: string;
};

/**
 * Card-style "Coming Soon / Under maintenance" placeholder that replaces a screen's
 * body when the admin toggles maintenance ON for that route. Matches the look of the
 * existing "All Done!" card (centered icon circle, big title, soft sub-line).
 */
export default function MaintenanceCard({ title = "", note, testID = "maintenance-card" }: Props) {
  const router = useRouter();
  const subtitle = (note && note.trim()) || "We'll be back soon. Please check again later.";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} testID="maintenance-back">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card} testID={testID}>
          <View style={styles.iconCircle}>
            <Wrench size={32} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Under Maintenance</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm,
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 22, fontWeight: "800", color: theme.colors.text, flex: 1, textAlign: "center" },
  scroll: { padding: theme.spacing.lg, paddingTop: theme.spacing.xl },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl,
    paddingVertical: 40, paddingHorizontal: 24, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: "800", color: theme.colors.primary, marginBottom: 8, textAlign: "center" },
  sub: { fontSize: 15, color: theme.colors.muted, textAlign: "center", lineHeight: 22 },
});
