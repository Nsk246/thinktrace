"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckCard } from "@/components/FactCheckCard";
import Link from "next/link";

export default function ReportPage() {
  const params = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"fallacies" | "factchecks" | "graph">("fallacies");

  useEffect(() => {
    api.get(`/api/v1/reports/${params.id}`)
      .then(r => setData(r.data))
      .catch(() => setError("Report not found or no longer available."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const scoreColor = (s: number) => s >= 70 ? "#22c55e" : s >= 40 ? "#f59e0b" : "#ef4444";

  const nodeTypeStyle = (type: string): React.CSSProperties => ({
    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
    flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    background: type === "conclusion" ? "rgba(99,102,241,0.15)"
      : type === "sub_claim" ? "rgba(14,165,233,0.15)" : "rgba(113,113,122,0.12)",
    color: type === "conclusion" ? "#818cf8" : type === "sub_claim" ? "#38bdf8" : "var(--text3)",
  });

  const relationStyle = (rel: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 6,
    textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    background: rel === "supports" ? "rgba(34,197,94,0.12)"
      : rel === "contradicts" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
    color: rel === "supports" ? "#22c55e" : rel === "contradicts" ? "#ef4444" : "#f59e0b",
  });

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border)", borderTop: "3px solid #6366f1", margin: "0 auto 16px" }} className="spin" />
        <p style={{ color: "var(--text3)", fontSize: 14 }}>Loading report...</p>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", padding: "0 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>404</div>
        <p style={{ color: "var(--text3)", fontSize: 15, marginBottom: 24 }}>{error}</p>
        <Link href="/" style={{ padding: "10px 24px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          Run your own analysis →
        </Link>
      </div>
    </div>
  );

  const score = data.overall_score;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", overflowX: "hidden" }}>
      {/* Report header */}
      <div style={{ borderBottom: "1px solid var(--border)", padding: "16px 20px" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 10 }}>TT</div>
            <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 13 }}>ThinkTrace</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>
              {new Date(data.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <button onClick={copyLink} style={{
              fontSize: 12, fontWeight: 500, padding: "6px 14px", borderRadius: 8,
              border: "1px solid var(--border)", background: copied ? "rgba(34,197,94,0.1)" : "var(--bg2)",
              color: copied ? "#22c55e" : "var(--text2)", cursor: "pointer", transition: "all 0.2s",
            }}>
              {copied ? "Copied!" : "Copy link"}
            </button>
            <Link href="/" style={{
              fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none",
            }}>
              Analyze your own →
            </Link>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Content preview */}
        {data.content_preview && (
          <div style={{
            padding: "16px 20px", background: "var(--bg2)",
            border: "1px solid var(--border)", borderRadius: 12,
            marginBottom: 20, borderLeft: "3px solid #6366f1",
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Analyzed argument
            </p>
            <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7, margin: 0, fontStyle: "italic" }}>
              "{data.content_preview}{data.content_preview.length >= 300 ? "..." : ""}"
            </p>
          </div>
        )}

        {/* Score badges */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
          <ScoreBadge score={data.epistemic_score?.overall_score ?? score} label="Overall" large />
          <ScoreBadge score={data.epistemic_score?.evidence_score ?? data.evidence_score ?? 0} label="Evidence" />
          <ScoreBadge score={data.epistemic_score?.logic_score ?? data.logic_score ?? 0} label="Logic" />
        </div>

        {/* Verdict */}
        <div className="card" style={{ padding: "18px 20px", marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Verdict</p>
          <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.75, margin: "0 0 14px" }}>
            {data.epistemic_score?.summary}
          </p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {[
              { l: "Claims", v: data.claim_count },
              { l: "Fallacies", v: data.fallacies?.length ?? 0 },
              { l: "Fact checks", v: data.fact_checks?.length ?? 0 },
              { l: "Graph nodes", v: data.argument_graph?.nodes?.length ?? 0 },
            ].map(s => (
              <div key={s.l}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1" }}>{s.v}</div>
                <div style={{ fontSize: 11, color: "var(--text4)" }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="card" style={{ overflow: "hidden", marginBottom: 28 }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
            {([
              ["fallacies", `Fallacies (${data.fallacies?.length ?? 0})`],
              ["factchecks", `Fact Checks (${data.fact_checks?.length ?? 0})`],
              ["graph", "Argument Graph"],
            ] as const).map(([t, label]) => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: "13px 10px", fontSize: 13, minWidth: 90,
                fontWeight: activeTab === t ? 500 : 400,
                color: activeTab === t ? "var(--text)" : "var(--text3)",
                background: "transparent", border: "none",
                borderBottom: activeTab === t ? "2px solid #6366f1" : "2px solid transparent",
                cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          <div style={{ padding: "18px 20px" }}>
            {activeTab === "fallacies" && (
              !data.fallacies?.length
                ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No fallacies detected. Solid reasoning.</p>
                : data.fallacies.map((f: any, i: number) => (
                    <FallacyCard key={i} name={f.name} severity={f.severity} explanation={f.explanation} />
                  ))
            )}
            {activeTab === "factchecks" && (
              !data.fact_checks?.length
                ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No fact checks available.</p>
                : data.fact_checks.map((fc: any, i: number) => (
                    <FactCheckCard key={i} verdict={fc.verdict} confidence={fc.confidence}
                                   explanation={fc.explanation} sources={fc.sources} />
                  ))
            )}
            {activeTab === "graph" && (
              <div>
                {data.argument_graph?.nodes?.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Claims — {data.argument_graph.nodes.length} nodes
                    </p>
                    {data.argument_graph.nodes.map((n: any, i: number) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 6 }}>
                        <span style={nodeTypeStyle(n.node_type)}>{n.node_type}</span>
                        <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5 }}>{n.text}</span>
                      </div>
                    ))}
                  </div>
                )}
                {data.argument_graph?.edges?.length > 0 ? (
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Connections — {data.argument_graph.edges.length} edges
                    </p>
                    {data.argument_graph.edges.map((e: any, i: number) => {
                      const src = data.argument_graph.nodes.find((n: any) => n.id === e.source_id);
                      const tgt = data.argument_graph.nodes.find((n: any) => n.id === e.target_id);
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8 }}>
                          <div style={{ fontSize: 13, color: "var(--text2)", padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, lineHeight: 1.5 }}>
                            {src?.text ?? e.source_id.slice(0,16) + "..."}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8 }}>
                            <span style={relationStyle(e.relation)}>{e.relation}</span>
                            <span style={{ color: e.relation === "supports" ? "#22c55e" : e.relation === "contradicts" ? "#ef4444" : "#f59e0b", fontSize: 16 }}>↓</span>
                          </div>
                          <div style={{ fontSize: 13, color: "var(--text2)", padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, lineHeight: 1.5 }}>
                            {tgt?.text ?? e.target_id.slice(0,16) + "..."}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No graph data available</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div style={{
          textAlign: "center", padding: "32px 20px",
          background: "var(--bg2)", borderRadius: 16,
          border: "1px solid var(--border)",
        }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
            Want to audit your own argument?
          </p>
          <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20 }}>
            ThinkTrace uses 4 AI agents to map logic, detect fallacies, verify facts, and score reasoning quality.
          </p>
          <Link href="/" style={{
            padding: "12px 28px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
            color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none",
          }}>
            Try ThinkTrace free →
          </Link>
        </div>
      </div>
    </div>
  );
}
