import { ShieldCheck, AlertTriangle, Activity, Settings as SettingsIcon, EyeOff, Check } from "lucide-react";
import type { RiskLevel } from "@/lib/alerts";
import { cn } from "@/lib/utils";

export const RISK_VISUALS: Record<RiskLevel, { badge: string; icon: string; detail: string }> = {
  High: {
    badge: "bg-rose-100 text-rose-700 border-rose-200",
    icon: "bg-rose-200/70 text-rose-700",
    detail: "bg-rose-50 border-rose-100 text-rose-900",
  },
  Medium: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    icon: "bg-amber-200/70 text-amber-700",
    detail: "bg-amber-50 border-amber-100 text-amber-950",
  },
  Low: {
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: "bg-emerald-200/65 text-emerald-700",
    detail: "bg-emerald-50 border-emerald-100 text-emerald-900",
  },
};

export const RiskBadge = ({ level }: { level: RiskLevel }) => {
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-semibold border", RISK_VISUALS[level].badge)}>
      {level} Risk
    </span>
  );
};

export const AlexProfileMark = ({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) => {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-2xl",
  };

  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-amber-100 via-rose-100 to-primary/90 text-amber-950 font-bold flex items-center justify-center shadow-sm ring-1 ring-primary/15",
        sizeClasses[size],
        className,
      )}
      aria-label="Alex profile mark"
    >
      A
    </div>
  );
};

export const SurfaceCard = ({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    onClick={onClick}
    className={cn(
      "bg-card rounded-xl border border-border/85 p-6 shadow-[0_12px_28px_-24px_rgba(148,111,82,0.45)]",
      onClick && "cursor-pointer hover:shadow-md transition-shadow",
      className,
    )}
  >
    {children}
  </div>
);

export const Icons = {
  Shield: ShieldCheck,
  Alert: AlertTriangle,
  Activity,
  Settings: SettingsIcon,
  EyeOff,
  Check,
};
