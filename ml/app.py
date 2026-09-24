"""
ReviewShield - ML Prediction API (Multilingual Edition v2)
----------------------------------------------------------
Lightweight Flask microservice wrapping the trained multilingual
feature pipeline behind a REST API.

Response schema for /predict and /predict/batch (single result):
    {
      "label":             "Fake" | "Genuine",
      "confidence":        0.95,          # float 0-1
      "detected_language": "en",          # ISO 639-1
      "signals": [                        # deterministic explainability
        "High structural repetition detected (27% of phrase pairs repeated)",
        "Abnormally high positivity density: 34% of tokens carry positive/joy/trust sentiment"
      ],
      "human_score":  23.4,               # P(genuine) × 100 (for UI gauge)
      "risk_level":   "high",             # "low" | "medium" | "high"
      "is_fake":      true,
      "word_count":   42
    }

Run:
    python app.py                              # dev server on :5001
    gunicorn -w 2 -b 0.0.0.0:5001 app:app     # production

Endpoints:
    GET  /health          → liveness + model state
    GET  /metrics         → stored training metrics
    POST /predict         → { text } → single prediction
    POST /predict/batch   → { reviews: [...] } → list of predictions
    POST /retrain         → re-runs train.py synchronously
"""

import os
import subprocess
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

from predict import get_metrics, model_is_ready, predict_review

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)

MAX_BATCH    = 500
MAX_TEXT_LEN = 8000


# ---------------------------------------------------------------------------
# /health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({
        "status":       "ok",
        "model_loaded": model_is_ready(),
        "service":      "reviewshield-ml-api",
    })


# ---------------------------------------------------------------------------
# /metrics
# ---------------------------------------------------------------------------

@app.get("/metrics")
def metrics():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503
    return jsonify(get_metrics())


# ---------------------------------------------------------------------------
# /predict  (single review)
# ---------------------------------------------------------------------------

@app.post("/predict")
def predict():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()

    if not text:
        return jsonify({"error": "Field 'text' is required."}), 400
    if len(text) > MAX_TEXT_LEN:
        return jsonify({
            "error": f"Review text is too long (max {MAX_TEXT_LEN} characters)."
        }), 400

    result = predict_review(text)
    return jsonify(_format_response(result))


# ---------------------------------------------------------------------------
# /predict/batch  (up to MAX_BATCH reviews)
# ---------------------------------------------------------------------------

@app.post("/predict/batch")
def predict_batch():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503

    data    = request.get_json(silent=True) or {}
    reviews = data.get("reviews") or []

    if not isinstance(reviews, list) or not reviews:
        return jsonify({
            "error": "Field 'reviews' must be a non-empty array of strings."
        }), 400
    if len(reviews) > MAX_BATCH:
        return jsonify({
            "error": f"Batch too large. Max {MAX_BATCH} reviews per request."
        }), 400

    results    = [predict_review(str(r)) for r in reviews]
    formatted  = [_format_response(r) for r in results]
    fake_count = sum(1 for r in results if r["is_fake"])

    return jsonify({
        "count":         len(formatted),
        "fake_count":    fake_count,
        "genuine_count": len(formatted) - fake_count,
        "results":       formatted,
    })


# ---------------------------------------------------------------------------
# /retrain
# ---------------------------------------------------------------------------

@app.post("/retrain")
def retrain():
    """Kick off train.py synchronously.  For large datasets consider async."""
    proc = subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "train.py")],
        capture_output=True, text=True, timeout=1800,
    )
    if proc.returncode != 0:
        return jsonify({
            "error": "Retraining failed.",
            "log":   proc.stderr[-4000:],
        }), 500
    return jsonify({"status": "retrained", "metrics": get_metrics()})


# ---------------------------------------------------------------------------
# Response formatter
# ---------------------------------------------------------------------------

def _format_response(result: dict) -> dict:
    """Ensure every response matches the documented schema exactly.

    Keeps legacy fields (human_score, risk_level, is_fake, word_count)
    alongside the new multilingual fields so the Express backend and any
    existing clients don't break.
    """
    return {
        # ── Core classification ──────────────────────────────────────────
        "label":             result.get("label", "Genuine"),
        "is_fake":           bool(result.get("is_fake", False)),
        "confidence":        result.get("confidence", 0.5),

        # ── Multilingual additions ───────────────────────────────────────
        "detected_language": result.get("detected_language", "en"),
        "signals":           result.get("signals", []),

        # ── Legacy fields kept for backwards-compatibility ───────────────
        "human_score":       result.get("human_score", 50.0),
        "risk_level":        result.get("risk_level", "medium"),
        "word_count":        result.get("word_count", 0),

        # ── Optional debug note (only present if prediction was trivial) ─
        **( {"note": result["note"]} if "note" in result else {} ),
    }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("ML_API_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
