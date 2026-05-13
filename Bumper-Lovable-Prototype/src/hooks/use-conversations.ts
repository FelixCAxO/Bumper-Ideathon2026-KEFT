import { useCallback, useEffect, useState } from "react";
import type { Alert } from "@/lib/alerts";
import { alertReadKey } from "@/hooks/use-read-alerts";
import { parentFacingAlertTitle } from "@/lib/alert-display";

const STORAGE_KEY = "bumper:conversations";
const EVENT_NAME = "bumper:conversations-changed";

export type ConversationMessage = {
  id: string;
  role: "parent" | "child";
  text: string;
  ts: string;
};

export type Conversation = {
  id: string;
  alertKey: string;
  child: string;
  childId?: string;
  alertTitle: string;
  platform: string;
  suggestedPrompt: string;
  messages: ConversationMessage[];
  createdAt: string;
  updatedAt: string;
};

const loadAll = (): Conversation[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Conversation[]) : [];
  } catch {
    return [];
  }
};

const persist = (list: Conversation[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch {
    // ignore
  }
};

export const suggestedPromptFor = (alert: Alert): string => {
  const title = parentFacingAlertTitle(alert);
  return `Hi ${alert.child}, I noticed something on ${alert.platform} I wanted to check in about: "${title}". Can we talk about it for a sec? No trouble — I just want to make sure you're okay.`;
};

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadAll());

  useEffect(() => {
    setConversations(loadAll());
    const handler = () => setConversations(loadAll());
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const findByAlert = useCallback(
    (alert: Alert) => {
      const key = alertReadKey(alert);
      return conversations.find((c) => c.alertKey === key);
    },
    [conversations],
  );

  const startFromAlert = useCallback((alert: Alert): Conversation => {
    const key = alertReadKey(alert);
    const list = loadAll();
    const existing = list.find((c) => c.alertKey === key);
    if (existing) return existing;
    const now = new Date().toISOString();
    const conv: Conversation = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      alertKey: key,
      child: alert.child,
      childId: alert.childId,
      alertTitle: parentFacingAlertTitle(alert),
      platform: alert.platform,
      suggestedPrompt: suggestedPromptFor(alert),
      messages: [],
      createdAt: now,
      updatedAt: now,
    };
    const next = [conv, ...list];
    persist(next);
    setConversations(next);
    return conv;
  }, []);

  const sendMessage = useCallback((conversationId: string, text: string, role: "parent" | "child" = "parent") => {
    const list = loadAll();
    const idx = list.findIndex((c) => c.id === conversationId);
    if (idx === -1) return;
    const now = new Date().toISOString();
    const msg: ConversationMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      role,
      text,
      ts: now,
    };
    const updated: Conversation = {
      ...list[idx],
      messages: [...list[idx].messages, msg],
      updatedAt: now,
    };
    const next = [...list];
    next[idx] = updated;
    persist(next);
    setConversations(next);
  }, []);

  const getById = useCallback(
    (id: string) => conversations.find((c) => c.id === id),
    [conversations],
  );

  const closeConversation = useCallback((id: string) => {
    const next = loadAll().filter((c) => c.id !== id);
    persist(next);
    setConversations(next);
  }, []);

  return { conversations, findByAlert, startFromAlert, sendMessage, getById, closeConversation };
}
