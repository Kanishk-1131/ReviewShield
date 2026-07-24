interface ConfidenceGaugeProps {
  score: number; // 0-100, human/genuine score
  size?: number;
}

export default function ConfidenceGauge({ score, size = 176 }: ConfidenceGaugeProps) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;

  const color = clamped >= 70 ? "#059669" : clamped >= 40 ? "#d97706" : "#dc2626";
  const track = clamped >= 70 ? "#d1fae5" : clamped >= 40 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-3xl font-bold text-ink-900">{Math.round(clamped)}%</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-400">Human</span>
      </div>
    </div>
  );
}
