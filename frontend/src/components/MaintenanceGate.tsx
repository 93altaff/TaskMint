import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useSegments, usePathname, useRouter } from "expo-router";
import { Wrench, X, Shield } from "lucide-react-native";
import { theme } from "../lib/theme";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type MaintenanceMap = Record<string, { enabled?: boolean; note?: string }>;

let cached: { at: number; data: MaintenanceMap } = { at: 0, data: {} };
const TTL = 30 * 1000;

async function fetchMaintenance(): Promise<MaintenanceMap> {
  const now = Date.now();
  if (now - cached.at < TTL) return cached.data;
  try {
    const r = await api<{ maintenance: MaintenanceMap }>("/maintenance");
    cached = { at: now, data: r?.maintenance || {} };
  } catch {
    cached = { at: now, data: {} };
  }
  return cached.data;
}

/** Force-clear cache so admin sees the new state immediately after toggling. */
export function clearMaintenanceCache() {
  cached = { at: 0, data: {} };
}

export default function MaintenanceGate({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey?: string;
}) {
  const pathname = usePathname();
  const segments = useSegments();
  const router = useRouter();
  const { adminLogin, user } = useAuth();
  const [maintenance, setMaintenance] = useState<MaintenanceMap>(cached.data);
  const [ready, setReady] = useState(cached.at > 0);
  const [adminModal, setAdminModal] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMaintenance().then((m) => {
      if (!alive) return;
      setMaintenance(m);
      setReady(true);
    });
    return () => { alive = false; };
  }, [pathname]);

  // Admin bypasses every maintenance gate — once they sign in (e.g. via the
  // long-press escape) they need full access to disable it.
  if (user?.is_admin) return <>{children}</>;

  if (!ready) return <>{children}</>;

  const candidates: string[] = [];
  if (routeKey) candidates.push(routeKey);
  if (pathname) candidates.push(pathname);
  if (pathname?.includes("(tabs)")) {
    candidates.push(pathname.replace("/(tabs)", ""));
  }
  const lastSeg = segments[segments.length - 1];
  if (lastSeg) candidates.push(`/${lastSeg}`);

  const match = candidates
    .map((k) => maintenance[k])
    .find((entry) => entry && entry.enabled);

  if (!match) return <>{children}</>;

  const submitAdmin = async () => {
    if (!email.trim() || !pwd.trim()) {
      Alert.alert("Required", "Please enter both email and password.");
      return;
    }
    setBusy(true);
    try {
      await adminLogin(email.trim(), pwd);
      setAdminModal(false);
      setEmail(""); setPwd("");
      // Bypass cache so admin sees the new state next time.
      clearMaintenanceCache();
      // /admin/* routes are not gateable → safe destination.
      router.push("/admin/settings");
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || "Invalid admin credentials.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.center}>
        {/* Long-press the wrench (1s) to open the hidden admin login. */}
        <TouchableOpacity
          activeOpacity={0.85}
          delayLongPress={1000}
          onLongPress={() => setAdminModal(true)}
          testID="maintenance-admin-trigger"
        >
          <LinearGradient
            colors={["#4F46E5", "#7C3AED"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Wrench size={48} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        <Text style={styles.title}>Coming Soon</Text>
        <Text style={styles.body}>
          {match.note?.trim() ||
            "This feature is undergoing improvements. Please check back later — your earnings are safe."}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeTxt}>Under Maintenance</Text>
        </View>
        <Text style={styles.hint}>Tip: long-press the icon if you're an admin.</Text>
      </View>

      {/* Hidden admin escape */}
      <Modal visible={adminModal} transparent animationType="fade">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalWrap}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Shield size={22} color={theme.colors.primary} />
              <Text style={styles.modalTitle}>Admin login</Text>
              <TouchableOpacity onPress={() => setAdminModal(false)} testID="maintenance-admin-close">
                <X size={22} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Admin email"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
              testID="maintenance-admin-email"
            />
            <TextInput
              value={pwd}
              onChangeText={setPwd}
              placeholder="Password"
              placeholderTextColor={theme.colors.muted}
              secureTextEntry
              style={styles.input}
              testID="maintenance-admin-password"
            />
            <TouchableOpacity
              style={[styles.submitBtn, busy && { opacity: 0.7 }]}
              onPress={submitAdmin}
              disabled={busy}
              testID="maintenance-admin-submit"
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitTxt}>Sign in & open Admin</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg, gap: 18 },
  iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800", color: theme.colors.text, letterSpacing: -0.5 },
  body: { fontSize: 14, color: theme.colors.muted, textAlign: "center", lineHeight: 21, maxWidth: 340 },
  badge: { backgroundColor: "rgba(99,102,241,0.12)", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.primary },
  badgeTxt: { color: theme.colors.primary, fontWeight: "800", fontSize: 12, letterSpacing: 0.8, textTransform: "uppercase" },
  hint: { color: theme.colors.muted, fontSize: 11, marginTop: 8, opacity: 0.7 },

  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: theme.spacing.lg },
  modalCard: { backgroundColor: theme.colors.surface, width: "100%", maxWidth: 360, borderRadius: theme.radii.xl, padding: theme.spacing.lg, gap: 12 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: theme.colors.text },
  input: { backgroundColor: theme.colors.bg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, color: theme.colors.text, fontSize: 14 },
  submitBtn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radii.lg, alignItems: "center", marginTop: 4 },
  submitTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
