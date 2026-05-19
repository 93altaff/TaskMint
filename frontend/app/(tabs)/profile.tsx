import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  Linking, Switch, Alert, Modal, TextInput, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Bell, Send, MessageCircle, Briefcase,
  ShieldCheck, FileText, ChevronRight, Coins, ListTodo, Flame, Shield, X, Phone,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type Links = {
  telegram: string; telegram_contact: string; business_contact: string;
  customer_support: string; privacy_policy: string; terms: string;
};

export default function ProfileScreen() {
  const { user, refreshUser, adminLogin, adminLogout } = useAuth();
  const router = useRouter();
  const [links, setLinks] = useState<Links | null>(null);
  const [reminder, setReminder] = useState(true);
  const [adminModal, setAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const handleLongPress = () => {
    if (user?.is_admin) {
      // Instant demote — admin is logged out immediately without a confirm dialog.
      adminLogout().catch((e: any) => Alert.alert("Error", e?.message || "Failed to logout"));
    } else {
      setAdminModal(true);
    }
  };

  const loadLinks = useCallback(async () => {
    try {
      const l = await api<Links>("/links", { auth: false });
      setLinks(l);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => {
    refreshUser();
    loadLinks();
  }, [loadLinks, refreshUser]));

  const open = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Cannot open link"));
  };

  const doAdminLogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await adminLogin(adminEmail.trim().toLowerCase(), adminPassword);
      setAdminModal(false);
      setAdminEmail(""); setAdminPassword("");
      Alert.alert("Success", "You are now admin.");
      router.push("/admin");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Invalid credentials");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card — long-press the avatar to reveal hidden admin login */}
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={handleLongPress}
          delayLongPress={900}
          style={styles.card}
          testID="profile-card-longpress"
        >
          <Image
            source={{ uri: user?.picture || "https://images.unsplash.com/photo-1704726135027-9c6f034cfa41?w=200&q=80" }}
            style={styles.avatar}
          />
          <Text style={styles.name} numberOfLines={1} testID="profile-name">{user?.name}</Text>
          {!!(user as any)?.mobile_number && (
            <View style={styles.mobileRow} testID="profile-mobile">
              <Phone size={12} color={theme.colors.muted} />
              <Text style={styles.mobileText}>{(user as any).mobile_number}</Text>
            </View>
          )}
          {user?.is_admin && (
            <View style={styles.adminBadge}>
              <Shield size={12} color={theme.colors.primary} />
              <Text style={styles.adminBadgeText}>ADMIN</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Stat icon={<Coins size={18} color={theme.colors.primary} />} label="Total earned" value={String(user?.total_earned ?? 0)} />
          <Stat icon={<ListTodo size={18} color={theme.colors.primary} />} label="Tasks done" value={String(user?.total_tasks ?? 0)} />
          <Stat icon={<Flame size={18} color={theme.colors.danger} />} label="Streak" value={String(user?.streak ?? 0)} />
        </View>

        {/* Notifications */}
        <Section title="Notifications">
          <Row
            icon={<Bell size={18} color={theme.colors.primary} />}
            title="Daily check-in reminder"
            sub="Get a nudge every day at 9 AM"
            right={<Switch value={reminder} onValueChange={setReminder} testID="reminder-switch" />}
          />
        </Section>

        {/* Quick access — old style, text rows with subtitles */}
        <Section title="Quick Access">
          <Row icon={<Send size={18} color="#0088cc" />} title="Telegram Channel"
            onPress={() => open(links?.telegram)} testID="qa-telegram" />
          <Row icon={<MessageCircle size={18} color="#0088cc" />} title="Contact on Telegram"
            onPress={() => open(links?.telegram_contact)} testID="qa-telegram-contact" />
          <Row icon={<Briefcase size={18} color={theme.colors.primary} />} title="Contact for Business"
            onPress={() => open(links?.business_contact)} testID="qa-business" />
          <Row icon={<ShieldCheck size={18} color={theme.colors.primary} />} title="Privacy Policy"
            onPress={() => open(links?.privacy_policy)} testID="qa-privacy" />
          <Row icon={<FileText size={18} color={theme.colors.primary} />} title="Terms & Conditions"
            onPress={() => open(links?.terms)} testID="qa-terms" />
        </Section>

        {user?.is_admin && (
          <Section title="Admin">
            <Row
              icon={<Shield size={18} color={theme.colors.primary} />}
              title="Open Admin Panel"
              sub="Manage banners, campaigns, withdrawals"
              onPress={() => router.push("/admin")}
              testID="qa-admin"
            />
          </Section>
        )}

        {!user?.is_admin && (
          <TouchableOpacity
            style={styles.versionRow}
            onPress={async () => {
              try {
                const info = await api<{ play_store_url?: string }>("/version", { auth: false });
                const url = info?.play_store_url || "https://play.google.com/store/apps/details?id=com.taskmint.app";
                Linking.openURL(url).catch(() => Alert.alert("Cannot open Play Store"));
              } catch {
                Linking.openURL("https://play.google.com/store/apps/details?id=com.taskmint.app").catch(() => {});
              }
            }}
            onLongPress={handleLongPress}
            delayLongPress={650}
            testID="profile-version-btn"
          >
            <Text style={styles.versionText} testID="profile-version">
              {`v${require("../../app.json").expo.version}`}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={adminModal} transparent animationType="slide" onRequestClose={() => setAdminModal(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.overlay}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Admin Login</Text>
              <TouchableOpacity onPress={() => setAdminModal(false)} testID="close-admin-modal">
                <X size={22} color={theme.colors.muted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>Enter admin email and password.</Text>
            <TextInput
              value={adminEmail} onChangeText={setAdminEmail}
              placeholder="Email" placeholderTextColor={theme.colors.muted}
              autoCapitalize="none" keyboardType="email-address"
              style={styles.input} testID="admin-email"
            />
            <TextInput
              value={adminPassword} onChangeText={setAdminPassword}
              placeholder="Password" placeholderTextColor={theme.colors.muted}
              secureTextEntry style={styles.input} testID="admin-password"
            />
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={doAdminLogin}
              disabled={busy}
              testID="admin-login-submit"
            >
              <Text style={styles.loginBtnText}>{busy ? "Logging in..." : "Login"}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon, title, sub, right, onPress, testID,
}: {
  icon: React.ReactNode; title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void; testID?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={styles.row}
      testID={testID}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>}
      </View>
      {right || (onPress ? <ChevronRight size={18} color={theme.colors.muted} /> : null)}
    </TouchableOpacity>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: theme.spacing.lg, paddingBottom: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    alignItems: "center",
    borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  avatar: { width: 84, height: 84, borderRadius: 42, marginBottom: 12, backgroundColor: "#eee" },
  name: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  email: { fontSize: 13, color: theme.colors.muted, marginTop: 4 },
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginTop: 8,
  },
  adminBadgeText: { color: theme.colors.primary, fontWeight: "800", fontSize: 10, letterSpacing: 1 },
  mobileRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  mobileText: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: theme.spacing.md },
  stat: {
    flex: 1, minWidth: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg, padding: theme.spacing.md,
    alignItems: "center", borderWidth: 1, borderColor: theme.colors.border,
  },
  statIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  statValue: { fontSize: 18, fontWeight: "800", color: theme.colors.text },
  statLabel: { fontSize: 11, color: theme.colors.muted, marginTop: 2, fontWeight: "600", textAlign: "center" },
  section: { marginBottom: theme.spacing.md },
  sectionTitle: {
    fontSize: 13, fontWeight: "800", color: theme.colors.muted,
    letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8, marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  rowSub: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  iconGrid: {
    flexDirection: "row", flexWrap: "wrap", padding: 12, gap: 8,
    justifyContent: "space-between",
  },
  iconTile: {
    width: "31%",
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 8,
    backgroundColor: theme.colors.bg, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  iconTileIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  iconTileLabel: {
    fontSize: 12, fontWeight: "700", color: theme.colors.text,
  },
  adminBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, marginTop: theme.spacing.md,
  },
  adminBtnText: { color: theme.colors.muted, fontWeight: "700", fontSize: 13 },
  versionRow: { alignItems: "center", marginTop: 24, paddingVertical: 8 },
  versionText: { color: theme.colors.muted, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: theme.spacing.lg, paddingBottom: 40, gap: 12,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.text },
  sheetSub: { fontSize: 13, color: theme.colors.muted },
  input: {
    backgroundColor: theme.colors.bg, borderRadius: theme.radii.md,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: theme.colors.text,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  loginBtn: {
    backgroundColor: theme.colors.primary, paddingVertical: 14,
    borderRadius: theme.radii.lg, alignItems: "center", marginTop: 4,
  },
  loginBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
