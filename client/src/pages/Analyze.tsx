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
  Languages,
  TriangleAlert,
  Info,
} from "lucide-react";
import TopBar from "../components/layout/TopBar";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import ConfidenceGauge from "../components/ConfidenceGauge";
import { analyzeReview, getApiErrorMessage } from "../lib/api";
import type { PredictionResult } from "../types";

// v2 multilingual pipeline stage labels
const pipelineStages = [
  "Unicode-safe text cleaning",
  "Script-aware tokenization",
  "Char n-gram TF-IDF (2–4)",
  "Structural feature extraction",
  "NRC lexicon scoring",
  "Logistic Regression scoring",
];

// Human-readable language names for common ISO 639-1 codes.
// Falls back to the raw code uppercased for unlisted languages.
const LANG_NAMES: Record<string, string> = {
  en: "English",   es: "Spanish",  fr: "French",   de: "German",
  it: "Italian",   pt: "Portuguese", nl: "Dutch",  ru: "Russian",
  zh: "Mandarin",  "zh-cn": "Mandarin", "zh-tw": "Mandarin (TW)",
  ja: "Japanese",  ko: "Korean",   ar: "Arabic",   hi: "Hindi",
  ta: "Tamil",     te: "Telugu",   bn: "Bengali",  tr: "Turkish",
  vi: "Vietnamese", pl: "Polish",  sv: "Swedish",  da: "Danish",
  fi: "Finnish",   no: "Norwegian", cs: "Czech",   ro: "Romanian",
  uk: "Ukrainian", fa: "Persian",  he: "Hebrew",   id: "Indonesian",
  ms: "Malay",     th: "Thai",     so: "Somali",   ca: "Catalan",
};

function langLabel(code: string): string {
  if (!code) return "Unknown";
  return LANG_NAMES[code.toLowerCase()] ?? code.toUpperCase();
}

// Whether the language uses right-to-left text direction
const RTL_LANGS = new Set(["ar", "he", "fa", "ur", "yi", "dv", "ps"]);

export default function Analyze() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const wordCount  = text.trim() ? text.trim().split(/\s+/).length : 0;
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

  const isFake    = result ? result.is_fake : false;
  const riskTone  = result?.risk_level === "high" ? "danger"
                  : result?.risk_level === "medium" ? "warning"
                  : "success";

  // v2: signals is a unified array; v1 fallback for cached responses
  const signals: string[] = result
    ? (result.signals?.length
        ? result.signals
        : [...(result.fake_signals ?? []), ...(result.genuine_signals ?? [])])
    : [];

  const detectedLang   = result?.detected_language ?? "en";
  const isRTL          = RTL_LANGS.has(detectedLang.toLowerCase());
  const textDirection  = isRTL ? "rtl" : "ltr";

  return (
    <div className="mx-auto max-w-6xl">
      <TopBar
        title="AI Review Analyzer"
        subtitle="Multilingual fake review detection — structural, lexical, and character-level analysis."
      />

      <div className="grid gap-6 p-6 lg:grid-cols-[1.3fr_1fr]">
        {/* ── Left column: input + explainability ─────────────────────── */}
        <div className="space-y-6">

          {/* Input card */}
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

            {/* Textarea — direction-aware for RTL scripts */}
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              dir={result ? textDirection : "auto"}
              placeholder="Paste a customer review here to check its authenticity…"
              className="w-full resize-none rounded-lg border border-ink-200 p-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />

            {/* Language badge — shown inline with word count once result is ready */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs text-ink-400">
                <span>{wordCount} Words</span>
                <span className="h-1 w-1 rounded-full bg-ink-300" />
                <span>Complexity: {complexity}</span>
                {result && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-ink-300" />
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 font-semibold text-brand-700"
                      title={`Detected language: ${langLabel(detectedLang)}`}
                    >
                      <Languages className="h-3 w-3" />
                      {langLabel(detectedLang)}
                    </span>
                  </>
                )}
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

          {/* Explainability panel */}
          <div className="card p-5">
            <p className="mb-4 text-sm font-bold text-ink-900">Structural & Lexical Signals</p>

            {!result ? (
              <p className="text-sm text-ink-400">
                Run an analysis to see the structural and lexical signals that drove the verdict.
              </p>
            ) : signals.length === 0 ? (
              /* Empty-state: no flags fired */
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-50">
                  <ShieldCheck className="h-5 w-5 text-success-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-700">No suspicious signals detected</p>
                  <p className="mt-1 text-xs text-ink-400">
                    Phrase variety, sentence-length variance, and sentiment density all appear
                    within natural human ranges.
                  </p>
                </div>
              </div>
            ) : (
              /* Signal chips */
              <div className="space-y-2.5">
                {signals.map((signal, idx) => {
                  // Heuristic: confidence fallback messages start with "Model confidence"
                  const isInfo = signal.startsWith("Model confidence");
                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-2.5 rounded-lg border p-3 text-xs leading-relaxed ${
                        isInfo
                          ? "border-brand-200 bg-brand-50 text-brand-700"
                          : isFake
                          ? "border-red-200 bg-danger-50 text-danger-700"
                          : "border-emerald-200 bg-success-50 text-success-700"
                      }`}
                    >
                      {isInfo ? (
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      )}
                      <span>{signal}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="mt-4 border-t border-ink-100 pt-3 text-xs leading-relaxed text-ink-500">
              Signals are computed deterministically from character n-gram patterns, phrase
              repetition ratios, sentence-length variance, and NRC emotion lexicon density —
              no secondary model inference at serving time.
            </p>
          </div>
        </div>

        {/* ── Right column: report + pipeline ──────────────────────────── */}
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

            {/* Language badge (prominent position in report card) */}
            {result && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-ink-100 bg-ink-50 px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-400">
                  <Languages className="h-3.5 w-3.5" />
                  Detected Language
                </span>
                <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {langLabel(detectedLang)}
                  {detectedLang !== "en" && (
                    <span className="ml-1 opacity-70">({detectedLang.toUpperCase()})</span>
                  )}
                </span>
              </div>
            )}

            <div className="mt-4 flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wide text-ink-400">Risk Level</span>
              <Badge tone={result ? riskTone : "neutral"}>
                {result ? result.risk_level.toUpperCase() : "—"}
              </Badge>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-ink-100 bg-ink-50 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-ink-400">
                  {result && !isFake ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wide">Authenticity</span>
                </div>
                <p className={`text-sm font-bold ${result && isFake ? "text-danger-600" : "text-success-600"}`}>
                  {!result ? "—" : isFake ? "Flagged" : "Verified"}
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

          {/* Detection pipeline card — updated for v2 */}
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
                Completed in {elapsedMs}ms (round-trip incl. network)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
