import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Gamepad2,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BumperDashboardBanner, BumperLogo } from "@/components/guardian/brand-assets";
import { useDemoAlerts } from "@/hooks/use-demo-alerts";
import { alertReadKey, useReadAlerts } from "@/hooks/use-read-alerts";
import { useConversations } from "@/hooks/use-conversations";
import { useAlertComments } from "@/hooks/use-alert-comments";
import { buildAccountConnectionsSummary } from "@/lib/account-connections";
import { parentFacingAlertDetail, parentFacingAlertTitle } from "@/lib/alert-display";
import {
  buildActivityChartData,
  getLatestScreenTimeMinutes,
  type ScreenTimeEntry,
} from "@/lib/activity-data";
import {
  buildDashboardActionState,
  type DashboardAction,
  type DashboardActionState,
} from "@/lib/dashboard-flow";
import { getDemoChildren } from "@/lib/demo-client";
import {
  childIds as fallbackChildIds,
  children as fallbackChildren,
  type GameStatus,
} from "@/lib/mock-data";
import type { Alert, RiskLevel } from "@/lib/alerts";
// Dashboard brand components are documented as from "@/components/guardian/brand-assets".

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard - Bumper" },
      {
        name: "description",
        content:
          "Your kids' safety at a glance - alerts, conversations, screen time, and next steps.",
      },
    ],
  }),
  component: Dashboard,
});

type IconType = ComponentType<{ className?: string }>;

type DashboardChild = {
  id: string;
  displayName: string;
  ageLabel: string;
  gameStatus: GameStatus;
  screenTimeHistory: ScreenTimeEntry[];
};

const fallbackChildById = new Map(fallbackChildren.map((child) => [child.id, child] as const));

const riskWeight: Record<RiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

const avatarBackgrounds = [
  "linear-gradient(135deg, #f7b7c6 0%, #7fb7ff 100%)",
  "linear-gradient(135deg, #ffd39a 0%, #86d4ff 100%)",
  "linear-gradient(135deg, #b8f2d0 0%, #8e8cff 100%)",
  "linear-gradient(135deg, #ffc1a6 0%, #c1a7ff 100%)",
];

const lineColors = ["#7257f5", "#42c5be", "#ffbd5a", "#4f8cff"];
const activityEndDate = "2026-05-13";
const activityDaysBack = 7;

const initialChildren: DashboardChild[] = fallbackChildren.map((child) => ({
  id: child.id,
  displayName: child.displayName,
  ageLabel: `${child.age} years old`,
  gameStatus: child.gameStatus,
  screenTimeHistory: child.screenTimeHistory,
}));

function Dashboard() {
  const [childOptions, setChildOptions] = useState<DashboardChild[]>(initialChildren);
  const [activeAction, setActiveAction] = useState<DashboardAction>({
    type: "section",
    id: "dashboard",
    label: "Dashboard",
  });

  const trackedChildIds = useMemo(
    () => (childOptions.length > 0 ? childOptions.map((child) => child.id) : fallbackChildIds),
    [childOptions],
  );

  const { alerts, dashboard, dashboardsByChildId, loading, error, lastUpdatedAt } =
    useDemoAlerts(trackedChildIds);

  useEffect(() => {
    let isMounted = true;

    getDemoChildren()
      .then((response) => {
        if (!isMounted || response.children.length === 0) return;

        setChildOptions(
          response.children.map((child) => {
            const fallback = fallbackChildById.get(child.id);

            return {
              id: child.id,
              displayName: child.displayName,
              ageLabel: fallback ? `${fallback.age} years old` : ageBandToLabel(child.ageBand),
              gameStatus: child.gameStatus ?? fallback?.gameStatus,
              screenTimeHistory: child.screenTimeHistory ?? fallback?.screenTimeHistory ?? [],
            };
          }),
        );
      })
      .catch(() => {
        // Keep fallback children so the dashboard still renders in previews.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const { isRead } = useReadAlerts();
  const recentWindowMs = 7 * 24 * 60 * 60 * 1000;
  const allRecentAlerts = useMemo(() => {
    const cutoff = Date.now() - recentWindowMs;
    return alerts.filter(
      (alert) => alert.isParentVisible !== false && new Date(alert.createdAt).getTime() >= cutoff,
    );
  }, [alerts, recentWindowMs]);
  const visibleAlerts = useMemo(
    () => allRecentAlerts.filter((alert) => !isRead(alert)),
    [allRecentAlerts, isRead],
  );

  const alertsByChild = useMemo(() => {
    const grouped = new Map<string, Alert[]>();

    for (const alert of visibleAlerts) {
      const childId =
        alert.childId ??
        childOptions.find((child) => child.displayName.toLowerCase() === alert.child.toLowerCase())
          ?.id ??
        alert.child;

      grouped.set(childId, [...(grouped.get(childId) ?? []), alert]);
    }

    return grouped;
  }, [childOptions, visibleAlerts]);

  const childRows = useMemo(
    () =>
      childOptions.map((child, index) => {
        const childAlerts = alertsByChild.get(child.id) ?? [];
        const riskLevel = highestRiskLevel(childAlerts);

        return {
          ...child,
          alertCount: childAlerts.length,
          currentGameLabel:
            dashboardsByChildId[child.id]?.gameStatus?.currentGame?.label ??
            child.gameStatus?.currentGame?.label ??
            "No game selected",
          screenMinutes: getLatestScreenTimeMinutes(child, activityEndDate),
          riskLevel,
        };
      }),
    [alertsByChild, childOptions, dashboardsByChildId],
  );

  const recentAlerts = allRecentAlerts.slice(0, 3);
  const highRiskCount = visibleAlerts.filter((alert) => alert.riskLevel === "High").length;
  const { conversations } = useConversations();
  const { comments } = useAlertComments();
  const openConversationCount = useMemo(
    () =>
      alerts.filter(
        (a) =>
          a.isParentVisible !== false &&
          (comments[alertReadKey(a)] ?? "").trim().length > 0,
      ).length,
    [alerts, comments],
  );
  const accountConnections = useMemo(
    () => buildAccountConnectionsSummary(childRows, visibleAlerts),
    [childRows, visibleAlerts],
  );

  const activityData = useMemo(
    () =>
      buildActivityChartData(childRows.slice(0, 3), {
        endDate: activityEndDate,
        daysBack: activityDaysBack,
      }),
    [childRows],
  );
  const flowContext = useMemo(
    () => ({ children: childRows, alerts: visibleAlerts, lastUpdatedAt }),
    [childRows, lastUpdatedAt, visibleAlerts],
  );
  const activeFlowState = useMemo(
    () => buildDashboardActionState(activeAction, flowContext),
    [activeAction, flowContext],
  );
  const handleAction = (action: DashboardAction) => {
    setActiveAction(action);
  };

  return (
    <div className="min-h-screen bg-[#f6f7ff] p-3 text-[#09113b]">
      <div className="mx-auto flex min-h-[calc(100vh-24px)] max-w-[1536px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_90px_rgba(31,43,108,0.12)] ring-1 ring-[#e7e9f8]">
        <main className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(118,91,246,0.08),transparent_28%),radial-gradient(circle_at_top_right,rgba(100,189,255,0.08),transparent_24%),#fff] px-5 py-6 md:px-8 lg:px-10">
          <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <a
                href="/dashboard"
                aria-label="Bumper dashboard home"
                className="block h-16 w-16 shrink-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e48ed]"
              >
                <BumperLogo className="h-full w-full" />
              </a>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-[#07103d] md:text-3xl">
                  Good morning <span aria-hidden="true">{"\u{1F44B}"}</span>
                </h1>
                <p className="mt-1 text-sm font-medium text-[#6a7096] md:text-base">
                  Here&apos;s what&apos;s happening with your kids.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleAction({ type: "section", id: "add-child", label: "Add Child" })
                }
                className="inline-flex items-center gap-2 rounded-xl bg-[#f0edff] px-5 py-3 text-sm font-bold text-[#5e48ed] transition hover:bg-[#e7e1ff]"
              >
                <Plus className="h-4 w-4" />
                Add Child
              </button>

              <div
                className="flex items-center rounded-full bg-white p-1.5 shadow-[0_12px_30px_rgba(31,43,108,0.10)] ring-1 ring-[#eceefa]"
                aria-label="Parent profile"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full bg-[linear-gradient(135deg,#ffbd8f,#f47879)] text-sm font-black text-white">
                  P
                </span>
              </div>
            </div>
          </header>

          <DashboardFlowStatus state={activeFlowState} />

          {error ? (
            <div className="mb-5 rounded-2xl border border-[#ffd1d1] bg-[#fff6f6] px-4 py-3 text-sm font-semibold text-[#d94b4b]">
              Backend connection issue: {error}
            </div>
          ) : null}

          <section className="mb-7 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              Icon={ShieldCheck}
              value={String(visibleAlerts.length)}
              title="New Alerts"
              body="Review recent high risk activity"
              iconShellClass="bg-[#cec2ff]"
              iconClass="text-[#6652df]"
              action={{ type: "metric", id: "alerts", label: "New Alerts" }}
              onAction={handleAction}
              to="/alerts"
            />
            <MetricCard
              Icon={CheckCircle2}
              value={highRiskCount === 0 ? "All Good" : `${highRiskCount} High`}
              title={highRiskCount === 0 ? "No high risk activity" : "High Risk"}
              body={
                highRiskCount === 0
                  ? "No high risk activity in the last 24 hours"
                  : "Needs attention from recent signals"
              }
              iconShellClass={highRiskCount === 0 ? "bg-[#bdf1b8]" : "bg-[#ffd3cf]"}
              iconClass={highRiskCount === 0 ? "text-[#12a83b]" : "text-[#ff5b4f]"}
              action={{ type: "metric", id: "high-risk", label: "High Risk" }}
              onAction={handleAction}
              to="/high-risk"
            />
            <MetricCard
              Icon={Gamepad2}
              value={accountConnections.value}
              title="Account Connections"
              body={`${accountConnections.connectionPreview} - ${accountConnections.alertBody}`}
              iconShellClass="bg-[#ffe08a]"
              iconClass="text-[#ff9f1c]"
              action={{ type: "metric", id: "account-connections", label: "Account Connections" }}
              onAction={handleAction}
            />
            <MetricCard
              Icon={Users}
              value={String(openConversationCount)}
              title="Open Conversations"
              body="Keep the dialogue going"
              iconShellClass="bg-[#b6d9ff]"
              iconClass="text-[#1d82f3]"
              action={{ type: "metric", id: "open-conversations", label: "Open Conversations" }}
              onAction={handleAction}
              to="/conversations"
            />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1.07fr)_minmax(360px,0.93fr)]">
            <div className="space-y-5">
              <Panel>
                <PanelHeader title="Your Children" />

                <div className="divide-y divide-[#edf0fa]">
                  {childRows.map((child, index) => (
                    <div
                      key={child.id}
                      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 md:grid-cols-[auto_minmax(150px,1fr)_minmax(140px,0.7fr)_auto_auto]"
                    >
                      <ChildAvatar name={child.displayName} index={index} className="h-16 w-16" />

                      <div>
                        <p className="text-base font-extrabold text-[#101943]">
                          {child.displayName}
                        </p>
                        <p className="text-sm font-medium text-[#515a85]">{child.ageLabel}</p>
                      </div>

                      <div className="col-start-2 min-w-0 md:col-start-auto">
                        <p className="truncate text-base font-extrabold text-[#6652df]">
                          {child.currentGameLabel}
                        </p>
                        <p className="text-sm font-medium text-[#515a85]">Currently playing</p>
                      </div>

                      <div className="text-right">
                        <p
                          className={
                            child.alertCount > 0
                              ? "text-2xl font-black text-[#ff513f]"
                              : "text-2xl font-black text-[#2db66f]"
                          }
                        >
                          {child.alertCount}
                        </p>
                        <p className="text-sm font-medium text-[#515a85]">
                          {child.alertCount === 1 ? "New Alert" : "New Alerts"}
                        </p>
                      </div>

                      <div className="hidden items-center gap-4 md:flex">
                        <Link
                          to="/child/$childId"
                          params={{ childId: child.id }}
                          className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f0ff] text-[#6652df] transition hover:bg-[#e7e1ff]"
                          aria-label={`Open ${child.displayName}'s profile`}
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Link>

                        <div className="min-w-[92px]">
                          <p className="text-lg font-black text-[#6652df]">
                            {minutesToTime(child.screenMinutes)}
                          </p>
                          <p className="text-sm font-medium text-[#515a85]">Screen Time</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Activity Overview" />

                <div className="mb-2 flex flex-wrap items-center gap-5 px-2 text-sm font-semibold text-[#515a85]">
                  {childRows.slice(0, 3).map((child, index) => (
                    <span key={child.id} className="inline-flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: lineColors[index % lineColors.length] }}
                      />
                      {child.displayName}
                    </span>
                  ))}
                </div>

                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={activityData}
                      margin={{ top: 16, right: 18, bottom: 0, left: -18 }}
                    >
                      <CartesianGrid stroke="#e9ecf8" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#343d69", fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#343d69", fontSize: 12, fontWeight: 600 }}
                        tickFormatter={(value) => `${Math.round(Number(value))}h`}
                        domain={[0, 3]}
                        ticks={[0, 1, 2, 3]}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          border: "1px solid #e5e8f6",
                          borderRadius: 14,
                          boxShadow: "0 18px 40px rgba(31,43,108,0.14)",
                          color: "#09113b",
                          fontWeight: 700,
                        }}
                        formatter={(value) => [`${value}h`, "Screen time"]}
                      />
                      {childRows.slice(0, 3).map((child, index) => (
                        <Line
                          key={child.id}
                          type="monotone"
                          dataKey={child.id}
                          stroke={lineColors[index % lineColors.length]}
                          strokeWidth={3}
                          dot={{
                            r: 4,
                            strokeWidth: 2,
                            fill: lineColors[index % lineColors.length],
                          }}
                          activeDot={{ r: 6 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div className="space-y-5">
              <Panel>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-black tracking-tight text-[#07103d]">
                    Recent Alerts
                  </h2>
                  <Link
                    to="/recent-alerts"
                    className="inline-flex items-center gap-1 text-sm font-extrabold text-[#5e48ed] hover:underline"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>

                {recentAlerts.length > 0 ? (
                  <div className="space-y-4">
                    {recentAlerts.map((alert) => (
                      <RecentAlertRow
                        key={String(alert.id)}
                        alert={alert}
                        onAction={handleAction}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-[#f8f9ff] p-5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-full bg-[#dbf8de] text-[#16a043]">
                        <CheckCircle2 className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="font-black text-[#07103d]">No recent alerts</p>
                        <p className="text-sm font-medium text-[#646b91]">
                          Everything looks calm right now.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </section>

          <BumperDashboardBanner />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#7b83a8]">
            <span>{loading ? "Refreshing safety summary..." : "Dashboard synced"}</span>
            <span>{lastUpdatedAt ? `Updated ${formatTimeAgo(lastUpdatedAt)}` : ""}</span>
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardFlowStatus({ state }: { state: DashboardActionState }) {
  return (
    <section
      aria-live="polite"
      role="status"
      className="mb-5 rounded-2xl border border-[#e7e9f6] bg-white/85 px-4 py-3 shadow-[0_14px_40px_rgba(31,43,108,0.06)]"
    >
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black text-[#07103d]">{state.title}</p>
          <p className="text-sm font-semibold text-[#515a85]">{state.detail}</p>
        </div>
        <p className="text-sm font-extrabold text-[#5e48ed]">{state.status}</p>
      </div>
    </section>
  );
}

type DashboardActionHandler = (action: DashboardAction) => void;

function Sidebar({
  alertCount,
  activeAction,
  onAction,
}: {
  alertCount: number;
  activeAction: DashboardAction;
  onAction: DashboardActionHandler;
}) {
  const navItems: Array<{
    label: string;
    Icon: IconType;
    id: string;
    badge?: number;
  }> = [
    { label: "Dashboard", id: "dashboard", Icon: LayoutDashboard },
  ];

  return (
    <aside className="hidden w-[300px] shrink-0 border-r border-[#e8ebf7] bg-white px-6 py-8 xl:flex xl:flex-col">
      <div className="mb-10">
        <a
          href="/dashboard"
          aria-label="Bumper dashboard home"
          className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5e48ed]"
        >
          <BumperLogo className="h-[72px] w-[72px]" />
        </a>
      </div>

      <nav className="space-y-2">
        {navItems.map(({ label, id, Icon, badge }) => {
          const active = activeAction.id === id;

          return (
            <button
              key={label}
              type="button"
              onClick={() => onAction({ type: "section", id, label })}
              aria-pressed={active}
              className={
                active
                  ? "flex w-full items-center justify-between rounded-2xl bg-[#f0edff] px-4 py-3 text-left font-extrabold text-[#5e48ed]"
                  : "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left font-bold text-[#323b66] transition hover:bg-[#f8f8ff]"
              }
            >
              <span className="inline-flex items-center gap-4">
                <Icon className="h-5 w-5" />
                {label}
              </span>

              {badge ? (
                <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#ff5b4f] px-2 text-xs font-black text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto overflow-hidden rounded-2xl bg-[#f2f0ff] p-6">
        <p className="text-base font-black text-[#5e48ed]">Built on trust.</p>
        <p className="mt-4 text-sm font-semibold leading-6 text-[#2e365f]">
          We focus on safety, respect, and open conversations.
        </p>
        <TrustArt />
      </div>
    </aside>
  );
}

type MetricCardProps = {
  Icon: IconType;
  value: string;
  title: string;
  body: string;
  iconShellClass: string;
  iconClass: string;
  action: DashboardAction;
  onAction: DashboardActionHandler;
  to?: string;
};

function MetricCard({
  Icon,
  value,
  title,
  body,
  iconShellClass,
  iconClass,
  action,
  onAction,
  to,
}: MetricCardProps) {
  const inner = (
    <div className="flex items-center gap-4">
      <div
        className={`grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full ${iconShellClass}`}
      >
        <Icon className={`h-8 w-8 ${iconClass}`} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-black text-[#07103d]">{value}</p>
        <p className="mt-0.5 text-sm font-bold text-[#07103d]">{title}</p>
        <p className="mt-1 text-sm font-medium leading-5 text-[#515a85]">{body}</p>
      </div>

      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#6d58f3]">
        <ChevronRight className="h-4 w-4" />
      </span>
    </div>
  );

  const className =
    "group block w-full rounded-3xl border border-[#e7e9f6] bg-white p-5 text-left shadow-[0_18px_50px_rgba(31,43,108,0.06)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(31,43,108,0.10)] focus:outline-none focus:ring-2 focus:ring-[#8b7cff]";

  if (to) {
    return (
      <Link to={to} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => onAction(action)} className={className}>
      {inner}
    </button>
  );
}

const Panel = ({ children }: { children: ReactNode }) => {
  return (
    <section className="rounded-3xl border border-[#e7e9f6] bg-white p-6 shadow-[0_18px_50px_rgba(31,43,108,0.06)]">
      {children}
    </section>
  );
};

function PanelHeader({
  title,
  actionLabel,
  action,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  action?: DashboardAction;
  onAction?: DashboardActionHandler;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-xl font-black tracking-tight text-[#07103d]">{title}</h2>
      {actionLabel && action && onAction ? (
        <button
          type="button"
          onClick={() => onAction(action)}
          className="text-sm font-extrabold text-[#5e48ed] hover:underline"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function RecentAlertRow({ alert, onAction }: { alert: Alert; onAction: DashboardActionHandler }) {
  const Icon = alertIconFor(alert);
  const key = alertReadKey(alert);

  return (
    <Link
      to="/recent-alerts"
      hash={key}
      onClick={() =>
        onAction({
          type: "alert",
          id: String(alert.publicId ?? alert.id),
          label: parentFacingAlertTitle(alert),
        })
      }
      className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl p-2 text-left transition hover:bg-[#f8f9ff] focus:outline-none focus:ring-2 focus:ring-[#8b7cff]"
    >
      <span
        className={`grid h-16 w-16 place-items-center rounded-full ${alertIconShellFor(alert)}`}
      >
        <Icon className={`h-7 w-7 ${alertIconTextFor(alert)}`} />
      </span>

      <span>
        <span className="block text-base font-black text-[#07103d]">
          {parentFacingAlertTitle(alert)}
        </span>
        <span className="mt-1 block text-sm font-semibold leading-5 text-[#3c456d]">
          {parentFacingAlertDetail(alert)}
        </span>
        <span className="mt-1 block text-sm font-semibold text-[#7b83a8]">
          {formatTimeAgo(alert.createdAt || alert.date)}
        </span>
      </span>

      <span className={`h-3 w-3 rounded-full ${riskDotClass(alert.riskLevel)}`} />
    </Link>
  );
}

function ChildAvatar({
  name,
  index,
  className = "h-12 w-12",
}: {
  name: string;
  index: number;
  className?: string;
}) {
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-full text-xl font-black text-white shadow-[0_12px_30px_rgba(31,43,108,0.16)] ${className}`}
      style={{ background: avatarBackgrounds[index % avatarBackgrounds.length] }}
      aria-label={name}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function TrustArt() {
  return (
    <div className="relative mt-8 h-32">
      <div className="absolute bottom-0 left-1 h-24 w-24 rounded-t-full bg-[#1c244d]" />
      <div className="absolute bottom-0 left-8 h-[5.5rem] w-24 rounded-t-full bg-[#6d58f3]" />
      <div className="absolute bottom-16 left-10 h-10 w-10 rounded-full bg-[#ffc39e]" />
      <div className="absolute bottom-0 right-4 h-20 w-20 rounded-t-full bg-[#1169c8]" />
      <div className="absolute bottom-14 right-10 h-9 w-9 rounded-full bg-[#ffc39e]" />
      <div className="absolute bottom-5 left-20 h-8 w-8 rounded-full bg-[#dcd6ff]" />
      <div className="absolute right-2 top-0 h-12 w-12 rounded-full bg-[#dcd6ff]" />
    </div>
  );
}

function ConversationBubbleArt() {
  return (
    <div className="relative h-28 w-28 shrink-0">
      <div className="absolute left-0 top-3 grid h-20 w-20 place-items-center rounded-full bg-[#70b9ff] text-white shadow-[0_14px_30px_rgba(31,43,108,0.12)]">
        <span className="h-8 w-8 rounded-full bg-white" />
      </div>
      <div className="absolute bottom-1 right-0 grid h-16 w-16 place-items-center rounded-full bg-[#ff8f9a] text-white shadow-[0_14px_30px_rgba(31,43,108,0.12)]">
        <span className="h-7 w-7 rounded-full bg-white" />
      </div>
      <div className="absolute right-4 top-0 h-6 w-6 rounded-full bg-[#ffd4dd]" />
      <div className="absolute bottom-0 left-7 h-3 w-3 rounded-full bg-[#cdd5ff]" />
    </div>
  );
}

function highestRiskLevel(alerts: Alert[]): RiskLevel | null {
  return alerts.reduce<RiskLevel | null>((highest, alert) => {
    if (!highest) return alert.riskLevel;
    return riskWeight[alert.riskLevel] > riskWeight[highest] ? alert.riskLevel : highest;
  }, null);
}

function minutesToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;

  return `${hours}h ${mins}m`;
}

function ageBandToLabel(ageBand?: string) {
  if (!ageBand) return "Child account";

  return ageBand
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .concat(" account");
}

function isConversationAlert(alert: Alert) {
  const eventType = alert.eventType?.toLowerCase() ?? "";
  const signals = alert.signals ?? [];

  return (
    eventType.includes("message") ||
    eventType.includes("conversation") ||
    eventType.includes("move_to_other_app") ||
    eventType.includes("call") ||
    signals.includes("move_to_other_app") ||
    signals.includes("private_call_invite") ||
    signals.includes("unknown_party_invite")
  );
}

function alertIconFor(alert: Alert): IconType {
  const eventType = alert.eventType?.toLowerCase() ?? "";
  const signals = alert.signals ?? [];
  const label = `${alert.label ?? ""} ${alert.description ?? ""}`.toLowerCase();

  if (eventType.includes("friend") || signals.includes("new_contact")) {
    return UserPlus;
  }

  if (eventType.includes("location") || label.includes("location")) {
    return MapPin;
  }

  if (isConversationAlert(alert)) {
    return MessageCircle;
  }

  return Bell;
}

function alertIconShellFor(alert: Alert) {
  const Icon = alertIconFor(alert);

  if (Icon === UserPlus) return "bg-[#fff0d9]";
  if (Icon === MapPin) return "bg-[#d8f7f2]";
  if (Icon === MessageCircle) return "bg-[#eee8ff]";

  return "bg-[#f0edff]";
}

function alertIconTextFor(alert: Alert) {
  const Icon = alertIconFor(alert);

  if (Icon === UserPlus) return "text-[#ffab00]";
  if (Icon === MapPin) return "text-[#27b9aa]";
  if (Icon === MessageCircle) return "text-[#6652df]";

  return "text-[#6652df]";
}

function riskDotClass(riskLevel: RiskLevel) {
  switch (riskLevel) {
    case "High":
      return "bg-[#ff5b4f]";
    case "Medium":
      return "bg-[#ffcb5c]";
    case "Low":
      return "bg-[#cbd2ef]";
    default:
      return "bg-[#cbd2ef]";
  }
}

function formatTimeAgo(value?: string) {
  if (!value) return "Just now";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const elapsedMs = Date.now() - date.getTime();
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60_000));

  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
