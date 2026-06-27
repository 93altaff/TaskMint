import React, { useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
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
 * Adaptive banner ad.
 *
 * Behaviour rules (per product spec):
 *   • While the ad is loading → render nothing (no placeholder, no reserved height).
 *   • If the ad fails to load → render nothing.
 *   • On web / Expo Go (no native module) → render nothing.
 *   • Only when the ad successfully loads do we reveal the banner.
 *
 * The native `<BannerAd />` is always mounted on supported platforms (it has
 * to be in order to fire the load callbacks), but it stays at zero size until
 * `onAdLoaded` fires.
 */
export default function BannerAd({ testID = "banner-ad" }: { testID?: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // No banner support at all → render nothing
  if (!RNBannerAd) return null;

  // Ad permanently failed for this mount → render nothing
  if (failed) return null;

  const unitId = __DEV__ ? TestIds.BANNER : getAdUnitId("banner");
  const visible = loaded;

  return (
    <View
      style={visible ? styles.visible : styles.hidden}
      pointerEvents={visible ? "auto" : "none"}
      testID={testID}
    >
      <RNBannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: false }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(e: any) => {
          console.log("[BannerAd] failed:", e?.message || e);
          setFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  visible: { alignItems: "center", justifyContent: "center", marginVertical: 4 },
  // Keep the native view mounted (so load callbacks can fire) but make it
  // take zero layout space and stay invisible until the ad actually loads.
  hidden: { width: 0, height: 0, opacity: 0, overflow: "hidden" },
});
