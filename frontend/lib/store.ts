import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: { user_id: string; org_id: string; role: string } | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  getOrgId: () => string;
}

function parseToken(token: string | null): { user_id: string; org_id: string; role: string } | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("token");
      return null;
    }
    return { user_id: payload.sub, org_id: payload.org_id, role: payload.role };
  } catch {
    localStorage.removeItem("token");
    return null;
  }
}

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  // Validate it before returning
  if (token && parseToken(token) === null) {
    localStorage.removeItem("token");
    return null;
  }
  return token;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof window !== "undefined" ? getStoredToken() : null,
  user: typeof window !== "undefined" ? parseToken(localStorage.getItem("token")) : null,
  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null });
  },
  getOrgId: () => {
    const state = get();
    if (state.user?.org_id) return state.user.org_id;
    try {
      const t = localStorage.getItem("token");
      if (!t) return "default";
      const payload = JSON.parse(atob(t.split(".")[1]));
      return payload.org_id || "default";
    } catch { return "default"; }
  },
}));
