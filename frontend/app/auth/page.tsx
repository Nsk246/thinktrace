"use client";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { useRouter } from "next/navigation";
import { login, api } from "@/lib/api";
import { useAuthStore } from "@/lib/store";
import { Navbar } from "@/components/Navbar";

type Step = "form" | "otp";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", org_name: "" });
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const { setAuth } = useAuthStore();
  const router = useRouter();

  const handleForm = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      if (mode === "login") {
        const data = await login(form.email, form.password);
        setAuth(data.access_token, { user_id: data.user_id, org_id: data.org_id, role: data.role });
        router.push("/");
      } else {
        const { data } = await api.post("/api/v1/auth/register", {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          org_name: form.org_name,
        });
        setInfo(data.message);
        setStep("otp");
      }
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      const status = e?.response?.status;
      if (status === 400) setError(detail || "Invalid details. Please check your input.");
      else if (status === 401) setError("Incorrect email or password. Please try again.");
      else if (status === 422) {
        const errors = e?.response?.data?.detail;
        setError(Array.isArray(errors) ? errors.map((err: any) => err.msg).join(". ") : detail || "Please check your input.");
      } else setError(detail || "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/api/v1/auth/verify-otp", {
        email: form.email,
        otp: otp.trim(),
      });
      setAuth(data.access_token, { user_id: data.user_id, org_id: data.org_id, role: data.role });
      router.push("/");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(detail || "Invalid or expired code. Please try again.");
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setLoading(true); setError(""); setInfo("");
    try {
      const { data } = await api.post(`/api/v1/auth/resend-otp?email=${encodeURIComponent(form.email)}`);
      setInfo(data.message);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Could not resend code.");
    } finally { setLoading(false); }
  };

  const inp = (placeholder: string, key: string, type = "text") => (
    <input
      type={type}
      placeholder={placeholder}
      value={(form as any)[key]}
      onChange={e => setForm({ ...form, [key]: e.target.value })}
      onKeyDown={e => e.key === "Enter" && handleForm()}
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
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <Logo size={48} showText={false} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6, letterSpacing: "-.5px" }}>
              {step === "otp" ? "Check your email" : mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p style={{ fontSize: 13, color: "var(--text3)" }}>
              {step === "otp"
                ? `We sent a 6-digit code to ${form.email}`
                : mode === "login" ? "Sign in to ThinkTrace" : "Start your free workspace"}
            </p>
          </div>

          <div className="card" style={{ padding: 24 }}>
            {/* OTP verification step */}
            {step === "otp" ? (
              <>
                {info && (
                  <div style={{ padding: "10px 14px", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, color: "#818cf8", fontSize: 13, marginBottom: 14 }}>
                    {info}
                  </div>
                )}

                <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 16, lineHeight: 1.6 }}>
                  Enter the 6-digit verification code from your email. Check your spam folder if you do not see it.
                </p>

                <input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  maxLength={6}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={e => e.key === "Enter" && handleVerifyOtp()}
                  style={{
                    width: "100%", height: 56,
                    background: "var(--bg3)", border: "1px solid var(--border)",
                    borderRadius: 12, color: "var(--text)",
                    fontSize: 28, fontWeight: 700,
                    padding: "0 14px", outline: "none",
                    fontFamily: "monospace", letterSpacing: "12px",
                    textAlign: "center", marginBottom: 14,
                    transition: "border-color 0.15s",
                  }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "var(--border)"}
                />

                {error && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                <button onClick={handleVerifyOtp} disabled={loading || otp.length !== 6} style={{
                  width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                  background: loading || otp.length !== 6 ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
                  color: loading || otp.length !== 6 ? "var(--text4)" : "#fff",
                  fontSize: 14, fontWeight: 600,
                  cursor: loading || otp.length !== 6 ? "not-allowed" : "pointer",
                  transition: "all 0.15s", marginBottom: 12,
                }}>
                  {loading ? "Verifying..." : "Verify and create account"}
                </button>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button onClick={() => { setStep("form"); setOtp(""); setError(""); }} style={{
                    background: "none", border: "none", color: "var(--text3)",
                    fontSize: 13, cursor: "pointer", padding: 0,
                  }}>
                    ← Back
                  </button>
                  <button onClick={handleResend} disabled={loading} style={{
                    background: "none", border: "none", color: "#818cf8",
                    fontSize: 13, cursor: "pointer", padding: 0,
                  }}>
                    Resend code
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Login/Register form */}
                <div style={{ display: "flex", background: "var(--bg3)", borderRadius: 10, padding: 4, marginBottom: 20 }}>
                  {(["login", "register"] as const).map(m => (
                    <button key={m} onClick={() => { setMode(m); setError(""); }} style={{
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
                        color: r.ok ? "#22c55e" : "var(--text4)", fontWeight: 500,
                      }}>
                        {r.ok ? "✓" : "○"} {r.label}
                      </span>
                    ))}
                  </div>
                )}

                {error && (
                  <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, color: "#ef4444", fontSize: 13, marginBottom: 12 }}>
                    {error}
                  </div>
                )}

                <button onClick={handleForm} disabled={loading} style={{
                  width: "100%", padding: "11px 0", borderRadius: 10, border: "none",
                  background: loading ? "var(--bg3)" : "linear-gradient(135deg,#6366f1,#0ea5e9)",
                  color: loading ? "var(--text4)" : "#fff",
                  fontSize: 14, fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.15s", marginTop: 4,
                }}>
                  {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Send verification code"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
