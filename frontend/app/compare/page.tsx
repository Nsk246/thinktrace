"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";

export default function ComparePage() {
  const [contentA, setContentA] = useState("");
  const [contentB, setContentB] = useState("");
  const [labelA, setLabelA] = useState("Argument A");
  const [labelB, setLabelB] = useState("Argument B");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"a" | "b">("a");

  const handleCompare = async () => {
    if (!contentA.trim() || !contentB.trim()) {
      setError("Please enter both arguments to compare.");
      return;
    }
    setLoading(true); setError(""); setResult(null);
    try {
      const { data } = await api.post("/api/v1/compare", {
        content_a: contentA,
        content_b: contentB,
        label_a: labelA,
        label_b: labelB,
      });
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Comparison failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const winnerColor = (winner: string) => {
    if (winner === labelA) return "#6366f1";
    if (winner === labelB) return "#0ea5e9";
    return "#f59e0b";
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", overflowX: "hidden" }}>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 20px 80px" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 8 }}>
            <span className="gradient-text">Compare arguments</span>
          </h1>
          <p style={{ fontSize: 15, color: "var(--text3)", lineHeight: 1.65 }}>
            Paste two arguments and ThinkTrace runs a full analysis on both, then gives you a structured head to head comparison.
          </p>
        </div>

        {/* Input grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {([
            { content: contentA, setContent: setContentA, label: labelA, setLabel: setLabelA, color: "#6366f1" },
            { content: contentB, setContent: setContentB, label: labelB, setLabel: setLabelB, color: "#0ea5e9" },
          ]).map((side, i) => (
            <div key={i} className="card" style={{ padding: "18px 20px" }}>
              <input
                value={side.label}
                onChange={e => side.setLabel(e.target.value)}
                style={{
                  width: "100%", height: 36, background: "var(--bg3)",
                  border: `1.5px solid ${side.color}44`, borderRadius: 8,
                  color: side.color, fontSize: 13, fontWeight: 600,
                  padding: "0 12px", outline: "none", marginBottom: 10,
                  fontFamily: "inherit",
                }}
              />
              <textarea
                value={side.content}
                onChange={e => side.setContent(e.target.value)}
                placeholder="Paste argument here..."
                style={{
                  width: "100%", minHeight: 200, background: "var(--bg3)",
                  border: "1.5px solid var(--border)", borderRadius: 10,
                  color: "var(--text)", fontSize: 13, lineHeight: 1.6,
                  padding: "12px 14px", resize: "vertical", outline: "none",
                  fontFamily: "inherit",
                }}
                onFocus={e => e.target.style.borderColor = side.color}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
              <div style={{ fontSize: 11, color: "var(--text4)", marginTop: 6 }}>
                {side.content.length} chars
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button onClick={handleCompare} disabled={loading || !contentA.trim() || !contentB.trim()} style={{
          width: "100%", padding: "13px 0", borderRadius: 12, border: "none",
          background: loading || !contentA.trim() || !contentB.trim() ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
          color: loading || !contentA.trim() || !contentB.trim() ? "var(--text4)" : "#fff",
          fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
          marginBottom: 24, transition: "all 0.15s",
        }}>
          {loading ? "Analyzing both arguments — takes 40 to 60 seconds..." : "Compare arguments →"}
        </button>

        {/* Results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Winner card */}
            <div className="card" style={{
              padding: "24px 24px",
              border: `1.5px solid ${winnerColor(result.comparison.winner)}44`,
              background: `rgba(${result.comparison.winner === labelA ? "99,102,241" : result.comparison.winner === labelB ? "14,165,233" : "245,158,11"},0.05)`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 14px", borderRadius: 100,
                  background: `${winnerColor(result.comparison.winner)}20`,
                  color: winnerColor(result.comparison.winner),
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}>
                  {result.comparison.winner === "tie" ? "Tie" : `${result.comparison.winner} wins`}
                </div>
              </div>
              <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.7, marginBottom: 16 }}>
                {result.comparison.winner_reasoning}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
                {[
                  { label: "Evidence", text: result.comparison.evidence_comparison },
                  { label: "Logic", text: result.comparison.logic_comparison },
                  { label: "Fallacies", text: result.comparison.fallacy_comparison },
                ].filter(x => x.text).map(x => (
                  <div key={x.label} style={{ padding: "12px 14px", background: "var(--bg3)", borderRadius: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{x.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{x.text}</div>
                  </div>
                ))}
              </div>
              {result.comparison.key_differences?.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Key differences</div>
                  {result.comparison.key_differences.map((d: string, i: number) => (
                    <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                      <span style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.5 }}>{d}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Side by side scores */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {([
                { label: labelA, res: result.result_a, color: "#6366f1" },
                { label: labelB, res: result.result_b, color: "#0ea5e9" },
              ]).map((side, i) => (
                <div key={i} className="card" style={{ padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: side.color, marginBottom: 14 }}>{side.label}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
                    <ScoreBadge score={side.res.epistemic_score.overall_score} label="Overall" large />
                    <ScoreBadge score={side.res.epistemic_score.evidence_score} label="Evidence" />
                    <ScoreBadge score={side.res.epistemic_score.logic_score} label="Logic" />
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6, marginBottom: 12 }}>
                    {side.res.epistemic_score.summary}
                  </p>
                  <div style={{ display: "flex", gap: 16 }}>
                    {[
                      { l: "Claims", v: side.res.claim_count },
                      { l: "Fallacies", v: side.res.fallacies.length },
                      { l: "Fact checks", v: side.res.fact_checks.length },
                    ].map(s => (
                      <div key={s.l}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: side.color }}>{s.v}</div>
                        <div style={{ fontSize: 10, color: "var(--text4)" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {side.res.fallacies.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Fallacies</div>
                      {side.res.fallacies.map((f: any, fi: number) => (
                        <FallacyCard key={fi} name={f.name} severity={f.severity} explanation={f.explanation} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
