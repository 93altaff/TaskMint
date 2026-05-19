import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save, RefreshCw } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { loadAdSettings } from "../../src/lib/adConfig";

type AdMobSettings = {
  android_app_id: string;
  banner_unit_id: string;
  interstitial_unit_id: string;
  rewarded_unit_id: string;
  native_unit_id: string;
};

const FIELDS: { key: keyof AdMobSettings; label: string; sub: string }[] = [
  { key: "android_app_id", label: "Android App ID", sub: "ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY (Manifest, info only)" },
  { key: "banner_unit_id", label: "Banner ad unit", sub: "Anchored adaptive banner shown on home/wallet" },
  { key: "interstitial_unit_id", label: "Interstitial ad unit", sub: "Full-screen ad after quizzes & key flows" },
  { key: "rewarded_unit_id", label: "Rewarded ad unit", sub: "Shown for watch-and-earn rewards" },
  { key: "native_unit_id", label: "Native ad unit", sub: "300x250 medium rectangle in task screens" },
];

export default function AdminAdMob() {
  const router = useRouter();
  const [settings, setSettings] = useState<AdMobSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSettings(await api<AdMobSettings>("/admin/admob-settings"));
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (key: keyof AdMobSettings, value: string) => {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  };

  const save = async () => {
    if (!settings) return;
    // Loose validation: every field must look like an AdMob unit/app ID.
    for (const f of FIELDS) {
      const v = (settings[f.key] || "").trim();
      if (!v.startsWith("ca-app-pub-")) {
        Alert.alert("Invalid", `${f.label} must start with "ca-app-pub-"`);
        return;
      }
    }
    setSaving(true);
    try {
      await api("/admin/admob-settings", { method: "PUT", body: settings });
      // Refresh the in-memory cache used by the ad components.
      await loadAdSettings();
      Alert.alert("Saved", "AdMob unit IDs updated. Reopen the app for native ads to pick them up.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>AdMob Settings</Text>
        <TouchableOpacity onPress={load} testID="admob-refresh">
          <RefreshCw size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {loading || !settings ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.intro}>
              Edit the production AdMob unit IDs used by the installed app. Changes are picked up on
              the next app cold-start (and within a few seconds for newly opened ad screens).
            </Text>

            {FIELDS.map((f) => (
              <View key={f.key} style={styles.field} testID={`field-${f.key}`}>
                <Text style={styles.fieldLabel}>{f.label}</Text>
                <Text style={styles.fieldSub}>{f.sub}</Text>
                <TextInput
                  value={settings[f.key]}
                  onChangeText={(v) => update(f.key, v)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY"
                  placeholderTextColor={theme.colors.muted}
                  style={styles.input}
                  testID={`input-${f.key}`}
                />
              </View>
            ))}

            <TouchableOpacity
              style={styles.saveBtn}
              onPress={save}
              disabled={saving}
              testID="save-admob"
            >
              <Save size={16} color="#fff" />
              <Text style={styles.saveText}>{saving ? "Saving..." : "Save changes"}</Text>
            </TouchableOpacity>

            <Text style={styles.note}>
              Tip: Debug builds always show Google test ads. Production unit IDs only take effect
              in release builds (Play Store / signed APK).
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  body: { padding: theme.spacing.lg, gap: 14, paddingBottom: 40 },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
  field: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
    gap: 6,
  },
  fieldLabel: { fontSize: 14, fontWeight: "800", color: theme.colors.text },
  fieldSub: { fontSize: 11, color: theme.colors.muted },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 13, color: theme.colors.text,
    borderWidth: 1, borderColor: theme.colors.border,
    marginTop: 4,
  },
  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14, borderRadius: theme.radii.lg, marginTop: 8,
  },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  note: { color: theme.colors.muted, fontSize: 11, marginTop: 4, lineHeight: 16 },
});
