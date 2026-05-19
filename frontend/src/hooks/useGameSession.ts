import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Feature-detect localStorage instead of relying on Platform.OS so that any
// JS runtime exposing window.localStorage uses it directly (the AsyncStorage
// web driver is unreliable in this Expo SDK 54 build).
const hasLocalStorage =
  typeof window !== "undefined" &&
  typeof window.localStorage !== "undefined" &&
  window.localStorage !== null;

function kvGet(key: string): Promise<string | null> {
  if (hasLocalStorage) {
    try {
      return Promise.resolve(window.localStorage.getItem(key));
    } catch (e) {
      console.warn("[useGameSession] localStorage.getItem failed", key, e);
      return Promise.resolve(null);
    }
  }
  return AsyncStorage.getItem(key).catch((e) => {
    console.warn("[useGameSession] AsyncStorage.getItem failed", key, e);
    return null;
  });
}

function kvSet(key: string, value: string): void {
  if (hasLocalStorage) {
    try {
      window.localStorage.setItem(key, value);
      return;
    } catch (e) {
      console.warn("[useGameSession] localStorage.setItem failed", key, e);
      return;
    }
  }
  AsyncStorage.setItem(key, value).catch((e) => {
    console.warn("[useGameSession] AsyncStorage.setItem failed", key, e);
  });
}

function kvRemove(key: string): void {
  if (hasLocalStorage) {
    try {
      window.localStorage.removeItem(key);
      return;
    } catch {
      return;
    }
  }
  AsyncStorage.removeItem(key).catch(() => {});
}

/**
 * Shared "ad-gated chances" controller used by Tic-Tac-Toe (10),
 * Memory Match (5), Math Sprint (10) and Higher-Lower (10).
 *
 * State is persisted under `storageKey` so unused chances survive app
 * restarts. We persist synchronously inside grantChances/consume/reset so
 * there's no race with the auto-prompt effect.
 */
export type GameSession = {
  chancesLeft: number;
  totalPlays: number;
  hasUnlocked: boolean;
  shouldShowInterstitial: boolean;
  hydrated: boolean;
  grantChances: () => void;
  consume: () => void;
  acknowledgeInterstitial: () => void;
  reset: () => void;
};

type Persisted = {
  chancesLeft: number;
  totalPlays: number;
  hasUnlocked: boolean;
};

export function useGameSession(
  chancesPerAd: number,
  interstitialEvery: number = 0,
  storageKey?: string,
): GameSession {
  const [chancesLeft, setChancesLeft] = useState(0);
  const [totalPlays, setTotalPlays] = useState(0);
  const [hasUnlocked, setHasUnlocked] = useState(false);
  const [shouldShowInterstitial, setShouldShowInterstitial] = useState(false);
  const [hydrated, setHydrated] = useState(!storageKey);

  // Refs mirror the latest state for use inside grantChances / consume so we
  // can persist the next value synchronously without waiting for an effect.
  const chancesRef = useRef(0);
  const playsRef = useRef(0);
  const unlockedRef = useRef(false);

  // Hydrate once from storage on mount.
  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await kvGet(storageKey);
        if (!cancelled && raw) {
          const saved = JSON.parse(raw) as Persisted;
          if (typeof saved.chancesLeft === "number") {
            chancesRef.current = saved.chancesLeft;
            setChancesLeft(saved.chancesLeft);
          }
          if (typeof saved.totalPlays === "number") {
            playsRef.current = saved.totalPlays;
            setTotalPlays(saved.totalPlays);
          }
          if (typeof saved.hasUnlocked === "boolean") {
            unlockedRef.current = saved.hasUnlocked;
            setHasUnlocked(saved.hasUnlocked);
          }
        }
      } catch (e) {
        console.warn("[useGameSession] hydrate failed", storageKey, e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storageKey]);

  const persist = useCallback(() => {
    if (!storageKey) return;
    const payload: Persisted = {
      chancesLeft: chancesRef.current,
      totalPlays: playsRef.current,
      hasUnlocked: unlockedRef.current,
    };
    kvSet(storageKey, JSON.stringify(payload));
  }, [storageKey]);

  const grantChances = useCallback(() => {
    chancesRef.current = chancesPerAd;
    unlockedRef.current = true;
    setChancesLeft(chancesPerAd);
    setHasUnlocked(true);
    persist();
  }, [chancesPerAd, persist]);

  const consume = useCallback(() => {
    const nextChances = Math.max(0, chancesRef.current - 1);
    const nextPlays = playsRef.current + 1;
    chancesRef.current = nextChances;
    playsRef.current = nextPlays;
    setChancesLeft(nextChances);
    setTotalPlays(nextPlays);
    if (interstitialEvery > 0 && nextPlays % interstitialEvery === 0) {
      setShouldShowInterstitial(true);
    }
    persist();
  }, [interstitialEvery, persist]);

  const acknowledgeInterstitial = useCallback(() => {
    setShouldShowInterstitial(false);
  }, []);

  const reset = useCallback(() => {
    chancesRef.current = 0;
    playsRef.current = 0;
    unlockedRef.current = false;
    setChancesLeft(0);
    setTotalPlays(0);
    setHasUnlocked(false);
    setShouldShowInterstitial(false);
    if (storageKey) kvRemove(storageKey);
  }, [storageKey]);

  return {
    chancesLeft,
    totalPlays,
    hasUnlocked,
    shouldShowInterstitial,
    hydrated,
    grantChances,
    consume,
    acknowledgeInterstitial,
    reset,
  };
}
