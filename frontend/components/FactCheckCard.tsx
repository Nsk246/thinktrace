interface FactCheckCardProps {
  verdict: string;
  confidence: number;
  explanation: string;
  sources: string[];
}

const VerdictIcon = ({ verdict }: { verdict: string }) => {
  if (verdict === "supported") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  if (verdict === "contradicted") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
  if (verdict === "contested") return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
};

const config: Record<string, { color: string; bg: string; border: string; label: string }> = {
  supported:    { color: "#22c55e", bg: "rgba(34,197,94,0.05)",   border: "rgba(34,197,94,0.2)",   label: "Supported" },
  contradicted: { color: "#ef4444", bg: "rgba(239,68,68,0.05)",   border: "rgba(239,68,68,0.2)",   label: "Contradicted" },
  contested:    { color: "#f59e0b", bg: "rgba(245,158,11,0.05)",  border: "rgba(245,158,11,0.2)",  label: "Contested" },
  unverifiable: { color: "#71717a", bg: "rgba(113,113,122,0.05)", border: "rgba(113,113,122,0.2)", label: "Unverifiable" },
};

export function FactCheckCard({ verdict, confidence, explanation, sources }: FactCheckCardProps) {
  const c = config[verdict] || config.unverifiable;
  return (
    <div style={{
      padding: "16px 18px",
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: 12,
      marginBottom: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: c.color, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <VerdictIcon verdict={verdict} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: c.color, letterSpacing: "-0.2px" }}>{c.label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Confidence bar */}
          <div style={{ width: 48, height: 4, background: "var(--border)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.round(confidence * 100)}%`, background: c.color, borderRadius: 99 }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--text4)", fontWeight: 500 }}>{Math.round(confidence * 100)}%</span>
        </div>
      </div>
      <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65, margin: "0 0 10px" }}>{explanation}</p>
      {sources.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          <span style={{ fontSize: 11, color: "var(--text4)", marginRight: 4 }}>Sources:</span>
          {sources.map((s, i) => (
            <span key={i} style={{
              fontSize: 11, color: "var(--text3)", fontWeight: 500,
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
