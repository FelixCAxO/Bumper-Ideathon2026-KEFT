import { useCallback, useEffect, useState } from "react";
import type { Alert } from "@/lib/alerts";
import { alertReadKey } from "@/hooks/use-read-alerts";

const STORAGE_KEY = "bumper:alert-comments";
const EVENT_NAME = "bumper:alert-comments-changed";

type CommentMap = Record<string, string>;

const loadAll = (): CommentMap => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as CommentMap) : {};
  } catch {
    return {};
  }
};

const persist = (map: CommentMap) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export function useAlertComments() {
  const [comments, setComments] = useState<CommentMap>(() => loadAll());

  useEffect(() => {
    setComments(loadAll());
    const handler = () => setComments(loadAll());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const getComment = useCallback(
    (alert: Alert) => comments[alertReadKey(alert)] ?? "",
    [comments],
  );

  const setComment = useCallback((alert: Alert, value: string) => {
    const map = loadAll();
    const key = alertReadKey(alert);
    if (value.trim()) {
      map[key] = value;
    } else {
      delete map[key];
    }
    persist(map);
    setComments(map);
  }, []);

  const commentedCount = Object.values(comments).filter((v) => v.trim().length > 0).length;

  return { getComment, setComment, commentedCount, comments };
}
