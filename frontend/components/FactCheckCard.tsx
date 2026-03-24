interface FactCheckCardProps {
  verdict: string;
  confidence: number;
  explanation: string;
  sources: string[];
}

const config: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  supported:    { icon: "✓", color: "#22c55e", bg: "rgba(34,197,94,0.08)",   label: "Supported" },
  contradicted: { icon: "✗", color: "#ef4444", bg: "rgba(239,68,68,0.08)",   label: "Contradicted" },
  contested:    { icon: "~", color: "#f59e0b", bg: "rgba(245,158,11,0.08)",  label: "Contested" },
  unverifiable: { icon: "?", color: "#71717a", bg: "rgba(113,113,122,0.08)", label: "Unverifiable" },
};

export function FactCheckCard({ verdict, confidence, explanation, sources }: FactCheckCardProps) {
  const c = config[verdict] || config.unverifiable;
  return (
    <div style={{
      padding: "14px 16px",
      background: c.bg,
      border: "1px solid var(--border)",
      borderRadius: 12,
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 20, height: 20, borderRadius: "50%",
            background: c.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, flexShrink: 0,
          }}>{c.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.label}</span>
        </div>
        <span style={{
          fontSize: 11, color: "var(--text4)",
          background: "var(--bg3)", padding: "2px 8px",
          borderRadius: 100, border: "1px solid var(--border)",
        }}>{Math.round(confidence * 100)}% confidence</span>
      </div>
      <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, margin: "0 0 8px" }}>{explanation}</p>
      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {sources.map((s, i) => (
            <span key={i} style={{
              fontSize: 11, color: "var(--text4)",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              padding: "2px 8px", borderRadius: 6,
            }}>{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}
