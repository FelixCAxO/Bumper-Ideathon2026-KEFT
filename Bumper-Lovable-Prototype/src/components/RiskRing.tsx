import type { Risk } from "@/lib/mock-data";
import { clampRiskScore } from "@/lib/risk-score";

const riskColor: Record<Risk, string> = {
  low: "var(--risk-low)",
  medium: "var(--risk-medium)",
  high: "var(--risk-high)",
};

const riskLabel: Record<Risk, string> = {
  low: "Safe",
  medium: "Watch",
  high: "Alert",
};

export function RiskRing({ risk, score, size = 96 }: { risk: Risk; score: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const safeScore = clampRiskScore(score);
  const offset = c - (safeScore / 100) * c;
  const color = riskColor[risk];

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--muted)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 600ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-semibold" style={{ color }}>
          {safeScore}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {riskLabel[risk]}
        </span>
      </div>
    </div>
  );
}
