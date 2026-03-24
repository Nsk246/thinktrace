interface ScoreBadgeProps {
  score: number;
  label: string;
  size?: "sm" | "lg";
}

export function ScoreBadge({ score, label, size = "sm" }: ScoreBadgeProps) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const bg = score >= 70 ? "rgba(34,197,94,0.1)" : score >= 40 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";
  const border = score >= 70 ? "rgba(34,197,94,0.3)" : score >= 40 ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)";

  return (
    <div className="rounded-xl p-4" style={{ background: bg, border: `1px solid ${border}` }}>
      <div className="flex justify-between items-start mb-3">
        <span className="text-xs font-medium" style={{ color: "var(--text2)" }}>{label}</span>
        <span className={`font-bold ${size === "lg" ? "text-4xl" : "text-2xl"}`} style={{ color }}>{score}</span>
      </div>
      <div className="w-full rounded-full h-1.5" style={{ background: "var(--border)" }}>
        <div className="h-1.5 rounded-full transition-all duration-700"
             style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
