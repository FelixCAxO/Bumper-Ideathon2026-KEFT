import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { useMemo } from "react";
import { useAlertComments } from "@/hooks/use-alert-comments";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { alertReadKey } from "@/hooks/use-read-alerts";
import { parentFacingAlertTitle } from "@/lib/alert-display";
import { childIds as fallbackChildIds } from "@/lib/mock-data";
import type { RiskLevel } from "@/lib/alerts";

export const Route = createFileRoute("/_app/conversations")({
  head: () => ({
    meta: [
      { title: "Open Conversations - Bumper" },
      { name: "description", content: "Alerts where you've left a message for your child." },
    ],
  }),
  component: ConversationsPage,
});

const riskBadgeClass: Record<RiskLevel, string> = {
  High: "bg-[#ffd3cf] text-[#ff5b4f]",
  Medium: "bg-[#ffe7c0] text-[#cc7a16]",
  Low: "bg-[#dbf8de] text-[#16a043]",
};

function ConversationsPage() {
  const { alerts } = useDemoAlerts(fallbackChildIds);
  const { comments, setComment } = useAlertComments();

  const commentedAlerts = useMemo(
    () =>
      alerts
        .filter((a) => a.isParentVisible !== false)
        .map((a) => ({ alert: a, comment: comments[alertReadKey(a)] ?? "" }))
        .filter((entry) => entry.comment.trim().length > 0),
    [alerts, comments],
  );

  return (
    <div className="min-h-screen bg-[#f6f7ff] p-3 text-[#09113b]">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[960px] rounded-[28px] bg-white px-6 py-8 shadow-[0_30px_90px_rgba(31,43,108,0.12)] ring-1 ring-[#e7e9f8] md:px-10 md:py-10">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to dashboard
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#07103d] md:text-3xl">
            Open Conversations
          </h1>
          <p className="mt-1 text-sm font-medium text-[#6a7096]">
            {commentedAlerts.length === 1
              ? "1 commented alert"
              : `${commentedAlerts.length} commented alerts`}
          </p>
        </header>

        {commentedAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl bg-[#f8f9ff] px-6 py-16 text-center">
            <div className="mb-6 grid h-24 w-24 place-items-center rounded-full bg-[#e8edff] text-[#5e48ed]">
              <MessageCircle className="h-12 w-12" />
            </div>
            <p className="text-lg font-black text-[#07103d]">No commented alerts yet</p>
            <p className="mt-2 max-w-sm text-sm font-medium text-[#646b91]">
              Add a comment on any alert and it'll show up here.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {commentedAlerts.map(({ alert, comment }) => (
              <li
                key={alertReadKey(alert)}
                className="rounded-2xl border border-[#e7e9f6] bg-white p-5 shadow-[0_14px_40px_rgba(31,43,108,0.06)]"
              >
                <Link
                  to="/recent-alerts"
                  hash={alertReadKey(alert)}
                  className="block transition hover:opacity-90"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-[#7b83a8]">
                      {alert.child} - {alert.platform}
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
                  <div className="mt-3 rounded-xl bg-[#f8f9ff] p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#7b83a8]">
                      Your message to {alert.child}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[#07103d]">{comment}</p>
                  </div>
                </Link>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link
                    to="/recent-alerts"
                    hash={alertReadKey(alert)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
                  >
                    Open alert
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setComment(alert, "")}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
                  >
                    Remove comment
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
