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
} from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import { renderProfileIcon } from "../../src/lib/profileIcons";

type Button = {
  id: string;
  title: string;
  icon: string;
  url: string;
  color: string;
  sort_order: number;
  hidden: boolean;
};

const ICON_HINTS = [
  "Send",
  "MessageCircle",
  "Briefcase",
  "ShieldCheck",
  "FileText",
  "Globe",
  "Mail",
  "Phone",
  "Link",
  "Youtube",
  "Instagram",
  "Twitter",
  "Star",
  "Gift",
  "HelpCircle",
  "Info",
  "Bell",
  "Heart",
  "Users",
  "Award",
];

export default function AdminProfileButtons() {
  const router = useRouter();
  const [items, setItems] = useState<Button[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ buttons: Button[] }>("/admin/profile-buttons")
      .then((r) => setItems(r.buttons || []))
      .catch((e) => toast.error("Error", { description: e?.message || "Failed to load" }))
      .finally(() => setLoading(false));
  }, []);

  const updateAt = (i: number, patch: Partial<Button>) => {
    setItems((arr) => arr.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const addNew = () => {
    setItems((arr) => [
      ...arr,
      {
        id: `pb_new_${Date.now()}`,
        title: "New Button",
        icon: "Link",
        url: "",
        color: "#4F46E5",
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
      // re-normalize sort_order
      return next.map((b, idx) => ({ ...b, sort_order: idx + 1 }));
    });
  };

  const save = async () => {
    // Validate
    for (const b of items) {
      if (!b.title.trim()) {
        toast.error("Title required", { description: "Every button needs a name." });
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        buttons: items.map((b, idx) => ({ ...b, sort_order: idx + 1 })),
      };
      const r = await api<{ buttons: Button[] }>("/admin/profile-buttons", {
        method: "PUT",
        body: payload,
      });
      setItems(r.buttons || []);
      toast.success("Saved", { description: "Profile buttons updated." });
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
          <Text style={styles.title}>Profile Buttons</Text>
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
            Customise the Quick Access section on the Profile tab. Add, rename,
            reorder or hide buttons. Icon names use the Lucide icon set (e.g.
            Send, Phone, Globe). URLs can be external links, internal
            routes (e.g. /refer), or tel:/mailto:/whatsapp: URIs.
          </Text>

          {items.map((b, i) => (
            <View key={b.id} style={styles.card} testID={`btn-row-${i}`}>
              <View style={styles.cardHead}>
                <View style={styles.iconPreview}>
                  {renderProfileIcon(b.icon, 22, b.color || theme.colors.primary)}
                </View>
                <Text style={styles.cardIdx}>#{i + 1}</Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                >
                  <ArrowUp size={18} color={i === 0 ? theme.colors.muted : theme.colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => move(i, 1)}
                  disabled={i === items.length - 1}
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

              <Field label="Title">
                <TextInput
                  style={styles.input}
                  value={b.title}
                  onChangeText={(v) => updateAt(i, { title: v })}
                  placeholder="e.g. Telegram Channel"
                  placeholderTextColor={theme.colors.muted}
                />
              </Field>

              <Field label="Icon (Lucide name)">
                <TextInput
                  style={styles.input}
                  value={b.icon}
                  onChangeText={(v) => updateAt(i, { icon: v })}
                  placeholder="e.g. Send, Phone, Globe"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 8 }}
                >
                  {ICON_HINTS.map((name) => (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.hintChip,
                        b.icon === name && styles.hintChipActive,
                      ]}
                      onPress={() => updateAt(i, { icon: name })}
                    >
                      {renderProfileIcon(
                        name,
                        14,
                        b.icon === name ? "#fff" : theme.colors.primary,
                      )}
                      <Text
                        style={[
                          styles.hintTxt,
                          b.icon === name && styles.hintTxtActive,
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </Field>

              <Field label="URL or route">
                <TextInput
                  style={styles.input}
                  value={b.url}
                  onChangeText={(v) => updateAt(i, { url: v })}
                  placeholder="https://… or /refer or tel:+91…"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </Field>

              <Field label="Icon colour (hex)">
                <TextInput
                  style={styles.input}
                  value={b.color}
                  onChangeText={(v) => updateAt(i, { color: v })}
                  placeholder="#4F46E5"
                  placeholderTextColor={theme.colors.muted}
                  autoCapitalize="none"
                />
              </Field>

              <View style={styles.switchRow}>
                {b.hidden ? (
                  <EyeOff size={16} color={theme.colors.muted} />
                ) : (
                  <Eye size={16} color={theme.colors.success} />
                )}
                <Text style={styles.switchLabel}>
                  {b.hidden ? "Hidden from users" : "Visible to users"}
                </Text>
                <View style={{ flex: 1 }} />
                <Switch
                  value={!b.hidden}
                  onValueChange={(v) => updateAt(i, { hidden: !v })}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addBtn} onPress={addNew} testID="add-btn">
            <Plus size={18} color="#fff" />
            <Text style={styles.addTxt}>Add new button</Text>
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
  body: { padding: theme.spacing.lg, gap: 14 },
  intro: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 },
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
    gap: 10,
    marginBottom: 6,
  },
  cardIdx: { color: theme.colors.muted, fontWeight: "800", fontSize: 12 },
  iconPreview: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtn: {
    width: 36,
    height: 36,
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
  hintChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hintChipActive: { backgroundColor: theme.colors.primary },
  hintTxt: { color: theme.colors.primary, fontWeight: "700", fontSize: 11 },
  hintTxtActive: { color: "#fff" },
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
