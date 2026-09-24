"""
ReviewShield - Lexicon & Stylometric Feature Extractor
------------------------------------------------------
Provides two fast, language-aware numerical features for the
combined feature matrix:

  nrc_superlative_ratio : float  [0.0 – 1.0]
      Fraction of tokens that carry positive / joy / trust sentiment
      per the NRC Emotion Lexicon, **with a 2-word sliding negation
      window** that cancels any token immediately preceded by a
      negation word (e.g., "not good", "never recommend", "no joy").

  pronoun_ratio : float  [0.0 – 1.0]
      Fraction of tokens that are first-person pronouns for the
      detected language (e.g., "I/we" in English, "我/我们" in Mandarin).

Design constraints met:
  - No PyTorch / sentence-transformers / NLTK
  - NRC dict loaded once at module level → O(1) per-token lookup
  - Closed-class lists are hardcoded → zero I/O at inference time
  - Graceful degradation: if nrc_compiled.json is missing, NRC ratio
    always returns 0.0 (structural features still carry the signal)
  - Expected memory overhead: < 3 MB for all languages combined

DEPENDENCY: Run `python build_lexicon.py` once to generate
  ml/model/nrc_compiled.json  before importing this module.
"""

import json
import os
from typing import Sequence

import numpy as np

from preprocessing import tokenize_text

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
_NRC_PATH = os.path.join(BASE_DIR, "model", "nrc_compiled.json")


# ---------------------------------------------------------------------------
# Closed-class word lists (hardcoded — zero runtime I/O, ~4 KB in memory)
# ---------------------------------------------------------------------------

CLOSED_CLASS: dict[str, dict[str, set]] = {
    "en": {
        "pronouns":  {"i", "me", "my", "we", "us", "our"},
        "negations": {"not", "never", "no"},
    },
    "es": {
        "pronouns":  {"yo", "me", "mi", "nosotros"},
        "negations": {"no", "nunca", "jamas", "jamás"},
    },
    "fr": {
        "pronouns":  {"je", "me", "mon", "nous", "notre"},
        "negations": {"ne", "pas", "jamais", "non"},
    },
    "zh": {
        "pronouns":  {"我", "我们"},
        "negations": {"不", "没", "没有"},
    },
    "hi": {
        "pronouns":  {"मैं", "मेरा", "मुझे", "हम", "हमारा"},
        "negations": {"नहीं", "ना", "मत"},
    },
    "ta": {
        "pronouns":  {"நான்", "என்", "எனக்கு", "நாங்கள்", "எங்கள்"},
        "negations": {"இல்லை", "அல்ல", "வேண்டாம்"},
    },
    "te": {
        "pronouns":  {"నేను", "నా", "నాకు", "మేము", "మన"},
        "negations": {"కాదు", "లేదు", "వద్దు"},
    },
}

# Union of all negations across languages for a language-agnostic fallback.
_ALL_NEGATIONS: set = {
    neg
    for lang_data in CLOSED_CLASS.values()
    for neg in lang_data["negations"]
}

# ---------------------------------------------------------------------------
# NRC Lexicon loader  (lazy singleton — loaded once on first access)
# ---------------------------------------------------------------------------

_NRC        = None   # dict | None — None means "not yet attempted"
_NRC_LOADED = False  # True once load was attempted (even if failed)


def _load_nrc() -> dict:
    """Load nrc_compiled.json into memory.  Called once; result is cached."""
    global _NRC, _NRC_LOADED
    if _NRC_LOADED:
        return _NRC or {}

    _NRC_LOADED = True
    if not os.path.exists(_NRC_PATH):
        import warnings
        warnings.warn(
            f"[lexicon_features] nrc_compiled.json not found at {_NRC_PATH}. "
            "NRC superlative ratios will be 0.0. "
            "Run: python build_lexicon.py",
            UserWarning,
            stacklevel=3,
        )
        _NRC = {}
        return _NRC

    with open(_NRC_PATH, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    # Strip the metadata block — we only need the per-language word dicts
    _NRC = {k: v for k, v in data.items() if k != "_meta"}
    total = sum(len(v) for v in _NRC.values())
    print(
        f"[lexicon_features] NRC lexicon loaded: "
        f"{len(_NRC)} languages, {total:,} total terms."
    )
    return _NRC


def get_nrc_lang(lang_code: str) -> dict:
    """Return the compiled NRC word dict for a given language code.

    Parameters
    ----------
    lang_code : str
        ISO 639-1 code, e.g. "en", "es", "zh".

    Returns
    -------
    dict  {word: 1} or {} if the language is not in the compiled lexicon.
    """
    nrc = _load_nrc()
    return nrc.get(lang_code, {})


# ---------------------------------------------------------------------------
# Core feature functions
# ---------------------------------------------------------------------------

def nrc_superlative_ratio(tokens: list[str], lang: str = "en") -> float:
    """Fraction of positive/joy/trust tokens, with 2-word negation window.

    Algorithm:
      1. Walk the token list with a sliding window.
      2. For each token that matches the NRC positive dict:
         a. Check whether the immediately preceding token (i-1) is a
            negation word for `lang` (or globally).
         b. If negated → do NOT count it as a positive hit.
         c. Otherwise   → count it.
      3. Return positive_hits / max(total_tokens, 1).

    The 2-word window (look back 1 token) handles the most common
    negation patterns across languages ("not good", "no joy", "没有 好")
    without requiring a parser or POS tagger.

    Parameters
    ----------
    tokens : list[str]
        Pre-tokenized, lowercased tokens from `preprocessing.tokenize_text()`.
    lang   : str
        ISO 639-1 language code for selecting the right negation set.

    Returns
    -------
    float  Ratio in [0.0, 1.0].
    """
    if not tokens:
        return 0.0

    nrc_words  = get_nrc_lang(lang)
    if not nrc_words:
        # Graceful degradation: return 0.0 if lexicon unavailable
        return 0.0

    # Language-specific negations + global union as fallback
    lang_negs  = CLOSED_CLASS.get(lang, {}).get("negations", set())
    negations  = lang_negs | _ALL_NEGATIONS

    positive_hits = 0
    for i, tok in enumerate(tokens):
        if tok in nrc_words:
            # Check the immediately preceding token for negation
            preceding = tokens[i - 1] if i > 0 else None
            if preceding is not None and preceding in negations:
                continue   # negated — skip
            positive_hits += 1

    return positive_hits / len(tokens)


def pronoun_ratio(tokens: list[str], lang: str = "en") -> float:
    """Fraction of first-person pronoun tokens for a given language.

    Parameters
    ----------
    tokens : list[str]
        Pre-tokenized, lowercased tokens.
    lang   : str
        ISO 639-1 language code.

    Returns
    -------
    float  Ratio in [0.0, 1.0].  Returns 0.0 if lang is unsupported.
    """
    if not tokens:
        return 0.0

    pronouns = CLOSED_CLASS.get(lang, {}).get("pronouns", set())
    if not pronouns:
        return 0.0

    hits = sum(1 for t in tokens if t in pronouns)
    return hits / len(tokens)


# ---------------------------------------------------------------------------
# Batch extractor (used by train.py)
# ---------------------------------------------------------------------------

def extract_lexicon_features(
    texts: Sequence[str],
    lang: str = "en",
) -> np.ndarray:
    """Extract [nrc_superlative_ratio, pronoun_ratio] for a list of texts.

    Parameters
    ----------
    texts : sequence of str
        Raw (or pre-cleaned) review texts.
    lang  : str
        Language code to use for NRC lookup and pronoun matching.
        In the current single-language training setup this defaults to "en".
        In Phase 3 (language detection), pass the per-review detected language.

    Returns
    -------
    np.ndarray, shape (n_samples, 2), dtype float32
        Column 0: nrc_superlative_ratio
        Column 1: pronoun_ratio
    """
    n   = len(texts)
    out = np.zeros((n, 2), dtype=np.float32)
    for i, text in enumerate(texts):
        toks       = tokenize_text(text)
        out[i, 0]  = nrc_superlative_ratio(toks, lang)
        out[i, 1]  = pronoun_ratio(toks, lang)
    return out


def extract_lexicon_features_single(
    text: str,
    lang: str = "en",
) -> np.ndarray:
    """Extract lexicon features for a single review (inference path).

    Returns
    -------
    np.ndarray, shape (1, 2)
    """
    toks = tokenize_text(text)
    return np.array(
        [[nrc_superlative_ratio(toks, lang), pronoun_ratio(toks, lang)]],
        dtype=np.float32,
    )


# ---------------------------------------------------------------------------
# Lexicon signal flags for UI explainability (deterministic, zero-latency)
# ---------------------------------------------------------------------------

# Thresholds chosen conservatively to surface only confident signals.
_NRC_HIGH_THRESHOLD   = 0.20   # >20 % positive tokens → suspicious positivity flood
_NRC_MEDIUM_THRESHOLD = 0.10   # >10 % → elevated positivity
_PRONOUN_HIGH         = 0.12   # >12 % first-person pronouns → highly personal tone

def get_lexicon_signals(text: str, lang: str = "en") -> list:
    """Return human-readable signal strings for the UI explainability panel.

    Covers both NRC superlative ratio and pronoun ratio signals.

    Parameters
    ----------
    text : str
        Raw review text.
    lang : str
        Detected language code.

    Returns
    -------
    list[str]
        Signal messages (may be empty if no strong signals detected).
    """
    signals = []
    toks = tokenize_text(text)

    nrc_ratio  = nrc_superlative_ratio(toks, lang)
    pron_ratio = pronoun_ratio(toks, lang)

    if nrc_ratio > _NRC_HIGH_THRESHOLD:
        signals.append(
            f"Abnormally high positivity density: {nrc_ratio * 100:.0f}% of "
            f"tokens carry positive/joy/trust sentiment — common in CG reviews."
        )
    elif nrc_ratio > _NRC_MEDIUM_THRESHOLD:
        signals.append(
            f"Elevated positive sentiment density ({nrc_ratio * 100:.0f}% of tokens)."
        )

    if pron_ratio > _PRONOUN_HIGH:
        signals.append(
            f"High first-person pronoun usage ({pron_ratio * 100:.0f}% of tokens) — "
            f"may indicate authentic personal experience."
        )

    return signals


# ---------------------------------------------------------------------------
# Smoke-test / demonstration
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=== Closed-class dictionary coverage ===")
    for lang, data in CLOSED_CLASS.items():
        print(
            f"  {lang}: {len(data['pronouns'])} pronouns, "
            f"{len(data['negations'])} negations"
        )

    print("\n=== Negation window test (English) ===")
    tests = [
        # (description, token_list)
        ("Positive hit (no negation)",     ["this", "product", "is", "excellent"]),
        ("Negated hit (not excellent)",     ["this", "product", "is", "not", "excellent"]),
        ("Negated hit (never recommend)",   ["i", "would", "never", "recommend", "this"]),
        ("Multiple positives + 1 negated",  ["love", "it", "not", "happy", "with", "joy"]),
    ]

    # Temporarily inject a tiny test NRC dict without needing the real file
    _NRC_LOADED = True
    _NRC = {"en": {"excellent": 1, "recommend": 1, "happy": 1, "joy": 1, "love": 1}}

    for desc, toks in tests:
        ratio = nrc_superlative_ratio(toks, "en")
        print(f"  {desc}")
        print(f"    tokens={toks}  →  nrc_ratio={ratio:.4f}")

    print("\n=== Pronoun ratio test ===")
    pron_tests = [
        ("en", ["i", "bought", "this", "for", "my", "daughter", "she", "loved", "it"]),
        ("zh", ["我", "买", "了", "这", "个", "产品", "我们", "都", "喜欢"]),
        ("hi", ["मैं", "ने", "यह", "खरीदा", "हम", "सब", "खुश", "हैं"]),
    ]
    for lang, toks in pron_tests:
        ratio = pronoun_ratio(toks, lang)
        print(f"  [{lang}] tokens={toks[:6]}...  →  pronoun_ratio={ratio:.4f}")

    print("\n=== extract_lexicon_features_single ===")
    sample = "I absolutely love this product. It is not bad at all. We highly recommend it!"
    result = extract_lexicon_features_single(sample, "en")
    print(f"  shape={result.shape}  values={result}")

    print("\n=== Lexicon signals ===")
    signal_tests = [
        ("en", "I love this product! It is absolutely excellent and wonderful and amazing!"),
        ("en", "It was not good. The quality was not excellent. I was never happy with it."),
    ]
    for lang, text in signal_tests:
        sigs = get_lexicon_signals(text, lang)
        print(f"  [{lang}] {text[:60]!r}")
        for s in sigs:
            print(f"    -> {s}")
