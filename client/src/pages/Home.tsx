import { useNavigate } from "react-router-dom";
import { ShieldCheck, Zap, Lock, ArrowRight, ScanSearch, BrainCircuit, Gauge } from "lucide-react";
import MarketingNav from "../components/layout/MarketingNav";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useAuth } from "../context/AuthContext";

const stats = [
  { icon: ShieldCheck, iconBg: "#dbeafe", iconColor: "#2563eb", value: "95%", label: "Detection Accuracy" },
  { icon: Zap, iconBg: "#d1fae5", iconColor: "#059669", value: "Real-time", label: "AI Analysis" },
  { icon: Lock, iconBg: "#e0e7ff", iconColor: "#1e3a8a", value: "Secure", label: "Privacy First" },
];

const steps = [
  {
    icon: ScanSearch,
    title: "Paste or upload reviews",
    body: "Drop in a single review, or upload a CSV of reviews exported from Amazon, Yelp or Google Maps for batch analysis.",
  },
  {
    icon: BrainCircuit,
    title: "NLP + TF-IDF pipeline",
    body: "Text is cleaned, lemmatized and vectorized with TF-IDF, then scored by a Logistic Regression model trained on 40,000+ labelled reviews.",
  },
  {
    icon: Gauge,
    title: "Confidence score & insights",
    body: "Get a human-likelihood score, a risk level, and the exact words that pushed the verdict toward fake or genuine.",
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handlePrimaryCta = () => navigate(user ? "/app/analyze" : "/register");
  const handleSecondaryCta = () => navigate("/app");

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(37,99,235,0.08),transparent)]" />
        <div className="mx-auto max-w-4xl px-6 pb-20 pt-20 text-center">
          <div className="mb-6 flex justify-center">
            <Badge tone="brand" dot>
              AI-Powered Verification Engine 2.0
            </Badge>
          </div>
          <h1 className="font-display text-5xl font-extrabold leading-[1.08] text-ink-900 sm:text-6xl">
            Detect Fake Reviews with{" "}
            <span className="text-gradient-brand italic">AI Confidence</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-600">
            Analyze reviews instantly using Machine Learning, NLP, and Explainable AI. Protect
            your brand reputation and ensure consumer trust with 95% detection accuracy.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" icon={<ArrowRight className="h-4 w-4" />} onClick={handlePrimaryCta}>
              Start Detecting
            </Button>
            <Button size="lg" variant="secondary" onClick={handleSecondaryCta}>
              Explore Dashboard
            </Button>
          </div>

          <div className="mx-auto mt-16 grid max-w-2xl grid-cols-3 gap-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <div
                  className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: s.iconBg, color: s.iconColor }}
                >
                  <s.icon className="h-6 w-6" strokeWidth={2.25} />
                </div>
                <p className="font-display text-xl font-bold text-ink-900">{s.value}</p>
                <p className="text-xs font-medium text-ink-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Dashboard preview teaser */}
        <div className="mx-auto max-w-4xl px-6">
          <div className="card mx-auto -mb-24 max-w-3xl translate-y-10 p-6 shadow-card-lg">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Gauge className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">Workspace Analytics</p>
                <p className="text-xs text-ink-400">Enterprise Tier Dashboard</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 opacity-90">
              {[
                { label: "Reviews Analyzed", value: "24,592" },
                { label: "Fake Detected", value: "3,108" },
                { label: "Avg. Confidence", value: "94.2%" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-ink-100 bg-ink-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                    {s.label}
                  </p>
                  <p className="mt-1 font-mono text-lg font-bold text-ink-900">{s.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-ink-100 bg-ink-50 pb-24 pt-36">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="font-display text-3xl font-bold text-ink-900">How ReviewShield works</h2>
            <p className="mt-3 text-ink-600">
              A three-stage NLP pipeline turns raw review text into a defensible verdict.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="card p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <step.icon className="h-5 w-5" strokeWidth={2.25} />
                  </div>
                  <span className="font-mono text-xs font-semibold text-ink-300">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="font-display text-3xl font-bold text-ink-900">
            Ready to protect your product reviews?
          </h2>
          <p className="mt-3 text-ink-600">
            Create a free workspace and start scoring reviews in under a minute.
          </p>
          <div className="mt-8 flex justify-center">
            <Button size="lg" icon={<ArrowRight className="h-4 w-4" />} onClick={handlePrimaryCta}>
              Get Started Free
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-ink-100 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-xs text-ink-400">
          <span>&copy; {new Date().getFullYear()} ReviewShield. All rights reserved.</span>
          <span>TF-IDF + Logistic Regression &middot; v1.0</span>
        </div>
      </footer>
    </div>
  );
}
