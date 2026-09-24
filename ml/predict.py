"""
ReviewShield - Prediction Module (Multilingual Edition v2)
----------------------------------------------------------
Mirrors the training pipeline exactly:

  raw text  →  langdetect (fallback 'en')
            →  preprocess()          (char-ngram TF-IDF input)
            →  vectorizer.transform  (sparse)
            →  extract_structural_features_single  (dense 1×2)
            →  extract_lexicon_features_single      (dense 1×2)
            →  hstack([sparse | dense_4_scaled])
            →  model.predict_proba
            →  deterministic signals (structural + lexicon)

Latency contract: < 5 ms per review (no secondary ML model at inference).
Memory contract : artifacts (model.pkl + vectorizer.pkl + scaler.pkl) < 150 MB.
"""

import json
import os
import sys

import joblib
import numpy as np
import scipy.sparse as sp

from lexicon_features import extract_lexicon_features_single, get_lexicon_signals
from preprocessing import preprocess
from structural_features import (
    extract_structural_features_single,
    get_structural_signals,
)

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

_model      = None
_vectorizer = None
_scaler     = None
_metrics    = None


# ---------------------------------------------------------------------------
# Language detection (langdetect wrapper)
# ---------------------------------------------------------------------------

def _detect_lang(text: str) -> str:
    """Detect ISO 639-1 language code; fall back to 'en' on any failure."""
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0   # deterministic output
        return detect(str(text))
    except Exception:
        return "en"


# ---------------------------------------------------------------------------
# Model loading (lazy singleton — loaded once per process lifetime)
# ---------------------------------------------------------------------------

def _load():
    global _model, _vectorizer, _scaler, _metrics
    if _model is None:
        _model      = joblib.load(os.path.join(MODEL_DIR, "model.pkl"))
        _vectorizer = joblib.load(os.path.join(MODEL_DIR, "vectorizer.pkl"))
        _scaler     = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))
        metrics_path = os.path.join(MODEL_DIR, "metrics.json")
        if os.path.exists(metrics_path):
            with open(metrics_path) as f:
                _metrics = json.load(f)
    return _model, _vectorizer, _scaler


def model_is_ready() -> bool:
    return all(
        os.path.exists(os.path.join(MODEL_DIR, fname))
        for fname in ("model.pkl", "vectorizer.pkl", "scaler.pkl")
    )


def get_metrics() -> dict:
    _load()
    return _metrics or {}


# ---------------------------------------------------------------------------
# Core prediction
# ---------------------------------------------------------------------------

def predict_review(text: str) -> dict:
    """Score a single review for Fake / Genuine.

    Parameters
    ----------
    text : str
        Raw review text (any language / script).

    Returns
    -------
    dict
        label             : "Fake" | "Genuine"
        is_fake           : bool
        confidence        : float  0–1  (probability of the predicted class)
        human_score       : float  0–100  (P(genuine) × 100 for UI gauge)
        risk_level        : "low" | "medium" | "high"
        detected_language : str  (ISO 639-1, e.g. "en", "es", "zh-cn")
        signals           : list[str]  (combined structural + lexicon flags)
        word_count        : int
    """
    model, vectorizer, scaler = _load()

    # ── 1. Language detection ──────────────────────────────────────────────
    lang = _detect_lang(text)

    # ── 2. Clean for char-ngram vectorizer ────────────────────────────────
    cleaned = preprocess(text)

    if not cleaned or len(cleaned.strip()) < 3:
        return {
            "label":             "Genuine",
            "is_fake":           False,
            "confidence":        0.5,
            "human_score":       50.0,
            "risk_level":        "low",
            "detected_language": lang,
            "signals":           [],
            "word_count":        len(text.split()),
            "note":              "Review too short to analyze reliably.",
        }

    # ── 3. Char n-gram TF-IDF (sparse) ─────────────────────────────────────
    X_tfidf = vectorizer.transform([cleaned])             # (1, vocab)

    # ── 4. Structural features (on raw text — preserves sentence boundaries)
    X_struct = extract_structural_features_single(text)   # (1, 2)

    # ── 5. Lexicon features (language-aware) ───────────────────────────────
    X_lex = extract_lexicon_features_single(text, lang)   # (1, 2)

    # ── 6. Stack dense features → scale → convert to sparse ────────────────
    X_dense = np.hstack([X_struct, X_lex])                # (1, 4)
    X_dense_sc = scaler.transform(X_dense)                # (1, 4)

    # ── 7. Horizontal stack → combined feature vector ──────────────────────
    X_combined = sp.hstack(
        [X_tfidf, sp.csr_matrix(X_dense_sc)], format="csr"
    )                                                      # (1, vocab+4)

    # ── 8. Predict ──────────────────────────────────────────────────────────
    proba      = model.predict_proba(X_combined)[0]       # [P(genuine), P(fake)]
    fake_proba = float(proba[1])
    is_fake    = fake_proba >= 0.5
    confidence = round(fake_proba if is_fake else 1.0 - fake_proba, 4)
    human_score = round((1.0 - fake_proba) * 100, 1)

    if confidence >= 0.80:
        risk = "high" if is_fake else "low"
    elif confidence >= 0.60:
        risk = "medium" if is_fake else "low"
    else:
        risk = "medium"

    # ── 9. Deterministic signals (structural + lexicon, merged) ────────────
    structural_sigs = get_structural_signals(text)
    lexicon_sigs    = get_lexicon_signals(text, lang)
    signals         = structural_sigs + lexicon_sigs

    # Fallback note when no flags fire but model is confident
    if not signals and confidence >= 0.75:
        direction = "Fake" if is_fake else "Genuine"
        signals.append(
            f"Model confidence {confidence * 100:.0f}% — classification "
            f"driven by character n-gram patterns typical of {direction} reviews."
        )

    return {
        "label":             "Fake" if is_fake else "Genuine",
        "is_fake":           bool(is_fake),
        "confidence":        confidence,
        "human_score":       human_score,
        "risk_level":        risk,
        "detected_language": lang,
        "signals":           signals,
        "word_count":        len(text.split()),
    }


# ---------------------------------------------------------------------------
# CLI smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    text = " ".join(sys.argv[1:]) or (
        "Absolutely incredible product!!! Best purchase ever, 10/10 would recommend!"
    )
    if not model_is_ready():
        print("Model not found. Run: python train.py")
        sys.exit(1)
    result = predict_review(text)
    print(json.dumps(result, indent=2, ensure_ascii=False))
