"use client";
import { useEffect, useState } from "react";
import { IconSearch, IconFileText, IconGlobe, IconEye, IconFlask, IconUsers } from "@/components/Icons";
import { getDashboard, getEvalResults } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";

const capabilities = [
  { title: "Analyze text", desc: "Audit any argument instantly", href: "/", Icon: IconSearch },
  { title: "PDF upload", desc: "Analyze research papers", href: "/", Icon: IconFileText },
  { title: "URL analysis", desc: "Analyze webpages and videos", href: "/", Icon: IconGlobe },
  { title: "Watchdog", desc: "Monitor URLs autonomously", href: "/watchdog", Icon: IconEye },
  { title: "Eval suite", desc: "Run LLM evaluation tests", href: "/evals", Icon: IconFlask },
  { title: "Team", desc: "Manage org members", href: "/team", Icon: IconUsers },
];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [evalData, setEvalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("token")) { window.location.href = "/auth"; return; }
    Promise.all([getDashboard().catch(() => null), getEvalResults().catch(() => null)])
      .then(([d, e]) => { setData(d); setEvalData(e); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 80 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border)", borderTop: "3px solid #6366f1" }} className="spin" />
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ textAlign: "center", paddingTop: 80, padding: "80px 16px" }}>
        <p style={{ color: "var(--text3)", marginBottom: 16 }}>Could not load dashboard</p>
        <Link href="/auth" style={{ padding: "8px 20px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>Sign in</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "clamp(24px,4vw,40px) 16px 80px" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: "clamp(22px,5vw,28px)", fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 }}>
            <span className="gradient-text">{data.org.name}</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)" }}>{data.org.slug}</p>
        </div>

        {/* Stats — 2 cols mobile, 4 cols desktop */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 24 }}>
          {[
            { label: "Total analyses", value: data.usage.total_analyses },
            { label: "Completed", value: data.usage.completed_analyses },
            { label: "Avg score", value: data.usage.avg_epistemic_score ?? "—" },
            { label: "Members", value: data.usage.member_count },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: "16px" }}>
              <div style={{ fontSize: 10, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: "clamp(22px,4vw,28px)", fontWeight: 700, color: "#6366f1", letterSpacing: "-1px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Capabilities — 2 cols mobile, 3 cols desktop */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 12 }}>Platform capabilities</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>
            {capabilities.map(c => (
              <Link key={c.title} href={c.href} style={{ textDecoration: "none" }}>
                <div className="card card-hover" style={{ padding: "16px", cursor: "pointer" }}>
                  <div style={{ marginBottom: 10, color: "var(--text3)" }}><c.Icon size={22} color="var(--text2)" /></div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{c.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Eval results */}
        {evalData?.status === "complete" && (
          <div className="card" style={{ padding: "18px 20px", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Latest eval results</h2>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                {evalData.passed}/{evalData.total} passing
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {evalData.results?.map((r: any) => (
                <div key={r.eval_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg3)", borderRadius: 8, gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.description}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{r.epistemic_score}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: r.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: r.passed ? "#22c55e" : "#ef4444", whiteSpace: "nowrap" }}>
                      {r.passed ? "✓ correct" : "✗ wrong"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent analyses */}
        <div className="card" style={{ padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Recent analyses</h2>
            <Link href="/" style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
              New analysis
            </Link>
          </div>
          {data.recent_analyses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 12 }}>No analyses yet</p>
              <Link href="/" style={{ fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none" }}>
                Run your first analysis →
              </Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.recent_analyses.map((a: any) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "var(--bg3)", borderRadius: 8, gap: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.content_preview || "—"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>{a.overall_score ?? "—"}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(34,197,94,0.1)", color: "#22c55e", whiteSpace: "nowrap" }}>{a.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
