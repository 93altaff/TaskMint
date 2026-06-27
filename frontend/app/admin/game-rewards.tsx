import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from "react-native";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Save } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

/**
 * Game Rewards admin page. Reads & writes the same `/admin/app-config`
 * document as App Config — we only render game-related fields here.
 * Saving merges the edited fields back onto the full config and PUTs the
 * whole document (server uses PUT-replaces-document semantics).
 */
type Config = Record<string, any>;

export default function AdminGameRewards() {
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Config>("/admin/app-config")
      .then(setConfig)
      .catch((e: any) =>
        toast.error("Error", { description: e?.message || "Failed to load" }),
      );
  }, []);

  const setNum = (key: string) => (v: string) =>
    setConfig((c) => (c ? { ...c, [key]: parseInt(v || "0", 10) || 0 } : c));

  const save = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await api("/admin/app-config", { method: "PUT", body: config });
      toast.success("Saved", {
        description: "Game rewards updated. New values take effect on the next round.",
      });
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
        <Text style={styles.title}>Game Rewards</Text>
        <TouchableOpacity
          onPress={save}
          disabled={saving}
          style={styles.saveBtn}
          testID="save-game-rewards"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Save size={18} color="#fff" />}
          <Text style={styles.saveTxt}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 20, paddingBottom: 120 }}>
          <Section title="Higher or Lower">
            <Row label="Reward at streak 3+"><NumInput value={config.hl_reward_streak_3} onChangeText={setNum("hl_reward_streak_3")} /></Row>
            <Row label="Reward at streak 5+"><NumInput value={config.hl_reward_streak_5} onChangeText={setNum("hl_reward_streak_5")} /></Row>
            <Row label="Reward at streak 7+"><NumInput value={config.hl_reward_streak_7} onChangeText={setNum("hl_reward_streak_7")} /></Row>
            <Text style={styles.muted}>
              Streaks below 3 award nothing. Cash-out unlocks at 3 correct.
            </Text>
          </Section>

          <Section title="Memory Match">
            <Row label="Completion reward"><NumInput value={config.memory_completion} onChangeText={setNum("memory_completion")} /></Row>
          </Section>

          <Section title="Tic-Tac-Toe">
            <Row label="Hard win (Easy/Med scale to 30%/60%)"><NumInput value={config.ttt_win} onChangeText={setNum("ttt_win")} /></Row>
          </Section>

          <Section title="Math Sprint">
            <Row label="Points per correct answer"><NumInput value={config.math_per_correct} onChangeText={setNum("math_per_correct")} /></Row>
          </Section>

          <Section title="Tap-the-Coin Rush">
            <Row label="Points per Diamond tap"><NumInput value={config.tap_per_diamond} onChangeText={setNum("tap_per_diamond")} /></Row>
            <Row label="Points per Gold tap"><NumInput value={config.tap_per_gold} onChangeText={setNum("tap_per_gold")} /></Row>
            <Row label="Points per Silver tap"><NumInput value={config.tap_per_silver} onChangeText={setNum("tap_per_silver")} /></Row>
            <Row label="Bomb penalty (points deducted)"><NumInput value={config.tap_bomb_penalty} onChangeText={setNum("tap_bomb_penalty")} /></Row>
          </Section>

          <Section title="Trivia Streak">
            <Row label="Points per correct answer"><NumInput value={config.trivia_per_correct} onChangeText={setNum("trivia_per_correct")} /></Row>
            <Row label="Bonus per streak step (above 1)"><NumInput value={config.trivia_streak_bonus} onChangeText={setNum("trivia_streak_bonus")} /></Row>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ width: 110 }}>{children}</View>
    </View>
  );
}
function NumInput({
  value, onChangeText, testID,
}: {
  value: number; onChangeText: (v: string) => void; testID?: string;
}) {
  return (
    <TextInput
      value={String(value ?? 0)}
      onChangeText={onChangeText}
      keyboardType="number-pad"
      style={styles.input}
      placeholderTextColor={theme.colors.muted}
      testID={testID}
    />
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
  section: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg,
    padding: theme.spacing.md, gap: 12,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
  },
  rowLabel: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: "500" },
  input: {
    backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    color: theme.colors.text, fontWeight: "700", textAlign: "right", flex: 1,
  },
  muted: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
});
