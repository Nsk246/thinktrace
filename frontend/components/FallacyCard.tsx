interface FallacyCardProps {
  name: string;
  severity: string;
  explanation: string;
  confidence?: number;
}

const severityConfig = {
  high:   { color: "#ef4444", bg: "rgba(239,68,68,0.05)",   border: "rgba(239,68,68,0.15)",   label: "High" },
  medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.15)",  label: "Medium" },
  low:    { color: "#6366f1", bg: "rgba(99,102,241,0.05)",  border: "rgba(99,102,241,0.15)",  label: "Low" },
};

export function FallacyCard({ name, severity, explanation, confidence }: FallacyCardProps) {
  const cfg = severityConfig[severity as keyof typeof severityConfig] || severityConfig.low;

  return (
    <div style={{
      padding: "16px 18px",
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 12,
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Severity dot */}
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, flexShrink: 0, boxShadow: `0 0 6px ${cfg.color}` }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.2px" }}>{name}</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: "3px 9px", borderRadius: 99,
            background: cfg.bg, color: cfg.color,
            border: `1px solid ${cfg.border}`,
            textTransform: "uppercase", letterSpacing: "0.06em",
          }}>{cfg.label} severity</span>
          {confidence !== undefined && (
            <span style={{
              fontSize: 10, fontWeight: 500, padding: "3px 9px", borderRadius: 99,
              background: "var(--bg3)", color: "var(--text4)",
              border: "1px solid var(--border)",
            }}>{Math.round(confidence * 100)}%</span>
          )}
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65, margin: 0 }}>{explanation}</p>
    </div>
  );
}
