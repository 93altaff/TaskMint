import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Image, Animated, Easing, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Download } from "lucide-react-native";
import { theme } from "../lib/theme";

type Props = {
  latestVersion: string;
  releaseNotes?: string;
  playStoreUrl: string;
  forceUpdate: boolean;
  onDismiss?: () => void;
};

export default function UpdateGate({
  latestVersion, releaseNotes, playStoreUrl, forceUpdate, onDismiss,
}: Props) {
  const [pulse] = useState(new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <SafeAreaView style={styles.safe} testID="update-gate">
      <View style={styles.body}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.icon}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={styles.title}>New version available</Text>
        <Text style={styles.body2}>
          Please update TaskMint to {`v${latestVersion}`} from the Play Store to continue using the app.
        </Text>
        {!!releaseNotes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesTitle}>What's new</Text>
            <Text style={styles.notesBody}>{releaseNotes}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.btn}
          onPress={() => Linking.openURL(playStoreUrl)}
          testID="update-btn"
        >
          <Download size={18} color="#fff" />
          <Text style={styles.btnText}>Update on {Platform.OS === "ios" ? "App Store" : "Play Store"}</Text>
        </TouchableOpacity>
        {!forceUpdate && (
          <TouchableOpacity onPress={onDismiss} style={styles.skipBtn} testID="update-skip">
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, gap: 16 },
  iconWrap: {
    width: 140, height: 140, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 8,
  },
  icon: { width: 110, height: 110 },
  title: { fontSize: 26, fontWeight: "800", color: theme.colors.text, textAlign: "center" },
  body2: { fontSize: 14, color: theme.colors.muted, textAlign: "center", lineHeight: 22, paddingHorizontal: 12 },
  notesBox: {
    width: "100%", backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg, padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border, marginTop: 8,
  },
  notesTitle: { fontSize: 12, fontWeight: "800", color: theme.colors.muted, letterSpacing: 1.2, marginBottom: 6 },
  notesBody: { fontSize: 13, color: theme.colors.text, lineHeight: 20 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16, paddingHorizontal: 24,
    borderRadius: theme.radii.lg,
    marginTop: theme.spacing.md, minWidth: 240,
  },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  skipBtn: { marginTop: 8, paddingVertical: 8 },
  skipText: { color: theme.colors.muted, fontSize: 13, fontWeight: "700" },
});
