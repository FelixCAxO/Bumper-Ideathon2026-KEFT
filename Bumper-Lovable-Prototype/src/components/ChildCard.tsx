import { Gamepad2 } from "lucide-react";
import { RiskRing } from "./RiskRing";
import type { Child } from "@/lib/mock-data";

export function ChildCard({ child }: { child: Child }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <RiskRing risk={child.risk} score={child.riskScore} />
      <div className="flex-1">
        <h3 className="text-lg font-semibold">{child.name}</h3>
        <p className="text-xs text-muted-foreground">Age {child.age}</p>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
          <Gamepad2 className="h-3.5 w-3.5" />
          <span>{child.platform}</span>
          <span className="text-muted-foreground">- {child.lastActive}</span>
        </div>
      </div>
    </div>
  );
}
