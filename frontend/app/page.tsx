"use client";
import { useState, useRef } from "react";
import { analyzeText, analyzeFile, AnalysisResult } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckCard } from "@/components/FactCheckCard";
import { Navbar } from "@/components/Navbar";

type InputMode = "text" | "pdf" | "url";

export default function Home() {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"fallacies" | "factchecks" | "graph">("fallacies");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      let data: AnalysisResult;
      if (mode === "pdf" && file) {
        data = await analyzeFile(file);
      } else if (mode === "url") {
        data = await analyzeText(url, "url");
      } else {
        data = await analyzeText(content, "text");
      }
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed. Make sure the API is running.");
    } finally {
      setLoading(false);
    }
  };

  const canAnalyze = mode === "text" ? content.trim().length > 10
    : mode === "url" ? url.trim().length > 5
    : file !== null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />

      <div className="text-center px-6 pt-14 pb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-4"
             style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          4 parallel AI agents · Real-time analysis
        </div>
        <h1 className="text-4xl font-bold mb-3">
          <span style={{ color: "var(--text)" }}>Audit any </span>
          <span className="text-gradient">argument</span>
        </h1>
        <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text2)" }}>
          ThinkTrace deploys specialist AI agents to map logic, hunt fallacies, verify facts, and score reasoning quality.
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 pb-20">
        <div className="card p-6 mb-6 glow">
          <div className="flex rounded-xl p-1 mb-5" style={{ background: "var(--bg2)" }}>
            {([["text", "Text"], ["pdf", "PDF Upload"], ["url", "URL"]] as const).map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)}
                      className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: mode === m ? "var(--accent)" : "transparent",
                        color: mode === m ? "white" : "var(--text2)",
                      }}>
                {label}
              </button>
            ))}
          </div>

          {mode === "text" && (
            <textarea
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition"
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)", minHeight: 160 }}
              placeholder="Paste any argument, article, speech, or claim here..."
              value={content}
              onChange={e => setContent(e.target.value)}
            />
          )}

          {mode === "url" && (
            <input
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
              placeholder="https://example.com/article or YouTube URL..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          )}

          {mode === "pdf" && (
            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-xl p-10 text-center cursor-pointer transition"
              style={{
                border: `2px dashed ${file ? "var(--accent)" : "var(--border)"}`,
                background: file ? "var(--accent-glow)" : "var(--bg2)",
              }}>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                     onChange={e => setFile(e.target.files?.[0] || null)} />
              <div className="text-3xl mb-2">📄</div>
              {file ? (
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{file.name}</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--text)" }}>Drop PDF here or click to upload</p>
                  <p className="text-xs mt-1" style={{ color: "var(--text2)" }}>Research papers, articles, reports</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-3 text-xs" style={{ color: "var(--text2)" }}>
              <span>Logic mapping</span><span>·</span>
              <span>Fallacy detection</span><span>·</span>
              <span>Fact checking</span><span>·</span>
              <span>Scoring</span>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={loading || !canAnalyze}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition accent-gradient disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Analyzing..." : "Analyze →"}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-4 mb-6 text-sm"
               style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444" }}>
            {error}
          </div>
        )}

        {loading && (
          <div className="card p-12 text-center glow">
            <div className="w-10 h-10 rounded-full mx-auto mb-4 spin"
                 style={{ border: "3px solid var(--border)", borderTop: "3px solid var(--accent)" }} />
            <p className="font-semibold mb-1" style={{ color: "var(--text)" }}>Running 4 agents in parallel</p>
            <div className="flex justify-center gap-4 text-xs mt-3 flex-wrap" style={{ color: "var(--text2)" }}>
              {["Logic Mapper", "Fallacy Hunter", "Fact Checker", "Epistemic Scorer"].map(a => (
                <span key={a}>{a}</span>
              ))}
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-4">
              <ScoreBadge score={result.epistemic_score.overall_score} label="Overall" size="lg" />
              <ScoreBadge score={result.epistemic_score.evidence_score} label="Evidence" />
              <ScoreBadge score={result.epistemic_score.logic_score} label="Logic" />
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>
                Verdict
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {result.epistemic_score.summary}
              </p>
              <div className="flex gap-6 mt-4 flex-wrap">
                {[
                  { label: "Claims", val: result.claim_count },
                  { label: "Graph nodes", val: typeof result.argument_graph.nodes === "number" ? result.argument_graph.nodes : result.argument_graph.nodes?.length ?? 0 },
                  { label: "Edges", val: typeof result.argument_graph.edges === "number" ? result.argument_graph.edges : result.argument_graph.edges?.length ?? 0 },
                  { label: "Fallacies", val: result.fallacies.length },
                  { label: "Fact checks", val: result.fact_checks.length },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>{s.val}</div>
                    <div className="text-xs" style={{ color: "var(--text2)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex border-b" style={{ borderColor: "var(--border)" }}>
                {([
                  ["fallacies", `Fallacies (${result.fallacies.length})`],
                  ["factchecks", `Fact Checks (${result.fact_checks.length})`],
                  ["graph", "Argument Graph"],
                ] as const).map(([tab, label]) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                          className="flex-1 py-3 text-xs font-medium transition"
                          style={{
                            borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent",
                            color: activeTab === tab ? "var(--accent)" : "var(--text2)",
                            background: "transparent",
                          }}>
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {activeTab === "fallacies" && (
                  result.fallacies.length === 0
                    ? <p className="text-sm text-center py-4" style={{ color: "var(--text2)" }}>No fallacies detected — solid reasoning.</p>
                    : result.fallacies.map((f, i) => <FallacyCard key={i} name={f.name} severity={f.severity} explanation={f.explanation} />)
                )}

                {activeTab === "factchecks" && (
                  result.fact_checks.length === 0
                    ? <p className="text-sm text-center py-4" style={{ color: "var(--text2)" }}>No fact checks available.</p>
                    : result.fact_checks.map((fc, i) => (
                        <FactCheckCard key={i} verdict={fc.verdict} confidence={fc.confidence}
                                       explanation={fc.explanation} sources={fc.sources} />
                      ))
                )}

                {activeTab === "graph" && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium mb-3" style={{ color: "var(--text2)" }}>
                      Logical connections between claims
                    </p>
                    {Array.isArray(result.argument_graph.nodes) && result.argument_graph.nodes.length > 0 && (
                      <div className="mb-4">
                        {(result.argument_graph.nodes as any[]).map((n: any, i: number) => (
                          <div key={i} className="flex items-start gap-2 p-2 rounded-lg mb-1"
                               style={{ background: "var(--bg2)" }}>
                            <span className="text-xs px-2 py-0.5 rounded flex-shrink-0 font-medium"
                                  style={{
                                    background: n.node_type === "conclusion" ? "rgba(56,189,248,0.15)" : "rgba(148,163,184,0.15)",
                                    color: n.node_type === "conclusion" ? "var(--accent)" : "var(--text2)",
                                  }}>
                              {n.node_type}
                            </span>
                            <span className="text-xs" style={{ color: "var(--text)" }}>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(result.argument_graph.edges) && result.argument_graph.edges.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium mb-1" style={{ color: "var(--text2)" }}>Connections</p>
                        {result.argument_graph.edges.map((e: any, i: number) => {
                          const src = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.source_id);
                          const tgt = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.target_id);
                          const relColor = e.relation === "supports" ? "#22c55e" : e.relation === "contradicts" ? "#ef4444" : "#f59e0b";
                          const relBg = e.relation === "supports" ? "rgba(34,197,94,0.12)" : e.relation === "contradicts" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)";
                          return (
                            <div key={i} className="flex items-center gap-2 p-3 rounded-lg flex-wrap"
                                 style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}>
                              <span className="text-xs px-2 py-1 rounded-lg"
                                    style={{ background: "var(--accent-glow)", color: "var(--accent)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                                {src?.text ?? e.source_id.slice(0,8)}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                                    style={{ background: relBg, color: relColor }}>
                                {e.relation}
                              </span>
                              <span className="text-xs px-2 py-1 rounded-lg"
                                    style={{ background: "rgba(148,163,184,0.1)", color: "var(--text2)", maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-block" }}>
                                {tgt?.text ?? e.target_id.slice(0,8)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm" style={{ color: "var(--text2)" }}>No graph data available</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
