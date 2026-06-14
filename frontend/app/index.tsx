import React, { useEffect } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { theme } from "../src/lib/theme";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)/home");
    else router.replace("/login");
  }, [loading, user, router]);

  // Plain background while auth hydrates. Redirect fires from the effect above.
  return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;
}
