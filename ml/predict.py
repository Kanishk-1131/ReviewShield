"""
ReviewShield - Prediction Module
------------------------------------
Loads the trained TF-IDF vectorizer + Logistic Regression model and exposes
`predict_review()`, used by both app.py (REST API) and this CLI.

Also implements a lightweight "Explainable AI" layer: for a given review we
surface which words in *that specific review* pushed the model toward
FAKE or GENUINE, using the model's learned coefficients (no black box).
"""

import json
import os
import sys

import joblib
import numpy as np

from preprocessing import preprocess, tokenize_and_lemmatize, clean_text

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

_model = None
_vectorizer = None
_metrics = None


def _load():
    global _model, _vectorizer, _metrics
    if _model is None:
        _model = joblib.load(os.path.join(MODEL_DIR, "model.pkl"))
        _vectorizer = joblib.load(os.path.join(MODEL_DIR, "vectorizer.pkl"))
        metrics_path = os.path.join(MODEL_DIR, "metrics.json")
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                _metrics = json.load(f)
    return _model, _vectorizer


def model_is_ready() -> bool:
    return os.path.exists(os.path.join(MODEL_DIR, "model.pkl")) and os.path.exists(
        os.path.join(MODEL_DIR, "vectorizer.pkl")
    )


def get_metrics() -> dict:
    _load()
    return _metrics or {}


def _explain(clean_tokens, vectorizer, model, top_n=5):
    """Return the tokens from this specific review with the strongest
    positive (fake-leaning) and negative (genuine-leaning) contribution."""
    vocab = vectorizer.vocabulary_
    coefs = model.coef_[0]
    contributions = []
    seen = set()
    for tok in clean_tokens:
        if tok in vocab and tok not in seen:
            seen.add(tok)
            idx = vocab[tok]
            contributions.append((tok, float(coefs[idx])))
    contributions.sort(key=lambda x: x[1], reverse=True)
    fake_signals = [t for t, w in contributions if w > 0][:top_n]
    genuine_signals = [t for t, w in contributions[::-1] if w < 0][:top_n]
    return fake_signals, genuine_signals


def predict_review(text: str) -> dict:
    model, vectorizer = _load()

    cleaned = clean_text(text)
    tokens = tokenize_and_lemmatize(cleaned)
    processed = " ".join(tokens)

    if not processed:
        return {
            "label": "genuine",
            "is_fake": False,
            "confidence": 50.0,
            "human_score": 50.0,
            "risk_level": "low",
            "fake_signals": [],
            "genuine_signals": [],
            "word_count": len(text.split()),
            "note": "Review too short/generic to analyze reliably.",
        }

    X = vectorizer.transform([processed])
    proba = model.predict_proba(X)[0]  # [P(genuine), P(fake)]
    fake_proba = float(proba[1])
    is_fake = fake_proba >= 0.5
    confidence = round((fake_proba if is_fake else 1 - fake_proba) * 100, 1)
    human_score = round((1 - fake_proba) * 100, 1)

    if confidence >= 80:
        risk = "high" if is_fake else "low"
    elif confidence >= 60:
        risk = "medium" if is_fake else "low"
    else:
        risk = "medium"

    fake_signals, genuine_signals = _explain(tokens, vectorizer, model)

    return {
        "label": "fake" if is_fake else "genuine",
        "is_fake": is_fake,
        "confidence": confidence,          # confidence in the predicted label
        "human_score": human_score,        # P(genuine) * 100 - matches the UI's "% HUMAN" gauge
        "risk_level": risk,
        "fake_signals": fake_signals,
        "genuine_signals": genuine_signals,
        "word_count": len(text.split()),
    }


if __name__ == "__main__":
    text = " ".join(sys.argv[1:]) or (
        "Absolutely incredible product!!! Best purchase ever, 10/10 would recommend to everyone!"
    )
    result = predict_review(text)
    print(json.dumps(result, indent=2))
