"use client";

import { useEffect, useState } from "react";
import { getDashboard } from "@/lib/api";
import Link from "next/link";

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Not authenticated or no data</p>
          <Link href="/" className="text-indigo-600 hover:underline">Go to home</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{data.org.name} — Dashboard</h1>
            <p className="text-xs text-gray-500">{data.org.slug}</p>
          </div>
          <Link href="/" className="text-sm text-indigo-600 font-medium">← Analyze</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total analyses", value: data.usage.total_analyses },
            { label: "Completed", value: data.usage.completed_analyses },
            { label: "Avg score", value: data.usage.avg_epistemic_score ?? "—" },
            { label: "Members", value: data.usage.member_count },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm text-center">
              <div className="text-3xl font-bold text-indigo-600 mb-1">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">Recent analyses</h3>
          {data.recent_analyses.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No analyses yet.{" "}
              <Link href="/" className="text-indigo-600 hover:underline">Run your first analysis →</Link>
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Preview</th>
                  <th className="pb-2 font-medium">Score</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_analyses.map((a: any) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-3 text-gray-700 max-w-xs truncate">{a.content_preview || "—"}</td>
                    <td className="py-3 font-medium text-indigo-600">{a.overall_score ?? "—"}</td>
                    <td className="py-3">
                      <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">{a.status}</span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </main>
  );
}
