import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { WifiOff } from "lucide-react-native";
import { theme } from "../lib/theme";

export default function NoInternetGate({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (online) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [online, pulse]);

  if (!online) {
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
    return (
      <View style={styles.wrap} testID="no-internet-screen">
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }], opacity }]}>
          <WifiOff size={64} color={theme.colors.danger} strokeWidth={2.4} />
        </Animated.View>
        <Text style={styles.title}>You're offline</Text>
        <Text style={styles.body}>
          Please check your internet connection to continue using TaskMint.
        </Text>
      </View>
    );
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
    padding: theme.spacing.lg,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,107,107,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  body: {
    fontSize: 14,
    color: theme.colors.muted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 22,
  },
});
