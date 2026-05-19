import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

export type AdSlot = "banner" | "interstitial" | "rewarded" | "native";

export type AdMobSettings = {
  android_app_id: string;
  banner_unit_id: string;
  interstitial_unit_id: string;
  rewarded_unit_id: string;
  native_unit_id: string;
};

const STORAGE_KEY = "tm_admob_settings_v1";

// Sensible defaults — also used as the production fallback if the
// backend is unreachable on first launch.
export const DEFAULT_AD_SETTINGS: AdMobSettings = {
  android_app_id: "ca-app-pub-7744865309171344~1346257321",
  banner_unit_id: "ca-app-pub-7744865309171344/7215240687",
  interstitial_unit_id: "ca-app-pub-7744865309171344/9409414321",
  rewarded_unit_id: "ca-app-pub-7744865309171344/8895153865",
  native_unit_id: "ca-app-pub-7744865309171344/5951555040",
};

let current: AdMobSettings = { ...DEFAULT_AD_SETTINGS };

// Synchronously read whatever is cached in memory. Used by the ad
// components at render time so they never block on a network call.
export function getAdUnitId(slot: AdSlot): string {
  switch (slot) {
    case "banner": return current.banner_unit_id;
    case "interstitial": return current.interstitial_unit_id;
    case "rewarded": return current.rewarded_unit_id;
    case "native": return current.native_unit_id;
  }
}

export function getAdSettings(): AdMobSettings {
  return current;
}

// Hydrate from AsyncStorage cache (instant) then refresh from backend.
export async function loadAdSettings(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEY);
    if (cached) {
      current = { ...DEFAULT_AD_SETTINGS, ...JSON.parse(cached) };
    }
  } catch {}
  try {
    const fresh = await api<AdMobSettings>("/admob-settings", { auth: false });
    current = { ...DEFAULT_AD_SETTINGS, ...fresh };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {}
}
