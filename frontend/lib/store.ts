import { create } from "zustand";

interface AuthState {
  token: string | null;
  user: { user_id: string; org_id: string; role: string } | null;
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  getOrgId: () => string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: typeof window !== "undefined" ? localStorage.getItem("token") : null,
  user: typeof window !== "undefined" ? (() => {
    try {
      const t = localStorage.getItem("token");
      if (!t) return null;
      const payload = JSON.parse(atob(t.split(".")[1]));
      return { user_id: payload.sub, org_id: payload.org_id, role: payload.role };
    } catch { return null; }
  })() : null,
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
