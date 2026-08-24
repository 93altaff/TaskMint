import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";

const { width } = Dimensions.get("window");

/**
 * Branded loading splash shown after the native splash hides and before the
 * first route renders. Removes the "white flash" between splash and home.
 *
 * Design: indigo background matching native splash (#4F46E5), centred logo,
 * app name, tagline and spinner. Mirrors the native splash styling so the
 * transition feels seamless.
 */
export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) router.replace("/(tabs)/home");
    else router.replace("/login");
  }, [loading, user, router]);

  return (
    <View style={styles.root}>
      <View style={styles.center}>
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.appName}>TaskMint</Text>
        <Text style={styles.tagline}>Earn rewards for everyday tasks</Text>
        <View style={styles.spinnerWrap}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {`Made with care · v${require("../app.json").expo.version}`}
        </Text>
      </View>
    </View>
  );
}

const LOGO_SIZE = Math.min(120, width * 0.28);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrap: {
    width: LOGO_SIZE + 24,
    height: LOGO_SIZE + 24,
    borderRadius: (LOGO_SIZE + 24) / 2,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 36,
  },
  spinnerWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
  },
  footer: {
    position: "absolute",
    bottom: 32,
    alignItems: "center",
  },
  footerText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: "500",
  },
});
