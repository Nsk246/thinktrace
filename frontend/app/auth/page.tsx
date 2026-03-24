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
    setLoading(true); setError("");
    try {
      const data = mode === "login"
        ? await login(form.email, form.password)
        : await register(form.email, form.password, form.full_name, form.org_name);
      setAuth(data.access_token, { user_id: data.user_id, org_id: data.org_id, role: data.role });
      router.push("/");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const status = e?.response?.status;
      if (status === 400) {
        setError(detail || "Invalid details. Please check your input.");
      } else if (status === 401) {
        setError("Incorrect email or password. Please try again.");
      } else if (status === 422) {
        const errors = e?.response?.data?.detail;
        if (Array.isArray(errors)) {
          setError(errors.map((err: any) => err.msg).join(". "));
        } else {
          setError(detail || "Please check your input and try again.");
        }
      } else {
        setError(detail || "Something went wrong. Please try again.");
      }
    } finally { setLoading(false); }
  };

  const inp = (placeholder: string, key: string, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={(form as any)[key]}
      onChange={e => setForm({ ...form, [key]: e.target.value })}
      onKeyDown={e => e.key === "Enter" && handle()}
      style={{
        width: "100%", height: 44,
        background: "var(--bg3)", border: "1px solid var(--border)",
        borderRadius: 10, color: "var(--text)", fontSize: 14,
        padding: "0 14px", outline: "none", fontFamily: "inherit",
        transition: "border-color 0.15s", marginBottom: 10,
      }}
      onFocus={e => e.target.style.borderColor = "#6366f1"}
      onBlur={e => e.target.style.borderColor = "var(--border)"}
    />
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "60px 20px" }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px", color: "#fff", fontWeight: 800, fontSize: 16,
            }}>TT</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6, letterSpacing: "-.5px" }}>
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text3)" }}>
              {mode === "login" ? "Sign in to ThinkTrace" : "Start your free workspace"}
            </p>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <div style={{
              display: "flex", background: "var(--bg3)",
              borderRadius: 10, padding: 4, marginBottom: 20,
            }}>
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, border: "none",
                  background: mode === m ? "linear-gradient(135deg,#6366f1,#0ea5e9)" : "transparent",
                  color: mode === m ? "#fff" : "var(--text3)",
                  fontSize: 13, fontWeight: mode === m ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                  {m === "login" ? "Sign in" : "Register"}
                </button>
              ))}
            </div>

            {mode === "register" && inp("Full name", "full_name")}
            {mode === "register" && inp("Organisation name", "org_name")}
            {inp("Email address", "email", "email")}
            {inp("Password", "password", "password")}
            {mode === "register" && form.password.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
                {[
                  { label: "8+ chars", ok: form.password.length >= 8 },
                  { label: "Uppercase", ok: /[A-Z]/.test(form.password) },
                  { label: "Number", ok: /[0-9]/.test(form.password) },
                ].map(r => (
                  <span key={r.label} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 100,
                    background: r.ok ? "rgba(34,197,94,0.12)" : "rgba(113,113,122,0.1)",
                    color: r.ok ? "#22c55e" : "var(--text4)",
                    fontWeight: 500,
                  }}>
                    {r.ok ? "✓" : "○"} {r.label}
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div style={{
                padding: "10px 14px", background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8,
                color: "#ef4444", fontSize: 13, marginBottom: 12,
              }}>{error}</div>
            )}

            <button onClick={handle} disabled={loading} style={{
              width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
              background: loading ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
              color: loading ? "var(--text4)" : "#fff",
              fontSize: 14, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.15s", marginTop: 4,
            }}>{loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
