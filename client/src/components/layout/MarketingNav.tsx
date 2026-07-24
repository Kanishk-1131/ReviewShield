import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Button from "../ui/Button";
import { useAuth } from "../../context/AuthContext";

// "Analyze" / "Analytics" / "Enterprise" live inside the authenticated app,
// so from the marketing site they render as gated (dotted) nav items that
// route through sign-in - only "Home" is a real top-level marketing page.
const links = [
  { to: "/", label: "Home", gated: false },
  { to: "/app/analyze", label: "Analyze", gated: true },
  { to: "/app/analytics", label: "Analytics", gated: true },
  { to: "/register", label: "Enterprise", gated: true },
];

export default function MarketingNav() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const go = (to: string, gated: boolean) => {
    if (gated && !user) return navigate("/login");
    navigate(to);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <ShieldCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-lg font-bold text-ink-900">ReviewShield</span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => go(l.to, l.gated)}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
                l.gated
                  ? "border border-dashed border-ink-300 text-ink-400 hover:border-brand-300 hover:text-brand-600"
                  : "text-brand-600"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <Button size="sm" onClick={() => navigate("/app")}>
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden text-sm font-semibold text-ink-600 hover:text-ink-900 sm:block"
              >
                Sign In
              </Link>
              <Button size="sm" onClick={() => navigate("/register")}>
                Get Started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
