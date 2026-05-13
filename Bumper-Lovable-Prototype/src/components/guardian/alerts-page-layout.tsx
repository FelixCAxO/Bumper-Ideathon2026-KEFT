import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Leaf, MessageCircle, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { alertReadKey, useReadAlerts } from "@/hooks/use-read-alerts";
import { useConversations } from "@/hooks/use-conversations";
import { useAlertComments } from "@/hooks/use-alert-comments";
import { parentFacingAlertDetail, parentFacingAlertTitle } from "@/lib/alert-display";
import type { Alert, RiskLevel } from "@/lib/alerts";

const PAGE_SIZE = 10;

const riskBadgeClass: Record<RiskLevel, string> = {
  High: "bg-[#ffd3cf] text-[#ff5b4f]",
  Medium: "bg-[#ffe7c0] text-[#cc7a16]",
  Low: "bg-[#dbf8de] text-[#16a043]",
};

type AlertsPageLayoutProps = {
  title: string;
  unitLabel: string;
  unitLabelPlural: string;
  loading: boolean;
  alerts: Alert[];
  emptyTitle: string;
  emptyBody: string;
  onMarkAllRead?: () => void;
  showReadButton?: boolean;
  showStartConversationButton?: boolean;
  showCommentField?: boolean;
};

export function AlertsPageLayout({
  title,
  unitLabel,
  unitLabelPlural,
  loading,
  alerts,
  emptyTitle,
  emptyBody,
  onMarkAllRead,
  showReadButton = false,
  showStartConversationButton = false,
  showCommentField = false,
}: AlertsPageLayoutProps) {
  const totalPages = Math.max(1, Math.ceil(alerts.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  const { markRead, isRead } = useReadAlerts();
  const { startFromAlert, findByAlert } = useConversations();
  const { getComment, setComment } = useAlertComments();
  const navigate = useNavigate();

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagedAlerts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return alerts.slice(start, start + PAGE_SIZE);
  }, [alerts, page]);

  // If URL hash targets an alert, jump to the right page and scroll to it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    if (!hash) return;
    const idx = alerts.findIndex((a) => alertReadKey(a) === hash);
    if (idx < 0) return;
    const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
    if (targetPage !== page) {
      setPage(targetPage);
      return;
    }
    const el = document.getElementById(hash);
    if (el) {
      requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [alerts, page]);

  const handleStartConversation = (alert: Alert) => {
    startFromAlert(alert);
    navigate({ to: "/recent-alerts", hash: alertReadKey(alert) });
  };

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
          {onMarkAllRead && alerts.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                onMarkAllRead();
                setPage(1);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#5e48ed] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(94,72,237,0.25)] transition hover:bg-[#4a36d1]"
            >
              Read all
            </button>
          ) : null}
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-extrabold tracking-tight text-[#07103d] md:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#6a7096]">
            {loading && alerts.length === 0
              ? "Loading the latest signals..."
              : alerts.length === 1
                ? `1 ${unitLabel}`
                : `${alerts.length} ${unitLabelPlural}`}
          </p>
        </header>

        {alerts.length === 0 ? (
          <EmptyState title={emptyTitle} body={emptyBody} />
        ) : (
          <>
            <ul className="space-y-4">
              {pagedAlerts.map((alert) => {
                const alreadyRead = isRead(alert);
                const conversationStarted = showCommentField ? true : Boolean(findByAlert(alert));
                return (
                  <li
                    key={alertReadKey(alert)}
                    id={alertReadKey(alert)}
                    className="scroll-mt-6 rounded-2xl border border-[#e7e9f6] bg-white p-5 shadow-[0_14px_40px_rgba(31,43,108,0.06)]"
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
                    <p className="mt-1 text-sm font-medium leading-6 text-[#515a85]">
                      {parentFacingAlertDetail(alert)}
                    </p>
                    <p className="mt-3 text-xs font-semibold text-[#7b83a8]">{alert.date}</p>

                    {(showReadButton || showStartConversationButton) ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {showReadButton && !alreadyRead ? (
                          <button
                            type="button"
                            onClick={() => markRead([alert])}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
                          >
                            Read
                          </button>
                        ) : null}
                        {showStartConversationButton ? (
                          <button
                            type="button"
                            onClick={() => handleStartConversation(alert)}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#5e48ed] px-4 py-2 text-sm font-bold text-white shadow-[0_12px_30px_rgba(94,72,237,0.25)] transition hover:bg-[#4a36d1]"
                          >
                            <MessageCircle className="h-4 w-4" />
                            Start conversation
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {showCommentField && conversationStarted ? (
                      <AlertCommentField
                        value={getComment(alert)}
                        onSave={(value) => setComment(alert, value)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {totalPages > 1 ? (
              <div className="mt-6 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <span className="text-sm font-bold text-[#515a85]">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#f0edff] px-4 py-2 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-[#f8f9ff] px-6 py-16 text-center">
      <div className="relative mb-6 grid h-24 w-24 place-items-center rounded-full bg-[#e8f8ec] text-[#16a043]">
        <Leaf className="h-12 w-12 -rotate-12" />
        <Wind className="absolute -right-6 top-3 h-10 w-10 text-[#9aa3c7]" aria-hidden="true" />
      </div>
      <p className="text-lg font-black text-[#07103d]">{title}</p>
      <p className="mt-2 max-w-sm text-sm font-medium text-[#646b91]">{body}</p>
    </div>
  );
}

function AlertCommentField({
  value,
  onSave,
}: {
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mt-4 rounded-xl bg-[#f8f9ff] p-3">
      <label className="text-xs font-bold uppercase tracking-wide text-[#7b83a8]">
        Message to your child about this alert
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a note your child will see about this alert..."
        rows={2}
        className="mt-2 w-full resize-none rounded-lg border border-[#e7e9f6] bg-white px-3 py-2 text-sm text-[#07103d] placeholder:text-[#9aa3c7] focus:border-[#5e48ed] focus:outline-none"
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        {saved ? (
          <span className="text-xs font-bold text-[#16a043]">Saved</span>
        ) : null}
        <button
          type="button"
          onClick={handleSave}
          disabled={draft === value}
          className="inline-flex items-center gap-2 rounded-xl bg-[#5e48ed] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#4a36d1] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Save comment
        </button>
      </div>
    </div>
  );
}
