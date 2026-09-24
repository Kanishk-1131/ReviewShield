import { useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Languages } from "lucide-react";
import TopBar from "../components/layout/TopBar";
import Badge from "../components/ui/Badge";
import { getHistory, getApiErrorMessage } from "../lib/api";
import type { HistoryItem } from "../types";

// Compact language display helper (mirrors Analyze.tsx)
const LANG_NAMES: Record<string, string> = {
  en: "EN", es: "ES", fr: "FR", de: "DE", it: "IT", pt: "PT",
  zh: "ZH", "zh-cn": "ZH", ja: "JA", ko: "KO", ar: "AR",
  hi: "HI", ta: "TA", te: "TE", ru: "RU", nl: "NL",
};
function langCode(code: string): string {
  if (!code) return "EN";
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

type LabelFilter = "all" | "fake" | "genuine";

export default function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<LabelFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const { data } = await getHistory(page, 15, filter === "all" ? undefined : filter);
        setItems(data.items);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        setError(getApiErrorMessage(err, "Could not load history."));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [page, filter]);

  return (
    <div className="mx-auto max-w-6xl">
      <TopBar title="Analysis History" subtitle="Every review you've analyzed, most recent first." />

      <div className="px-6 pt-6">
        <div className="mb-4 flex gap-2">
          {(["all", "genuine", "fake"] as LabelFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "bg-white text-ink-500 border border-ink-200 hover:bg-ink-100"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}

        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-ink-400">
              No analyses yet. Head to the Analyze tab to check your first review.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-400">
                  <th className="px-5 py-3">Review</th>
                  <th className="px-5 py-3">Platform</th>
                  <th className="px-5 py-3">Language</th>
                  <th className="px-5 py-3">Verdict</th>
                  <th className="px-5 py-3">Confidence</th>
                  <th className="px-5 py-3">Signals</th>
                  <th className="px-5 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item._id} className="border-b border-ink-50 last:border-0 hover:bg-ink-50/60">
                    <td className="max-w-xs truncate px-5 py-3 text-ink-700">{item.review?.text}</td>
                    <td className="px-5 py-3 capitalize text-ink-500">
                      {item.review?.platform?.replace("_", " ")}
                    </td>
                    {/* Language badge */}
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                        <Languages className="h-3 w-3" />
                        {langCode(item.detectedLanguage ?? "en")}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge tone={item.label === "fake" ? "danger" : "success"}>
                        {item.label === "fake" ? "Fake" : "Genuine"}
                      </Badge>
                    </td>
                    {/* confidence: v2 stores 0-1 float; v1 stored 0-100 integer */}
                    <td className="px-5 py-3 font-mono text-ink-700">
                      {item.confidence <= 1
                        ? `${(item.confidence * 100).toFixed(1)}%`
                        : `${item.confidence}%`}
                    </td>
                    {/* Signals count chip */}
                    <td className="px-5 py-3">
                      {(item.signals?.length ?? 0) > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-warning-50 border border-yellow-200 px-2 py-0.5 text-xs font-semibold text-warning-700">
                          {item.signals.length} flag{item.signals.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-ink-500">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-100 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
