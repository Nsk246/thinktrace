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
    try {
      const { data } = await api.get("/api/v1/watchdog/sources");
      setSources(data.sources || []);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/auth"; return; }
    load();
  }, []);

  const addSource = async () => {
    setLoading(true);
    try {
      await api.post("/api/v1/watchdog/sources", form);
      setMsg("Source added successfully");
      setForm({ source_id: "", url: "", label: "", interval_minutes: 60 });
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Failed to add source");
    } finally {
      setLoading(false);
    }
  };

  const checkNow = async (id: string) => {
    try {
      await api.post(`/api/v1/watchdog/sources/${id}/check-now`);
      setMsg(`Check triggered for ${id}`);
      setTimeout(load, 2000);
    } catch {}
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/api/v1/watchdog/sources/${id}`);
      load();
    } catch {}
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gradient">Watchdog</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>
            Autonomous monitoring — add URLs and ThinkTrace watches them for reasoning changes
          </p>
        </div>

        {msg && (
          <div className="rounded-xl p-3 mb-6 text-sm"
               style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
            {msg}
          </div>
        )}

        {/* Add form */}
        <div className="card p-6 mb-6 glow">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: "var(--text)" }}>Add a source to monitor</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { key: "source_id", label: "Source ID", placeholder: "bbc_tech" },
              { key: "label", label: "Label", placeholder: "BBC Technology" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs mb-1 block" style={{ color: "var(--text2)" }}>{f.label}</label>
                <input value={(form as any)[f.key]}
                       onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                       className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                       style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                       placeholder={f.placeholder} />
              </div>
            ))}
          </div>
          <div className="mb-4">
            <label className="text-xs mb-1 block" style={{ color: "var(--text2)" }}>URL</label>
            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })}
                   className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                   style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                   placeholder="https://example.com/article" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text2)" }}>Check every (minutes)</label>
              <input type="number" value={form.interval_minutes}
                     onChange={e => setForm({ ...form, interval_minutes: Number(e.target.value) })}
                     className="w-28 px-3 py-2 rounded-xl text-sm outline-none"
                     style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }} />
            </div>
            <button onClick={addSource} disabled={loading || !form.url || !form.source_id}
                    className="px-5 py-2 rounded-xl text-sm font-medium text-white accent-gradient disabled:opacity-40">
              {loading ? "Adding..." : "Add source"}
            </button>
          </div>
        </div>

        {/* Sources list */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: "var(--text)" }}>
            Active sources ({sources.length})
          </h2>
          {sources.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: "var(--text2)" }}>
              No sources yet — add one above to start monitoring
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map(s => (
                <div key={s.source_id} className="p-4 rounded-xl"
                     style={{ background: "var(--bg2)", border: "1px solid var(--border)" }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{s.label}</div>
                      <div className="text-xs mt-0.5 truncate max-w-xs" style={{ color: "var(--text2)" }}>{s.url}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => checkNow(s.source_id)}
                              className="text-xs px-3 py-1 rounded-lg"
                              style={{ background: "var(--accent-glow)", color: "var(--accent)" }}>
                        Check now
                      </button>
                      <button onClick={() => remove(s.source_id)}
                              className="text-xs px-3 py-1 rounded-lg"
                              style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-3 text-xs" style={{ color: "var(--text2)" }}>
                    <span>Checks: {s.check_count}</span>
                    <span>Alerts: {s.alert_count}</span>
                    <span>Every {s.interval_minutes}m</span>
                    {s.last_checked && <span>Last: {new Date(s.last_checked).toLocaleTimeString()}</span>}
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
