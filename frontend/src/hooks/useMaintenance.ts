import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api } from "../lib/api";

type MaintEntry = { enabled: boolean; note?: string };
type MaintMap = Record<string, MaintEntry>;

/**
 * Polls /api/maintenance on mount and on screen focus and returns the maintenance
 * entry for the given route key (e.g. "/quizzes"). Admin toggles in /admin/settings
 * flip `enabled` to true and attach an optional note.
 */
export function useMaintenance(routeKey: string) {
  const [entry, setEntry] = useState<MaintEntry>({ enabled: false, note: "" });
  const [loaded, setLoaded] = useState(false);

  const fetchOnce = useCallback(async () => {
    try {
      const res = await api<{ maintenance: MaintMap }>("/maintenance");
      const m = res?.maintenance?.[routeKey];
      setEntry(m ? { enabled: !!m.enabled, note: m.note || "" } : { enabled: false, note: "" });
    } catch {
      setEntry({ enabled: false, note: "" });
    } finally {
      setLoaded(true);
    }
  }, [routeKey]);

  useEffect(() => { fetchOnce(); }, [fetchOnce]);
  useFocusEffect(useCallback(() => { fetchOnce(); }, [fetchOnce]));

  return { ...entry, loaded };
}
