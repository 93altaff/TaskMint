import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

/**
 * Maintenance / Coming Soon admin page. Toggle per-screen maintenance and
 * write an optional note that users see on the maintenance card.
 */
type MaintEntry = { enabled: boolean; note: string };
type Config = Record<string, any> & {
  maintenance: Record<string, MaintEntry>;
};

const ROUTE_GROUPS: { label: string; items: { key: string; name: string }[] }[] = [
  { label: "Tabs", items: [
    { key: "/home", name: "Home" },
    { key: "/earn", name: "Earn" },
    { key: "/wallet", name: "Wallet" },
    { key: "/refer", name: "Refer" },
  ]},
  { label: "Tasks", items: [
    { key: "/spin", name: "Spin & Win" },
    { key: "/scratch", name: "Scratch & Earn" },
    { key: "/visit-earn", name: "Visit & Earn" },
    { key: "/watch-earn", name: "Watch & Earn" },
    { key: "/surveys", name: "Surveys" },
    { key: "/quizzes", name: "Quizzes" },
    { key: "/checkin", name: "Daily Check-in" },
  ]},
  { label: "Games", items: [
    { key: "/higher-lower", name: "Higher or Lower" },
    { key: "/memory-match", name: "Memory Match" },
    { key: "/tic-tac-toe", name: "Tic-Tac-Toe" },
    { key: "/math-sprint", name: "Math Sprint" },
    { key: "/daily-challenge", name: "Daily Challenge" },
    { key: "/tap-rush", name: "Tap-the-Coin Rush" },
    { key: "/trivia-streak", name: "Trivia Streak" },
  ]},
  { label: "Wallet", items: [
    { key: "/withdraw", name: "Withdraw" },
    { key: "/refer", name: "Refer & Earn" },
  ]},
];

export default function AdminMaintenance() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Config>("/admin/app-config")
      .then((c) => setConfig({ ...c, maintenance: c.maintenance || {} }))
      .catch((e: any) =>
        toast.error("Error", { description: e?.message || "Failed to load" }),
      );
  }, []);

  const toggle = (key: string) => {
    if (!config) return;
    const current = config.maintenance[key] || { enabled: false, note: "" };
    setConfig({
      ...config,
      maintenance: { ...config.maintenance, [key]: { ...current, enabled: !current.enabled } },
    });
  };
  const setNote = (key: string, note: string) => {
    if (!config) return;
    const current = config.maintenance[key] || { enabled: false, note: "" };
    setConfig({
      ...config,
      maintenance: { ...config.maintenance, [key]: { ...current, note } },
    });
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api("/admin/app-config", { method: "PUT", body: config });
      toast.success("Saved", { description: "Maintenance settings updated." });
    } catch (e: any) {
      toast.error("Error", { description: e?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Maintenance</Text>
        <TouchableOpacity onPress={save} disabled={saving} style={styles.saveBtn} testID="save-maint">
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={18} color="#fff" />}
          <Text style={styles.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 20, paddingBottom: 120 }}>
          <Text style={styles.intro}>
            Toggle ON to replace that screen's body with a Coming Soon / Under
            Maintenance card. Add an optional note that users will see on the card.
          </Text>

          {ROUTE_GROUPS.map((grp) => (
            <View key={grp.label} style={styles.section}>
              <Text style={styles.sectionTitle}>{grp.label}</Text>
              {grp.items.map((it) => {
                const m = config.maintenance[it.key] || { enabled: false, note: "" };
                return (
                  <View key={it.key} style={styles.maintRow}>
                    <View style={styles.maintHeader}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.maintName} numberOfLines={1}>{it.name}</Text>
                        <Text style={styles.maintKey} numberOfLines={1}>{it.key}</Text>
                      </View>
                      <Switch value={m.enabled} onValueChange={() => toggle(it.key)} testID={`maint-toggle-${it.key}`} />
                    </View>
                    {m.enabled && (
                      <TextInput
                        value={m.note}
                        onChangeText={(v) => setNote(it.key, v)}
                        placeholder="Optional note shown on the card…"
                        placeholderTextColor={theme.colors.muted}
                        style={styles.noteInput}
                        testID={`maint-note-${it.key}`}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  saveBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 999,
  },
  saveTxt: { color: "#fff", fontWeight: "800" },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  section: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg,
    padding: theme.spacing.md, gap: 8,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sectionTitle: {
    fontSize: 14, fontWeight: "800", color: theme.colors.text,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  maintRow: {
    backgroundColor: theme.colors.bg, padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, gap: 6,
  },
  maintHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  maintName: { fontSize: 14, fontWeight: "700", color: theme.colors.text },
  maintKey: {
    fontSize: 11, color: theme.colors.muted,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  noteInput: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    color: theme.colors.text, fontSize: 13,
  },
});
