import { useEffect, useState, type ChangeEvent } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Download, FileSpreadsheet, Loader2, ScanEye, ShieldAlert, Gauge, Target } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import StatCard from "../components/ui/StatCard";
import Button from "../components/ui/Button";
import { getAnalytics, getApiErrorMessage, uploadCsvFile } from "../lib/api";
import type { AnalyticsData, UploadReportResult } from "../types";

const PLATFORM_COLORS: Record<string, string> = {
  amazon: "#2563eb",
  google_maps: "#059669",
  yelp: "#8b5cf6",
  manual: "#f59e0b",
  csv_upload: "#0ea5e9",
};

const RANGE_OPTIONS = [
  { label: "Last 7 Days", value: 7 },
  { label: "Last 30 Days", value: 30 },
  { label: "Last 90 Days", value: 90 },
];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadReportResult | null>(null);
  const [uploadError, setUploadError] = useState("");

  const fetchAnalytics = async (range: number) => {
    setIsLoading(true);
    setError("");
    try {
      const { data } = await getAnalytics(range);
      setData(data);
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not load analytics."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const { data } = await uploadCsvFile(file);
      setUploadResult(data);
      fetchAnalytics(days); // refresh stats with the new batch
    } catch (err) {
      setUploadError(getApiErrorMessage(err, "Upload failed."));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleExport = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value"],
      ["Reviews Analyzed", data.reviewsAnalyzed],
      ["Fake Detected", data.fakeDetected],
      ["Fake Detected %", `${data.fakeDetectedPct}%`],
      ["Avg Confidence", `${data.avgConfidence}%`],
      ["Model Accuracy", data.modelAccuracy ? `${data.modelAccuracy}%` : "N/A"],
      ["Date Range", `Last ${days} days`],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reviewshield-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Build a lightweight confidence/risk heatmap from the daily trend data
  const heatmapCells = (data?.analysisTrend ?? []).map((d) => {
    const total = d.real + d.suspicious;
    const intensity = total > 0 ? d.suspicious / total : 0;
    return { date: d.date, intensity, total };
  });

  const platformTotal = data?.platformDistribution.reduce((sum, p) => sum + p.count, 0) || 0;

  return (
    <div className="mx-auto max-w-6xl">
      <TopBar />
      <div className="px-6 pt-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink-900">Analytics Overview</h1>
            <p className="text-sm text-ink-400">
              Comprehensive insights into review authenticity and model performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 focus:border-brand-400 focus:outline-none"
            >
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button icon={<Download className="h-4 w-4" />} onClick={handleExport} disabled={!data}>
              Export Report
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center text-ink-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={<ScanEye className="h-5 w-5" />}
                iconBg="#dbeafe"
                iconColor="#2563eb"
                label="Reviews Analyzed"
                value={(data?.reviewsAnalyzed ?? 0).toLocaleString()}
                trend={`Last ${days} days`}
                trendTone="neutral"
              />
              <StatCard
                icon={<ShieldAlert className="h-5 w-5" />}
                iconBg="#fee2e2"
                iconColor="#dc2626"
                label="Fake Detected"
                value={(data?.fakeDetected ?? 0).toLocaleString()}
                trend={`${data?.fakeDetectedPct ?? 0}% of analyzed traffic`}
                trendTone="danger"
              />
              <StatCard
                icon={<Gauge className="h-5 w-5" />}
                iconBg="#dcfce7"
                iconColor="#059669"
                label="Avg Confidence"
                value={`${data?.avgConfidence ?? 0}%`}
                trend="Across selected range"
                trendTone="success"
              />
              <StatCard
                icon={<Target className="h-5 w-5" />}
                iconBg="#ede9fe"
                iconColor="#7c3aed"
                label="Model Accuracy"
                value={data?.modelAccuracy ? `${data.modelAccuracy}%` : "N/A"}
                trend="TF-IDF + LogReg v1.0"
                trendTone="neutral"
              />
            </div>

            <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-bold text-ink-900">Analysis Trends</p>
                  <div className="flex items-center gap-4 text-xs text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-brand-500" /> Real
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-danger-500" /> Suspicious
                    </span>
                  </div>
                </div>
                {data && data.analysisTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={data.analysisTrend}>
                      <defs>
                        <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="susGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#dc2626" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11, fill: "#94a3b8" }}
                        tickFormatter={(d: string) => d.slice(5)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                      />
                      <Area type="monotone" dataKey="real" stroke="#2563eb" fill="url(#realGrad)" strokeWidth={2} />
                      <Area
                        type="monotone"
                        dataKey="suspicious"
                        stroke="#dc2626"
                        fill="url(#susGrad)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-[220px] items-center justify-center text-sm text-ink-400">
                    No analyses yet in this range.
                  </div>
                )}
              </div>

              <div className="card p-5">
                <p className="mb-4 text-sm font-bold text-ink-900">Platform Distribution</p>
                {data && data.platformDistribution.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart>
                        <Pie
                          data={data.platformDistribution}
                          dataKey="count"
                          nameKey="platform"
                          innerRadius={45}
                          outerRadius={70}
                          paddingAngle={3}
                        >
                          {data.platformDistribution.map((p) => (
                            <Cell key={p.platform} fill={PLATFORM_COLORS[p.platform] || "#94a3b8"} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-2 space-y-1.5">
                      {data.platformDistribution.map((p) => (
                        <div key={p.platform} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-medium capitalize text-ink-600">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: PLATFORM_COLORS[p.platform] || "#94a3b8" }}
                            />
                            {p.platform.replace("_", " ")}
                          </span>
                          <span className="font-mono text-ink-400">
                            {Math.round((p.count / platformTotal) * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex h-[160px] items-center justify-center text-sm text-ink-400">
                    No data yet.
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1fr] pb-8">
              <div className="card p-5">
                <p className="mb-1 text-sm font-bold text-ink-900">Suspicious-Rate Heatmap</p>
                <p className="mb-4 text-xs text-ink-400">
                  Daily share of flagged reviews - darker means a higher fake rate that day.
                </p>
                {heatmapCells.length > 0 ? (
                  <div className="grid grid-cols-10 gap-1.5">
                    {heatmapCells.map((c) => (
                      <div
                        key={c.date}
                        title={`${c.date}: ${Math.round(c.intensity * 100)}% suspicious (${c.total} reviews)`}
                        className="aspect-square rounded"
                        style={{
                          backgroundColor:
                            c.total === 0 ? "#f1f5f9" : `rgba(37, 99, 235, ${0.15 + c.intensity * 0.75})`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center text-sm text-ink-400">
                    No data yet.
                  </div>
                )}
              </div>

              <div className="card p-5">
                <p className="mb-1 text-sm font-bold text-ink-900">Batch Analysis</p>
                <p className="mb-4 text-xs text-ink-400">
                  Upload a CSV of reviews (any column named "review" or "text") to score them all at once.
                </p>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-200 py-8 text-center hover:border-brand-300 hover:bg-brand-50/40">
                  <FileSpreadsheet className="h-6 w-6 text-ink-400" />
                  <span className="text-sm font-semibold text-ink-600">
                    {uploading ? "Uploading..." : "Click to upload CSV"}
                  </span>
                  <input type="file" accept=".csv" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>

                {uploadError && (
                  <p className="mt-3 rounded-lg bg-danger-50 p-2.5 text-xs font-medium text-danger-600">
                    {uploadError}
                  </p>
                )}
                {uploadResult && (
                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-ink-50 p-3 text-center">
                    <div>
                      <p className="font-mono text-sm font-bold text-ink-900">
                        {uploadResult.totalReviews}
                      </p>
                      <p className="text-[10px] uppercase text-ink-400">Total</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold text-danger-600">
                        {uploadResult.fakeCount}
                      </p>
                      <p className="text-[10px] uppercase text-ink-400">Fake</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm font-bold text-success-600">
                        {uploadResult.genuineCount}
                      </p>
                      <p className="text-[10px] uppercase text-ink-400">Genuine</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
