"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";

export default function TeamPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [form, setForm] = useState({ email: "", full_name: "", role: "member", password: "" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/api/v1/org/members");
      setMembers(data.members || []);
    } catch {}
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { window.location.href = "/auth"; return; }
    load();
  }, []);

  const invite = async () => {
    try {
      await api.post("/api/v1/org/members/invite", form);
      setMsg("Member invited successfully");
      setForm({ email: "", full_name: "", role: "member", password: "" });
      load();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "Failed to invite member");
    }
  };

  const remove = async (userId: string) => {
    try {
      await api.delete(`/api/v1/org/members/${userId}`);
      load();
    } catch {}
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gradient">Team</h1>
          <p className="text-sm mt-1" style={{ color: "var(--text2)" }}>Manage org members and roles</p>
        </div>

        {msg && (
          <div className="rounded-xl p-3 mb-6 text-sm"
               style={{ background: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}>
            {msg}
          </div>
        )}

        {/* Invite form */}
        <div className="card p-6 mb-6 glow">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: "var(--text)" }}>Invite a member</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {[
              { key: "full_name", label: "Full name", placeholder: "Jane Smith" },
              { key: "email", label: "Email", placeholder: "jane@company.com" },
              { key: "password", label: "Password", placeholder: "••••••••" },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs mb-1 block" style={{ color: "var(--text2)" }}>{f.label}</label>
                <input type={f.key === "password" ? "password" : "text"}
                       value={(form as any)[f.key]}
                       onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                       className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                       style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                       placeholder={f.placeholder} />
              </div>
            ))}
            <div>
              <label className="text-xs mb-1 block" style={{ color: "var(--text2)" }}>Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                      style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
          </div>
          <button onClick={invite} disabled={!form.email || !form.full_name}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white accent-gradient disabled:opacity-40">
            Invite member
          </button>
        </div>

        {/* Members list */}
        <div className="card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: "var(--text)" }}>
            Members ({members.length})
          </h2>
          <div className="space-y-3">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center justify-between p-4 rounded-xl"
                   style={{ background: "var(--bg2)" }}>
                <div>
                  <div className="font-medium text-sm" style={{ color: "var(--text)" }}>{m.full_name}</div>
                  <div className="text-xs" style={{ color: "var(--text2)" }}>{m.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full"
                        style={{
                          background: m.role === "admin" ? "var(--accent-glow)" : "var(--bg)",
                          color: m.role === "admin" ? "var(--accent)" : "var(--text2)",
                          border: "1px solid var(--border)",
                        }}>
                    {m.role}
                  </span>
                  {m.role !== "admin" && (
                    <button onClick={() => remove(m.user_id)}
                            className="text-xs px-2 py-1 rounded-lg"
                            style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
