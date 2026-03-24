interface ScoreBadgeProps {
  score: number;
  label: string;
}

export function ScoreBadge({ score, label }: ScoreBadgeProps) {
  const color =
    score >= 70
      ? "bg-green-100 text-green-800 border-green-300"
      : score >= 40
      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
      : "bg-red-100 text-red-800 border-red-300";

  const bar =
    score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className={`rounded-lg border p-4 ${color}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-2xl font-bold">{score}</span>
      </div>
      <div className="w-full bg-white bg-opacity-50 rounded-full h-2">
        <div
          className={`h-2 rounded-full ${bar} transition-all duration-500`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
