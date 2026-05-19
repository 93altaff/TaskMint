import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  RefreshControl, useWindowDimensions, Alert, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import {
  ChevronRight, Coins, Check, X, Clock,
} from "lucide-react-native";
import { useAuth } from "../../src/context/AuthContext";
import { theme } from "../../src/lib/theme";
import { api } from "../../src/lib/api";

type Banner = { id: string; title: string; subtitle?: string; image_url: string; link_url?: string };
type Campaign = {
  id: string; name: string; note: string; logo_url: string;
  link_url?: string; reward_points: number; reward_inr: number;
};
type Completion = {
  id: string; campaign_id: string; status: "pending" | "approved" | "rejected";
  admin_note?: string;
};

export default function HomeScreen() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [bannerIndex, setBannerIndex] = useState(0);

  const load = useCallback(async () => {
    try {
      const [b, c, comps] = await Promise.all([
        api<Banner[]>("/banners", { auth: false }),
        api<Campaign[]>("/campaigns", { auth: false }),
        api<Completion[]>("/campaign-completions").catch(() => []),
      ]);
      setBanners(b);
      setCampaigns(c);
      setCompletions(comps);
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { refreshUser(); load(); }, [load, refreshUser]));

  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => {
      setBannerIndex((i) => {
        const next = (i + 1) % banners.length;
        scrollRef.current?.scrollTo({ x: next * (width - 48), animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [banners.length, width]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshUser()]);
    setRefreshing(false);
  };

  const openLink = (url?: string) => {
    if (!url) return;
    Linking.openURL(url).catch(() => Alert.alert("Cannot open link"));
  };

  const startCampaign = (c: Campaign) => {
    router.push(`/task/${c.id}` as any);
  };

  const points = user?.points ?? 0;
  const showFirstWithdrawCue = !user?.has_first_withdrawal && points >= 100;
  const completionMap = Object.fromEntries(completions.map((c) => [c.campaign_id, c]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.row}>
            <Image
              source={{ uri: user?.picture || "https://images.unsplash.com/photo-1704726135027-9c6f034cfa41?w=200&q=80" }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.hello}>Hello,</Text>
              <Text style={styles.name} testID="home-username">{user?.name?.split(" ")[0] || "User"}</Text>
            </View>
          </View>
          <View style={styles.balancePill}>
            <Coins size={14} color={theme.colors.secondary} />
            <Text style={styles.balancePillText}>{points} pts</Text>
          </View>
        </View>

        {banners.length > 0 && (
          <View style={styles.section}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              snapToInterval={width - 48}
              decelerationRate="fast"
              testID="banner-slider"
            >
              {banners.map((b) => (
                <TouchableOpacity
                  key={b.id}
                  activeOpacity={0.85}
                  onPress={() => openLink(b.link_url)}
                  disabled={!b.link_url}
                  style={[styles.bannerItem, { width: width - 48 }]}
                  testID={`banner-${b.id}`}
                >
                  <Image source={{ uri: b.image_url }} style={styles.bannerImg} />
                  <View style={styles.bannerOverlay} />
                  <View style={styles.bannerText}>
                    <Text style={styles.bannerTitle}>{b.title}</Text>
                    {!!b.subtitle && <Text style={styles.bannerSub}>{b.subtitle}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.dots}>
              {banners.map((_, i) => (
                <View key={i} style={[styles.dot, i === bannerIndex && styles.dotActive]} />
              ))}
            </View>
          </View>
        )}

        {/* Offerwall full list */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>High Paying Campaigns</Text>
          {[...campaigns].sort((a, b) => {
            const sa = completionMap[a.id]?.status; const sb = completionMap[b.id]?.status;
            // 0=pending, 1=incomplete (no completion), 2=approved, 3=rejected
            const rank = (s?: string) => {
              if (s === "pending") return 0;
              if (s === "approved") return 2;
              if (s === "rejected") return 3;
              return 1;
            };
            const r = rank(sa) - rank(sb);
            if (r !== 0) return r;
            // Within same status group, show newest tasks at the top.
            const ta = (a as any).created_at || "";
            const tb = (b as any).created_at || "";
            return tb.localeCompare(ta);
          }).map((c) => {
            const comp = completionMap[c.id];
            const status = comp?.status; // pending/approved/rejected/undefined
            const note = comp?.admin_note;
            const disabled = status === "pending" || status === "approved";
            const fade = !!status && status !== "rejected";
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.campaign, fade && styles.campaignFade]}
                activeOpacity={disabled ? 1 : 0.85}
                onPress={() => !disabled && startCampaign(c)}
                disabled={disabled}
                testID={`campaign-${c.id}`}
              >
                <Image source={{ uri: c.logo_url }} style={styles.campaignLogo} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.campaignName}>{c.name}</Text>
                  <Text style={styles.campaignNote} numberOfLines={2}>{c.note}</Text>
                  {status && <StatusChip status={status} />}
                  {status === "rejected" && !!note && (
                    <Text style={styles.reasonText} numberOfLines={3} testID={`campaign-${c.id}-reason`}>
                      Reason: {note}
                    </Text>
                  )}
                </View>
                <View style={styles.campaignReward}>
                  <Text style={styles.campaignInr}>₹{c.reward_inr}</Text>
                  <Text style={styles.campaignPts}>{c.reward_points} pts</Text>
                </View>
                {!disabled && <ChevronRight size={18} color={theme.colors.muted} />}
              </TouchableOpacity>
            );
          })}
          {campaigns.length === 0 && (
            <Text style={styles.empty}>No campaigns available right now.</Text>
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusChip({ status }: { status: "pending" | "approved" | "rejected" }) {
  const cfg = {
    pending: { c: "#B45309", bg: "rgba(255,193,7,0.18)", icon: <Clock size={12} color="#B45309" />, label: "Pending" },
    approved: { c: theme.colors.success, bg: "rgba(16,185,129,0.12)", icon: <Check size={12} color={theme.colors.success} />, label: "Task Completed" },
    rejected: { c: theme.colors.danger, bg: "rgba(255,107,107,0.12)", icon: <X size={12} color={theme.colors.danger} />, label: "Rejected" },
  }[status];
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      {cfg.icon}
      <Text style={[styles.chipText, { color: cfg.c }]}>{cfg.label}</Text>
    </View>
  );
}

function BentoCard({ hero, title, subtitle, icon, color, onPress, testID }: any) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      testID={testID}
      style={[
        styles.bentoCard,
        hero ? styles.bentoHero : styles.bentoHalf,
        hero && color ? { backgroundColor: color } : null,
      ]}
    >
      <View style={[styles.bentoIcon, hero ? styles.bentoIconHero : null]}>{icon}</View>
      <Text style={[styles.bentoTitle, hero ? { color: "#fff" } : null]}>{title}</Text>
      {!!subtitle && (
        <Text style={[styles.bentoSubtitle, hero ? { color: "rgba(255,255,255,0.85)" } : null]}>
          {subtitle}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { paddingBottom: 16 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#eee" },
  hello: { color: theme.colors.muted, fontSize: 12, fontWeight: "600" },
  name: { color: theme.colors.text, fontSize: 18, fontWeight: "800" },
  balancePill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
  },
  balancePillText: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },
  section: { paddingHorizontal: theme.spacing.lg, marginBottom: theme.spacing.lg },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.md },
  sectionTitle: {
    fontSize: 18, fontWeight: "800", color: theme.colors.text, marginBottom: theme.spacing.md,
  },
  viewAll: { color: theme.colors.primary, fontWeight: "800", fontSize: 13 },
  firstWithdrawCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    marginHorizontal: theme.spacing.lg,
    backgroundColor: "rgba(16,185,129,0.10)",
    padding: theme.spacing.md, borderRadius: theme.radii.lg,
    marginBottom: theme.spacing.md, borderWidth: 1, borderColor: "rgba(16,185,129,0.25)",
  },
  fwIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(16,185,129,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  fwTitle: { color: theme.colors.text, fontWeight: "800", fontSize: 14 },
  fwBody: { color: theme.colors.muted, fontSize: 12, marginTop: 2 },
  fwBtn: { backgroundColor: theme.colors.success, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999 },
  fwBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  bannerItem: { height: 140, borderRadius: theme.radii.xl, overflow: "hidden" },
  bannerImg: { width: "100%", height: "100%" },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.45)" },
  bannerText: { position: "absolute", left: 20, right: 20, bottom: 18 },
  bannerTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  bannerSub: { color: "rgba(255,255,255,0.9)", fontSize: 13, marginTop: 4, fontWeight: "500" },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.border },
  dotActive: { backgroundColor: theme.colors.primary, width: 18 },
  bento: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  bentoCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radii.xl,
    padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border,
    minHeight: 110, justifyContent: "space-between",
  },
  bentoHero: { width: "100%", minHeight: 130 },
  bentoHalf: { flex: 1, minWidth: 0 },
  bentoIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center", justifyContent: "center",
  },
  bentoIconHero: { backgroundColor: "rgba(255,255,255,0.18)" },
  bentoTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.text, marginTop: 12 },
  bentoSubtitle: { fontSize: 12, color: theme.colors.muted, marginTop: 4, fontWeight: "500" },
  campaign: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: theme.colors.surface, padding: theme.spacing.md,
    borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border,
    marginBottom: 10,
  },
  campaignFade: { opacity: 0.55 },
  campaignLogo: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#eee" },
  campaignName: { fontSize: 15, fontWeight: "700", color: theme.colors.text },
  campaignNote: { fontSize: 12, color: theme.colors.muted, marginTop: 2 },
  campaignReward: { alignItems: "flex-end", marginRight: 4 },
  campaignInr: { color: theme.colors.success, fontSize: 16, fontWeight: "800" },
  campaignPts: { color: theme.colors.muted, fontSize: 11, fontWeight: "600" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, marginTop: 4,
  },
  chipText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  reasonText: {
    color: theme.colors.danger, fontSize: 11, fontWeight: "700",
    marginTop: 6, lineHeight: 16,
    backgroundColor: "rgba(255,107,107,0.08)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  empty: { color: theme.colors.muted, textAlign: "center", paddingVertical: 24 },
});
