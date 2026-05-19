import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Image, Alert,
  KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, Plus, Trash2, Pencil, Eye, EyeOff, Pin, PinOff, X } from "lucide-react-native";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";
import ImagePickerField from "../../src/components/ImagePickerField";

type Banner = {
  id: string; title: string; subtitle: string; image_url: string; link_url: string;
  active: boolean; hidden?: boolean; pinned?: boolean;
};

export default function AdminBanners() {
  const router = useRouter();
  const [items, setItems] = useState<Banner[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");

  const load = useCallback(async () => {
    try {
      const it = await api<Banner[]>("/admin/banners");
      setItems(it);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setEditId(null); setTitle(""); setSubtitle(""); setImage(""); setLink("");
  };

  const save = async () => {
    if (!title || !image) {
      Alert.alert("Required", "Title and image URL required");
      return;
    }
    try {
      if (editId) {
        const orig = items.find((i) => i.id === editId);
        await api(`/admin/banners/${editId}`, {
          method: "PUT",
          body: {
            title, subtitle, image_url: image, link_url: link,
            active: orig?.active ?? true,
            hidden: orig?.hidden ?? false,
            pinned: orig?.pinned ?? false,
          },
        });
      } else {
        await api("/admin/banners", {
          method: "POST",
          body: { title, subtitle, image_url: image, link_url: link, active: true },
        });
      }
      resetForm();
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const startEdit = (b: Banner) => {
    setEditId(b.id);
    setTitle(b.title);
    setSubtitle(b.subtitle || "");
    setImage(b.image_url);
    setLink(b.link_url || "");
  };

  const toggle = async (b: Banner, field: "hidden" | "pinned") => {
    try {
      await api(`/admin/banners/${b.id}`, {
        method: "PUT",
        body: {
          title: b.title, subtitle: b.subtitle || "", image_url: b.image_url,
          link_url: b.link_url || "", active: b.active ?? true,
          hidden: field === "hidden" ? !(b.hidden ?? false) : (b.hidden ?? false),
          pinned: field === "pinned" ? !(b.pinned ?? false) : (b.pinned ?? false),
        },
      });
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  const del = async (id: string) => {
    try { await api(`/admin/banners/${id}`, { method: "DELETE" }); load(); } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} testID="back-btn">
            <ChevronLeft size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Banners</Text>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: 12 }}>
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{editId ? "Edit Banner" : "Add Banner"}</Text>
              {editId && (
                <TouchableOpacity onPress={resetForm} testID="banner-cancel-edit">
                  <X size={18} color={theme.colors.muted} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput value={title} onChangeText={setTitle} placeholder="Title"
              placeholderTextColor={theme.colors.muted} style={styles.input} testID="banner-title" />
            <TextInput value={subtitle} onChangeText={setSubtitle} placeholder="Subtitle"
              placeholderTextColor={theme.colors.muted} style={styles.input} testID="banner-subtitle" />
            <ImagePickerField value={image} onChange={setImage} label="Banner Image" testID="banner-image" />
            <TextInput value={link} onChangeText={setLink} placeholder="Link URL (opens on tap)"
              placeholderTextColor={theme.colors.muted} style={styles.input} autoCapitalize="none"
              testID="banner-link" />
            <TouchableOpacity style={styles.cta} onPress={save} testID="banner-save">
              {editId ? <Pencil size={18} color="#fff" /> : <Plus size={18} color="#fff" />}
              <Text style={styles.ctaText}>{editId ? "Save Changes" : "Add Banner"}</Text>
            </TouchableOpacity>
          </View>

          {items.map((b) => (
            <View key={b.id} style={[styles.item, b.hidden && { opacity: 0.55 }]} testID={`banner-${b.id}`}>
              <Image source={{ uri: b.image_url }} style={styles.thumb} />
              <View style={{ flex: 1 }}>
                <View style={styles.titleRow}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{b.title}</Text>
                  {b.pinned && <Text style={styles.badge}>PINNED</Text>}
                  {b.hidden && <Text style={[styles.badge, styles.badgeHidden]}>HIDDEN</Text>}
                </View>
                {!!b.subtitle && <Text style={styles.itemSub} numberOfLines={2}>{b.subtitle}</Text>}
                <View style={styles.actionRow}>
                  <TouchableOpacity onPress={() => startEdit(b)} style={styles.iconBtn} testID={`banner-edit-${b.id}`}>
                    <Pencil size={16} color={theme.colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggle(b, "pinned")} style={styles.iconBtn} testID={`banner-pin-${b.id}`}>
                    {b.pinned ? <PinOff size={16} color={theme.colors.secondary} /> : <Pin size={16} color={theme.colors.muted} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggle(b, "hidden")} style={styles.iconBtn} testID={`banner-hide-${b.id}`}>
                    {b.hidden ? <Eye size={16} color={theme.colors.success} /> : <EyeOff size={16} color={theme.colors.muted} />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => del(b.id)} style={styles.iconBtn} testID={`banner-del-${b.id}`}>
                    <Trash2 size={16} color={theme.colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          {items.length === 0 && <Text style={styles.empty}>No banners yet.</Text>}
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
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  formTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  input: {
    backgroundColor: theme.colors.bg, borderRadius: theme.radii.md,
    paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: theme.colors.text,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radii.md,
  },
  ctaText: { color: "#fff", fontWeight: "800" },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
  },
  thumb: { width: 60, height: 60, borderRadius: 10, backgroundColor: "#eee" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  itemTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text },
  itemSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  badge: {
    fontSize: 9, fontWeight: "900", color: theme.colors.secondary,
    backgroundColor: theme.colors.bg, paddingHorizontal: 5, paddingVertical: 2,
    borderRadius: 4, letterSpacing: 0.5,
  },
  badgeHidden: { color: theme.colors.danger },
  actionRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  iconBtn: {
    padding: 6, borderRadius: 6, backgroundColor: theme.colors.bg,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  empty: { color: theme.colors.muted, textAlign: "center", padding: 24 },
});
