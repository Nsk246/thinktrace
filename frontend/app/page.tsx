"use client";
import { useState, useRef } from "react";
import { analyzeText, analyzeFile, AnalysisResult } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckCard } from "@/components/FactCheckCard";
import { Navbar } from "@/components/Navbar";

type Tab = "text" | "pdf" | "url";
type ResultTab = "fallacies" | "factchecks" | "graph";

const techStack = [
  { category: "AI Orchestration", items: ["LangGraph", "LangChain", "LangSmith"] },
  { category: "LLM & Agents", items: ["Claude API", "Multi-agent pipeline", "Tool-use"] },
  { category: "Async & Queue", items: ["Celery", "Redis", "Upstash"] },
  { category: "Vector & Memory", items: ["Pinecone", "Neo4j", "RAG"] },
  { category: "Backend", items: ["FastAPI", "SQLAlchemy", "JWT Auth"] },
  { category: "Frontend", items: ["Next.js", "TypeScript", "Tailwind"] },
  { category: "Infrastructure", items: ["Docker", "AWS ECS", "GitHub Actions"] },
  { category: "Monitoring", items: ["LangSmith", "CloudWatch", "APScheduler"] },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("text");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultTab, setResultTab] = useState<ResultTab>("fallacies");
  const fileRef = useRef<HTMLInputElement>(null);

  const canAnalyze = tab === "text" ? content.trim().length > 10
    : tab === "url" ? url.trim().length > 5
    : file !== null;

  const handleAnalyze = async () => {
    setLoading(true); setError(""); setResult(null);
    try {
      const data = tab === "pdf" && file ? await analyzeFile(file)
        : tab === "url" ? await analyzeText(url, "url")
        : await analyzeText(content, "text");
      setResult(data);
      setResultTab("fallacies");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed.");
    } finally { setLoading(false); }
  };

  const agentLabels = ["Logic Mapper", "Fallacy Hunter", "Fact Checker", "Scorer"];

  const nodeTypeStyle = (type: string) => ({
    fontSize: 10,
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: 100,
    flexShrink: 0,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    background: type === "conclusion"
      ? "rgba(99,102,241,0.15)"
      : type === "sub_claim"
      ? "rgba(14,165,233,0.15)"
      : "rgba(113,113,122,0.12)",
    color: type === "conclusion" ? "#818cf8"
      : type === "sub_claim" ? "#38bdf8"
      : "var(--text3)",
  });

  const relationStyle = (rel: string) => ({
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 6,
    textTransform: "uppercase" as const,
    letterSpacing: "0.04em",
    background: rel === "supports"
      ? "rgba(34,197,94,0.12)"
      : rel === "contradicts"
      ? "rgba(239,68,68,0.12)"
      : "rgba(245,158,11,0.12)",
    color: rel === "supports" ? "#22c55e"
      : rel === "contradicts" ? "#ef4444"
      : "#f59e0b",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "56px 24px 40px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "var(--bg3)", border: "1px solid var(--border)",
          color: "var(--text3)", fontSize: 11, fontWeight: 500,
          padding: "4px 12px", borderRadius: 100, marginBottom: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          4 parallel AI agents · Real-time analysis
        </div>
        <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: "-2px", lineHeight: 1.1, marginBottom: 14, color: "var(--text)" }}>
          Audit any{" "}
          <span className="gradient-text">argument</span>
        </h1>
        <p style={{ fontSize: 15, color: "var(--text3)", maxWidth: 460, margin: "0 auto", lineHeight: 1.65 }}>
          Paste text, upload a PDF, or drop a URL. ThinkTrace maps logic, hunts fallacies, verifies facts, and scores reasoning quality.
        </p>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 20px 20px" }}>
        {/* Input card */}
        <div className="card" style={{ marginBottom: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 4px" }}>
            {(["text", "pdf", "url"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "12px 16px", fontSize: 13,
                fontWeight: tab === t ? 500 : 400,
                color: tab === t ? "var(--text)" : "var(--text3)",
                background: "transparent", border: "none",
                borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
                cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
              }}>
                {t === "pdf" ? "PDF Upload" : t === "url" ? "URL" : "Text"}
              </button>
            ))}
          </div>
          <div style={{ padding: "20px" }}>
            {tab === "text" && (
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder="Paste any argument, article, speech, or claim here..."
                style={{
                  width: "100%", minHeight: 160, background: "var(--bg3)",
                  border: "1px solid var(--border)", borderRadius: 10,
                  color: "var(--text)", fontSize: 14, lineHeight: 1.6,
                  padding: "14px 16px", resize: "vertical", outline: "none",
                  fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            )}
            {tab === "url" && (
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/article or YouTube URL..."
                style={{
                  width: "100%", height: 48, background: "var(--bg3)",
                  border: "1px solid var(--border)", borderRadius: 10,
                  color: "var(--text)", fontSize: 14, padding: "0 16px",
                  outline: "none", fontFamily: "inherit", transition: "border-color 0.15s",
                }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            )}
            {tab === "pdf" && (
              <div onClick={() => fileRef.current?.click()} style={{
                border: `2px dashed ${file ? "#6366f1" : "var(--border2)"}`,
                borderRadius: 12, padding: "40px 20px", textAlign: "center",
                cursor: "pointer", background: file ? "rgba(99,102,241,0.05)" : "var(--bg3)",
                transition: "all 0.15s",
              }}>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
                       onChange={e => setFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                {file ? (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "#6366f1", marginBottom: 4 }}>{file.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text3)" }}>{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>Drop PDF here or click to upload</p>
                    <p style={{ fontSize: 12, color: "var(--text3)" }}>Research papers, articles, reports</p>
                  </>
                )}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {agentLabels.map(a => (
                  <span key={a} style={{ fontSize: 11, color: "var(--text4)", background: "var(--bg3)", border: "1px solid var(--border)", padding: "3px 9px", borderRadius: 100 }}>{a}</span>
                ))}
              </div>
              <button onClick={handleAnalyze} disabled={loading || !canAnalyze} style={{
                padding: "9px 22px", borderRadius: 10, border: "none",
                background: loading || !canAnalyze ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
                color: loading || !canAnalyze ? "var(--text4)" : "#fff",
                fontSize: 13, fontWeight: 600,
                cursor: loading || !canAnalyze ? "not-allowed" : "pointer",
                transition: "all 0.15s", letterSpacing: "-.2px",
              }}>
                {loading ? "Analyzing..." : "Analyze →"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, color: "#ef4444", fontSize: 13, marginBottom: 16 }}>{error}</div>
        )}

        {loading && (
          <div className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid var(--border)", borderTop: "3px solid #6366f1", margin: "0 auto 16px" }} className="spin" />
            <p style={{ fontWeight: 600, color: "var(--text)", marginBottom: 8, fontSize: 15 }}>Running 4 agents in parallel</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
              {agentLabels.map(a => <span key={a} style={{ fontSize: 12, color: "var(--text4)" }} className="pulse">{a}</span>)}
            </div>
          </div>
        )}

        {result && (
          <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <ScoreBadge score={result.epistemic_score.overall_score} label="Overall" large />
              <ScoreBadge score={result.epistemic_score.evidence_score} label="Evidence" />
              <ScoreBadge score={result.epistemic_score.logic_score} label="Logic" />
            </div>

            <div className="card" style={{ padding: "18px 20px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Verdict</p>
              <p style={{ fontSize: 13, color: "var(--text2)", lineHeight: 1.7, margin: "0 0 14px" }}>{result.epistemic_score.summary}</p>
              <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                {[
                  { l: "Claims", v: result.claim_count },
                  { l: "Graph nodes", v: Array.isArray(result.argument_graph.nodes) ? result.argument_graph.nodes.length : result.argument_graph.nodes },
                  { l: "Edges", v: Array.isArray(result.argument_graph.edges) ? result.argument_graph.edges.length : result.argument_graph.edges },
                  { l: "Fallacies", v: result.fallacies.length },
                  { l: "Fact checks", v: result.fact_checks.length },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#6366f1", letterSpacing: "-.5px" }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: "var(--text4)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
                {([
                  ["fallacies", `Fallacies (${result.fallacies.length})`],
                  ["factchecks", `Fact Checks (${result.fact_checks.length})`],
                  ["graph", "Argument Graph"],
                ] as [ResultTab, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setResultTab(t)} style={{
                    flex: 1, padding: "12px 8px", fontSize: 12,
                    fontWeight: resultTab === t ? 500 : 400,
                    color: resultTab === t ? "var(--text)" : "var(--text3)",
                    background: "transparent", border: "none",
                    borderBottom: resultTab === t ? "2px solid #6366f1" : "2px solid transparent",
                    cursor: "pointer", transition: "all 0.15s", marginBottom: -1,
                  }}>{label}</button>
                ))}
              </div>

              <div style={{ padding: "18px 20px" }}>
                {resultTab === "fallacies" && (
                  result.fallacies.length === 0
                    ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No fallacies detected — solid reasoning.</p>
                    : result.fallacies.map((f, i) => <FallacyCard key={i} name={f.name} severity={f.severity} explanation={f.explanation} />)
                )}
                {resultTab === "factchecks" && (
                  result.fact_checks.length === 0
                    ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No fact checks available.</p>
                    : result.fact_checks.map((fc, i) => (
                        <FactCheckCard key={i} verdict={fc.verdict} confidence={fc.confidence} explanation={fc.explanation} sources={fc.sources} />
                      ))
                )}
                {resultTab === "graph" && (
                  <div>
                    {Array.isArray(result.argument_graph.nodes) && result.argument_graph.nodes.length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                          Claims — {result.argument_graph.nodes.length} nodes
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {(result.argument_graph.nodes as any[]).map((n: any, i: number) => (
                            <div key={i} style={{
                              display: "flex", alignItems: "flex-start", gap: 10,
                              padding: "10px 14px",
                              background: "var(--bg3)",
                              border: "1px solid var(--border)",
                              borderRadius: 10,
                            }}>
                              <span style={nodeTypeStyle(n.node_type)}>{n.node_type}</span>
                              <span style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.5, flex: 1 }}>{n.text}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(result.argument_graph.edges) && result.argument_graph.edges.length > 0 ? (
                      <div>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                          Logical connections — {result.argument_graph.edges.length} edges
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {result.argument_graph.edges.map((e: any, i: number) => {
                            const src = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.source_id);
                            const tgt = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.target_id);
                            return (
                              <div key={i} style={{
                                display: "grid",
                                gridTemplateColumns: "1fr auto 1fr",
                                alignItems: "center",
                                gap: 10,
                                padding: "12px 14px",
                                background: "var(--bg3)",
                                border: "1px solid var(--border)",
                                borderRadius: 10,
                              }}>
                                <div style={{
                                  fontSize: 12, color: "var(--text2)",
                                  background: "var(--bg)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8, padding: "8px 12px",
                                  lineHeight: 1.4,
                                }}>
                                  {src?.text ?? e.source_id.slice(0, 12) + "..."}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                                  <span style={relationStyle(e.relation)}>{e.relation}</span>
                                  <span style={{ fontSize: 16, color: e.relation === "supports" ? "#22c55e" : e.relation === "contradicts" ? "#ef4444" : "#f59e0b" }}>→</span>
                                </div>
                                <div style={{
                                  fontSize: 12, color: "var(--text2)",
                                  background: "var(--bg)",
                                  border: "1px solid var(--border)",
                                  borderRadius: 8, padding: "8px 12px",
                                  lineHeight: 1.4,
                                }}>
                                  {tgt?.text ?? e.target_id.slice(0, 12) + "..."}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "20px 0" }}>No graph data available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Enterprise tech stack showcase */}
      <div style={{
        borderTop: "1px solid var(--border)",
        marginTop: 60,
        padding: "48px 24px 56px",
        background: "var(--bg2)",
      }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              Enterprise stack
            </p>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px" }}>
              Built with production-grade technology
            </h2>
            <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 8, maxWidth: 480, margin: "8px auto 0" }}>
              Every component chosen for real-world scalability, observability, and enterprise deployment
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {techStack.map(t => (
              <div key={t.category} style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                  {t.category}
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {t.items.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text2)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "Agents", value: "6" },
              { label: "API endpoints", value: "18+" },
              { label: "Eval pass rate", value: "100%" },
              { label: "CI/CD", value: "GitHub Actions" },
              { label: "Deploy", value: "AWS ECS" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#6366f1", letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "var(--text4)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text4)", marginTop: 32 }}>
            Built by <span style={{ color: "var(--text3)", fontWeight: 500 }}>@Nsk246</span> · Open source on{" "}
            <a href="https://github.com/Nsk246/thinktrace" target="_blank" rel="noopener noreferrer"
               style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
