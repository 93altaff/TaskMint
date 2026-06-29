import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Image,
  Alert,
} from "react-native";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ChevronLeft,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Star,
  RotateCcw,
} from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type EarnCard = {
  id: string;
  key: string;
  title: string;
  image_url: string;
  route: string;
  hero: boolean;
  sort_order: number;
  hidden: boolean;
};

export default function AdminEarnCards() {
  const router = useRouter();
  const [items, setItems] = useState<EarnCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    api<{ cards: EarnCard[] }>("/admin/earn-cards")
      .then((r) => setItems(r.cards || []))
      .catch((e) => toast.error("Error", { description: e?.message || "Failed to load" }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const updateAt = (i: number, patch: Partial<EarnCard>) => {
    setItems((arr) => arr.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  };

  const addNew = () => {
    setItems((arr) => [
      ...arr,
      {
        id: `ec_new_${Date.now()}`,
        key: `card_${Date.now()}`,
        title: "New Card",
        image_url: "",
        route: "",
        hero: false,
        sort_order: (arr[arr.length - 1]?.sort_order ?? 0) + 1,
        hidden: false,
      },
    ]);
  };

  const removeAt = (i: number) => {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  };

  const move = (i: number, dir: -1 | 1) => {
    setItems((arr) => {
      const next = arr.slice();
      const j = i + dir;
      if (j < 0 || j >= next.length) return arr;
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((c, idx) => ({ ...c, sort_order: idx + 1 }));
    });
  };

  const resetDefaults = () => {
    Alert.alert(
      "Reset to defaults?",
      "This will replace your custom arrangement with the original 15 cards. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            try {
              const r = await api<{ cards: EarnCard[] }>("/admin/earn-cards/reset", {
                method: "POST",
              });
              setItems(r.cards || []);
              toast.success("Reset", { description: "Defaults restored." });
            } catch (e: any) {
              toast.error("Reset failed", { description: e?.message || "Try again" });
            }
          },
        },
      ],
    );
  };

  const save = async () => {
    for (const c of items) {
      if (!c.key.trim()) {
        toast.error("Key required", { description: "Every card needs a unique key." });
        return;
      }
      if (!c.image_url.trim()) {
        toast.error("Image URL required", { description: `Card "${c.title}" is missing an image.` });
        return;
      }
      if (!c.route.trim()) {
        toast.error("Route required", { description: `Card "${c.title}" needs a destination route.` });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        cards: items.map((c, idx) => ({ ...c, sort_order: idx + 1 })),
      };
      const r = await api<{ cards: EarnCard[] }>("/admin/earn-cards", {
        method: "PUT",
        body: payload,
      });
      setItems(r.cards || []);
      toast.success("Saved", { description: "Earn cards updated." });
    } catch (e: any) {
      toast.error("Save failed", { description: e?.message || "Try again" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const heroCount = items.filter((c) => c.hero && !c.hidden).length;

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
          <Text style={styles.title}>Earn Cards</Text>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={save}
            disabled={saving}
            testID="save-btn"
          >
            <Save size={16} color="#fff" />
            <Text style={styles.saveTxt}>{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.intro}>
            Reorder, hide, or relabel the cards shown on the Earn tab. Cards marked as
            Hero appear in the top 2-column row; the rest fill the 3-column grid
            below in the order shown here.
          </Text>

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{items.length}</Text>
              <Text style={styles.statLbl}>Total</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{heroCount}</Text>
              <Text style={styles.statLbl}>Hero</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: theme.colors.danger }]}>
                {items.filter((c) => c.hidden).length}
              </Text>
              <Text style={styles.statLbl}>Hidden</Text>
            </View>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={resetDefaults}
              testID="reset-btn"
            >
              <RotateCcw size={14} color={theme.colors.danger} />
              <Text style={styles.resetTxt}>Reset</Text>
            </TouchableOpacity>
          </View>

          {items.map((c, i) => (
            <View key={c.id} style={styles.card} testID={`card-row-${i}`}>
              <View style={styles.cardHead}>
                <View style={styles.thumbWrap}>
                  {c.image_url ? (
                    <Image
                      source={{ uri: c.image_url }}
                      style={styles.thumb}
                      resizeMode="stretch"
                    />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: theme.colors.border }]} />
                  )}
                  {c.hero && (
                    <View style={styles.heroBadge}>
                      <Star size={10} color="#fff" fill="#fff" />
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    #{i + 1} · {c.title || c.key}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {c.route || "no route"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  testID={`move-up-${i}`}
                >
                  <ArrowUp size={18} color={i === 0 ? theme.colors.muted : theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  testID={`move-down-${i}`}
                >
                  <ArrowDown
                    size={18}
                    color={i === items.length - 1 ? theme.colors.muted : theme.colors.text}
                  />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => removeAt(i)}>
                  <Trash2 size={18} color={theme.colors.danger} />
                </TouchableOpacity>
              </View>

              <Field label="Title (admin label)">
                <TextInput
                  style={styles.input}
                  value={c.title}
                  onChangeText={(v) => updateAt(i, { title: v })}
                  placeholder="e.g. Daily Check-in"
                  placeholderTextColor={theme.colors.muted}
                />
              </Field>

              <Field label="Key (unique, no spaces)">
                <TextInput
                  style={styles.input}
                  value={c.key}
                  onChangeText={(v) => updateAt(i, { key: v.replace(/\s+/g, "_").toLowerCase() })}
                  placeholder="e.g. spin"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                />
              </Field>

              <Field label="Image URL (PNG/JPG)">
                <TextInput
                  style={styles.input}
                  value={c.image_url}
                  onChangeText={(v) => updateAt(i, { image_url: v.trim() })}
                  placeholder="https://…"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </Field>

              <Field label="Route (app destination)">
                <TextInput
                  style={styles.input}
                  value={c.route}
                  onChangeText={(v) => updateAt(i, { route: v.trim() })}
                  placeholder="/spin, /scratch, /quizzes…"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                />
              </Field>

              <View style={styles.switchRow}>
                <Star size={16} color={c.hero ? "#F59E0B" : theme.colors.muted} fill={c.hero ? "#F59E0B" : "transparent"} />
                <Text style={styles.switchLabel}>
                  {c.hero ? "Hero card (top 2-col row)" : "Grid card (3-col row)"}
                </Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={c.hero}
                  onValueChange={(v) => updateAt(i, { hero: v })}
                  testID={`hero-${i}`}
                />
              </View>

              <View style={styles.switchRow}>
                {c.hidden ? (
                  <EyeOff size={16} color={theme.colors.muted} />
                ) : (
                  <Eye size={16} color={theme.colors.success} />
                )}
                <Text style={styles.switchLabel}>
                  {c.hidden ? "Hidden from users" : "Visible to users"}
                </Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={!c.hidden}
                  onValueChange={(v) => updateAt(i, { hidden: !v })}
                  testID={`visible-${i}`}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addNew} testID="add-btn">
            <Plus size={18} color="#fff" />
            <Text style={styles.addTxt}>Add new card</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
  },
  title: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  saveTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  body: { padding: theme.spacing.lg, gap: 12 },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  stat: { alignItems: "center", flex: 1 },
  statVal: { color: theme.colors.text, fontWeight: "900", fontSize: 18 },
  statLbl: { color: theme.colors.muted, fontSize: 11, fontWeight: "700" },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  resetTxt: { color: theme.colors.danger, fontWeight: "800", fontSize: 12 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  thumbWrap: { position: "relative" },
  thumb: { width: 52, height: 52, borderRadius: 12, backgroundColor: theme.colors.bg },
  heroBadge: {
    position: "absolute",
    top: -4, right: -4,
    backgroundColor: "#F59E0B",
    width: 18, height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  cardTitle: { color: theme.colors.text, fontWeight: "800", fontSize: 14 },
  cardSub: { color: theme.colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
  fieldLabel: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  input: {
    backgroundColor: theme.colors.bg,
    borderRadius: theme.radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  switchLabel: { color: theme.colors.text, fontWeight: "700", fontSize: 13 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radii.lg,
  },
  addTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
