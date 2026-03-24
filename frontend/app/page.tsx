"use client";
import { useState, useRef, useEffect } from "react";
import { analyzeText, analyzeFile, AnalysisResult } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckCard } from "@/components/FactCheckCard";
import { Navbar } from "@/components/Navbar";

type Tab = "text" | "pdf" | "url";
type ResultTab = "fallacies" | "factchecks" | "graph";

const agents = [
  {
    name: "Parser",
    role: "Reads your content",
    desc: "Extracts every distinct claim from the text. Premises, conclusions, and sub-claims are all identified and structured so the other agents have something concrete to work with.",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.35)",
    rgb: "99,102,241",
  },
  {
    name: "Mapper",
    role: "Builds the argument graph",
    desc: "Maps the logical structure of the argument. It shows which claims support which, which ones contradict each other, and how the reasoning chain connects evidence to the final conclusion.",
    color: "#0ea5e9",
    glow: "rgba(14,165,233,0.35)",
    rgb: "14,165,233",
  },
  {
    name: "Detector",
    role: "Hunts logical fallacies",
    desc: "Identifies named logical fallacies such as Ad Hominem, Straw Man, False Cause, and Hasty Generalization. Each one is explained in plain language so you can see exactly how it weakens the argument.",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.35)",
    rgb: "245,158,11",
  },
  {
    name: "Verifier",
    role: "Fact-checks live",
    desc: "Searches the web in real time to verify every factual claim. Each one gets a verdict of Supported, Contradicted, Contested, or Unverifiable along with the sources used to reach that conclusion.",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.35)",
    rgb: "34,197,94",
  },
];

const useCases = [
  { icon: "📰", title: "News and media", desc: "Spot misinformation and weak reasoning in articles before sharing them." },
  { icon: "🎓", title: "Academic research", desc: "Audit papers and essays for logical consistency and evidential gaps." },
  { icon: "⚖️", title: "Legal and policy", desc: "Stress-test arguments in briefs, proposals, and policy documents." },
  { icon: "💼", title: "Business decisions", desc: "Evaluate pitches, reports, and proposals before committing resources." },
];

const techStack = [
  { category: "AI Orchestration", items: ["LangGraph", "LangChain", "LangSmith"] },
  { category: "LLM and Agents", items: ["Claude API", "Multi-agent pipeline", "Tool-use agents"] },
  { category: "Async and Queue", items: ["Celery workers", "Redis streams", "Upstash cloud"] },
  { category: "Data and Memory", items: ["SQLAlchemy ORM", "Neo4j graph", "Pinecone vectors"] },
  { category: "Fact Checking", items: ["Serper Search", "Wikipedia API", "ArXiv + PubMed"] },
  { category: "Backend", items: ["FastAPI", "JWT Auth", "Multi-tenant orgs"] },
  { category: "Frontend", items: ["Next.js 14", "TypeScript", "Tailwind CSS"] },
  { category: "Infrastructure", items: ["Docker", "GitHub Actions CI", "Render deploy"] },
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
  const [activeAgent, setActiveAgent] = useState(-1);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const canAnalyze = tab === "text" ? content.trim().length > 10
    : tab === "url" ? url.trim().length > 5
    : file !== null;

  const startAgentAnimation = () => {
    setActiveAgent(0);
    const delays = [0, 8000, 18000, 28000];
    const timers = delays.map((delay, i) => setTimeout(() => setActiveAgent(i), delay));
    timerRef.current = timers;
  };

  const stopAgentAnimation = () => {
    timerRef.current.forEach(clearTimeout);
    setActiveAgent(-1);
  };

  const handleAnalyze = async () => {
    setLoading(true); setError(""); setResult(null);
    startAgentAnimation();
    try {
      const data = tab === "pdf" && file ? await analyzeFile(file)
        : tab === "url" ? await analyzeText(url, "url")
        : await analyzeText(content, "text");
      setResult(data);
      setAnalysisId(data.analysis_id);
      setResultTab("fallacies");
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed. Make sure the API is running.");
    } finally {
      setLoading(false);
      stopAgentAnimation();
    }
  };

  useEffect(() => () => timerRef.current.forEach(clearTimeout), []);

  const nodeTypeStyle = (type: string): React.CSSProperties => ({
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
    flexShrink: 0, textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap",
    background: type === "conclusion" ? "rgba(99,102,241,0.15)"
      : type === "sub_claim" ? "rgba(14,165,233,0.15)"
      : "rgba(113,113,122,0.12)",
    color: type === "conclusion" ? "#818cf8"
      : type === "sub_claim" ? "#38bdf8"
      : "var(--text3)",
  });

  const relationStyle = (rel: string): React.CSSProperties => ({
    fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 6,
    textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    background: rel === "supports" ? "rgba(34,197,94,0.12)"
      : rel === "contradicts" ? "rgba(239,68,68,0.12)"
      : "rgba(245,158,11,0.12)",
    color: rel === "supports" ? "#22c55e"
      : rel === "contradicts" ? "#ef4444"
      : "#f59e0b",
  });

  const sec = (label: string, title: string, sub?: string) => (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{label}</p>
      <h2 style={{ fontSize: 30, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: sub ? 12 : 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 15, color: "var(--text3)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", overflowX: "hidden" }}>
      <Navbar />

      {/* HERO */}
      <div style={{ textAlign: "center", padding: "72px 20px 28px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "var(--bg3)", border: "1.5px solid var(--border)",
          color: "var(--text3)", fontSize: 12, fontWeight: 500,
          padding: "5px 16px", borderRadius: 100, marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          4 specialist AI agents working in parallel
        </div>
        <h1 className="hero-title" style={{ marginBottom: 20, color: "var(--text)" }}>
          Is this argument<br />
          <span className="gradient-text">actually sound?</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text2)", maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.75 }}>
          ThinkTrace reads any argument and tells you exactly what is logically flawed, factually wrong, and evidentially weak. In seconds.
        </p>
        <p style={{ fontSize: 15, color: "var(--text3)", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
          Used by researchers, journalists, lawyers, and analysts to stress-test reasoning before it matters.
        </p>
      </div>

      {/* HOW IT WORKS STRIP */}
      <div style={{ maxWidth: 960, margin: "44px auto 0", padding: "0 20px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 1, background: "var(--border)", borderRadius: 18,
          overflow: "hidden", border: "1.5px solid var(--border)",
        }}>
          {[
            { step: "01", title: "Submit content", desc: "Paste text, upload a PDF, or drop a URL. ThinkTrace handles everything from there." },
            { step: "02", title: "Agents analyze", desc: "Four specialist agents run in parallel mapping logic, detecting fallacies, and verifying facts." },
            { step: "03", title: "Get a verdict", desc: "Every claim is scored, every fallacy named, and every fact checked against live web sources." },
            { step: "04", title: "Act on it", desc: "Use the structured report to improve, challenge, or validate the argument with confidence." },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--bg2)", padding: "28px 24px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", letterSpacing: "0.1em", marginBottom: 12 }}>{s.step}</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* INPUT CARD */}
      <div style={{ maxWidth: 800, margin: "36px auto 0", padding: "0 20px 20px" }}>
        <div className="card" style={{ marginBottom: 16, overflow: "hidden" }}>
          <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)" }}>
            {(["text", "pdf", "url"] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: "14px 10px", fontSize: 14,
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

          <div style={{ padding: "24px" }}>
            {tab === "text" && (
              <textarea value={content} onChange={e => setContent(e.target.value)}
                placeholder='Try: "Social media is destroying democracy because 70% of misinformation spreads through Facebook. Anyone who disagrees is naive."'
                style={{
                  width: "100%", minHeight: 180, background: "var(--bg3)",
                  border: "1.5px solid var(--border)", borderRadius: 12,
                  color: "var(--text)", fontSize: 15, lineHeight: 1.7,
                  padding: "16px 18px", resize: "vertical", outline: "none",
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
                  width: "100%", height: 52, background: "var(--bg3)",
                  border: "1.5px solid var(--border)", borderRadius: 12,
                  color: "var(--text)", fontSize: 15, padding: "0 18px",
                  outline: "none", fontFamily: "inherit",
                }}
                onFocus={e => e.target.style.borderColor = "#6366f1"}
                onBlur={e => e.target.style.borderColor = "var(--border)"}
              />
            )}
            {tab === "pdf" && (
              <div onClick={() => fileRef.current?.click()} style={{
                border: `2px dashed ${file ? "#6366f1" : "var(--border2)"}`,
                borderRadius: 14, padding: "44px 20px", textAlign: "center",
                cursor: "pointer", background: file ? "rgba(99,102,241,0.05)" : "var(--bg3)",
                transition: "all 0.2s",
              }}>
                <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }}
                       onChange={e => setFile(e.target.files?.[0] || null)} />
                <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
                {file ? (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 500, color: "#6366f1", marginBottom: 4 }}>{file.name}</p>
                    <p style={{ fontSize: 13, color: "var(--text3)" }}>{(file.size / 1024).toFixed(1)} KB — click to change</p>
                  </>
                ) : (
                  <>
                    <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>Drop a PDF here or click to upload</p>
                    <p style={{ fontSize: 13, color: "var(--text3)" }}>Research papers, articles, reports, legal briefs</p>
                  </>
                )}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {agents.map(a => (
                  <span key={a.name} style={{
                    fontSize: 12, color: "var(--text3)",
                    background: "var(--bg3)", border: "1.5px solid var(--border)",
                    padding: "4px 12px", borderRadius: 100,
                  }}>{a.name}</span>
                ))}
              </div>
              <button onClick={handleAnalyze} disabled={loading || !canAnalyze} style={{
                padding: "12px 28px", borderRadius: 12, border: "none",
                background: loading || !canAnalyze ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
                color: loading || !canAnalyze ? "var(--text4)" : "#fff",
                fontSize: 15, fontWeight: 600,
                cursor: loading || !canAnalyze ? "not-allowed" : "pointer",
                whiteSpace: "nowrap", transition: "all 0.15s",
              }}>
                {loading ? "Analyzing..." : "Analyze →"}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 12, color: "#ef4444", fontSize: 14, marginBottom: 14 }}>{error}</div>
        )}

        {/* AGENT ANIMATION */}
        {loading && (
          <div className="card" style={{ padding: "36px 28px", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Analyzing your argument</p>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 28 }}>Each agent runs in parallel. This takes 20 to 40 seconds.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              {agents.map((a, i) => {
                const isActive = activeAgent === i;
                const isDone = activeAgent > i;
                return (
                  <div key={a.name} style={{
                    padding: "20px 16px",
                    borderRadius: 14,
                    border: `1.5px solid ${isActive ? a.color : isDone ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                    background: isActive ? `rgba(${a.rgb},0.07)` : isDone ? "rgba(34,197,94,0.05)" : "var(--bg3)",
                    transition: "all 0.4s ease",
                    boxShadow: isActive ? `0 0 24px ${a.glow}, 0 0 48px ${a.glow}` : "none",
                    textAlign: "center",
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      margin: "0 auto 12px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isActive ? a.color : isDone ? "rgba(34,197,94,0.15)" : "var(--bg)",
                      border: `2px solid ${isActive ? a.color : isDone ? "#22c55e" : "var(--border)"}`,
                      transition: "all 0.4s ease",
                      boxShadow: isActive ? `0 0 16px ${a.glow}` : "none",
                    }}>
                      {isDone ? (
                        <span style={{ color: "#22c55e", fontSize: 16, fontWeight: 700 }}>✓</span>
                      ) : isActive ? (
                        <div style={{ width: 16, height: 16, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.3)", borderTop: "2.5px solid #fff" }} className="spin" />
                      ) : (
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--border2)" }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: isActive ? a.color : isDone ? "#22c55e" : "var(--text3)",
                      marginBottom: 5, transition: "color 0.3s",
                    }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text4)", lineHeight: 1.4 }}>
                      {isDone ? "Complete" : isActive ? a.role : "Waiting"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RESULTS */}
        {result && (
          <div ref={resultsRef} className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              <ScoreBadge score={result.epistemic_score.overall_score} label="Overall" large />
              <ScoreBadge score={result.epistemic_score.evidence_score} label="Evidence" />
              <ScoreBadge score={result.epistemic_score.logic_score} label="Logic" />
            </div>

            <div className="card" style={{ padding: "22px 24px" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Verdict</p>
              <p style={{ fontSize: 15, color: "var(--text2)", lineHeight: 1.75, margin: "0 0 16px" }}>{result.epistemic_score.summary}</p>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {[
                  { l: "Claims", v: result.claim_count },
                  { l: "Graph nodes", v: Array.isArray(result.argument_graph.nodes) ? result.argument_graph.nodes.length : result.argument_graph.nodes },
                  { l: "Edges", v: Array.isArray(result.argument_graph.edges) ? result.argument_graph.edges.length : result.argument_graph.edges },
                  { l: "Fallacies", v: result.fallacies.length },
                  { l: "Fact checks", v: result.fact_checks.length },
                ].map(s => (
                  <div key={s.l}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "#6366f1", letterSpacing: "-.5px" }}>{s.v}</div>
                    <div style={{ fontSize: 12, color: "var(--text4)" }}>{s.l}</div>
                  </div>
                ))}
              </div>
              {analysisId && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>
                    Share this report:
                  </span>
                  <code style={{ fontSize: 11, color: "var(--text2)", background: "var(--bg3)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                    /report/{analysisId.slice(0, 8)}...
                  </code>
                  <button
                    onClick={() => {
                      const url = `${window.location.origin}/report/${analysisId}`;
                      navigator.clipboard.writeText(url);
                      setShareCopied(true);
                      setTimeout(() => setShareCopied(false), 2000);
                    }}
                    style={{
                      fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
                      border: "none",
                      background: shareCopied ? "rgba(34,197,94,0.15)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
                      color: shareCopied ? "#22c55e" : "#fff",
                      cursor: "pointer", transition: "all 0.2s",
                    }}>
                    {shareCopied ? "Link copied!" : "Copy shareable link"}
                  </button>
                  <a href={`/report/${analysisId}`} target="_blank" rel="noopener noreferrer"
                     style={{ fontSize: 12, color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
                    Open report →
                  </a>
                </div>
              )}
            </div>

            <div className="card" style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", borderBottom: "1.5px solid var(--border)", overflowX: "auto" }}>
                {([
                  ["fallacies", `Fallacies (${result.fallacies.length})`],
                  ["factchecks", `Fact Checks (${result.fact_checks.length})`],
                  ["graph", "Argument Graph"],
                ] as [ResultTab, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setResultTab(t)} style={{
                    flex: 1, padding: "14px 10px", fontSize: 14, minWidth: 100,
                    fontWeight: resultTab === t ? 500 : 400,
                    color: resultTab === t ? "var(--text)" : "var(--text3)",
                    background: "transparent", border: "none",
                    borderBottom: resultTab === t ? "2px solid #6366f1" : "2px solid transparent",
                    cursor: "pointer", whiteSpace: "nowrap", marginBottom: -1,
                  }}>{label}</button>
                ))}
              </div>

              <div style={{ padding: "20px 24px" }}>
                {resultTab === "fallacies" && (
                  result.fallacies.length === 0
                    ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "24px 0" }}>No fallacies detected. Solid reasoning.</p>
                    : result.fallacies.map((f, i) => <FallacyCard key={i} name={f.name} severity={f.severity} explanation={f.explanation} />)
                )}
                {resultTab === "factchecks" && (
                  result.fact_checks.length === 0
                    ? <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "24px 0" }}>No fact checks available.</p>
                    : result.fact_checks.map((fc, i) => (
                        <FactCheckCard key={i} verdict={fc.verdict} confidence={fc.confidence} explanation={fc.explanation} sources={fc.sources} />
                      ))
                )}
                {resultTab === "graph" && (
                  <div>
                    {Array.isArray(result.argument_graph.nodes) && result.argument_graph.nodes.length > 0 && (
                      <div style={{ marginBottom: 24 }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                          Claims — {result.argument_graph.nodes.length} nodes
                        </p>
                        {(result.argument_graph.nodes as any[]).map((n: any, i: number) => (
                          <div key={i} style={{
                            display: "flex", alignItems: "flex-start", gap: 12,
                            padding: "12px 16px", background: "var(--bg3)",
                            border: "1.5px solid var(--border)", borderRadius: 12, marginBottom: 8,
                          }}>
                            <span style={nodeTypeStyle(n.node_type)}>{n.node_type}</span>
                            <span style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.6 }}>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {Array.isArray(result.argument_graph.edges) && result.argument_graph.edges.length > 0 ? (
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
                          Connections — {result.argument_graph.edges.length} edges
                        </p>
                        {result.argument_graph.edges.map((e: any, i: number) => {
                          const src = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.source_id);
                          const tgt = (result.argument_graph.nodes as any[]).find((n: any) => n.id === e.target_id);
                          return (
                            <div key={i} style={{
                              display: "flex", flexDirection: "column", gap: 8,
                              padding: "14px 16px", background: "var(--bg3)",
                              border: "1.5px solid var(--border)", borderRadius: 12, marginBottom: 10,
                            }}>
                              <div style={{ fontSize: 14, color: "var(--text2)", padding: "10px 14px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10, lineHeight: 1.5 }}>
                                {src?.text ?? e.source_id.slice(0,16) + "..."}
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 10 }}>
                                <span style={relationStyle(e.relation)}>{e.relation}</span>
                                <span style={{ color: e.relation === "supports" ? "#22c55e" : e.relation === "contradicts" ? "#ef4444" : "#f59e0b", fontSize: 18 }}>↓</span>
                              </div>
                              <div style={{ fontSize: 14, color: "var(--text2)", padding: "10px 14px", background: "var(--bg)", border: "1.5px solid var(--border)", borderRadius: 10, lineHeight: 1.5 }}>
                                {tgt?.text ?? e.target_id.slice(0,16) + "..."}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 14, padding: "24px 0" }}>No graph data available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* AGENT EXPLAINER */}
      <div style={{ maxWidth: 960, margin: "72px auto 0", padding: "0 20px" }}>
        {sec("How it works", "Four agents. One verdict.", "Each agent is a specialist. They run in parallel and their findings are combined into a single structured report.")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {agents.map((a, i) => (
            <div key={a.name} className="card" style={{ padding: "26px 22px" }}>
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: `rgba(${a.rgb},0.12)`,
                border: `1.5px solid ${a.color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginBottom: 16, fontSize: 12, fontWeight: 800, color: a.color,
                letterSpacing: "0.05em",
              }}>0{i + 1}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 5 }}>{a.name}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: a.color, marginBottom: 10 }}>{a.role}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.7 }}>{a.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* USE CASES */}
      <div style={{ maxWidth: 960, margin: "72px auto 0", padding: "0 20px" }}>
        {sec("Who uses it", "Built for people who care about getting it right")}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14 }}>
          {useCases.map(u => (
            <div key={u.title} className="card" style={{ padding: "24px 22px" }}>
              <div style={{ fontSize: 30, marginBottom: 14 }}>{u.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{u.title}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.7 }}>{u.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TECH STACK */}
      <div style={{ borderTop: "1.5px solid var(--border)", marginTop: 80, padding: "56px 20px 64px", background: "var(--bg2)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          {sec("Enterprise stack", "Built with production-grade technology", "Every component chosen for real-world scalability, observability, and enterprise deployment.")}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12, marginBottom: 40 }}>
            {techStack.map(t => (
              <div key={t.category} style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 14, padding: "18px 20px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>{t.category}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {t.items.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text2)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 40, flexWrap: "wrap", marginBottom: 36 }}>
            {[
              { label: "Agents", value: "6" },
              { label: "API endpoints", value: "18+" },
              { label: "Eval pass rate", value: "100%" },
              { label: "Fact sources", value: "5" },
              { label: "CI/CD", value: "GitHub Actions" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#6366f1", letterSpacing: "-0.5px" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text4)" }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text4)" }}>
            Built by <span style={{ color: "var(--text3)", fontWeight: 500 }}>@Nsk246</span> {" · "}
            <a href="https://github.com/Nsk246/thinktrace" target="_blank" rel="noopener noreferrer"
               style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>View on GitHub</a>
          </p>
        </div>
      </div>
    </div>
  );
}
