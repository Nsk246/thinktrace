"use client";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";

const stack = [
  { category: "AI Orchestration", items: ["LangGraph", "LangChain", "LangSmith"] },
  { category: "LLM", items: ["Claude API (Sonnet)", "4 parallel agents", "Epistemic scoring"] },
  { category: "Async Queue", items: ["Celery workers", "Redis broker", "Upstash Redis"] },
  { category: "Data", items: ["PostgreSQL", "Neo4j graph", "Pinecone vectors"] },
  { category: "Fact Checking", items: ["Serper Search", "Wikipedia API", "ArXiv + PubMed + News"] },
  { category: "Backend", items: ["FastAPI", "JWT + OTP Auth", "Multi-tenant orgs"] },
  { category: "Frontend", items: ["Next.js 14", "TypeScript", "Tailwind CSS"] },
  { category: "Infrastructure", items: ["Railway cloud", "GitHub Actions CI", "Docker"] },
];

const agents = [
  {
    name: "Parser",
    color: "#6366f1",
    rgb: "99,102,241",
    what: "Reads your content and extracts every distinct claim — premises, conclusions, and supporting sub-claims. Tracks attribution metadata to distinguish the author's own assertions from reported views.",
    how: "Sends a structured extraction prompt to Claude Sonnet. Returns typed claims with confidence scores and attribution flags.",
  },
  {
    name: "Mapper",
    color: "#0ea5e9",
    rgb: "14,165,233",
    what: "Builds a directed argument graph showing which claims support which, which contradict each other, and where the reasoning chain breaks. Scores each logical connection 0.0–1.0 for validity.",
    how: "Uses brace-counting JSON extraction to parse Claude's response into nodes and edges. Identifies missing premises and circular reasoning.",
  },
  {
    name: "Detector",
    color: "#f59e0b",
    rgb: "245,158,11",
    what: "Identifies named logical fallacies with severity ratings. Only fires on the author's own claims — not on views attributed to others. Each fallacy is explained in plain language.",
    how: "Context-aware prompt includes content type metadata. Encyclopedic content is handled differently from direct arguments.",
  },
  {
    name: "Verifier",
    color: "#22c55e",
    rgb: "34,197,94",
    what: "Fact-checks every verifiable claim against 5 live sources simultaneously: Google Search, Wikipedia, ArXiv, PubMed, and NewsAPI. Each claim gets a verdict and source attribution.",
    how: "Smart routing — medical claims hit PubMed, scientific claims hit ArXiv, current events hit NewsAPI. All sources run in parallel with 8-second per-source timeouts.",
  },
];

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 20px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text4)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 28 }}>
            ← Back to ThinkTrace
          </Link>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: "var(--text)", letterSpacing: "-1.5px", marginBottom: 14 }}>
            How ThinkTrace works
          </h1>
          <p style={{ fontSize: 16, color: "var(--text2)", lineHeight: 1.75, maxWidth: 620 }}>
            The technical architecture behind the 4-agent parallel reasoning pipeline, triple-store data layer, and enterprise security model.
          </p>
        </div>

        {/* Architecture */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 6 }}>Architecture</h2>
          <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 20, lineHeight: 1.7 }}>
            Parser runs first and extracts all claims. Then Mapper, Detector, and Verifier fire simultaneously via ThreadPoolExecutor — reducing analysis time from ~90 seconds sequential to ~20 seconds parallel. The Epistemic Scorer synthesises all findings last.
          </p>
          <div className="card" style={{ padding: "24px", fontFamily: "monospace", fontSize: 13, color: "var(--text2)", lineHeight: 2, background: "var(--bg3)" }}>
            <div style={{ color: "var(--text4)", marginBottom: 4 }}># Execution flow</div>
            <div>Parser ──────────────────────────────────► Claims</div>
            <div style={{ paddingLeft: 20 }}>├── Mapper ──► Argument graph + validity scores</div>
            <div style={{ paddingLeft: 20 }}>├── Detector ► Named fallacies + severity</div>
            <div style={{ paddingLeft: 20 }}>└── Verifier ► Fact verdicts (5 sources async)</div>
            <div style={{ paddingLeft: 40 }}>└── Epistemic Scorer ──► 0–100 score</div>
          </div>
        </section>

        {/* Agents */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 20 }}>The 4 Agents</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {agents.map(a => (
              <div key={a.name} className="card" style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: a.color,
                    boxShadow: `0 0 8px rgba(${a.rgb},0.6)`,
                  }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: a.color }}>{a.name}</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--text2)", lineHeight: 1.7, marginBottom: 10 }}>{a.what}</p>
                <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65 }}>
                  <span style={{ fontWeight: 600, color: "var(--text4)" }}>Implementation: </span>{a.how}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Data layer */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 6 }}>Triple Store Data Layer</h2>
          <p style={{ fontSize: 14, color: "var(--text3)", marginBottom: 20, lineHeight: 1.7 }}>
            Every analysis is saved to three stores simultaneously — each optimised for a different access pattern.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              { name: "PostgreSQL", color: "#6366f1", use: "Primary store", detail: "Full analysis records, user accounts, org data. SQLAlchemy QueuePool with 10 base + 20 overflow connections." },
              { name: "Pinecone", color: "#0ea5e9", use: "Vector search", detail: "384-dim semantic embeddings per analysis, namespaced by org. Enables similarity search across past analyses." },
              { name: "Neo4j Aura", color: "#22c55e", use: "Graph queries", detail: "Org → User → Analysis → Claim → Fallacy graph. Enables cross-analysis queries and relationship traversal." },
            ].map(s => (
              <div key={s.name} className="card" style={{ padding: "20px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.name}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{s.use}</div>
                <p style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65, margin: 0 }}>{s.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Production readiness */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 20 }}>Production Readiness</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Horizontal scaling", detail: "Stateless API. Redis holds all shared state (token blacklist, rate limits, OTP). Add instances without coordination." },
              { label: "Rate limiting", detail: "Per-IP limits on every endpoint. Register: 5/hr, Login: 20/hr, OTP: 10/10min, Analyze: 3/day guest / 100/hr authenticated. 50 analyses/month per org." },
              { label: "Security", detail: "bcrypt passwords, JWT blacklist on logout, brute force lockout after 5 attempts, OTP single-use with 10min TTL, CORS locked to frontend domain." },
              { label: "Reliability", detail: "Content hash caching (24hr TTL, ~460ms on hit). Celery task_acks_late + reject_on_worker_lost. Graceful degradation if Neo4j or Redis unavailable." },
              { label: "Observability", detail: "LangSmith traces every Claude call. Request ID on every response. Health endpoint verifies DB + Redis. Structured logging across all agents." },
              { label: "Load tested", detail: "4 simultaneous authenticated analyses completed in 19–24 seconds with zero failures. True parallel execution across Gunicorn workers confirmed." },
            ].map(p => (
              <div key={p.label} style={{
                display: "flex", gap: 16, padding: "14px 18px",
                background: "var(--bg3)", borderRadius: 10,
                border: "1px solid var(--border)",
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6366f1", flexShrink: 0, marginTop: 6 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65 }}>{p.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech stack */}
        <section style={{ marginBottom: 56 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.5px", marginBottom: 20 }}>Full Stack</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
            {stack.map(t => (
              <div key={t.category} className="card" style={{ padding: "16px 18px" }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{t.category}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {t.items.map(item => (
                    <div key={item} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: "var(--text2)" }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer links */}
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <a href="https://github.com/Nsk246/thinktrace" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 14, color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
            View on GitHub →
          </a>
          <a href="https://thinktrace-api-production.up.railway.app/api/docs" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 14, color: "#818cf8", textDecoration: "none", fontWeight: 500 }}>
            API Documentation →
          </a>
          <Link href="/" style={{ fontSize: 14, color: "var(--text3)", textDecoration: "none" }}>
            ← Back to app
          </Link>
        </div>

      </div>
    </div>
  );
}
