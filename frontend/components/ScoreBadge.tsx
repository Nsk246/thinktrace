interface ScoreBadgeProps {
  score: number;
  label: string;
  large?: boolean;
}

export function ScoreBadge({ score, label, large }: ScoreBadgeProps) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const bg = score >= 70 ? "rgba(34,197,94,0.08)" : score >= 40 ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)";
  const border = score >= 70 ? "rgba(34,197,94,0.2)" : score >= 40 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: large ? "18px 20px" : "14px 16px",
    }}>
      <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: large ? 36 : 26, fontWeight: 700, color, letterSpacing: "-1px", lineHeight: 1 }}>
        {score}
      </div>
      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 10, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(score, 100)}%`, background: color, borderRadius: 2, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}
