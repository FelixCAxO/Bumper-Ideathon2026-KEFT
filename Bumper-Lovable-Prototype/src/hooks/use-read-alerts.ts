import { useCallback, useEffect, useState } from "react";
import type { Alert } from "@/lib/alerts";

const STORAGE_KEY = "bumper:read-alert-ids";
const EVENT_NAME = "bumper:read-alerts-changed";

export const alertReadKey = (alert: Alert): string =>
  alert.publicId ?? `${alert.childId ?? alert.child}:${String(alert.id)}`;

const loadReadIds = (): Set<string> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
};

const persistReadIds = (ids: Set<string>) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export function useReadAlerts() {
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setReadIds(loadReadIds());
    const handler = () => setReadIds(loadReadIds());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const markRead = useCallback((alerts: Alert[]) => {
    const next = new Set(loadReadIds());
    for (const alert of alerts) next.add(alertReadKey(alert));
    persistReadIds(next);
    setReadIds(next);
  }, []);

  const isRead = useCallback((alert: Alert) => readIds.has(alertReadKey(alert)), [readIds]);

  return { readIds, isRead, markRead };
}
