import { Bell, HelpCircle, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function TopBar({ title, subtitle }: { title?: string; subtitle?: string }) {
  const { user } = useAuth();
  const initials = (user?.name || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 bg-white px-6">
      <div>
        {title && <h1 className="font-display text-lg font-bold text-ink-900">{title}</h1>}
        {subtitle && <p className="text-xs text-ink-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative hidden sm:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            placeholder="Search analyses..."
            className="w-56 rounded-lg border border-ink-200 bg-ink-50 py-2 pl-9 pr-3 text-sm text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
        </div>
        <button className="relative rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-600">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-danger-500" />
        </button>
        <button className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-600">
          <HelpCircle className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2.5 border-l border-ink-200 pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
            {initials}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-semibold leading-tight text-ink-900">{user?.name}</p>
            <p className="text-[11px] uppercase leading-tight text-ink-400">{user?.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
