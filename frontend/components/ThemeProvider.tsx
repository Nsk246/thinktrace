"use client";
import { createContext, useContext, useEffect, useState } from "react";

const ThemeCtx = createContext({ theme: "dark", toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const saved = localStorage.getItem("tt-theme") || "dark";
    setTheme(saved);
    document.documentElement.className = saved === "light" ? "light" : "";
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("tt-theme", next);
    document.documentElement.className = next === "light" ? "light" : "";
  };

  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}
