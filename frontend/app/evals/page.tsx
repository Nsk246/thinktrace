"use client";
import { useState, useEffect } from "react";
import { getEvalResults, api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function EvalsPage() {
  const [data, setData] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const d = await getEvalResults();
      setData(d);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/auth"; return; }
    load();
  }, []);

  const runSuite = async () => {
    setRunning(true);
    setMsg("Running eval suite... this takes ~2 minutes");
    try {
      await api.post("/api/v1/eval/run");
      setTimeout(async () => {
        await load();
        setRunning(false);
        setMsg("Eval suite complete");
      }, 120000);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Failed to run evals");
      setRunning(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gradient">Eval Suite</h1>
            <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
              LLM evaluation framework — tests fallacy detection, fact checking, and score calibration
            </p>
          </div>
          <button onClick={runSuite} disabled={running}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient disabled:opacity-50">
            {running ? "Running..." : "Run suite"}
          </button>
        </div>

        {msg && (
          <div className="rounded-xl p-3 mb-6 text-sm"
               style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
            {msg}
          </div>
        )}

        {data && data.status === "complete" && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total cases", val: data.total },
                { label: "Passed", val: data.passed, color: "#22c55e" },
                { label: "Pass rate", val: `${data.pass_rate}%`, color: data.pass_rate === 100 ? "#22c55e" : "#f59e0b" },
              ].map(s => (
                <div key={s.label} className="card p-5 text-center">
                  <div className="text-3xl font-bold mb-1" style={{ color: s.color || "var(--accent)" }}>{s.val}</div>
                  <div className="text-xs" style={{ color: "var(--text2)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Results */}
            <div className="space-y-4">
              {data.results?.map((r: any) => (
                <div key={r.eval_id} className="card p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold text-sm" style={{ color: "var(--text)" }}>{r.description}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>ID: {r.eval_id}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                        {r.epistemic_score}/100
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium"
                            style={{
                              background: r.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                              color: r.passed ? "#22c55e" : "#ef4444",
                            }}>
                        {r.passed ? "PASS" : "FAIL"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="p-3 rounded-xl" style={{ background: "var(--bg2)" }}>
                      <div className="font-medium mb-1" style={{ color: "var(--text2)" }}>Score range</div>
                      <div style={{ color: "var(--text)" }}>
                        {r.expected_score_range[0]}–{r.expected_score_range[1]}
                        <span className="ml-1" style={{ color: r.score_in_range ? "#22c55e" : "#ef4444" }}>
                          {r.score_in_range ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: "var(--bg2)" }}>
                      <div className="font-medium mb-1" style={{ color: "var(--text2)" }}>Fallacy recall</div>
                      <div style={{ color: "var(--text)" }}>
                        {r.fallacy_scores?.recall?.toFixed(2) ?? "—"}
                        <span className="ml-1" style={{ color: r.fallacy_recall_ok ? "#22c55e" : "#ef4444" }}>
                          {r.fallacy_recall_ok ? "✓" : "✗"}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 rounded-xl" style={{ background: "var(--bg2)" }}>
                      <div className="font-medium mb-1" style={{ color: "var(--text2)" }}>Claim accuracy</div>
                      <div style={{ color: "var(--text)" }}>
                        {r.claim_scores?.accuracy?.toFixed(2) ?? "—"}
                      </div>
                    </div>
                  </div>

                  {r.fallacies_detected?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {r.fallacies_detected.map((f: string) => (
                        <span key={f} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {(!data || data.status === "no_results") && !running && (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-4">🧪</div>
            <p className="font-semibold mb-2" style={{ color: "var(--text)" }}>No eval results yet</p>
            <p className="text-sm mb-6" style={{ color: "var(--text2)" }}>
              Run the suite to test fallacy detection, fact checking, and score calibration
            </p>
            <button onClick={runSuite}
                    className="px-6 py-2.5 rounded-xl text-sm font-medium text-white accent-gradient">
              Run eval suite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
