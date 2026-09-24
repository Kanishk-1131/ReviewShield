"""
ReviewShield - Language-Agnostic Structural Feature Extractor
--------------------------------------------------------------
Extracts purely numerical features from review text that work across ALL
languages without dictionaries, lexicons, or heavy models.

Design constraints met:
  - No PyTorch / sentence-transformers
  - No NLTK / language-specific tokenizers
  - Pure Python + numpy: negligible memory footprint
  - Sub-millisecond per review (typically <0.1 ms on modern hardware)

Features exported
-----------------
repetition_ratio : float  [0.0 – 1.0]
    Fraction of bigrams (2-token windows) in the review that appear more than
    once.  AI/CG reviews frequently recycle the same phrasing ("great product",
    "highly recommend") more than a human writer would.

    Formula:
        repeated_bigrams / max(total_unique_bigrams, 1)

    A value of 0.0 means every consecutive token-pair is unique.
    A value approaching 1.0 signals heavy repetition.

sentence_length_variance : float  [0.0 – ∞)
    Variance of sentence lengths (measured in tokens) across all sentences in
    the review.  Human reviewers write with natural rhythm — some short
    punchy sentences, some longer explanatory ones.  AI-generated reviews
    tend toward eerily uniform sentence lengths, yielding low variance.

    Sentences are delimited by `.`, `!`, `?`, `。` (CJK full stop),
    `？`, `！` (CJK), `।` (Devanagari danda), and `؟` (Arabic).

Both functions accept *raw* text (before or after cleaning) — they handle
cleaning internally so they can be called independently at inference time.
"""

import re
import unicodedata
from collections import Counter
from typing import Sequence

import numpy as np

# Shared import: preprocessing lives in the same package directory.
from preprocessing import tokenize_text

# ---------------------------------------------------------------------------
# Sentence splitting (language-agnostic)
# ---------------------------------------------------------------------------

# Sentence-boundary punctuation for Latin, CJK, Arabic, Devanagari scripts.
_SENT_BOUNDARY_RE = re.compile(
    r"[.!?。！？।؟…]+"  # one-or-more terminal marks treated as single boundary
)


def _split_sentences(text: str) -> list:
    """Split raw text into sentences using universal terminal punctuation.

    Returns a list of non-empty sentence strings.
    """
    if not text or not isinstance(text, str):
        return []
    parts = _SENT_BOUNDARY_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


# ---------------------------------------------------------------------------
# Feature 1: repetition_ratio
# ---------------------------------------------------------------------------

def repetition_ratio(text: str) -> float:
    """Fraction of consecutive token bigrams that appear more than once.

    Higher → more repetitive (synthetic/CG signal).
    Lower  → more varied phrasing (human signal).

    Parameters
    ----------
    text : str
        Raw review text (any language/script).

    Returns
    -------
    float
        Value in [0.0, 1.0].  Returns 0.0 for texts too short to form bigrams.
    """
    tokens = tokenize_text(text)
    if len(tokens) < 2:
        return 0.0

    bigrams = [(tokens[i], tokens[i + 1]) for i in range(len(tokens) - 1)]
    if not bigrams:
        return 0.0

    counts = Counter(bigrams)
    total_unique = len(counts)
    repeated = sum(1 for cnt in counts.values() if cnt > 1)

    return repeated / total_unique


# ---------------------------------------------------------------------------
# Feature 2: sentence_length_variance
# ---------------------------------------------------------------------------

def sentence_length_variance(text: str) -> float:
    """Variance of per-sentence token counts.

    Lower variance → robotic, uniform sentence structure (CG signal).
    Higher variance → natural human writing rhythm.

    Parameters
    ----------
    text : str
        Raw review text (any language/script).

    Returns
    -------
    float
        Variance value (≥ 0.0).  Returns 0.0 for single-sentence reviews.
    """
    sentences = _split_sentences(text)
    if len(sentences) < 2:
        return 0.0

    lengths = np.array([len(tokenize_text(s)) for s in sentences], dtype=float)
    # Filter empty/trivially short sentences (artefacts of splitting)
    lengths = lengths[lengths > 0]
    if len(lengths) < 2:
        return 0.0

    return float(np.var(lengths))


# ---------------------------------------------------------------------------
# Batch extractor (used by train.py)
# ---------------------------------------------------------------------------

def extract_structural_features(texts: Sequence[str]) -> np.ndarray:
    """Extract [repetition_ratio, sentence_length_variance] for a list of texts.

    Parameters
    ----------
    texts : sequence of str
        Raw review texts.

    Returns
    -------
    np.ndarray, shape (n_samples, 2)
        Column 0: repetition_ratio
        Column 1: sentence_length_variance
    """
    n = len(texts)
    out = np.zeros((n, 2), dtype=np.float32)
    for i, text in enumerate(texts):
        out[i, 0] = repetition_ratio(text)
        out[i, 1] = sentence_length_variance(text)
    return out


def extract_structural_features_single(text: str) -> np.ndarray:
    """Extract structural features for a single review (inference path).

    Returns
    -------
    np.ndarray, shape (1, 2)
    """
    return np.array(
        [[repetition_ratio(text), sentence_length_variance(text)]],
        dtype=np.float32,
    )


# ---------------------------------------------------------------------------
# Deterministic signal flags (used by predict.py for UI explainability)
# ---------------------------------------------------------------------------

# Thresholds derived from empirical analysis of the training set.
# These are deliberately conservative to minimize false positives.
_REPETITION_HIGH = 0.35   # >35 % repeated bigrams → "High structural repetition"
_REPETITION_MED  = 0.15   # >15 % → "Moderate phrase repetition"
_VARIANCE_LOW    = 1.5    # variance < 1.5 tokens² → "Uniform sentence lengths"


def get_structural_signals(text: str) -> list:
    """Return human-readable signal strings for the UI explainability panel.

    These are deterministic — no model inference required — so they add
    essentially zero latency to the prediction endpoint.

    Parameters
    ----------
    text : str
        Raw review text.

    Returns
    -------
    list[str]
        Signal messages (may be empty if no strong signals detected).
    """
    signals = []
    rep  = repetition_ratio(text)
    var  = sentence_length_variance(text)

    if rep > _REPETITION_HIGH:
        signals.append(
            f"High structural repetition detected "
            f"({rep * 100:.0f}% of phrase pairs repeated)"
        )
    elif rep > _REPETITION_MED:
        signals.append(
            f"Moderate phrase repetition detected "
            f"({rep * 100:.0f}% of phrase pairs repeated)"
        )

    sentences = _split_sentences(text)
    if len(sentences) >= 2 and var < _VARIANCE_LOW:
        signals.append(
            f"Unusually uniform sentence lengths "
            f"(variance = {var:.2f} tokens²) — typical of generated text"
        )

    return signals


# ---------------------------------------------------------------------------
# Smoke-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    tests = [
        (
            "Human",
            "I bought this for my daughter's birthday. She absolutely loved it! "
            "The quality is excellent and the color is exactly as shown. "
            "Shipping was fast. Would definitely recommend. "
            "Only minor issue was the packaging — a bit flimsy — but the product itself is great.",
        ),
        (
            "AI/CG",
            "Great product. Great product. I love this product. "
            "This product is great. Great product. Love it. Great product. "
            "I love this product. This product is great. Love it.",
        ),
        (
            "CJK sample",
            "这个产品非常好。非常好用。我很喜欢这个产品。非常好。",
        ),
        (
            "Arabic sample",
            "منتج رائع جداً. أنصح به. منتج رائع. أنصح به بشدة. منتج رائع جداً.",
        ),
    ]

    for label, text in tests:
        rep = repetition_ratio(text)
        var = sentence_length_variance(text)
        sigs = get_structural_signals(text)
        print(f"[{label}]")
        print(f"  repetition_ratio          = {rep:.4f}")
        print(f"  sentence_length_variance  = {var:.4f}")
        print(f"  signals: {sigs}")
        print()
