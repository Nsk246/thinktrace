interface ScoreBadgeProps {
  score: number;
  label: string;
  large?: boolean;
}

export function ScoreBadge({ score, label, large }: ScoreBadgeProps) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const bg = score >= 70 ? "rgba(34,197,94,0.06)" : score >= 40 ? "rgba(245,158,11,0.06)" : "rgba(239,68,68,0.06)";
  const border = score >= 70 ? "rgba(34,197,94,0.2)" : score >= 40 ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)";
  const label2 = score >= 70 ? "Strong" : score >= 40 ? "Moderate" : "Weak";

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: large ? "20px 22px" : "16px 18px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Subtle glow background */}
      <div style={{
        position: "absolute", top: 0, right: 0,
        width: 80, height: 80, borderRadius: "50%",
        background: color, opacity: 0.04, filter: "blur(20px)",
        pointerEvents: "none",
      }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: large ? 42 : 30, fontWeight: 800, color, letterSpacing: "-2px", lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: 13, color: "var(--text4)", fontWeight: 500 }}>/100</span>
      </div>
      {/* Progress bar */}
      <div style={{ height: 5, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${Math.min(score, 100)}%`,
          background: `linear-gradient(90deg, ${color}99, ${color})`,
          borderRadius: 99,
          transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
        }} />
      </div>
      <div style={{ fontSize: 11, color, fontWeight: 600, marginTop: 6 }}>{label2}</div>
    </div>
  );
}
