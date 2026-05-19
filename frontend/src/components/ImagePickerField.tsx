import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Upload, RefreshCw } from "lucide-react-native";
import { theme } from "../lib/theme";
import { api } from "../lib/api";

export default function ImagePickerField({
  value, onChange, label = "Image", testID = "img-picker",
}: { value: string; onChange: (url: string) => void; label?: string; testID?: string }) {
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted && Platform.OS !== "web") {
        Alert.alert("Permission required", "Allow photo access to upload images.");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.6,
        base64: true,
        allowsEditing: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const dataUrl = a.base64
        ? `data:image/jpeg;base64,${a.base64}`
        : a.uri;
      setBusy(true);
      const out = await api<{ url: string }>("/admin/upload-image", {
        method: "POST",
        body: { data_url: dataUrl },
      });
      onChange(out.url);
    } catch (e: any) {
      Alert.alert("Upload failed", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.btn} onPress={pick} disabled={busy} testID={testID}>
        {value ? (
          <>
            <Image source={{ uri: value }} style={styles.preview} />
            <View style={styles.overlay}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.overlayText}>{busy ? "Uploading..." : "Replace"}</Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholder}>
            <Upload size={22} color={theme.colors.primary} />
            <Text style={styles.placeholderText}>{busy ? "Uploading..." : "Tap to upload"}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: "700" },
  btn: { borderRadius: theme.radii.md, overflow: "hidden" },
  placeholder: {
    height: 100, borderRadius: theme.radii.md,
    backgroundColor: theme.colors.bg,
    borderWidth: 2, borderColor: theme.colors.primary, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  placeholderText: { color: theme.colors.primary, fontWeight: "700" },
  preview: { width: "100%", height: 140, backgroundColor: "#eee" },
  overlay: {
    position: "absolute", bottom: 8, right: 8,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999,
  },
  overlayText: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
