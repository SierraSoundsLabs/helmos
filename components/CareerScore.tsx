"use client";

interface CareerScoreProps {
  score: number;
  headline: string;
}

export default function CareerScore({ score, headline }: CareerScoreProps) {
  const getScoreColor = (s: number) => {
    if (s >= 70) return { text: "text-emerald-400", ring: "#10b981", label: "Strong" };
    if (s >= 50) return { text: "text-yellow-400", ring: "#f59e0b", label: "Growing" };
    if (s >= 30) return { text: "text-orange-400", ring: "#f97316", label: "Emerging" };
    return { text: "text-red-400", ring: "#ef4444", label: "Early Stage" };
  };

  const { text, ring, label } = getScoreColor(score);
  const circumference = 2 * Math.PI * 28;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="bg-[#0e0e0e] rounded-2xl border border-[#1e1e1e] p-5">
      <div className="flex items-center gap-5">
        {/* Circular score */}
        <div className="relative shrink-0">
          <svg width="72" height="72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#1e1e1e" strokeWidth="4" />
            <circle
              cx="36"
              cy="36"
              r="28"
              fill="none"
              stroke={ring}
              strokeWidth="4"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold ${text}`}>{score}</span>
          </div>
        </div>

        {/* Label + headline */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Career Score
            </p>
            <span className={`text-xs font-medium ${text}`}>· {label}</span>
          </div>
          <p className="text-sm text-zinc-300 leading-snug">{headline}</p>
        </div>
      </div>
    </div>
  );
}
