"use client";
import Link from "next/link";
import { Logo } from "@/components/Logo";
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

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const MoonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

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
  const isLoggedIn = mounted && !!token;

  return (
    <>
      <nav style={{
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 50,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          padding: "0 20px", height: 58,
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 16,
        }}>
          <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
            <Logo size={28} />
          </Link>

          {isLoggedIn && !isMobile && (
            <div style={{ display: "flex", gap: 1, flex: 1, justifyContent: "center" }}>
              {links.map(l => (
                <Link key={l.href} href={l.href} style={{
                  color: isActive(l.href) ? "var(--text)" : "var(--text3)",
                  fontSize: 13.5,
                  fontWeight: isActive(l.href) ? 500 : 400,
                  padding: "6px 13px",
                  borderRadius: 8,
                  background: isActive(l.href) ? "var(--bg3)" : "transparent",
                  textDecoration: "none",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  letterSpacing: "-0.1px",
                }}>{l.label}</Link>
              ))}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <button onClick={toggle} title="Toggle theme" style={{
              width: 34, height: 34, borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--bg2)",
              color: "var(--text3)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "border-color 0.15s, color 0.15s",
            }}>
              {mounted && theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>

            {isLoggedIn && !isMobile && (
              <button onClick={handleLogout} className="btn-ghost">Sign out</button>
            )}

            {!isLoggedIn && mounted && (
              <Link href="/auth" className="btn-primary" style={{
                display: "inline-block", textDecoration: "none", fontSize: 13,
              }}>Sign in</Link>
            )}

            {isLoggedIn && isMobile && (
              <button onClick={() => setMenuOpen(o => !o)} style={{
                width: 34, height: 34, borderRadius: 8,
                border: "1px solid var(--border)", background: "var(--bg2)",
                color: "var(--text)", cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 5, padding: 9,
              }}>
                <span style={{ display: "block", width: 16, height: 1.5, background: "currentColor", borderRadius: 1, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translateY(6.5px)" : "none" }} />
                <span style={{ display: "block", width: 16, height: 1.5, background: "currentColor", borderRadius: 1, transition: "opacity 0.2s", opacity: menuOpen ? 0 : 1 }} />
                <span style={{ display: "block", width: 16, height: 1.5, background: "currentColor", borderRadius: 1, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translateY(-6.5px)" : "none" }} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {mounted && menuOpen && isMobile && (
        <div style={{
          position: "fixed", top: 58, left: 0, right: 0, bottom: 0,
          zIndex: 48, background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)",
        }} onClick={() => setMenuOpen(false)}>
          <div style={{
            background: "var(--bg)",
            borderBottom: "1px solid var(--border)",
            padding: "10px 16px 20px",
          }} onClick={e => e.stopPropagation()}>
            {links.map(l => (
              <Link key={l.href} href={l.href} style={{
                display: "block", padding: "12px 16px",
                color: isActive(l.href) ? "var(--text)" : "var(--text2)",
                fontSize: 15, fontWeight: isActive(l.href) ? 600 : 400,
                background: isActive(l.href) ? "var(--bg3)" : "transparent",
                borderRadius: 10, textDecoration: "none", marginBottom: 2,
                transition: "background 0.15s",
              }}>{l.label}</Link>
            ))}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 10 }}>
              <button onClick={handleLogout} style={{
                width: "100%", padding: "11px 16px", borderRadius: 10,
                border: "1px solid var(--border)", background: "transparent",
                color: "var(--text3)", fontSize: 14, cursor: "pointer",
                textAlign: "left", fontFamily: "inherit",
              }}>Sign out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
