"use client";
import { useState, useRef, useEffect } from "react";
import { analyzeText, analyzeFile, AnalysisResult } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckCard } from "@/components/FactCheckCard";
import { Navbar } from "@/components/Navbar";
import { useAuthStore } from "@/lib/store";
import { IconSearch, IconFileText, IconGlobe, IconEye, IconFlask, IconUsers, IconNewspaper, IconGraduationCap, IconScale, IconBriefcase } from "@/components/Icons";

type Tab = "text" | "pdf" | "url";
type ResultTab = "fallacies" | "factchecks" | "graph";

const agents = [
  {
    name: "Parser",
    role: "Reads your content",
    desc: "Reads your content and picks out every individual claim including the main point and all the supporting statements.",
    color: "#6366f1",
    glow: "rgba(99,102,241,0.35)",
    rgb: "99,102,241",
  },
  {
    name: "Mapper",
    role: "Builds the argument graph",
    desc: "Draws a map of how the argument is built, which statements back each other up and where the logic breaks down.",
    color: "#0ea5e9",
    glow: "rgba(14,165,233,0.35)",
    rgb: "14,165,233",
  },
  {
    name: "Detector",
    role: "Hunts logical fallacies",
    desc: "Spots tricks and weak reasoning like attacking the person instead of the point, or jumping to conclusions without evidence. Each one is explained simply.",
    color: "#f59e0b",
    glow: "rgba(245,158,11,0.35)",
    rgb: "245,158,11",
  },
  {
    name: "Verifier",
    role: "Fact-checks live",
    desc: "Looks up every factual claim against real sources like Wikipedia, Google, research papers, and news. Tells you what checks out and what doesn't.",
    color: "#22c55e",
    glow: "rgba(34,197,94,0.35)",
    rgb: "34,197,94",
  },
];

const useCases = [
  { Icon: IconNewspaper, title: "News and media", desc: "Check an article before you share it. Know if the facts hold up." },
  { Icon: IconGraduationCap, title: "Academic research", desc: "Check your essay or a research paper for gaps in reasoning and unsupported claims." },
  { Icon: IconScale, title: "Legal and policy", desc: "Test the strength of a proposal or policy argument before committing to it." },
  { Icon: IconBriefcase, title: "Business decisions", desc: "Check a pitch or report for weak claims before making a decision based on it." },
];

const techStack = [
  { category: "AI Orchestration", items: ["LangGraph", "LangChain", "LangSmith"] },
  { category: "LLM and Agents", items: ["Claude API (Sonnet)", "4 parallel agents", "Epistemic scoring"] },
  { category: "Async and Queue", items: ["Celery workers", "Redis broker", "Upstash Redis"] },
  { category: "Data and Memory", items: ["PostgreSQL", "SQLAlchemy ORM", "Neo4j graph", "Pinecone vectors"] },
  { category: "Fact Checking", items: ["Serper Search", "Wikipedia API", "ArXiv + PubMed + News"] },
  { category: "Backend", items: ["FastAPI", "JWT + OTP Auth", "Multi-tenant orgs"] },
  { category: "Frontend", items: ["Next.js 14", "TypeScript", "Tailwind CSS"] },
  { category: "Infrastructure", items: ["Docker", "Railway cloud", "GitHub Actions CI"] },
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
  const [windowWidth, setWindowWidth] = useState(1200);
  const [activeAgents, setActiveAgents] = useState<number[]>([]);
  const [doneAgents, setDoneAgents] = useState<number[]>([]);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const { token } = useAuthStore();
  const [guestLimited, setGuestLimited] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  const canAnalyze = tab === "text" ? content.trim().length > 10
    : tab === "url" ? url.trim().length > 5
    : file !== null;

  const startAgentAnimation = () => {
    // Matches backend reality:
    // Parser (0) runs first alone
    // Then Mapper (1) + Detector (2) + Verifier (3) run in parallel
    setActiveAgents([0]);
    setDoneAgents([]);
    const t1 = setTimeout(() => {
      setDoneAgents([0]);
      setActiveAgents([1, 2, 3]); // All 3 fire simultaneously
    }, 7000);
    timerRef.current = [t1];
  };

  const stopAgentAnimation = () => {
    timerRef.current.forEach(clearTimeout);
    setActiveAgents([]);
    setDoneAgents([]);
  };

  const handleAnalyze = async () => {
    setLoading(true); setError(""); setResult(null); setGuestLimited(false);
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
      const status = e?.response?.status;
      const detail = e?.response?.data?.detail || e?.response?.data?.message || "";

      if (status === 429 || detail.includes("Guest users") || detail.includes("limited to 3")) {
        if (detail.includes("Guest users") || detail.includes("limited to 3")) {
          setGuestLimited(true);
        } else {
          setError(detail || "Too many requests. Please wait a moment before trying again.");
        }
      } else if (status === 408) {
        setError("Analysis timed out. Try with shorter or simpler content.");
      } else if (status === 413) {
        setError("Content is too large. Please use text under 50,000 characters.");
      } else if (status === 400) {
        setError(detail || "Invalid input. Please check your content and try again.");
      } else if (status >= 500) {
        setError("The analysis service is temporarily unavailable. Please try again in a moment.");
      } else if (!e?.response) {
        // Check if it might be a rate limit disguised as network error
        setError("Cannot reach the server. Make sure the backend is running.");
      } else {
        setError(detail || "Analysis failed. Please try again.");
      }
    } finally {
      setLoading(false);
      stopAgentAnimation();
    }
  };

  useEffect(() => () => timerRef.current.forEach(clearTimeout), []);

  useEffect(() => {
    setWindowWidth(window.innerWidth);
    const handle = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, []);

  const grid4 = {
    display: "grid" as const,
    gridTemplateColumns: windowWidth > 900 ? "repeat(4,1fr)" : windowWidth > 560 ? "repeat(2,1fr)" : "1fr",
    gap: 14,
  };

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
      <h2 style={{ fontSize: 26, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: sub ? 12 : 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 15, color: "var(--text3)", maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", overflowX: "hidden" }}>
      <Navbar />

      {/* HERO */}
      <div style={{ textAlign: "center", padding: "60px 20px 20px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "var(--bg3)", border: "1.5px solid var(--border)",
          color: "var(--text3)", fontSize: 12, fontWeight: 500,
          padding: "5px 16px", borderRadius: 100, marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", display: "inline-block" }} />
          4 AI agents · Real-time analysis
        </div>
        <h1 className="hero-title" style={{ marginBottom: 20, color: "var(--text)" }}>
          Before you share it,<br />
          <span className="gradient-text">know if it holds up.</span>
        </h1>
        <p style={{ fontSize: 18, color: "var(--text2)", maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.75 }}>
          Paste any article, claim, or argument. ThinkTrace checks the facts, spots the flaws, and tells you exactly how strong and true it is. In plain English.
        </p>

      </div>

      {/* HOW IT WORKS STRIP */}
      <div style={{ maxWidth: 960, margin: "24px auto 0", padding: "0 20px" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))",
          gap: 0, background: "var(--border)", borderRadius: 18,
          overflow: "hidden", border: "1px solid var(--border)",
        }}>
          {[
            { step: "01", title: "Paste anything", desc: "Text, a PDF, or a link to an article. No formatting needed. Just paste and go." },
            { step: "02", title: "We check it", desc: "ThinkTrace reads every claim, looks them up against real sources, and checks the logic." },
            { step: "03", title: "See what's wrong", desc: "You get a score, a list of factual errors, and plain-English explanations of any logical flaws." },
            { step: "04", title: "Share or act", desc: "Share the report with a link, or use the findings to push back with confidence." },
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
      <div style={{ maxWidth: 800, margin: "24px auto 0", padding: "0 20px 20px" }}>
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
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "center" }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
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
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "var(--text4)", marginRight: 2 }}>Agents:</span>
                {agents.map(a => (
                  <span key={a.name} style={{
                    fontSize: 11, fontWeight: 500, color: "var(--text3)",
                    background: "var(--bg3)", border: "1px solid var(--border)",
                    padding: "3px 10px", borderRadius: 100,
                    letterSpacing: "0.02em",
                  }}>{a.name}</span>
                ))}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={loading || !canAnalyze}
                style={{
                  padding: "12px 28px", borderRadius: 10, border: "none",
                  background: canAnalyze && !loading ? "linear-gradient(135deg,#6366f1,#0ea5e9)" : "var(--bg3)",
                  color: canAnalyze && !loading ? "#fff" : "var(--text4)",
                  fontSize: 14, fontWeight: 600,
                  cursor: loading || !canAnalyze ? "not-allowed" : "pointer",
                  transition: "all 0.2s", whiteSpace: "nowrap",
                  boxShadow: canAnalyze && !loading ? "0 4px 14px rgba(99,102,241,0.3)" : "none",
                  fontFamily: "inherit",
                }}
              >
                {loading ? "Analyzing..." : "Analyze →"}
              </button>
            </div>
          </div>
        </div>

        {/* Sign in prompt — show only when not logged in */}
        {!token && !result && !loading && (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 18px", marginBottom: 14,
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 12, flexWrap: "wrap", gap: 10,
          }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text2)" }}>
                You have 3 free analyses per day.
              </span>
              {" "}
              <span style={{ fontSize: 13, color: "var(--text3)" }}>
                Sign in for 100/hour, history, compare, and more.
              </span>
            </div>
            <a href="/auth" style={{
              fontSize: 13, fontWeight: 600,
              padding: "7px 18px", borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              color: "#fff", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              Sign in free →
            </a>
          </div>
        )}

        {error && (
          <div style={{ padding: "14px 18px", background: "rgba(239,68,68,0.08)", border: "1.5px solid rgba(239,68,68,0.3)", borderRadius: 12, color: "#ef4444", fontSize: 14, marginBottom: 14 }}>{error}</div>
        )}

        {guestLimited && (
          <div style={{
            padding: "18px 20px",
            background: "rgba(99,102,241,0.06)",
            border: "1.5px solid rgba(99,102,241,0.3)",
            borderRadius: 14, marginBottom: 14,
            display: "flex", alignItems: "center",
            justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
                Daily guest limit reached
              </p>
              <p style={{ fontSize: 13, color: "var(--text3)", margin: 0 }}>
                Guest users can run 3 analyses per day. Sign in for 100 analyses per hour.
              </p>
            </div>
            <a href="/auth" style={{
              padding: "9px 20px", borderRadius: 10,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              Sign in — it's free →
            </a>
          </div>
        )}

        {/* AGENT ANIMATION */}
        {loading && (
          <div className="card" style={{ padding: "36px 28px", marginBottom: 14 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)", marginBottom: 6 }}>Checking your content</p>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 28 }}>This takes 20–35 seconds. We're checking the facts, the logic, and the reasoning all at once.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
              {agents.map((a, i) => {
                const isActive = activeAgents.includes(i);
                const isDone = doneAgents.includes(i) || (!isActive && doneAgents.length > 0 && i === 0);
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
                      {isDone ? "Complete" : isActive ? a.role : doneAgents.includes(0) ? "Queued" : "Waiting"}
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
                  <span style={{ fontSize: 11, color: "var(--text3)", background: "var(--bg3)", padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", fontFamily: "monospace" }}>
                    {analysisId.slice(0, 8)}...
                  </span>
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
        {sec("How it works", "What ThinkTrace checks", "Parser runs first to extract claims. Then Mapper, Detector and Verifier fire in parallel. Their findings are combined into a single structured report.")}
        <div style={grid4}>
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
        {sec("Who uses it", "Anyone can use it")}
        <div style={grid4}>
          {useCases.map(u => (
            <div key={u.title} className="card" style={{ padding: "24px 22px" }}>
              <div style={{ marginBottom: 14, color: "var(--text3)" }}>
                <u.Icon size={26} color="var(--text2)" />
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>{u.title}</div>
              <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.7 }}>{u.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: "1px solid var(--border)", marginTop: 80, padding: "48px 20px 56px", background: "var(--bg2)" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 48, flexWrap: "wrap", marginBottom: 36 }}>
            {[
              { label: "AI agents", value: "4" },
              { label: "Fact sources", value: "5" },
              { label: "Eval pass rate", value: "100%" },
              { label: "Analysis time", value: "~20s" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-1px", lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "var(--text4)", marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 32 }}>
            <a href="/about" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              fontSize: 14, color: "#818cf8", textDecoration: "none", fontWeight: 500,
              padding: "11px 24px", borderRadius: 10,
              border: "1px solid rgba(129,140,248,0.25)",
              background: "rgba(99,102,241,0.05)",
            }}>
              How it works technically →
            </a>
          </div>
          <p style={{ fontSize: 13, color: "var(--text4)" }}>
            Built by{" "}
            <a href="https://nandhusk.dev" target="_blank" rel="noopener noreferrer"
               style={{ color: "var(--text3)", fontWeight: 500, textDecoration: "none" }}>@Nsk246</a>
            {" · "}
            <a href="https://github.com/Nsk246/thinktrace" target="_blank" rel="noopener noreferrer"
               style={{ color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>GitHub</a>
            {" · "}
            <a href="/about" style={{ color: "var(--text4)", textDecoration: "none" }}>About</a>
          </p>
        </div>
      </div>
    </div>
  );
}
