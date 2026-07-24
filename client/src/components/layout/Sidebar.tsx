import { NavLink, useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  Home,
  ScanSearch,
  History,
  BarChart3,
  Settings,
  LifeBuoy,
  LogOut,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/analyze", label: "Analyze", icon: ScanSearch },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
          <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-display text-base font-bold leading-none text-ink-900">
            ReviewShield
          </p>
          <p className="text-[11px] font-medium text-ink-400">
            {user?.plan === "enterprise" ? "Enterprise Tier" : "Free Tier"}
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-brand-50 text-brand-700"
                  : "text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              }`
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-4 p-3">
        {user?.plan !== "enterprise" && (
          <div className="rounded-xl bg-brand-600 p-4 text-white">
            <div className="mb-1 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-bold">Upgrade Plan</p>
            </div>
            <p className="mb-3 text-xs text-brand-100">
              Get advanced LLM verification &amp; bulk exports.
            </p>
            <button className="w-full rounded-lg bg-white py-2 text-xs font-bold text-brand-700 hover:bg-brand-50">
              Upgrade Now
            </button>
          </div>
        )}
        <div className="space-y-1 border-t border-ink-100 pt-3">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            <LifeBuoy className="h-[18px] w-[18px]" />
            Support
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-danger-600 hover:bg-danger-50"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
