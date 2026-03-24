interface FactCheckCardProps {
  verdict: string;
  confidence: number;
  explanation: string;
  sources: string[];
}

const v: Record<string, { icon: string; color: string; bg: string }> = {
  supported:    { icon: "✓", color: "#22c55e", bg: "rgba(34,197,94,0.08)" },
  contradicted: { icon: "✗", color: "#ef4444", bg: "rgba(239,68,68,0.08)" },
  contested:    { icon: "⚡", color: "#f59e0b", bg: "rgba(245,158,11,0.08)" },
  unverifiable: { icon: "?", color: "#94a3b8", bg: "rgba(148,163,184,0.08)" },
};

export function FactCheckCard({ verdict, confidence, explanation, sources }: FactCheckCardProps) {
  const s = v[verdict] || v.unverifiable;
  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: s.bg, border: "1px solid var(--border)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white"
                style={{ background: s.color }}>{s.icon}</span>
          <span className="text-sm font-semibold capitalize" style={{ color: s.color }}>{verdict}</span>
        </div>
        <div className="text-xs px-2 py-1 rounded-full" style={{ background: "var(--bg2)", color: "var(--text2)" }}>
          {Math.round(confidence * 100)}% confident
        </div>
      </div>
      <p className="text-sm leading-relaxed mb-2" style={{ color: "var(--text2)" }}>{explanation}</p>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {sources.map((s, i) => (
            <span key={i} className="text-xs px-2 py-0.5 rounded"
                  style={{ background: "var(--bg2)", color: "var(--text2)", border: "1px solid var(--border)" }}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
