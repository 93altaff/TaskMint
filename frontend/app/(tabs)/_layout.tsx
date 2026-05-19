import React, { useEffect } from "react";
import { Tabs, useRouter } from "expo-router";
import { Home, Wallet, User, Coins } from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BannerAd from "../../src/components/BannerAd";

const TAB_ICONS: Record<string, any> = {
  home: Home, earn: Coins, wallet: Wallet, profile: User,
};
const TAB_LABELS: Record<string, string> = {
  home: "Home", earn: "Earn", wallet: "Wallet", profile: "Profile",
};

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.barWrap, { paddingBottom: insets.bottom }]} testID="tab-bar-with-ad">
      <BannerAd testID="tabs-banner-ad" />
      <View style={styles.row}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const Icon = TAB_ICONS[route.name] || Home;
          const color = focused ? theme.colors.primary : theme.colors.muted;
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress", target: route.key, canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="button"
              testID={`tab-${route.name}`}
            >
              <Icon size={22} color={color} />
              <Text style={[styles.label, { color }]}>{TAB_LABELS[route.name] || route.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="home" />
      <Tabs.Screen name="earn" />
      <Tabs.Screen name="wallet" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: theme.colors.border,
  },
  row: {
    flexDirection: "row", height: 64,
    paddingTop: 6,
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 4,
  },
  label: { fontSize: 11, fontWeight: "700" },
});
