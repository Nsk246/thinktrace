"use client";
import { useState, useEffect } from "react";
import { getEvalResults, api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

const EVAL_EXPLANATIONS = [
  {
    id: "vaccine_misinfo",
    title: "Misinformation detection",
    description: "Tests whether the scorer correctly gives a very low score to a text making false claims that contradict scientific consensus. A passing agent scores this 0 to 30.",
    what_it_tests: "Epistemic scoring on misinformation",
    why_it_matters: "Ensures the system does not reward false or dangerous content with high scores.",
  },
  {
    id: "climate_science",
    title: "Sound argument recognition",
    description: "Tests whether the scorer correctly gives a high score to a well-evidenced scientific argument. A passing agent scores this 35 to 100.",
    what_it_tests: "Epistemic scoring on credible scientific content",
    why_it_matters: "Ensures the system rewards well-supported, logically valid arguments.",
  },
  {
    id: "supplement_marketing",
    title: "Fallacy detection in marketing",
    description: "Tests whether the fallacy detector correctly identifies multiple fallacies in a supplement marketing claim. A passing agent scores this 0 to 35 and finds at least 2 fallacies.",
    what_it_tests: "Fallacy detection on commercial misinformation",
    why_it_matters: "Ensures the system catches manipulative reasoning patterns commonly used in advertising.",
  },
];

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
    setMsg("Eval suite running. This takes around 2 minutes as each test case runs a full analysis...");
    try {
      await api.post("/api/v1/eval/run");
      setTimeout(async () => {
        const d = await getEvalResults().catch(() => null);
        setData(d); setRunning(false);
        setMsg("Eval suite complete. Results updated.");
      }, 120000);
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Failed to run eval suite.");
      setRunning(false);
    }
  };

  const getEvalExplanation = (evalId: string) =>
    EVAL_EXPLANATIONS.find(e => evalId?.includes(e.id)) || null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 20px 80px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", marginBottom: 6 }}>
              <span className="gradient-text">Eval Suite</span>
            </h1>
            <p style={{ fontSize: 14, color: "var(--text3)", maxWidth: 500, lineHeight: 1.65 }}>
              Automated tests that verify the agents are calibrated correctly. Each test runs a full analysis on a known input and checks whether the score and fallacy detection land in the expected range.
            </p>
          </div>
          <button onClick={runSuite} disabled={running} style={{
            padding: "10px 20px", borderRadius: 10, border: "none",
            background: running ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
            color: running ? "var(--text4)" : "#fff",
            fontSize: 13, fontWeight: 600, cursor: running ? "not-allowed" : "pointer",
            flexShrink: 0,
          }}>
            {running ? "Running..." : "Run suite"}
          </button>
        </div>

        {/* What PASS means */}
        <div className="card" style={{ padding: "18px 22px", marginBottom: 24, borderLeft: "3px solid #6366f1" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: "#6366f1", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            How to read these results
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            {[
              { label: "AGENT CORRECT", color: "#22c55e", bg: "rgba(34,197,94,0.1)", desc: "The agent scored this input within the expected range. The system is calibrated correctly for this case." },
              { label: "AGENT WRONG", color: "#ef4444", bg: "rgba(239,68,68,0.1)", desc: "The agent scored outside the expected range. This signals a calibration problem that needs investigation." },
            ].map(s => (
              <div key={s.label} style={{ padding: "12px 14px", background: s.bg, borderRadius: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: s.color, marginBottom: 6, letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {msg && (
          <div style={{ padding: "12px 16px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 10, color: "#818cf8", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* Test case explanations — always visible */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)", marginBottom: 14 }}>Test cases</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {EVAL_EXPLANATIONS.map((e, i) => (
              <div key={e.id} className="card" style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                    background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#6366f1",
                  }}>0{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{e.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text3)", lineHeight: 1.65, marginBottom: 10 }}>{e.description}</div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 100, background: "rgba(99,102,241,0.08)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                        Tests: {e.what_it_tests}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text4)", marginTop: 8, lineHeight: 1.5 }}>
                      Why it matters: {e.why_it_matters}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Results */}
        {data?.status === "complete" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { l: "Total cases", v: data.total, c: "#6366f1" },
                { l: "Agent correct", v: data.passed, c: "#22c55e" },
                { l: "Pass rate", v: `${data.pass_rate}%`, c: data.pass_rate === 100 ? "#22c55e" : "#f59e0b" },
              ].map(s => (
                <div key={s.l} className="card" style={{ padding: "16px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.l}</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: s.c, letterSpacing: "-1px" }}>{s.v}</div>
                </div>
              ))}
            </div>

            <h2 style={{ fontSize: 15, fontWeight: 600, color: "var(--text2)", marginBottom: 14 }}>Latest results</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {data.results?.map((r: any, idx: number) => {
                const explanation = getEvalExplanation(r.eval_id);
                return (
                  <div key={r.eval_id} className="card" style={{ padding: "20px 22px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 3 }}>
                          {explanation?.title || r.description}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text4)" }}>
                          {r.eval_id} · expected score {r.expected_score_range[0]} to {r.expected_score_range[1]}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 26, fontWeight: 800, color: "#6366f1", letterSpacing: "-1px" }}>{r.epistemic_score}</div>
                          <div style={{ fontSize: 10, color: "var(--text4)" }}>scored</div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 100,
                          background: r.passed ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                          color: r.passed ? "#22c55e" : "#ef4444",
                          whiteSpace: "nowrap",
                        }}>
                          {r.passed ? "Agent correct" : "Agent wrong"}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginBottom: explanation ? 12 : 0 }}>
                      {[
                        { l: "Score range", v: `${r.expected_score_range[0]} to ${r.expected_score_range[1]}`, ok: r.score_in_range },
                        { l: "Fallacy recall", v: r.fallacy_scores?.recall?.toFixed(2) ?? "N/A", ok: r.fallacy_recall_ok },
                        { l: "Claim accuracy", v: r.claim_scores?.accuracy?.toFixed(2) ?? "N/A", ok: true },
                      ].map(m => (
                        <div key={m.l} style={{ padding: "10px 12px", background: "var(--bg3)", borderRadius: 8 }}>
                          <div style={{ fontSize: 10, color: "var(--text4)", marginBottom: 4 }}>{m.l}</div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: m.ok ? "#22c55e" : "#ef4444" }}>
                            {m.v} {m.ok ? "✓" : "✗"}
                          </div>
                        </div>
                      ))}
                    </div>

                    {explanation && (
                      <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.06)", borderRadius: 8, fontSize: 12, color: "var(--text3)", lineHeight: 1.6 }}>
                        {explanation.why_it_matters}
                      </div>
                    )}

                    {r.fallacies_detected?.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 10 }}>
                        {r.fallacies_detected.map((f: string) => (
                          <span key={f} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "rgba(239,68,68,0.1)", color: "#f87171" }}>{f}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!data || data.status === "no_results") && !running && (
          <div className="card" style={{ padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🧪</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>No eval results yet</p>
            <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 24, maxWidth: 400, margin: "0 auto 24px" }}>
              Run the suite to verify the agents are scoring and detecting fallacies correctly. Results are saved and can be compared over time.
            </p>
            <button onClick={runSuite} style={{
              padding: "10px 24px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>
              Run eval suite
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
