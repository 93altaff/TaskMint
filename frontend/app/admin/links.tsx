import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type Links = {
  telegram: string; telegram_contact: string;
  business_contact: string; privacy_policy: string; terms: string;
};

export default function AdminLinks() {
  const router = useRouter();
  const [data, setData] = useState<Links>({
    telegram: "", telegram_contact: "", business_contact: "", privacy_policy: "", terms: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Links>("/admin/links").then(setData).catch(() => {});
  }, []);

  const save = async () => {
    setBusy(true);
    try {
      await api("/admin/links", { method: "PUT", body: data });
      Alert.alert("Saved", "Links updated successfully");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  const setField = (k: keyof Links, v: string) => setData((d) => ({ ...d, [k]: v }));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Channel Links</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 14 }}>
          {[
            ["telegram", "Telegram Channel"],
            ["telegram_contact", "Contact on Telegram"],
            ["business_contact", "Contact for Business (URL or mailto:)"],
            ["privacy_policy", "Privacy Policy URL"],
            ["terms", "Terms & Conditions URL"],
          ].map(([key, label]) => (
            <View key={key}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                value={(data as any)[key]}
                onChangeText={(v) => setField(key as any, v)}
                placeholder="https://..."
                placeholderTextColor={theme.colors.muted}
                style={styles.input}
                autoCapitalize="none"
                testID={`link-${key}`}
              />
            </View>
          ))}

          <TouchableOpacity style={styles.cta} onPress={save} disabled={busy} testID="save-links">
            <Save size={18} color="#fff" />
            <Text style={styles.ctaText}>{busy ? "Saving..." : "Save"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: theme.spacing.md },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  label: { fontSize: 12, fontWeight: "700", color: theme.colors.muted, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.md,
    paddingHorizontal: 12, paddingVertical: 14, fontSize: 14, color: theme.colors.text,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: theme.radii.lg,
    marginTop: theme.spacing.md,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
