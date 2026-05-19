import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, X, Clock, Smartphone, Building2, History } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import PromptModal from "../../src/components/PromptModal";

type WD = {
  id: string; user_id: string; user_email: string; user_name: string;
  user_mobile?: string | null;
  method: "upi" | "bank"; source?: "campaign" | "games_task";
  points: number; inr_amount: number;
  upi_id?: string; bank_account?: string; bank_ifsc?: string; bank_holder?: string;
  status: "pending" | "successful" | "rejected"; created_at: string;
};

type Txn = {
  id: string; source: string; points: number; note: string; created_at: string;
  category?: string;
};

type TxnFilter = "all" | "games_task" | "campaign" | "withdrawals";

export default function AdminWithdrawals() {
  const router = useRouter();
  const [items, setItems] = useState<WD[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "successful" | "rejected">("pending");
  const [historyUser, setHistoryUser] = useState<{ user_id: string; name: string; email: string; mobile?: string | null } | null>(null);
  const [historyTxns, setHistoryTxns] = useState<Txn[]>([]);
  const [historyFilter, setHistoryFilter] = useState<TxnFilter>("all");
  const [rejectFor, setRejectFor] = useState<string | null>(null);

  const viewHistory = async (w: WD) => {
    setHistoryUser({ user_id: w.user_id, name: w.user_name, email: w.user_email, mobile: w.user_mobile });
    setHistoryTxns([]);
    setHistoryFilter("all");
    try {
      const t = await api<Txn[]>(`/admin/users/${w.user_id}/transactions`);
      setHistoryTxns(t);
    } catch {}
  };

  const load = useCallback(async () => {
    try { setItems(await api<WD[]>("/admin/withdrawals")); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const submitUpdate = async (id: string, status: WD["status"], reason: string) => {
    try {
      await api(`/admin/withdrawals/${id}`, {
        method: "PUT", body: { status, admin_note: reason },
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const update = (id: string, status: WD["status"]) => {
    if (status === "rejected") {
      setRejectFor(id);
      return;
    }
    submitUpdate(id, status, "");
  };

  const onRejectConfirm = (reason: string) => {
    if (!reason.trim()) { Alert.alert("Reason required"); return; }
    const id = rejectFor;
    setRejectFor(null);
    if (id) submitUpdate(id, "rejected", reason.trim());
  };

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Withdrawals</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabs}>
        {(["pending", "successful", "rejected", "all"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, filter === t && styles.tabActive]}
            onPress={() => setFilter(t)}
            testID={`filter-${t}`}
          >
            <Text style={[styles.tabText, filter === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
        {filtered.map((w) => (
          <View key={w.id} style={styles.card} testID={`wd-${w.id}`}>
            <View style={styles.row}>
              <View style={[styles.icon, statusBg(w.status)]}>
                {w.method === "upi" ? <Smartphone size={18} color={theme.colors.primary} /> : <Building2 size={18} color={theme.colors.primary} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.amt}>
                  ₹{w.inr_amount.toFixed(2)}
                  {w.source && (
                    <Text style={styles.sourceTag}>
                      {"  "}• {w.source === "campaign" ? "Campaigns" : "Games & Task"}
                    </Text>
                  )}
                </Text>
                <Text style={styles.user}>
                  {w.user_name}
                  {w.user_mobile ? ` • 📱 ${w.user_mobile}` : ` • ${w.user_email}`}
                </Text>
              </View>
              <Text style={[styles.status, statusColor(w.status)]}>{w.status.toUpperCase()}</Text>
            </View>
            <View style={styles.details}>
              {w.method === "upi" ? (
                <Text style={styles.detail}>UPI: <Text style={styles.bold}>{w.upi_id}</Text></Text>
              ) : (
                <>
                  <Text style={styles.detail}>Holder: <Text style={styles.bold}>{w.bank_holder}</Text></Text>
                  <Text style={styles.detail}>Account: <Text style={styles.bold}>{w.bank_account}</Text></Text>
                  <Text style={styles.detail}>IFSC: <Text style={styles.bold}>{w.bank_ifsc}</Text></Text>
                </>
              )}
              <Text style={styles.detail}>Points: <Text style={styles.bold}>{w.points}</Text></Text>
              <Text style={styles.detail}>{new Date(w.created_at).toLocaleString()}</Text>
            </View>
            <TouchableOpacity
              style={styles.historyBtn}
              onPress={() => viewHistory(w)}
              testID={`view-history-${w.id}`}
            >
              <History size={14} color={theme.colors.primary} />
              <Text style={styles.historyBtnText}>View user's transaction history</Text>
            </TouchableOpacity>
            {w.status === "pending" && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.success }]}
                  onPress={() => update(w.id, "successful")} testID={`approve-${w.id}`}>
                  <Check size={16} color="#fff" />
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.danger }]}
                  onPress={() => update(w.id, "rejected")} testID={`reject-${w.id}`}>
                  <X size={16} color="#fff" />
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>No {filter} withdrawals.</Text>}
      </ScrollView>

      <Modal visible={!!historyUser} transparent animationType="slide" onRequestClose={() => setHistoryUser(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Transaction History</Text>
                <Text style={styles.sheetSub}>
                  {historyUser?.name}
                  {historyUser?.mobile ? ` • 📱 ${historyUser.mobile}` : ` • ${historyUser?.email}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setHistoryUser(null)} testID="close-history">
                <X size={22} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChipsRow}>
              {(["all","games_task","campaign","withdrawals"] as TxnFilter[]).map((f) => {
                const active = historyFilter === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, active && styles.filterChipActive]}
                    onPress={() => setHistoryFilter(f)}
                    testID={`wdh-filter-${f}`}
                  >
                    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                      {f === "all" ? "All" : f === "games_task" ? "Games & Task" : f === "campaign" ? "Campaigns" : "Withdrawals"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <ScrollView style={{ maxHeight: 440 }}>
              {(() => {
                const filtered = historyTxns.filter((t) => {
                  if (historyFilter === "all") return true;
                  if (historyFilter === "withdrawals") return t.source === "withdraw";
                  return (t.category || "games_task") === historyFilter;
                });
                if (filtered.length === 0) return <Text style={styles.empty}>No transactions in this category.</Text>;
                return filtered.map((t) => (
                  <View key={t.id} style={styles.txnRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.txnTitle}>{t.note || t.source}</Text>
                      <Text style={styles.txnDate}>
                        {new Date(t.created_at).toLocaleString()}
                        {t.category === "campaign" ? " • Campaigns" : " • Games & Task"}
                      </Text>
                    </View>
                    <Text style={[styles.txnAmt, { color: t.points > 0 ? theme.colors.success : theme.colors.danger }]}>
                      {t.points > 0 ? "+" : ""}{t.points} pts
                    </Text>
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <PromptModal
        visible={!!rejectFor}
        title="Rejection reason"
        placeholder="Why is this withdrawal being rejected? The user will see this."
        confirmLabel="Reject withdrawal"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setRejectFor(null)}
        onConfirm={onRejectConfirm}
      />
    </SafeAreaView>
  );
}

const statusBg = (s: string) =>
  s === "successful" ? { backgroundColor: "rgba(16,185,129,0.12)" } :
  s === "rejected" ? { backgroundColor: "rgba(255,107,107,0.12)" } :
  { backgroundColor: theme.colors.primarySoft };

const statusColor = (s: string) =>
  s === "successful" ? { color: theme.colors.success } :
  s === "rejected" ? { color: theme.colors.danger } :
  { color: "#B45309" };

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  tabs: { flexDirection: "row", gap: 6, paddingHorizontal: theme.spacing.lg, marginBottom: 4 },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  amt: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sourceTag: { fontSize: 12, fontWeight: "700", color: theme.colors.primary },
  user: { fontSize: 12, color: theme.colors.muted },
  status: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  details: { backgroundColor: theme.colors.bg, borderRadius: 12, padding: 12, gap: 4 },
  detail: { fontSize: 12, color: theme.colors.muted },
  bold: { color: theme.colors.text, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  historyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.primarySoft,
    backgroundColor: theme.colors.primarySoft,
  },
  historyBtnText: { color: theme.colors.primary, fontWeight: "800", fontSize: 12 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: theme.spacing.lg, paddingBottom: 40, gap: 10, maxHeight: "70%",
  },
  sheetHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  sheetSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  filterChipsRow: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 4 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
    backgroundColor: theme.colors.bg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterChipText: { color: theme.colors.text, fontSize: 11, fontWeight: "800" },
  filterChipTextActive: { color: "#fff" },
  txnRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  txnTitle: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
  txnDate: { color: theme.colors.muted, fontSize: 11, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: "800" },
  empty: { color: theme.colors.muted, textAlign: "center", padding: 24 },
});
