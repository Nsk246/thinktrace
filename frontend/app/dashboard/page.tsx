"use client";
import { useEffect, useState } from "react";
import { getDashboard, getEvalResults } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";

const capabilities = [
  { title: "Analyze text", desc: "Audit any argument instantly", href: "/", icon: "🔍" },
  { title: "PDF upload", desc: "Analyze research papers", href: "/", icon: "📄" },
  { title: "URL analysis", desc: "Analyze webpages and videos", href: "/", icon: "🌐" },
  { title: "Watchdog", desc: "Monitor URLs autonomously", href: "/watchdog", icon: "👁" },
  { title: "Eval suite", desc: "Run LLM evaluation tests", href: "/evals", icon: "🧪" },
  { title: "Team", desc: "Manage org members", href: "/team", icon: "👥" },
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
      <div style={{ textAlign: "center", paddingTop: 80 }}>
        <p style={{ color: "var(--text3)", marginBottom: 16 }}>Could not load dashboard</p>
        <Link href="/auth" style={{ padding: "8px 20px", borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>Sign in</Link>
      </div>
    </div>
  );

  const stats = [
    { label: "Total analyses", value: data.usage.total_analyses },
    { label: "Completed", value: data.usage.completed_analyses },
    { label: "Avg score", value: data.usage.avg_epistemic_score ?? "—" },
    { label: "Members", value: data.usage.member_count },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 }}>
            <span className="gradient-text">{data.org.name}</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)" }}>{data.org.slug}</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 28 }}>
          {stats.map(s => (
            <div key={s.label} className="card" style={{ padding: "18px 20px" }}>
              <div style={{ fontSize: 11, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#6366f1", letterSpacing: "-1px" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Capabilities */}
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 14, letterSpacing: "-.3px" }}>Platform capabilities</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {capabilities.map(c => (
              <Link key={c.title} href={c.href} style={{ textDecoration: "none" }}>
                <div className="card card-hover" style={{ padding: "18px 20px", cursor: "pointer" }}>
                  <div style={{ fontSize: 24, marginBottom: 10 }}>{c.icon}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text3)" }}>{c.desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Eval results */}
        {evalData?.status === "complete" && (
          <div className="card" style={{ padding: "20px 24px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Latest eval results</h2>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 100,
                background: "rgba(34,197,94,0.1)", color: "#22c55e",
              }}>{evalData.passed}/{evalData.total} passing</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {evalData.results?.map((r: any) => (
                <div key={r.eval_id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg3)", borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, color: "var(--text3)" }}>{r.description}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#6366f1" }}>{r.epistemic_score}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 100,
                      background: r.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      color: r.passed ? "#22c55e" : "#ef4444",
                    }}>{r.passed ? "PASS" : "FAIL"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent analyses */}
        <div className="card" style={{ padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)" }}>Recent analyses</h2>
            <Link href="/" style={{
              fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none",
            }}>New analysis</Link>
          </div>
          {data.recent_analyses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 12 }}>No analyses yet</p>
              <Link href="/" style={{
                fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 10,
                background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", textDecoration: "none",
              }}>Run your first analysis →</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {data.recent_analyses.map((a: any) => (
                <div key={a.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", background: "var(--bg3)", borderRadius: 8,
                }}>
                  <span style={{ fontSize: 12, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 16 }}>
                    {a.content_preview || "—"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>{a.overall_score ?? "—"}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>{a.status}</span>
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
