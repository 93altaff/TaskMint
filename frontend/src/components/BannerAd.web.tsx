import React from "react";

/**
 * Web has no AdMob — render absolutely nothing (matches native behaviour
 * when an ad fails to load or hasn't loaded yet).
 */
export default function BannerAd(_props: { testID?: string }) {
  return null;
}
