import { useState, type FormEvent } from "react";
import {
  Copy,
  Trash2,
  Share2,
  Download,
  ScanSearch,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import ConfidenceGauge from "../components/ConfidenceGauge";
import { analyzeReview, getApiErrorMessage } from "../lib/api";
import type { PredictionResult } from "../types";

const pipelineStages = [
  "Text Cleaning",
  "Tokenization & Lemmatization",
  "TF-IDF Vectorization",
  "Logistic Regression Scoring",
];

export default function Analyze() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const complexity = wordCount > 60 ? "High" : wordCount > 20 ? "Medium" : "Low";

  const handleAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setError("");
    setIsLoading(true);
    const startedAt = performance.now();
    try {
      const { data } = await analyzeReview(text.trim());
      setResult(data);
      setElapsedMs(Math.round(performance.now() - startedAt));
    } catch (err) {
      setError(getApiErrorMessage(err, "Analysis failed. Is the ML API running?"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setText("");
    setResult(null);
    setError("");
  };

  const riskTone =
    result?.risk_level === "high" ? "danger" : result?.risk_level === "medium" ? "warning" : "success";

  return (
    <div className="mx-auto max-w-6xl">
      <TopBar
        title="AI Review Analyzer"
        subtitle="Detect deceptive content, bot-generated spam, and sentiment manipulation."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Left column: input + explainability */}
        <div className="space-y-6">
          <form onSubmit={handleAnalyze} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-400">
                Paste Review for Analysis
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.readText().then(setText).catch(() => {})}
                  className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  title="Paste from clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-md p-1.5 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  title="Clear"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              placeholder="Paste a customer review here to check its authenticity..."
              className="w-full resize-none rounded-lg border border-ink-200 p-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-ink-400">
                <span>{wordCount} Words</span>
                <span className="h-1 w-1 rounded-full bg-ink-300" />
                <span>Linguistic complexity: {complexity}</span>
              </div>
              <Button type="submit" icon={<ScanSearch className="h-4 w-4" />} isLoading={isLoading}>
                Analyze Review
              </Button>
            </div>

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-danger-50 p-3 text-xs font-medium text-danger-600">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </form>

          <div className="card p-5">
            <p className="mb-4 text-sm font-bold text-ink-900">Explainable AI Insights</p>
            {!result ? (
              <p className="text-sm text-ink-400">
                Run an analysis to see which words in the review pushed the verdict toward fake
                or genuine.
              </p>
            ) : (
              <div className="space-y-4">
                {result.fake_signals.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-600">
                      Pushed toward Fake
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.fake_signals.map((w) => (
                        <span
                          key={w}
                          className="rounded-md border border-red-200 bg-danger-50 px-2.5 py-1 font-mono text-xs font-medium text-danger-600"
                        >
                          "{w}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.genuine_signals.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-success-600">
                      Pushed toward Genuine
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.genuine_signals.map((w) => (
                        <span
                          key={w}
                          className="rounded-md border border-emerald-200 bg-success-50 px-2.5 py-1 font-mono text-xs font-medium text-success-600"
                        >
                          "{w}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p className="border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
                  Each word is weighted by the Logistic Regression model's learned coefficients
                  for that term - this is the model's actual decision boundary, not a
                  post-hoc guess.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column: report + pipeline */}
        <div className="space-y-6">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-ink-400">
                {result ? `REPORT ID #${result.predictionId.slice(-6).toUpperCase()}` : "REPORT ID —"}
              </span>
              <button className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100" title="Share">
                <Share2 className="h-4 w-4" />
              </button>
            </div>

            <div className="flex justify-center py-2">
              <ConfidenceGauge score={result?.human_score ?? 50} />
            </div>

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-400">Risk Level</span>
              <Badge tone={result ? riskTone : "neutral"}>
                {result ? result.risk_level.toUpperCase() : "—"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-100 bg-ink-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-ink-400">
                  {result && !result.is_fake ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide">Authenticity</span>
                </div>
                <p
                  className={`text-sm font-bold ${
                    result && result.is_fake ? "text-danger-600" : "text-success-600"
                  }`}
                >
                  {!result ? "—" : result.is_fake ? "Flagged" : "Verified"}
                </p>
              </div>
              <div className="rounded-lg border border-ink-100 bg-ink-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-ink-400">
                  <ScanSearch className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wide">Pattern Bias</span>
                </div>
                <p className="text-sm font-bold text-ink-800">
                  {!result
                    ? "—"
                    : result.risk_level === "low"
                    ? "Negligible"
                    : result.risk_level === "medium"
                    ? "Moderate"
                    : "Elevated"}
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              className="mt-4 w-full"
              icon={<Download className="h-4 w-4" />}
              disabled={!result}
            >
              Download Full Audit
            </Button>
          </div>

          <div className="card p-5">
            <p className="mb-4 text-sm font-bold text-ink-900">Detection Pipeline</p>
            <ul className="space-y-3">
              {pipelineStages.map((stage) => (
                <li key={stage} className="flex items-center gap-2.5">
                  <CheckCircle2
                    className={`h-4 w-4 shrink-0 ${result ? "text-success-500" : "text-ink-200"}`}
                  />
                  <span className={`text-sm ${result ? "text-ink-700" : "text-ink-400"}`}>
                    {stage}
                  </span>
                </li>
              ))}
            </ul>
            {result && elapsedMs !== null && (
              <p className="mt-4 border-t border-ink-100 pt-3 font-mono text-xs text-ink-400">
                Completed in {elapsedMs}ms
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
