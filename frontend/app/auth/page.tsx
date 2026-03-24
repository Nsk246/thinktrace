"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, register } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/Navbar";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", org_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handle = async () => {
    setLoading(true);
    setError("");
    try {
      let data;
      if (mode === "login") {
        data = await login(form.email, form.password);
      } else {
        data = await register(form.email, form.password, form.full_name, form.org_name);
      }
      setAuth(data.access_token, { user_id: data.user_id, org_id: data.org_id, role: data.role });
      router.push("/");
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl accent-gradient flex items-center justify-center mx-auto mb-4 pulse-glow">
              <span className="text-white font-bold text-xl">TT</span>
            </div>
            <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text)" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="text-sm" style={{ color: "var(--text2)" }}>
              {mode === "login" ? "Sign in to ThinkTrace" : "Start your free workspace"}
            </p>
          </div>

          <div className="card p-6 glow">
            <div className="flex rounded-xl p-1 mb-6" style={{ background: "var(--bg2)" }}>
              {(["login", "register"] as const).map((m) => (
                <button key={m} onClick={() => setMode(m)}
                        className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                        style={{
                          background: mode === m ? "var(--accent)" : "transparent",
                          color: mode === m ? "white" : "var(--text2)",
                        }}>
                  {m === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {mode === "register" && (
                <>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>Full name</label>
                    <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                           className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                           style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                           placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>Organisation name</label>
                    <input value={form.org_name} onChange={e => setForm({ ...form, org_name: e.target.value })}
                           className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                           style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                           placeholder="Acme Corp" />
                  </div>
                </>
              )}
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>Email</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                       className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                       style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                       placeholder="you@company.com" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--text2)" }}>Password</label>
                <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                       onKeyDown={e => e.key === "Enter" && handle()}
                       className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition"
                       style={{ background: "var(--bg2)", border: "1px solid var(--border)", color: "var(--text)" }}
                       placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>
                {error}
              </div>
            )}

            <button onClick={handle} disabled={loading}
                    className="w-full mt-6 py-3 rounded-xl text-sm font-semibold text-white transition accent-gradient disabled:opacity-50">
              {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
