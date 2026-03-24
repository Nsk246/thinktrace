interface FallacyCardProps {
  name: string;
  severity: string;
  explanation: string;
}

const sev: Record<string, { dot: string; badge: string; bg: string }> = {
  high:   { dot: "#ef4444", badge: "rgba(239,68,68,0.15)",   bg: "rgba(239,68,68,0.05)" },
  medium: { dot: "#f59e0b", badge: "rgba(245,158,11,0.15)",  bg: "rgba(245,158,11,0.05)" },
  low:    { dot: "#3b82f6", badge: "rgba(59,130,246,0.15)",  bg: "rgba(59,130,246,0.05)" },
};

export function FallacyCard({ name, severity, explanation }: FallacyCardProps) {
  const s = sev[severity] || sev.medium;
  return (
    <div className="rounded-xl p-4 mb-3" style={{ background: s.bg, border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>{name}</span>
        <span className="text-xs px-2 py-0.5 rounded-full ml-auto font-medium"
              style={{ background: s.badge, color: s.dot }}>
          {severity}
        </span>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: "var(--text2)" }}>{explanation}</p>
    </div>
  );
}
