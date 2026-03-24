import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface ArgumentNode {
  id: string;
  text: string;
  node_type: string;
}

export interface ArgumentEdge {
  source_id: string;
  target_id: string;
  relation: string;
}

export interface AnalysisResult {
  status: string;
  analysis_id: string;
  claim_count: number;
  argument_graph: {
    nodes: ArgumentNode[];
    edges: ArgumentEdge[];
  };
  fallacies: {
    name: string;
    severity: string;
    affected_claim: string;
    explanation: string;
  }[];
  fact_checks: {
    claim_id: string;
    verdict: string;
    confidence: number;
    explanation: string;
    sources: string[];
  }[];
  epistemic_score: {
    evidence_score: number;
    logic_score: number;
    overall_score: number;
    summary: string;
  };
}

export const analyzeText = async (content: string, type = "text"): Promise<AnalysisResult> => {
  const { data } = await api.post("/api/v1/analyze", { content, content_type: type });
  return data;
};

export const analyzeFile = async (file: File): Promise<AnalysisResult> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/v1/ingest/pdf", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  if (data.claims) {
    const text = data.claims.map((c: any) => c.text).join(". ");
    return analyzeText(text, "text");
  }
  return data;
};

export const login = async (email: string, password: string) => {
  const { data } = await api.post("/api/v1/auth/login", { email, password });
  return data;
};

export const register = async (email: string, password: string, full_name: string, org_name: string) => {
  const { data } = await api.post("/api/v1/auth/register", { email, password, full_name, org_name });
  return data;
};

export const getDashboard = async () => {
  const { data } = await api.get("/api/v1/org/dashboard");
  return data;
};

export const getEvalResults = async () => {
  const { data } = await api.get("/api/v1/eval/results");
  return data;
};
