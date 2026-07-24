import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, ScanSearch, ShieldAlert, ShieldCheck, Gauge, ArrowRight } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import StatCard from "../components/ui/StatCard";
import Badge from "../components/ui/Badge";
import Button from "../components/ui/Button";
import { getDashboard, getApiErrorMessage } from "../lib/api";
import type { DashboardStats } from "../types";
import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await getDashboard();
        setStats(data);
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not load your dashboard."));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <TopBar title={`Welcome back, ${user?.name?.split(" ")[0] || "there"}`} subtitle="Here's your workspace at a glance." />

      <div className="px-6 pt-6 pb-8">
        {error && (
          <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-48 items-center justify-center text-ink-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                icon={<ScanSearch className="h-5 w-5" />}
                iconBg="#dbeafe"
                iconColor="#2563eb"
                label="Reviews Analyzed"
                value={(stats?.totalAnalyzed ?? 0).toLocaleString()}
              />
              <StatCard
                icon={<ShieldAlert className="h-5 w-5" />}
                iconBg="#fee2e2"
                iconColor="#dc2626"
                label="Fake Detected"
                value={(stats?.fakeDetected ?? 0).toLocaleString()}
                trend={stats ? `${stats.fakeRate}% of your reviews` : undefined}
                trendTone="danger"
              />
              <StatCard
                icon={<Gauge className="h-5 w-5" />}
                iconBg="#dcfce7"
                iconColor="#059669"
                label="Avg Confidence"
                value={`${stats?.avgConfidence ?? 0}%`}
                trendTone="success"
              />
            </div>

            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-bold text-ink-900">Recent Analyses</p>
                <Link
                  to="/app/history"
                  className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {!stats || stats.recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm text-ink-400">
                    You haven&apos;t analyzed any reviews yet.
                  </p>
                  <Link to="/app/analyze">
                    <Button size="sm" icon={<ScanSearch className="h-4 w-4" />}>
                      Analyze your first review
                    </Button>
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-ink-50">
                  {stats.recent.map((item) => (
                    <li key={item._id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        {item.label === "fake" ? (
                          <ShieldAlert className="h-4 w-4 shrink-0 text-danger-500" />
                        ) : (
                          <ShieldCheck className="h-4 w-4 shrink-0 text-success-500" />
                        )}
                        <p className="truncate text-sm text-ink-700">{item.review?.text}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-xs text-ink-400">{item.confidence}%</span>
                        <Badge tone={item.label === "fake" ? "danger" : "success"}>
                          {item.label === "fake" ? "Fake" : "Genuine"}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
