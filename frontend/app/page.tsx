"use client";

import { useState } from "react";
import { analyzeText, AnalysisResult } from "@/lib/api";
import { ScoreBadge } from "@/components/ScoreBadge";
import { FallacyCard } from "@/components/FallacyCard";
import { FactCheckResult } from "@/components/FactCheckResult";

export default function Home() {
  const [content, setContent] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!content.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await analyzeText(content);
      setResult(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Analysis failed. Check your API connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">ThinkTrace</h1>
            <p className="text-xs text-gray-500">Enterprise reasoning audit platform</p>
          </div>
          <a href="/dashboard" className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
            Dashboard →
          </a>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Analyze any argument</h2>
          <p className="text-sm text-gray-500 mb-4">
            Paste any text and ThinkTrace audits the reasoning using 4 parallel AI agents.
          </p>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none min-h-[140px] bg-gray-50"
            placeholder="Paste any argument here..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-gray-400">{content.length} characters</span>
            <button
              onClick={handleAnalyze}
              disabled={loading || !content.trim()}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Analyzing..." : "Analyze argument"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6 text-sm">{error}</div>
        )}

        {loading && (
          <div className="bg-white rounded-xl border border-gray-200 p-10 text-center shadow-sm">
            <div className="inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-gray-600 font-medium">Running 4 agents in parallel...</p>
            <p className="text-gray-400 text-sm mt-1">Logic mapping · Fallacy detection · Fact checking · Scoring</p>
          </div>
        )}

        {result && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ScoreBadge score={result.epistemic_score.overall_score} label="Overall score" />
              <ScoreBadge score={result.epistemic_score.evidence_score} label="Evidence score" />
              <ScoreBadge score={result.epistemic_score.logic_score} label="Logic score" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-2">Verdict</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{result.epistemic_score.summary}</p>
              <div className="flex gap-4 mt-4 text-sm text-gray-500">
                <span>{result.claim_count} claims</span>
                <span>{result.argument_graph.nodes} graph nodes</span>
                <span>{result.argument_graph.edges} logical edges</span>
                <span>{result.fallacies.length} fallacies</span>
              </div>
            </div>

            {result.fallacies.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Fallacies detected ({result.fallacies.length})</h3>
                {result.fallacies.map((f, i) => (
                  <FallacyCard key={i} name={f.name} severity={f.severity} explanation={f.explanation} />
                ))}
              </div>
            )}

            {result.fact_checks.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-4">Fact checks ({result.fact_checks.length})</h3>
                {result.fact_checks.map((fc, i) => (
                  <FactCheckResult key={i} verdict={fc.verdict} confidence={fc.confidence} explanation={fc.explanation} sources={fc.sources} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
