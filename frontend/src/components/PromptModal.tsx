import React, { useEffect, useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, KeyboardTypeOptions,
} from "react-native";
import { theme } from "../lib/theme";

type Props = {
  visible: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  keyboardType?: KeyboardTypeOptions;
  onCancel: () => void;
  onConfirm: (value: string) => void;
};

/**
 * A cross-platform replacement for window.prompt() that works in React Native (iOS/Android)
 * and on the web. Renders a centered modal with a single-line input + Cancel / Confirm.
 */
export default function PromptModal({
  visible, title, placeholder, initialValue = "",
  confirmLabel = "Submit", cancelLabel = "Cancel", destructive = false,
  keyboardType,
  onCancel, onConfirm,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const isNumeric = keyboardType === "number-pad" || keyboardType === "numeric" || keyboardType === "decimal-pad" || keyboardType === "phone-pad" || keyboardType === "number-pad";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.backdrop}
      >
        <View style={styles.card} testID="prompt-modal">
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={theme.colors.muted}
            keyboardType={keyboardType}
            style={[styles.input, isNumeric && { minHeight: 44, textAlignVertical: "center" }]}
            autoFocus
            multiline={!isNumeric}
            testID="prompt-input"
          />
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onCancel}
              testID="prompt-cancel"
              activeOpacity={0.85}
            >
              <Text style={styles.btnGhostText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, destructive ? styles.btnDanger : styles.btnPrimary]}
              onPress={() => onConfirm(value)}
              testID="prompt-confirm"
              activeOpacity={0.85}
            >
              <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center", padding: 24,
  },
  card: {
    backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 14,
  },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  input: {
    minHeight: 60, maxHeight: 140,
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    color: theme.colors.text, fontSize: 14, backgroundColor: theme.colors.bg,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  btn: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  btnGhost: { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border },
  btnGhostText: { color: theme.colors.text, fontWeight: "800", fontSize: 13 },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnDanger: { backgroundColor: theme.colors.danger },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
