import type { ReactNode } from "react";

export default function StatCard({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  trend,
  trendTone = "success",
}: {
  icon: ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  trend?: string;
  trendTone?: "success" | "danger" | "neutral";
}) {
  const trendColor =
    trendTone === "success"
      ? "text-success-600"
      : trendTone === "danger"
      ? "text-danger-600"
      : "text-ink-400";

  return (
    <div className="card p-5">
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ backgroundColor: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-ink-900">{value}</p>
      {trend && <p className={`mt-1 text-xs font-medium ${trendColor}`}>{trend}</p>}
    </div>
  );
}
