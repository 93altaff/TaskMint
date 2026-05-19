import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus, Trash2, Globe } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type Site = { id: string; title: string; url: string; active: boolean };

export default function AdminVisitSites() {
  const router = useRouter();
  const [items, setItems] = useState<Site[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(async () => {
    try {
      const it = await api<Site[]>("/admin/visit-sites");
      setItems(it);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!title.trim() || !url.trim()) {
      Alert.alert("Required", "Title and URL are required");
      return;
    }
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = "https://" + normalized;
    try {
      await api("/admin/visit-sites", {
        method: "POST",
        body: { title: title.trim(), url: normalized, active },
      });
      setTitle(""); setUrl(""); setActive(true);
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create site");
    }
  };

  const toggle = async (s: Site) => {
    try {
      await api(`/admin/visit-sites/${s.id}`, {
        method: "PUT",
        body: { active: !s.active },
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update");
    }
  };

  const del = async (id: string) => {
    try {
      await api(`/admin/visit-sites/${id}`, { method: "DELETE" });
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Visit Sites</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Add Visit Site</Text>
            <TextInput
              value={title} onChangeText={setTitle}
              placeholder="Title (e.g. PaisaBazaar Loan)"
              placeholderTextColor={theme.colors.muted}
              style={styles.input} testID="site-title"
            />
            <TextInput
              value={url} onChangeText={setUrl}
              placeholder="https://example.com"
              placeholderTextColor={theme.colors.muted}
              style={styles.input} autoCapitalize="none" autoCorrect={false}
              keyboardType="url"
              testID="site-url"
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Active (visible to users)</Text>
              <Switch value={active} onValueChange={setActive} testID="site-active" />
            </View>
            <TouchableOpacity style={styles.cta} onPress={create} testID="site-create">
              <Plus size={18} color="#fff" />
              <Text style={styles.ctaText}>Add Site</Text>
            </TouchableOpacity>
          </View>

          {items.map((s) => (
            <View key={s.id} style={styles.item} testID={`site-${s.id}`}>
              <View style={styles.itemIcon}><Globe size={22} color={theme.colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{s.title}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>{s.url}</Text>
                <Text style={[styles.badge, { color: s.active ? theme.colors.success : theme.colors.muted }]}>
                  {s.active ? "Active" : "Hidden"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => toggle(s)} testID={`site-toggle-${s.id}`} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>{s.active ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => del(s.id)} style={styles.delBtn} testID={`site-del-${s.id}`}>
                <Trash2 size={18} color={theme.colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
          {items.length === 0 && <Text style={styles.empty}>No visit sites yet. Add one above.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  formCard: {
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, gap: 10,
  },
  formTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text, marginBottom: 4 },
  input: {
    backgroundColor: theme.colors.bg, borderRadius: theme.radii.md,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: theme.colors.text,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  switchLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radii.md,
  },
  ctaText: { color: "#fff", fontWeight: "800" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  itemIcon: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  itemTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  itemSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  badge: { fontSize: 11, fontWeight: "800", marginTop: 2 },
  smallBtn: {
    backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  smallBtnText: { fontSize: 12, fontWeight: "700", color: theme.colors.text },
  delBtn: { padding: 8 },
  empty: { color: theme.colors.muted, textAlign: "center", padding: 24 },
});
