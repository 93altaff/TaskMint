import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Sparkles, Gift, Coins } from "lucide-react-native";
import { theme } from "../src/lib/theme";
import { useAuth } from "../src/context/AuthContext";
import HomeSkeleton from "../src/components/HomeSkeleton";

const LOGIN_LOGO =
  "https://customer-assets.emergentagent.com/job_mint-tasks-sync/artifacts/ra7gbxi5_file_000000003c3471faa8561013c559c221.png";
const LOGIN_HERO =
  "https://customer-assets.emergentagent.com/job_mint-tasks-sync/artifacts/pnm3c2nn_photo-1671749999622-4087a86868cc.jpeg";

export default function Login() {
  const router = useRouter();
  const { deviceLogin } = useAuth();
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deviceLogin();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Could not sign in", e?.message || "Try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {busy ? (
        <HomeSkeleton />
      ) : (
      <View style={styles.wrap} testID="login-screen">
        <View style={styles.brandWrap}>
          <View style={styles.logoCircle}>
            <Image
              source={{ uri: LOGIN_LOGO }}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.brand}>TaskMint</Text>
          <Text style={styles.tag}>Earn rewards. Get paid. Anytime.</Text>
        </View>

        <View style={styles.heroCard}>
          <Image
            source={{ uri: LOGIN_HERO }}
            style={styles.heroImg}
            resizeMode="cover"
          />
          <View style={styles.benefits}>
            <Benefit icon={<Gift size={18} color={theme.colors.primary} />} text="High paying Tasks" />
            <Benefit icon={<Sparkles size={18} color={theme.colors.primary} />} text="Multiple Earning ways" />
            <Benefit icon={<Coins size={18} color={theme.colors.primary} />} text="Withdraw to UPI Or Bank" />
          </View>
        </View>

        <TouchableOpacity
          style={styles.continueBtn}
          onPress={onContinue}
          disabled={busy}
          testID="login-continue-btn"
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.continueText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.legal}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
      )}
    </SafeAreaView>
  );
}

function Benefit({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>{icon}</View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: {
    flex: 1, padding: theme.spacing.lg, justifyContent: "center", gap: theme.spacing.lg,
  },
  brandWrap: { alignItems: "center", gap: theme.spacing.sm },
  logoCircle: {
    width: 120, height: 120, maxWidth: "30%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
  },
  logoImg: { width: "100%", height: "100%" },
  brand: { fontSize: 34, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  tag: { fontSize: 14, color: theme.colors.muted, fontWeight: "500" },
  heroCard: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
  },
  heroImg: {
    width: "100%", height: 180, borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.md, backgroundColor: "#ddd",
  },
  benefits: { gap: 14, paddingVertical: 8 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  benefitIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  benefitText: { fontSize: 16, color: theme.colors.text, fontWeight: "700" },
  continueBtn: {
    height: 64, borderRadius: theme.radii.pill,
    backgroundColor: "#0F1729", alignItems: "center", justifyContent: "center",
  },
  continueText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  legal: { textAlign: "center", color: theme.colors.muted, fontSize: 12, marginTop: -4 },
});
