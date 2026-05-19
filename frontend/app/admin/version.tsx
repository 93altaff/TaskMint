import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Switch,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save, Smartphone, AlertTriangle } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type AppVersion = {
  latest_version: string;
  min_supported_version: string;
  play_store_url: string;
  force_update: boolean;
  release_notes: string;
};

export default function AdminVersion() {
  const router = useRouter();
  const [latest, setLatest] = useState("1.0.0");
  const [minVer, setMinVer] = useState("1.0.0");
  const [storeUrl, setStoreUrl] = useState(
    "https://play.google.com/store/apps/details?id=com.taskmint.app"
  );
  const [force, setForce] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<AppVersion>("/admin/version")
      .then((x) => {
        if (x.latest_version) setLatest(x.latest_version);
        if (x.min_supported_version) setMinVer(x.min_supported_version);
        if (x.play_store_url) setStoreUrl(x.play_store_url);
        if (typeof x.force_update === "boolean") setForce(x.force_update);
        if (x.release_notes) setNotes(x.release_notes);
      })
      .catch(() => {});
  }, []);

  const isVer = (v: string) => /^\d+(\.\d+){0,3}$/.test(v.trim());

  const save = async () => {
    if (!isVer(latest) || !isVer(minVer)) {
      Alert.alert("Invalid", "Versions must look like 1.2.3");
      return;
    }
    if (!storeUrl.trim().startsWith("http")) {
      Alert.alert("Invalid", "Store URL must start with http(s)://");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/version", {
        method: "PUT",
        body: {
          latest_version: latest.trim(),
          min_supported_version: minVer.trim(),
          play_store_url: storeUrl.trim(),
          force_update: !!force,
          release_notes: notes,
        },
      });
      Alert.alert("Saved", "App version settings updated");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>App Version</Text>
          <Smartphone size={20} color={theme.colors.primary} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: theme.spacing.lg, gap: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.note}>
            Control the version-update gate shown to users on app launch. The app reads
            `Application.nativeApplicationVersion` and compares it with the values below.
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>LATEST VERSION</Text>
            <TextInput
              value={latest} onChangeText={setLatest}
              style={styles.input} placeholder="1.0.0"
              placeholderTextColor={theme.colors.muted}
              testID="ver-latest"
            />
            <Text style={styles.help}>The newest version published on Play Store.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>MIN SUPPORTED VERSION</Text>
            <TextInput
              value={minVer} onChangeText={setMinVer}
              style={styles.input} placeholder="1.0.0"
              placeholderTextColor={theme.colors.muted}
              testID="ver-min"
            />
            <Text style={styles.help}>
              Anything below this is FORCE-blocked from using the app and must update.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>PLAY STORE URL</Text>
            <TextInput
              value={storeUrl} onChangeText={setStoreUrl}
              style={[styles.input, { fontSize: 13 }]}
              placeholder="https://play.google.com/store/apps/details?id=..."
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              testID="ver-url"
            />
          </View>

          <View style={styles.card}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.label}>FORCE UPDATE</Text>
                <Text style={styles.help}>
                  When ON, even users on the latest_version - 1 are blocked until they update.
                </Text>
              </View>
              <Switch
                value={force} onValueChange={setForce}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor="#fff"
                testID="ver-force"
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>RELEASE NOTES (SHOWN ON UPDATE SCREEN)</Text>
            <TextInput
              value={notes} onChangeText={setNotes}
              style={[styles.input, { fontSize: 14, minHeight: 90 }]}
              placeholder="What's new in this version…"
              placeholderTextColor={theme.colors.muted}
              multiline maxLength={400}
              testID="ver-notes"
            />
          </View>

          {force && (
            <View style={styles.warn}>
              <AlertTriangle size={16} color={theme.colors.danger} />
              <Text style={styles.warnText}>
                Force-update is ON — every user below v{latest} will see the update screen on next launch.
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.cta, busy && { opacity: 0.6 }]}
            onPress={save}
            disabled={busy}
            testID="save-version"
          >
            <Save size={18} color="#fff" />
            <Text style={styles.ctaText}>{busy ? "Saving..." : "Save Changes"}</Text>
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
  note: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  label: { fontSize: 11, fontWeight: "800", color: theme.colors.muted, letterSpacing: 1.4, marginBottom: 8 },
  input: {
    backgroundColor: theme.colors.bg, borderRadius: theme.radii.md,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 16,
    color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border,
    fontWeight: "700",
  },
  help: { marginTop: 6, color: theme.colors.muted, fontSize: 11, lineHeight: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  warn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.30)", borderWidth: 1,
    borderRadius: theme.radii.md, padding: 12,
  },
  warnText: { flex: 1, color: theme.colors.danger, fontSize: 12, fontWeight: "700", lineHeight: 17 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: theme.radii.lg,
    marginTop: theme.spacing.md,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
