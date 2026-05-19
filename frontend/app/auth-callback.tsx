import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { theme } from "../src/lib/theme";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

export default function AuthCallback() {
  const router = useRouter();
  const processed = useRef(false);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    // OAuth callback only happens via the web browser flow.
    // On native (iOS/Android), there is no window.location, so just route to login.
    if (Platform.OS !== "web") {
      router.replace("/login");
      return;
    }

    // Web fallback: anonymous device login flow does not need session_id exchange.
    // If we ever reach this page on web (e.g. external redirect), just send the user
    // to /login where the device-based "Continue" button will sign them in.
    router.replace("/login");
  }, [router]);

  return (
    <View style={styles.wrap} testID="auth-callback-screen">
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.text}>{error || "Signing you in..."}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    gap: 16,
  },
  text: { color: theme.colors.muted, fontSize: 14 },
});
