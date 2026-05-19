import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ArrowDownToLine, ArrowUpToLine, Receipt } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import BalanceCard from "../../src/components/BalanceCard";

type Txn = {
  id: string; type: "earn" | "withdraw"; source: string;
  category?: string;
  points: number; note: string; created_at: string;
};

type Filter = "all" | "games_task" | "campaign";

const sourceLabel: Record<string, string> = {
  checkin: "Daily Check-in", spin: "Spin Wheel", scratch: "Scratch Card",
  campaign: "Campaign", quiz: "Quiz", survey: "Survey", watch: "Watch & Earn",
  withdraw: "Withdrawal", admin: "Admin Adjustment",
  coinmine: "Coin Mine", plinko: "Plinko",
  treasure: "Treasure Hunt", higher_lower: "Higher or Lower",
  tictactoe: "Tic-Tac-Toe", memory: "Memory Match", math: "Math Sprint",
  visit: "Visit & Earn",
};

const FILTERS: { key: Filter; label: string; testID: string }[] = [
  { key: "all",         label: "All",            testID: "wallet-filter-all" },
  { key: "games_task",  label: "Games & Task",   testID: "wallet-filter-games" },
  { key: "campaign",    label: "Campaigns",      testID: "wallet-filter-campaigns" },
];

export default function WalletScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const t = await api<Txn[]>("/wallet/transactions");
      setTxns(t);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    refreshUser();
    load();
  }, [load, refreshUser]));

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshUser(), load()]);
    setRefreshing(false);
  };

  const filtered = txns.filter((t) => {
    if (filter === "all") return true;
    const cat = t.category || "games_task";
    return cat === filter;
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Wallet</Text>

        <View style={styles.section}>
          <BalanceCard
            points={user?.points ?? 0}
            onWithdraw={() => router.push("/withdraw")}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  testID={f.testID}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          {loading ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 24 }} />
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Receipt size={36} color={theme.colors.muted} />
              <Text style={styles.empty}>No transactions yet.</Text>
              <Text style={styles.emptySub}>
                {filter === "all"
                  ? "Start earning to see your history here."
                  : "Nothing in this category yet."}
              </Text>
            </View>
          ) : (
            filtered.map((t) => (
              <View key={t.id} style={styles.txn} testID={`txn-${t.id}`}>
                <View
                  style={[
                    styles.txnIcon,
                    { backgroundColor: t.points > 0 ? "rgba(16,185,129,0.12)" : "rgba(255,107,107,0.12)" },
                  ]}
                >
                  {t.points > 0 ? (
                    <ArrowDownToLine size={18} color={theme.colors.success} />
                  ) : (
                    <ArrowUpToLine size={18} color={theme.colors.danger} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnTitle}>
                    {sourceLabel[t.source] || t.source}
                  </Text>
                  <Text style={styles.txnNote} numberOfLines={1}>
                    {t.note || new Date(t.created_at).toLocaleDateString()}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txnAmt,
                    { color: t.points > 0 ? theme.colors.success : theme.colors.danger },
                  ]}
                >
                  {t.points > 0 ? "+" : ""}{t.points} pts
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingBottom: 16 },
  title: {
    fontSize: 28, fontWeight: "800", color: theme.colors.text,
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm,
  },
  section: { paddingHorizontal: theme.spacing.lg, marginTop: theme.spacing.md },
  sectionTitle: {
    fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: theme.spacing.md,
  },
  filterRow: { flexDirection: "row", gap: 8, paddingBottom: 12 },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999,
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: { fontSize: 13, fontWeight: "700", color: theme.colors.text },
  filterTextActive: { color: "#fff" },
  txn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 10,
  },
  txnIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  txnTitle: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  txnNote: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: "800" },
  emptyCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    alignItems: "center",
    gap: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  empty: { color: theme.colors.text, fontSize: 16, fontWeight: "700", marginTop: 8 },
  emptySub: { color: theme.colors.muted, fontSize: 13, textAlign: "center" },
});
