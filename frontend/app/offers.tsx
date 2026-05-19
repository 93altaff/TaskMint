import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, Linking,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Check, X, Clock } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";

type Offer = {
  id: string; name: string; note: string; logo_url: string;
  link_url?: string; category?: string; difficulty?: string;
  reward_points: number; reward_inr: number;
};

type Completion = {
  id: string; campaign_id: string;
  status: "pending" | "approved" | "rejected";
  admin_note?: string;
};

export default function Offers() {
  const router = useRouter();
  const [items, setItems] = useState<Offer[]>([]);
  const [comps, setComps] = useState<Completion[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([
        api<Offer[]>("/campaigns", { auth: false }),
        api<Completion[]>("/campaign-completions").catch(() => []),
      ]);
      setItems(c);
      setComps(m);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const start = (o: Offer) => {
    Alert.alert(
      "Complete this task?",
      `${o.note}\n\nReward: ${o.reward_points} pts (₹${o.reward_inr})\n\nThe link will open. After you complete it, admin will verify and credit your points.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, start",
          onPress: async () => {
            try {
              const res = await api<{ link_url: string }>(`/tasks/campaign/${o.id}`, { method: "POST" });
              await load();
              if (res.link_url) Linking.openURL(res.link_url).catch(() => {});
              Alert.alert("Marked Pending", "Complete the task and admin will credit your points.");
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not start task");
            }
          },
        },
      ],
    );
  };

  const map = Object.fromEntries(comps.map((c) => [c.campaign_id, c]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Offerwall</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: 10, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.intro}>
          High paying offers. Complete and admin credits your reward.
        </Text>
        {items.map((o) => {
          const comp = map[o.id];
          const status = comp?.status;
          const disabled = !!status;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.row, disabled && styles.rowFade]}
              activeOpacity={disabled ? 1 : 0.85}
              onPress={() => !disabled && start(o)}
              disabled={disabled}
              testID={`offer-${o.id}`}
            >
              <Image source={{ uri: o.logo_url }} style={styles.logo} />
              <View style={{ flex: 1 }}>
                <View style={styles.tags}>
                  {!!o.category && <Tag text={o.category} />}
                  {!!o.difficulty && <Tag text={o.difficulty} dim />}
                </View>
                <Text style={styles.name}>{o.name}</Text>
                <Text style={styles.note} numberOfLines={2}>{o.note}</Text>
                {status && <StatusChip status={status} />}
                {status === "rejected" && !!comp?.admin_note && (
                  <View style={styles.reasonBox}>
                    <X size={12} color={theme.colors.danger} />
                    <Text style={styles.reasonText} numberOfLines={3}>
                      Reason: {comp.admin_note}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.rwd}>
                <Text style={styles.rwdInr}>₹{o.reward_inr}</Text>
                <Text style={styles.rwdPts}>{o.reward_points} pts</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        {items.length === 0 && <Text style={styles.empty}>No offers available right now.</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Tag({ text, dim }: { text: string; dim?: boolean }) {
  return (
    <View style={[styles.tag, dim && { backgroundColor: theme.colors.bg }]}>
      <Text style={[styles.tagText, dim && { color: theme.colors.muted }]}>{text}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const cfg = {
    pending: { c: "#B45309", bg: "rgba(255,193,7,0.18)", icon: <Clock size={12} color="#B45309" />, label: "Pending" },
    approved: { c: theme.colors.success, bg: "rgba(16,185,129,0.12)", icon: <Check size={12} color={theme.colors.success} />, label: "Task Completed" },
    rejected: { c: theme.colors.danger, bg: "rgba(255,107,107,0.12)", icon: <X size={12} color={theme.colors.danger} />, label: "Rejected" },
  }[status];
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      {cfg.icon}
      <Text style={[styles.chipText, { color: cfg.c }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  rowFade: { opacity: 0.55 },
  logo: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#eee" },
  tags: { flexDirection: "row", gap: 6, marginBottom: 4 },
  tag: { backgroundColor: theme.colors.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagText: { color: theme.colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  name: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  note: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  rwd: { alignItems: "flex-end" },
  rwdInr: { color: theme.colors.success, fontSize: 16, fontWeight: "800" },
  rwdPts: { color: theme.colors.muted, fontSize: 11, fontWeight: "600" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  reasonBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: "rgba(255,107,107,0.08)",
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6,
    marginTop: 6,
  },
  reasonText: { color: theme.colors.danger, fontSize: 11, fontWeight: "700", flex: 1 },
  empty: { color: theme.colors.muted, textAlign: "center", padding: 24 },
});
