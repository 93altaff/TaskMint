import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { ChevronLeft, Brain, Check } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { api } from "../src/lib/api";
import { useAuth } from "../src/context/AuthContext";
import InterstitialAdModal from "../src/components/InterstitialAdModal";
import NativeAd from "../src/components/NativeAd";

type Question = { q: string; a: string[]; c: number };

export default function Quizzes() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const [reward, setReward] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showInterstitial, setShowInterstitial] = useState(false);

  const used = user?.daily_quizzes_used ?? 0;
  const left = Math.max(0, 5 - used);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<Question[]>("/tasks/quizzes/random?limit=5");
      setQuestions(list);
      setPicks([]);
      setIdx(0);
      setDone(false);
      setReward(0);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not load quiz");
    } finally {
      setLoading(false);
    }
  }, []);

  // Pull a fresh, randomly-selected set of questions every time the screen is focused.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const choose = (i: number) => {
    const next = [...picks, i];
    setPicks(next);
    if (idx + 1 < questions.length) setIdx(idx + 1);
    else finish(next);
  };

  const finish = async (final: number[]) => {
    if (left <= 0) {
      Alert.alert("Daily limit reached", "Come back tomorrow for more quizzes.");
      return;
    }
    const correct = final.reduce((acc, p, i) => acc + (p === questions[i].c ? 1 : 0), 0);
    try {
      const r = await api<{ reward: number }>("/tasks/quiz", {
        method: "POST",
        body: { correct, total: questions.length },
      });
      setReward(r.reward);
      await refreshUser();
      setShowInterstitial(true);
      setDone(true);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Try again");
    }
  };

  if (loading || questions.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Quizzes</Text>
          <View style={{ width: 26 }} />
        </View>
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 64 }} />
      </SafeAreaView>
    );
  }

  // Daily quota fully used — block the screen with the limit-reached state.
  if (left <= 0 && !done) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Quizzes</Text>
          <View style={{ width: 26 }} />
        </View>
        <View style={styles.body}>
          <View style={styles.doneCard} testID="quiz-limit-reached">
            <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
            <Text style={styles.doneTitle}>All Done!</Text>
            <Text style={styles.doneBody}>Daily limit reached. Come back tomorrow.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn">
          <ChevronLeft size={26} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Quizzes</Text>
        <Text style={styles.counter}>{Math.min(idx + 1, questions.length)}/{questions.length}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.intro}>5 quizzes per day • 30-100 pts each • {left}/5 left</Text>
        <InterstitialAdModal
          visible={showInterstitial}
          onDone={() => setShowInterstitial(false)}
          duration={3}
        />
        {!done ? (
          <View style={styles.card}>
            <View style={styles.qIcon}><Brain color={theme.colors.primary} size={28} /></View>
            <Text style={styles.q}>{questions[idx].q}</Text>
            <View style={{ gap: 10, marginTop: theme.spacing.md }}>
              {questions[idx].a.map((opt, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.opt}
                  onPress={() => choose(i)}
                  testID={`quiz-opt-${i}`}
                >
                  <Text style={styles.optText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <NativeAd testID="quiz-native-ad-active" />
          </View>
        ) : (
          <View style={styles.doneCard} testID="quiz-done">
            <View style={styles.doneIcon}><Check size={32} color={theme.colors.success} /></View>
            <Text style={styles.doneTitle}>+{reward} points</Text>
            <Text style={styles.doneBody}>Great job! Keep going to earn more.</Text>
            <TouchableOpacity style={[styles.btn, left <= 0 && { backgroundColor: theme.colors.muted }]} onPress={load} disabled={left <= 0} testID="quiz-restart">
              <Text style={styles.btnText}>{left <= 0 ? "Come back tomorrow" : "Play again"}</Text>
            </TouchableOpacity>
            <NativeAd testID="quiz-native-ad-after" />
          </View>
        )}
      </ScrollView>
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
  counter: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  body: { padding: theme.spacing.lg, gap: 16 },
  intro: { color: theme.colors.muted, fontSize: 13 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  qIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },
  q: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  opt: {
    backgroundColor: theme.colors.bg, padding: 16, borderRadius: theme.radii.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  optText: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
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
  btn: { backgroundColor: theme.colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 999 },
  btnText: { color: "#fff", fontWeight: "800" },
});
