"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

const links = [
  { href: "/", label: "Analyze" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/watchdog", label: "Watchdog" },
  { href: "/evals", label: "Evals" },
  { href: "/team", label: "Team" },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const { token, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => { logout(); router.push("/auth"); };

  return (
    <nav style={{
      background: "var(--bg)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "0 24px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "-.3px",
          }}>TT</div>
          <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14, letterSpacing: "-.3px" }}>ThinkTrace</span>
        </Link>

        {token && (
          <div style={{ display: "flex", gap: 2, flex: 1, justifyContent: "center" }}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                color: pathname === l.href ? "var(--text)" : "var(--text3)",
                fontSize: 13,
                fontWeight: pathname === l.href ? 500 : 400,
                padding: "5px 12px",
                borderRadius: 8,
                background: pathname === l.href ? "var(--bg3)" : "transparent",
                textDecoration: "none",
                transition: "all 0.15s",
              }}>{l.label}</Link>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <button onClick={toggle} style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--bg2)",
            color: "var(--text3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            transition: "border-color 0.15s",
          }}>
            {theme === "dark" ? "○" : "●"}
          </button>

          {token ? (
            <button onClick={handleLogout} style={{
              fontSize: 13,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text3)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}>Sign out</button>
          ) : (
            <Link href="/auth" style={{
              fontSize: 13,
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              color: "#fff",
              textDecoration: "none",
            }}>Sign in</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
