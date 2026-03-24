interface FallacyCardProps {
  name: string;
  severity: string;
  explanation: string;
}

export function FallacyCard({ name, severity, explanation }: FallacyCardProps) {
  const color = severity === "high" ? "#ef4444" : severity === "medium" ? "#f59e0b" : "#6366f1";
  const bg = severity === "high" ? "rgba(239,68,68,0.06)" : severity === "medium" ? "rgba(245,158,11,0.06)" : "rgba(99,102,241,0.06)";
  const tagBg = severity === "high" ? "rgba(239,68,68,0.12)" : severity === "medium" ? "rgba(245,158,11,0.12)" : "rgba(99,102,241,0.12)";

  return (
    <div style={{
      display: "flex",
      gap: 12,
      padding: "14px 16px",
      background: bg,
      border: "1px solid var(--border)",
      borderRadius: 12,
      marginBottom: 8,
    }}>
      <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{name}</span>
          <span style={{
            fontSize: 10,
            fontWeight: 500,
            padding: "2px 7px",
            borderRadius: 100,
            background: tagBg,
            color,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}>{severity}</span>
        </div>
        <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, margin: 0 }}>{explanation}</p>
      </div>
    </div>
  );
}
