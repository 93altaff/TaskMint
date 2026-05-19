import React, { useState } from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";
import { getAdUnitId } from "../lib/adConfig";

// Conditionally require the native module only on Android/iOS.
let RNBannerAd: any = null;
let BannerAdSize: any = null;
let TestIds: any = null;
try {
  if (Platform.OS !== "web") {
    const mod = require("react-native-google-mobile-ads");
    RNBannerAd = mod.BannerAd;
    BannerAdSize = mod.BannerAdSize;
    TestIds = mod.TestIds;
  }
} catch {}

/**
 * Native-style ad placement (300x250 medium rectangle). Used inline on
 * earning task screens (Spin, Scratch, Visit, Watch, Surveys, Quizzes).
 * The release build pulls the unit ID from the admin-controlled AdMob
 * settings on the backend. On web/Expo Go (or when the real ad fails
 * to load) we render a styled placeholder so the layout never breaks.
 */
export default function NativeAd({ testID = "native-ad" }: { testID?: string }) {
  const [failed, setFailed] = useState(false);

  if (!RNBannerAd || failed) {
    return (
      <View style={styles.wrap} testID={testID}>
        <Text style={styles.label}>SPONSORED</Text>
        <Text style={styles.title}>TaskMint partners</Text>
        <Text style={styles.sub}>Support us by checking back later</Text>
      </View>
    );
  }

  const unitId = __DEV__ ? TestIds.BANNER : getAdUnitId("native");

  return (
    <View style={styles.native} testID={testID}>
      <RNBannerAd
        unitId={unitId}
        size={BannerAdSize.MEDIUM_RECTANGLE}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={(e: any) => {
          console.log("[NativeAd] failed:", e?.message || e);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 200,
    alignSelf: "stretch",
    width: "100%",
    marginVertical: theme.spacing.md,
    backgroundColor: "#EEF1F6",
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  native: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: theme.spacing.md,
  },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: theme.colors.muted },
  title: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  sub: { fontSize: 11, color: "#9CA3AF" },
});
