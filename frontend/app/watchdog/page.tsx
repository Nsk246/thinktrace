"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function WatchdogPage() {
  const [sources, setSources] = useState<any[]>([]);
  const [form, setForm] = useState({ source_id: "", url: "", label: "", interval_minutes: 60 });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/api/v1/watchdog/sources"); setSources(data.sources || []); } catch {}
  };

  useEffect(() => {
    if (!localStorage.getItem("token")) { window.location.href = "/auth"; return; }
    load();
  }, []);

  const addSource = async () => {
    setLoading(true);
    try {
      await api.post("/api/v1/watchdog/sources", form);
      setMsg("Source added successfully");
      setForm({ source_id: "", url: "", label: "", interval_minutes: 60 });
      load();
    } catch (e: any) { setMsg(e?.response?.data?.detail || "Failed"); }
    finally { setLoading(false); }
  };

  const inp = (placeholder: string, key: string, type = "text") => (
    <input type={type} placeholder={placeholder} value={(form as any)[key]}
           onChange={e => setForm({ ...form, [key]: e.target.value })}
           style={{ width: "100%", height: 42, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "0 12px", outline: "none", fontFamily: "inherit" }} />
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 }}>
            <span className="gradient-text">Watchdog</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)" }}>Autonomous monitoring — ThinkTrace watches URLs and alerts you when reasoning changes</p>
        </div>

        {msg && (
          <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#818cf8", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 16 }}>Add a source to monitor</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>{inp("Source ID (e.g. bbc_tech)", "source_id")}</div>
            <div>{inp("Label (e.g. BBC Technology)", "label")}</div>
          </div>
          <div style={{ marginBottom: 10 }}>{inp("URL (https://...)", "url")}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--text3)" }}>Check every</span>
              <input type="number" value={form.interval_minutes}
                     onChange={e => setForm({ ...form, interval_minutes: Number(e.target.value) })}
                     style={{ width: 70, height: 36, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "0 10px", outline: "none", textAlign: "center" }} />
              <span style={{ fontSize: 13, color: "var(--text3)" }}>minutes</span>
            </div>
            <button onClick={addSource} disabled={loading || !form.url || !form.source_id}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: loading || !form.url ? 0.5 : 1 }}>
              {loading ? "Adding..." : "Add source"}
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: "20px 24px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 16 }}>Active sources ({sources.length})</h2>
          {sources.length === 0 ? (
            <p style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 0" }}>No sources yet — add one above</p>
          ) : sources.map(s => (
            <div key={s.source_id} style={{ padding: "14px 16px", background: "var(--bg3)", borderRadius: 10, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", wordBreak: "break-all" }}>{s.url}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}>
                  <button onClick={() => api.post(`/api/v1/watchdog/sources/${s.source_id}/check-now`).then(load)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.08)", color: "#818cf8", cursor: "pointer" }}>
                    Check now
                  </button>
                  <button onClick={() => api.delete(`/api/v1/watchdog/sources/${s.source_id}`).then(load)}
                          style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer" }}>
                    Remove
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                {[["Checks", s.check_count], ["Alerts", s.alert_count], ["Interval", `${s.interval_minutes}m`]].map(([l, v]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#6366f1" }}>{v}</div>
                    <div style={{ fontSize: 10, color: "var(--text4)" }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
