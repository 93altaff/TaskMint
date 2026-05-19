import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, ClipboardCheck, Check, RefreshCw } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import InterstitialAdModal from "../src/components/InterstitialAdModal";
import NativeAd from "../src/components/NativeAd";

type Survey = { id: string; title: string; time: string; reward: number };

export default function Surveys() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [adVisible, setAdVisible] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const used = user?.daily_surveys_used ?? 0;
  const left = Math.max(0, 5 - used);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<Survey[]>("/tasks/surveys/random?limit=5");
      setSurveys(list);
      setCompleted([]);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load surveys");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load fresh, random surveys every time the screen is focused.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startSurvey = (id: string) => {
    if (completed.includes(id)) return;
    if (left <= 0) {
      Alert.alert("Daily limit reached", "Come back tomorrow for more surveys.");
      return;
    }
    setPendingId(id);
    setAdVisible(true);
  };

  const onAdDone = async () => {
    setAdVisible(false);
    if (!pendingId) return;
    const id = pendingId;
    setPendingId(null);
    try {
      const r = await api<{ reward: number }>("/tasks/survey", { method: "POST" });
      setCompleted((c) => [...c, id]);
      await refreshUser();
      Alert.alert("Reward", `+${r.reward} points`);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Try again");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Surveys</Text>
        {left > 0 ? (
          <TouchableOpacity onPress={load} testID="refresh-surveys">
            <RefreshCw size={22} color={theme.colors.muted} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
        {loading ? (
          <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 32 }} />
        ) : left <= 0 ? (
          <>
            <NativeAd testID="surveys-native-ad-done" />
            <View style={styles.doneCard} testID="surveys-limit-reached">
              <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
              <Text style={styles.doneTitle}>All Done!</Text>
              <Text style={styles.doneBody}>Daily limit reached. Come back tomorrow.</Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.intro}>5 fresh surveys per day • 30-100 pts each • {left}/5 left</Text>
            <NativeAd testID="surveys-native-ad" />
            {surveys.map((s) => {
              const done = completed.includes(s.id);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.row, done && { opacity: 0.55 }]}
                  onPress={() => startSurvey(s.id)}
                  disabled={done}
                  testID={`survey-${s.id}`}
                >
                  <View style={styles.icon}>
                    {done ? <Check size={22} color={theme.colors.success} /> :
                      <ClipboardCheck size={22} color={theme.colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{s.title}</Text>
                    <Text style={styles.rowSub}>~{s.time} • {done ? "Completed" : "Tap to start"}</Text>
                  </View>
                  <Text style={styles.reward}>+{s.reward}</Text>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>
      <InterstitialAdModal visible={adVisible} onDone={onAdDone} duration={3} />
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
  intro: { color: theme.colors.muted, fontSize: 13, marginBottom: 4 },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  icon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  rowSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  reward: { color: theme.colors.success, fontWeight: "800", fontSize: 16 },
  empty: { textAlign: "center", color: theme.colors.muted, marginTop: 12, fontWeight: "600" },
  doneCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl, padding: theme.spacing.lg,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.colors.border,
  },
  doneIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "rgba(16,185,129,0.12)", alignItems: "center", justifyContent: "center",
  },
  doneTitle: { fontSize: 26, fontWeight: "800", color: theme.colors.success },
  doneBody: { color: theme.colors.muted, textAlign: "center" },
});
