interface FactCheckResultProps {
  verdict: string;
  confidence: number;
  explanation: string;
  sources: string[];
}

const verdictStyles: Record<string, { bg: string; text: string; label: string }> = {
  supported: { bg: "bg-green-50 border-green-200", text: "text-green-700", label: "Supported" },
  contradicted: { bg: "bg-red-50 border-red-200", text: "text-red-700", label: "Contradicted" },
  contested: { bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-700", label: "Contested" },
  unverifiable: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600", label: "Unverifiable" },
};

export function FactCheckResult({ verdict, confidence, explanation, sources }: FactCheckResultProps) {
  const style = verdictStyles[verdict] || verdictStyles.unverifiable;
  return (
    <div className={`border rounded-lg p-4 mb-3 ${style.bg}`}>
      <div className="flex justify-between items-center mb-2">
        <span className={`font-semibold text-sm ${style.text}`}>{style.label}</span>
        <span className="text-xs text-gray-500">{Math.round(confidence * 100)}% confidence</span>
      </div>
      <p className="text-sm text-gray-700 mb-2">{explanation}</p>
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sources.map((s, i) => (
            <span key={i} className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
