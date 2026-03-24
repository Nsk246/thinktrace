interface FallacyCardProps {
  name: string;
  severity: string;
  explanation: string;
}

const severityStyles: Record<string, string> = {
  high: "border-l-red-500 bg-red-50",
  medium: "border-l-yellow-500 bg-yellow-50",
  low: "border-l-blue-500 bg-blue-50",
};

const severityBadge: Record<string, string> = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-blue-100 text-blue-700",
};

export function FallacyCard({ name, severity, explanation }: FallacyCardProps) {
  return (
    <div
      className={`border-l-4 rounded-r-lg p-4 mb-3 ${
        severityStyles[severity] || severityStyles.medium
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-semibold text-gray-900 text-sm">{name}</span>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            severityBadge[severity] || severityBadge.medium
          }`}
        >
          {severity}
        </span>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
    </div>
  );
}
