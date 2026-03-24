"use client";
import { useEffect, useState } from "react";
import { getDashboard, getEvalResults, api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [evalData, setEvalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/auth"; return; }

    Promise.all([
      getDashboard().catch(() => null),
      getEvalResults().catch(() => null),
    ]).then(([dash, evals]) => {
      setData(dash);
      setEvalData(evals);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full spin" style={{ border: "3px solid var(--border)", borderTop: "3px solid var(--accent)" }} />
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p style={{ color: "var(--text2)" }}>Could not load dashboard</p>
        <Link href="/auth" className="text-sm px-4 py-2 rounded-xl text-white accent-gradient">Sign in</Link>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gradient">{data.org.name}</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
            Workspace · {data.org.slug}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total analyses", val: data.usage.total_analyses, icon: "📊" },
            { label: "Completed", val: data.usage.completed_analyses, icon: "✅" },
            { label: "Avg score", val: data.usage.avg_epistemic_score ?? "—", icon: "🎯" },
            { label: "Members", val: data.usage.member_count, icon: "👥" },
          ].map(s => (
            <div key={s.label} className="card p-5">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl font-bold mb-1" style={{ color: "var(--accent)" }}>{s.val}</div>
              <div className="text-xs" style={{ color: "var(--text2)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Capabilities grid */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          {[
            { title: "Analyze text", desc: "Paste any argument and audit it instantly", href: "/", icon: "🔍" },
            { title: "PDF upload", desc: "Upload research papers and documents", href: "/?mode=pdf", icon: "📄" },
            { title: "URL analysis", desc: "Analyze any webpage or YouTube video", href: "/?mode=url", icon: "🌐" },
            { title: "Watchdog", desc: "Monitor URLs for content changes autonomously", href: "/watchdog", icon: "👁" },
            { title: "Eval suite", desc: "Run the LLM evaluation framework", href: "/evals", icon: "🧪" },
            { title: "Team", desc: "Manage org members and roles", href: "/team", icon: "👥" },
          ].map(c => (
            <Link key={c.title} href={c.href}
                  className="card p-5 hover:glow transition-all group block">
              <div className="text-2xl mb-2">{c.icon}</div>
              <div className="font-semibold text-sm mb-1 group-hover:text-gradient transition"
                   style={{ color: "var(--text)" }}>{c.title}</div>
              <div className="text-xs" style={{ color: "var(--text2)" }}>{c.desc}</div>
            </Link>
          ))}
        </div>

        {/* Eval results */}
        {evalData && evalData.status === "complete" && (
          <div className="card p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: "var(--text)" }}>Latest eval results</h3>
              <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                {evalData.passed}/{evalData.total} passing
              </span>
            </div>
            <div className="space-y-2">
              {evalData.results?.map((r: any) => (
                <div key={r.eval_id} className="flex items-center justify-between p-3 rounded-xl text-sm"
                     style={{ background: "var(--bg2)" }}>
                  <span style={{ color: "var(--text2)" }}>{r.description}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: "var(--accent)" }}>{r.epistemic_score}/100</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.passed ? "text-green-400" : "text-red-400"}`}
                          style={{ background: r.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent analyses */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold" style={{ color: "var(--text)" }}>Recent analyses</h3>
            <Link href="/" className="text-xs px-3 py-1.5 rounded-lg text-white accent-gradient">
              New analysis
            </Link>
          </div>
          {data.recent_analyses.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm mb-3" style={{ color: "var(--text2)" }}>No analyses yet</p>
              <Link href="/" className="text-sm px-4 py-2 rounded-xl text-white accent-gradient inline-block">
                Run your first analysis →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent_analyses.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-xl"
                     style={{ background: "var(--bg2)" }}>
                  <span className="text-sm truncate max-w-xs" style={{ color: "var(--text2)" }}>
                    {a.content_preview || "—"}
                  </span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="font-bold text-sm" style={{ color: "var(--accent)" }}>
                      {a.overall_score ?? "—"}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e" }}>
                      {a.status}
                    </span>
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
