"use client";
import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";
import { useAuthStore } from "@/lib/store";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { theme, toggle } = useTheme();
  const { token, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/auth");
  };

  return (
    <nav style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}
         className="sticky top-0 z-50 px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg accent-gradient flex items-center justify-center">
            <span className="text-white font-bold text-xs">TT</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>ThinkTrace</span>
        </Link>

        <div className="flex items-center gap-2">
          {token && (
            <>
              <Link href="/" className="text-xs px-3 py-1.5 rounded-lg hover:bg-opacity-10 transition"
                    style={{ color: "var(--text2)" }}>
                Analyze
              </Link>
              <Link href="/dashboard" className="text-xs px-3 py-1.5 rounded-lg hover:bg-opacity-10 transition"
                    style={{ color: "var(--text2)" }}>
                Dashboard
              </Link>
              <Link href="/watchdog" className="text-xs px-3 py-1.5 rounded-lg hover:bg-opacity-10 transition"
                    style={{ color: "var(--text2)" }}>
                Watchdog
              </Link>
              <Link href="/evals" className="text-xs px-3 py-1.5 rounded-lg hover:bg-opacity-10 transition"
                    style={{ color: "var(--text2)" }}>
                Evals
              </Link>
            </>
          )}

          <button onClick={toggle}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                  style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
            {theme === "dark" ? "☀" : "◑"}
          </button>

          {token ? (
            <button onClick={handleLogout}
                    className="text-xs px-3 py-1.5 rounded-lg transition"
                    style={{ border: "1px solid var(--border)", color: "var(--text2)" }}>
              Sign out
            </button>
          ) : (
            <Link href="/auth"
                  className="text-xs px-3 py-1.5 rounded-lg text-white accent-gradient font-medium">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
