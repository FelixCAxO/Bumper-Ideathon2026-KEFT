import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { useReadAlerts, alertReadKey } from "@/hooks/use-read-alerts";
import { useConversations } from "@/hooks/use-conversations";
import { parentFacingAlertDetail, parentFacingAlertTitle } from "@/lib/alert-display";
import { children as fallbackChildren, childIds as fallbackChildIds } from "@/lib/mock-data";
import type { Alert, RiskLevel } from "@/lib/alerts";

export const Route = createFileRoute("/_app/child/$childId")({
  head: ({ params }) => {
    const child = fallbackChildren.find((c) => c.id === params.childId);
    const name = child?.displayName ?? "Child";
    return {
      meta: [
        { title: `${name} - Bumper` },
        { name: "description", content: `Profile for ${name} - alerts and conversations.` },
      ],
    };
  },
  component: ChildProfilePage,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6 text-[#09113b]">
      <div className="text-center">
        <p className="text-lg font-black">Child not found</p>
        <Link to="/dashboard" className="mt-3 inline-block text-[#5e48ed] underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6 text-[#09113b]">
      <p>{error.message}</p>
    </div>
  ),
});

const riskBadgeClass: Record<RiskLevel, string> = {
  High: "bg-[#ffd3cf] text-[#ff5b4f]",
  Medium: "bg-[#ffe7c0] text-[#cc7a16]",
  Low: "bg-[#dbf8de] text-[#16a043]",
};

type Tab = "current" | "old" | "conversations";

function ChildProfilePage() {
  const { childId } = Route.useParams();
  const child = fallbackChildren.find((c) => c.id === childId);
  if (!child) throw notFound();

  const { alerts } = useDemoAlerts(fallbackChildIds);
  const { isRead } = useReadAlerts();
  const { conversations } = useConversations();
  const [tab, setTab] = useState<Tab>("current");

  const childAlerts = useMemo(
    () =>
      alerts.filter((a) => {
        if (a.isParentVisible === false) return false;
        if (a.childId) return a.childId === child.id;
        return a.child.toLowerCase() === child.displayName.toLowerCase();
      }),
    [alerts, child],
  );

  const currentAlerts = childAlerts.filter((a) => !isRead(a));
  const oldAlerts = childAlerts.filter((a) => isRead(a));
  const childConversations = conversations.filter(
    (c) =>
      c.childId === child.id ||
      c.child.toLowerCase() === child.displayName.toLowerCase(),
  );

  const counts: Record<Tab, number> = {
    current: currentAlerts.length,
    old: oldAlerts.length,
    conversations: childConversations.length,
  };

  return (
    <div className="min-h-screen bg-[#f6f7ff] p-3 text-[#09113b]">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[960px] rounded-[28px] bg-white px-6 py-8 shadow-[0_30px_90px_rgba(31,43,108,0.12)] ring-1 ring-[#e7e9f8] md:px-10 md:py-10">
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        <header className="mb-6 flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#f7b7c6,#7fb7ff)] text-2xl font-black text-white">
            {child.displayName[0]}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#07103d] md:text-3xl">
              {child.displayName}
            </h1>
            <p className="mt-1 text-sm font-medium text-[#6a7096]">
              {child.age} years old &middot; {child.platform}
            </p>
          </div>
        </header>

        <div className="mb-6 flex flex-wrap gap-2">
          {(["current", "old", "conversations"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                tab === t
                  ? "bg-[#5e48ed] text-white shadow-[0_12px_30px_rgba(94,72,237,0.25)]"
                  : "bg-[#f0edff] text-[#5e48ed] hover:bg-[#e7e1ff]"
              }`}
            >
              {t === "current"
                ? "Current alerts"
                : t === "old"
                  ? "Old alerts"
                  : "Conversations"}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  tab === t ? "bg-white/20" : "bg-white text-[#5e48ed]"
                }`}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {tab === "conversations" ? (
          <ConversationList items={childConversations} />
        ) : (
          <AlertList items={tab === "current" ? currentAlerts : oldAlerts} tab={tab} />
        )}
      </div>
    </div>
  );
}

function AlertList({ items, tab }: { items: Alert[]; tab: "current" | "old" }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={tab === "current" ? "No current alerts" : "No previous alerts"}
        body={
          tab === "current"
            ? "All caught up. New signals will show up here."
            : "Alerts you've read will be archived here."
        }
      />
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((alert) => (
        <li
          key={alertReadKey(alert)}
          className="rounded-2xl border border-[#e7e9f6] bg-white p-5 shadow-[0_14px_40px_rgba(31,43,108,0.06)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#7b83a8]">
              {alert.platform}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black ${riskBadgeClass[alert.riskLevel]}`}
            >
              {alert.riskLevel} risk
            </span>
          </div>
          <p className="mt-2 text-base font-extrabold text-[#07103d]">
            {parentFacingAlertTitle(alert)}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-[#515a85]">
            {parentFacingAlertDetail(alert)}
          </p>
          <p className="mt-3 text-xs font-semibold text-[#7b83a8]">{alert.date}</p>
          <div className="mt-4">
            <Link
              to="/recent-alerts"
              hash={alertReadKey(alert)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
            >
              Open alert
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ConversationList({
  items,
}: {
  items: ReturnType<typeof useConversations>["conversations"];
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No conversations yet"
        body="Start one from an alert and it will show up here."
      />
    );
  }
  return (
    <ul className="space-y-4">
      {items.map((conv) => {
        const last = conv.messages[conv.messages.length - 1];
        return (
          <li key={conv.id}>
            <Link
              to="/conversations/$conversationId"
              params={{ conversationId: conv.id }}
              className="flex items-center justify-between gap-4 rounded-2xl border border-[#e7e9f6] bg-white p-5 shadow-[0_14px_40px_rgba(31,43,108,0.06)] transition hover:opacity-90"
            >
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold uppercase tracking-wide text-[#7b83a8]">
                  {conv.platform}
                </span>
                <p className="mt-1 truncate text-base font-extrabold text-[#07103d]">
                  {conv.alertTitle}
                </p>
                <p className="mt-1 truncate text-sm font-medium text-[#515a85]">
                  {last
                    ? `${last.role === "parent" ? "You" : conv.child}: ${last.text}`
                    : "No messages yet"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#6d58f3]" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-[#f8f9ff] px-6 py-16 text-center">
      <div className="mb-6 grid h-20 w-20 place-items-center rounded-full bg-[#e8edff] text-[#5e48ed]">
        <MessageCircle className="h-10 w-10" />
      </div>
      <p className="text-lg font-black text-[#07103d]">{title}</p>
      <p className="mt-2 max-w-sm text-sm font-medium text-[#646b91]">{body}</p>
    </div>
  );
}
