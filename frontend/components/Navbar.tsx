"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const links = [
  { href: "/", label: "Analyze" },
  { href: "/compare", label: "Compare" },
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
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

  const handleLogout = () => { logout(); router.push("/auth"); };
  const isActive = (href: string) => mounted && pathname === href;

  return (
    <>
      <nav style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          padding: "0 20px", height: 56,
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 12,
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 11,
            }}>TT</div>
            <span style={{ color: "var(--text)", fontWeight: 600, fontSize: 14, letterSpacing: "-.3px" }}>ThinkTrace</span>
          </Link>

          {/* Desktop nav links */}
          {mounted && token && !isMobile && (
            <div style={{ display: "flex", gap: 2, flex: 1, justifyContent: "center" }}>
              {links.map(l => (
                <Link key={l.href} href={l.href} style={{
                  color: isActive(l.href) ? "var(--text)" : "var(--text3)",
                  fontSize: 13, fontWeight: isActive(l.href) ? 500 : 400,
                  padding: "5px 12px", borderRadius: 8,
                  background: isActive(l.href) ? "var(--bg3)" : "transparent",
                  textDecoration: "none", transition: "all 0.15s", whiteSpace: "nowrap",
                }}>{l.label}</Link>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Theme toggle */}
            <button onClick={toggle} style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--border)", background: "var(--bg2)",
              color: "var(--text3)", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
            }}>
              {mounted && theme === "dark" ? "○" : "●"}
            </button>

            {/* Desktop sign out */}
            {mounted && token && !isMobile && (
              <button onClick={handleLogout} style={{
                fontSize: 13, padding: "6px 14px", borderRadius: 8,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text3)", cursor: "pointer",
              }}>Sign out</button>
            )}

            {/* Sign in (not logged in) */}
            {mounted && !token && (
              <Link href="/auth" style={{
                fontSize: 13, fontWeight: 500, padding: "6px 14px", borderRadius: 8,
                background: "linear-gradient(135deg,#6366f1,#0ea5e9)",
                color: "#fff", textDecoration: "none",
              }}>Sign in</Link>
            )}

            {/* Hamburger — mobile only when logged in */}
            {mounted && token && isMobile && (
              <button
                onClick={() => setMenuOpen(o => !o)}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg2)",
                  color: "var(--text)", cursor: "pointer",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 4, padding: 8,
                }}>
                <span style={{ display: "block", width: 16, height: 2, background: "var(--text)", borderRadius: 1, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translateY(6px)" : "none" }} />
                <span style={{ display: "block", width: 16, height: 2, background: "var(--text)", borderRadius: 1, transition: "all 0.2s", opacity: menuOpen ? 0 : 1 }} />
                <span style={{ display: "block", width: 16, height: 2, background: "var(--text)", borderRadius: 1, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translateY(-6px)" : "none" }} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {mounted && menuOpen && isMobile && (
        <div style={{
          position: "fixed", top: 56, left: 0, right: 0, bottom: 0,
          zIndex: 48, background: "rgba(0,0,0,0.5)",
        }} onClick={() => setMenuOpen(false)}>
          <div style={{
            background: "var(--bg)", borderBottom: "1px solid var(--border)",
            padding: "8px 16px 20px",
          }} onClick={e => e.stopPropagation()}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                display: "block", padding: "13px 16px",
                color: isActive(l.href) ? "var(--text)" : "var(--text2)",
                fontSize: 15, fontWeight: isActive(l.href) ? 600 : 400,
                background: isActive(l.href) ? "var(--bg3)" : "transparent",
                borderRadius: 10, textDecoration: "none", marginBottom: 4,
              }}>{l.label}</Link>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 8 }}>
              <button onClick={handleLogout} style={{
                width: "100%", padding: "12px 16px", borderRadius: 10,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text3)", fontSize: 14, cursor: "pointer", textAlign: "left",
              }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
