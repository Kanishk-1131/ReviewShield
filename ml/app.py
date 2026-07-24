"""
ReviewShield - ML Prediction API
------------------------------------
Lightweight Flask microservice that wraps the trained TF-IDF + Logistic
Regression model behind a REST API, as specified in the PRD's System
Architecture (Express Backend -> Python ML API -> NLP/TF-IDF/Model).

Run:
    python app.py                      # dev server on :5001
    gunicorn -w 2 -b 0.0.0.0:5001 app:app   # production (Render/Railway)

Endpoints:
    GET  /health                -> liveness + whether a trained model is loaded
    GET  /metrics                -> stored evaluation metrics from training
    POST /predict                -> { text } -> single prediction
    POST /predict/batch          -> { reviews: [text, ...] } -> list of predictions
    POST /retrain                -> retrain on dataset/fake_reviews_dataset.csv (or an uploaded CSV path)
"""

import os
import subprocess
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

from predict import get_metrics, model_is_ready, predict_review

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
CORS(app)  # the Express backend + local dev frontend call this service directly

MAX_BATCH = 500


@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_loaded": model_is_ready(),
        "service": "reviewshield-ml-api",
    })


@app.get("/metrics")
def metrics():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503
    return jsonify(get_metrics())


@app.post("/predict")
def predict():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return jsonify({"error": "Field 'text' is required."}), 400
    if len(text) > 8000:
        return jsonify({"error": "Review text is too long (max 8000 characters)."}), 400

    result = predict_review(text)
    return jsonify(result)


@app.post("/predict/batch")
def predict_batch():
    if not model_is_ready():
        return jsonify({"error": "Model not trained yet. Run train.py first."}), 503

    data = request.get_json(silent=True) or {}
    reviews = data.get("reviews") or []
    if not isinstance(reviews, list) or not reviews:
        return jsonify({"error": "Field 'reviews' must be a non-empty array of strings."}), 400
    if len(reviews) > MAX_BATCH:
        return jsonify({"error": f"Batch too large. Max {MAX_BATCH} reviews per request."}), 400

    results = [predict_review(str(r)) for r in reviews]
    fake_count = sum(1 for r in results if r["is_fake"])
    return jsonify({
        "count": len(results),
        "fake_count": fake_count,
        "genuine_count": len(results) - fake_count,
        "results": results,
    })


@app.post("/retrain")
def retrain():
    """Kicks off train.py synchronously. Intended for the Admin module's
    'Retrain Model' action. For a large dataset this should be made async
    (e.g. a background job / queue) - kept simple here per project scope."""
    proc = subprocess.run(
        [sys.executable, os.path.join(BASE_DIR, "train.py")],
        capture_output=True, text=True, timeout=1800,
    )
    if proc.returncode != 0:
        return jsonify({"error": "Retraining failed.", "log": proc.stderr[-4000:]}), 500
    return jsonify({"status": "retrained", "metrics": get_metrics()})


if __name__ == "__main__":
    port = int(os.environ.get("ML_API_PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
