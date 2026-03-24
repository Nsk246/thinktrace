"use client";
import { useState, useEffect } from "react";
import { getEvalResults, api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function EvalsPage() {
  const [data, setData] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("token")) { window.location.href = "/auth"; return; }
    getEvalResults().then(setData).catch(() => {});
  }, []);

  const runSuite = async () => {
    setRunning(true);
    setMsg("Eval suite running — takes ~2 minutes...");
    try {
      await api.post("/api/v1/eval/run");
      setTimeout(async () => {
        const d = await getEvalResults().catch(() => null);
        setData(d); setRunning(false); setMsg("Eval suite complete");
      }, 120000);
    } catch (e: any) { setMsg(e?.response?.data?.detail || "Failed"); setRunning(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 }}>
              <span className="gradient-text">Eval Suite</span>
            </h1>
            <p style={{ fontSize: 13, color: "var(--text3)" }}>Tests fallacy detection, fact checking accuracy, and score calibration</p>
          </div>
          <button onClick={runSuite} disabled={running}
                  style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: running ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)", color: running ? "var(--text4)" : "#fff", fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer", flexShrink: 0 }}>
            {running ? "Running..." : "Run suite"}
          </button>
        </div>

        {msg && (
          <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#818cf8", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {data?.status === "complete" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Total cases", v: data.total, c: "#6366f1" },
                { l: "Passed", v: data.passed, c: "#22c55e" },
                { l: "Pass rate", v: `${data.pass_rate}%`, c: data.pass_rate === 100 ? "#22c55e" : "#f59e0b" },
              ].map(s => (
                <div key={s.l} className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.l}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: s.c, letterSpacing: "-1px" }}>{s.v}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.results?.map((r: any) => (
                <div key={r.eval_id} className="card" style={{ padding: "18px 20px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{r.description}</div>
                      <div style={{ fontSize: 11, color: "var(--text4)" }}>
                        {r.eval_id} · expected score {r.expected_score_range[0]}–{r.expected_score_range[1]}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#6366f1", letterSpacing: "-1px" }}>{r.epistemic_score}</div>
                        <div style={{ fontSize: 10, color: "var(--text4)" }}>scored</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 100, background: r.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", color: r.passed ? "#22c55e" : "#ef4444" }}>
                        {r.passed ? "AGENT CORRECT" : "AGENT WRONG"}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { l: "Score range", v: `${r.expected_score_range[0]}–${r.expected_score_range[1]}`, ok: r.score_in_range },
                      { l: "Fallacy recall", v: r.fallacy_scores?.recall?.toFixed(2) ?? "—", ok: r.fallacy_recall_ok },
                      { l: "Claim accuracy", v: r.claim_scores?.accuracy?.toFixed(2) ?? "—", ok: true },
                    ].map(m => (
                      <div key={m.l} style={{ padding: "10px 12px", background: "var(--bg3)", borderRadius: 8 }}>
                        <div style={{ fontSize: 10, color: "var(--text4)", marginBottom: 4 }}>{m.l}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: m.ok ? "#22c55e" : "#ef4444" }}>{m.v} {m.ok ? "✓" : "✗"}</div>
                      </div>
                    ))}
                  </div>
                  {r.fallacies_detected?.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                      {r.fallacies_detected.map((f: string) => (
                        <span key={f} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "rgba(239,68,68,0.1)", color: "#f87171" }}>{f}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(!data || data.status === "no_results") && !running && (
          <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧪</div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No eval results yet</p>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24 }}>Run the suite to test agent accuracy and score calibration</p>
            <button onClick={runSuite} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Run eval suite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
