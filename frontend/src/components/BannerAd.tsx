import React, { useState } from "react";
import { Platform, View, Text, StyleSheet } from "react-native";
import { theme } from "../lib/theme";
import { getAdUnitId } from "../lib/adConfig";

// Conditionally require the native module only on Android/iOS.
// On web / Expo Go (without this native module) require() would throw.
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
 * Fixed-height banner ad. Uses Google's test banner ID in __DEV__ builds so
 * it always shows a live "Test Ad" during development. In release builds it
 * uses the admin-configurable AdMob unit pulled from the backend. If the ad
 * fails to load (no fill, unit still activating, etc.) we render a styled
 * placeholder so users never see an empty rectangle.
 */
export default function BannerAd({ testID = "banner-ad" }: { testID?: string }) {
  const [failed, setFailed] = useState(false);

  // On web (preview) or if the native module failed to load (e.g. running in
  // Expo Go), render a light placeholder instead of crashing.
  if (!RNBannerAd || failed) {
    return (
      <View style={styles.wrap} testID={testID}>
        <Text style={styles.label}>ADVERTISEMENT</Text>
        <Text style={styles.sub}>Sponsored by TaskMint partners</Text>
      </View>
    );
  }

  const unitId = __DEV__ ? TestIds.BANNER : getAdUnitId("banner");

  return (
    <View style={styles.native} testID={testID}>
      <RNBannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdFailedToLoad={(e: any) => {
          console.log("[BannerAd] failed:", e?.message || e);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 60,
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    backgroundColor: "#EEF1F6",
    borderRadius: theme.radii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  native: { alignItems: "center", justifyContent: "center", marginVertical: 4 },
  label: { fontSize: 11, fontWeight: "800", letterSpacing: 1.4, color: theme.colors.muted },
  sub: { fontSize: 10, color: "#9CA3AF", marginTop: 2 },
});
