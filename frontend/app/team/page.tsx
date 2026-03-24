"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", role: "member", password: "" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    try { const { data } = await api.get("/api/v1/org/members"); setMembers(data.members || []); } catch {}
  };

  useEffect(() => {
    if (!localStorage.getItem("token")) { window.location.href = "/auth"; return; }
    load();
  }, []);

  const invite = async () => {
    try {
      await api.post("/api/v1/org/members/invite", form);
      setMsg("Member invited successfully");
      setForm({ email: "", full_name: "", role: "member", password: "" });
      load();
    } catch (e: any) { setMsg(e?.response?.data?.detail || "Failed"); }
  };

  const inp = (placeholder: string, key: string, type = "text") => (
    <input type={type} placeholder={placeholder} value={(form as any)[key]}
           onChange={e => setForm({ ...form, [key]: e.target.value })}
           style={{ width: "100%", height: 42, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "0 12px", outline: "none", fontFamily: "inherit" }} />
  );

  const roleColors: Record<string, { bg: string; color: string }> = {
    admin:  { bg: "rgba(99,102,241,0.12)", color: "#818cf8" },
    member: { bg: "rgba(113,113,122,0.12)", color: "var(--text3)" },
    viewer: { bg: "rgba(113,113,122,0.08)", color: "var(--text4)" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", marginBottom: 4 }}>
            <span className="gradient-text">Team</span>
          </h1>
          <p style={{ fontSize: 13, color: "var(--text3)" }}>Manage org members and roles</p>
        </div>

        {msg && (
          <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#818cf8", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        <div className="card" style={{ padding: "20px 24px", marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 16 }}>Invite a member</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>{inp("Full name", "full_name")}</div>
            <div>{inp("Email address", "email", "email")}</div>
            <div>{inp("Password", "password", "password")}</div>
            <div>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      style={{ width: "100%", height: 42, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 13, padding: "0 12px", outline: "none" }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <button onClick={invite} disabled={!form.email || !form.full_name}
                  style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: !form.email ? 0.5 : 1 }}>
            Invite member
          </button>
        </div>

        <div className="card" style={{ padding: "20px 24px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text2)", marginBottom: 16 }}>Members ({members.length})</h2>
          {members.map(m => (
            <div key={m.user_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--bg3)", borderRadius: 10, marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                  {m.full_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{m.full_name}</div>
                  <div style={{ fontSize: 11, color: "var(--text4)" }}>{m.email}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 100, ...roleColors[m.role] || roleColors.member }}>{m.role}</span>
                {m.role !== "admin" && (
                  <button onClick={() => api.delete(`/api/v1/org/members/${m.user_id}`).then(load)}
                          style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)", color: "#ef4444", cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
