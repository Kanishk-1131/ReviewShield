import type { ReactNode } from "react";

type Tone = "brand" | "success" | "danger" | "warning" | "neutral";

const tones: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  success: "bg-success-50 text-success-600 border-emerald-200",
  danger: "bg-danger-50 text-danger-600 border-red-200",
  warning: "bg-warning-50 text-warning-600 border-amber-200",
  neutral: "bg-ink-100 text-ink-600 border-ink-200",
};

export default function Badge({
  tone = "neutral",
  children,
  dot = false,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]} ${className}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
