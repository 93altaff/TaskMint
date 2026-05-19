import React, { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { theme } from "../src/lib/theme";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    // Device login happens automatically in AuthProvider.
    // If we still don't have a user, show the first-launch "Continue" screen.
    if (user) router.replace("/(tabs)/home");
    else router.replace("/login");
  }, [loading, user, router]);

  return (
    <View style={styles.wrap}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
});
