"""
ReviewShield - Multilingual Text Preprocessing Module
------------------------------------------------------
Script-aware tokenizer and Unicode-safe cleaner.  Supports Latin, Cyrillic,
Indic/Brahmic, Arabic, Greek, and Hebrew scripts with standard whitespace
splitting.  For CJK (Chinese/Japanese/Korean), Thai, Khmer, Lao, and Myanmar
— scripts that do not delimit words with spaces — we fall back to
character-level tokenization so structural features remain meaningful without
heavy segmenters (no MeCab, no Jieba, no ICU).

Key design decisions:
  - No NLTK dependency: removes ~100 MB of corpus data from the container.
  - HTML/URL stripping uses a conservative regex that avoids corrupting
    non-ASCII characters (no blanket unicode-escaping).
  - Punctuation removal is script-aware: we only strip ASCII punctuation and
    a small set of common Unicode punctuation; we do NOT strip characters that
    carry lexical meaning in any script.
  - The `preprocess()` output is a plain string fed to a char-ngram
    TfidfVectorizer, so lemmatization and stopword removal are intentionally
    omitted — char n-grams subsume those signals.

This module is shared by train.py, predict.py, and app.py so that training
and inference see identical transformations.
"""

import re
import unicodedata

# ---------------------------------------------------------------------------
# Unicode block helpers
# ---------------------------------------------------------------------------

# CJK Unified Ideographs and extensions, Katakana, Hiragana, Hangul
_CJK_RANGES = [
    (0x3040, 0x30FF),   # Hiragana + Katakana
    (0x3400, 0x4DBF),   # CJK Extension A
    (0x4E00, 0x9FFF),   # CJK Unified Ideographs (core)
    (0xA000, 0xA48F),   # Yi Syllables
    (0xAC00, 0xD7AF),   # Hangul Syllables
    (0xF900, 0xFAFF),   # CJK Compatibility Ideographs
    (0x20000, 0x2A6DF), # CJK Extension B
    (0x2A700, 0x2CEAF), # CJK Extensions C/D/E
]

# Scripts that do not use whitespace as a word boundary and require
# character-level fallback.
_CHAR_LEVEL_RANGES = _CJK_RANGES + [
    (0x0E00, 0x0E7F),   # Thai
    (0x1780, 0x17FF),   # Khmer
    (0x0E80, 0x0EFF),   # Lao
    (0x1000, 0x109F),   # Myanmar
]


def _is_char_level_script(text: str) -> bool:
    """Return True if *any* character in text belongs to a char-level script.

    We sample the first 120 characters for speed — sufficient for a review.
    """
    sample = text[:120]
    for ch in sample:
        cp = ord(ch)
        for lo, hi in _CHAR_LEVEL_RANGES:
            if lo <= cp <= hi:
                return True
    return False


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------

# Matches http/https URLs, bare www. URLs, and e-mail addresses.
_URL_RE = re.compile(
    r"(?:https?://|www\.)\S+|[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}",
    re.IGNORECASE,
)

# HTML tags (including self-closing and DOCTYPE).
_HTML_RE = re.compile(r"<[^>]{1,200}>", re.DOTALL)

# ASCII punctuation we actively want to strip so the char-ngram vectorizer
# focuses on character patterns rather than punctuation noise.
# We keep apostrophes (') because they carry morphological meaning in English
# and some other languages.
_ASCII_PUNCT_RE = re.compile(r'[!"#$%&()*+,\-./:;<=>?@\[\\\]^_`{|}~]')

# Collapse runs of whitespace (including unicode whitespace such as NBSP).
_WHITESPACE_RE = re.compile(r"[\s\u00A0\u200B\u200C\u200D\uFEFF]+")


def clean_text(text: str) -> str:
    """Unicode-safe cleaning: strip URLs, HTML, ASCII punctuation, and extra
    whitespace without corrupting non-Latin scripts.

    Parameters
    ----------
    text : str
        Raw review text (any language/script).

    Returns
    -------
    str
        Cleaned text, lower-cased for Latin scripts.  CJK/Thai etc. are
        lowercased for any embedded Latin characters but otherwise preserved.
    """
    if not isinstance(text, str) or not text.strip():
        return ""

    # 1. Strip HTML
    text = _HTML_RE.sub(" ", text)
    # 2. Strip URLs / e-mails
    text = _URL_RE.sub(" ", text)
    # 3. Lowercase (safe for all Unicode; no-op on CJK/Arabic/etc.)
    text = text.lower()
    # 4. Remove ASCII punctuation
    text = _ASCII_PUNCT_RE.sub(" ", text)
    # 5. Remove Unicode "control" and "format" category characters
    #    (zero-width spaces, soft hyphens, etc.) but keep letters/marks/numbers.
    text = "".join(
        ch for ch in text
        if unicodedata.category(ch)[0] not in ("C",)  # Cc, Cf, Cs, Co, Cn
    )
    # 6. Collapse whitespace
    text = _WHITESPACE_RE.sub(" ", text).strip()
    return text


# ---------------------------------------------------------------------------
# Script-aware tokenizer
# ---------------------------------------------------------------------------

def tokenize(text: str) -> list:
    """Split *cleaned* text into tokens.

    For whitespace-delimited scripts (Latin, Cyrillic, Arabic, Indic/Brahmic,
    Greek, Hebrew, …) we split on whitespace and drop trivially short tokens.

    For character-level scripts (CJK, Thai, Khmer, Lao, Myanmar) we return
    individual characters, filtering out whitespace characters.  This lets
    structural features (repetition, length variance) work meaningfully even
    without a dictionary-based segmenter.

    Parameters
    ----------
    text : str
        Pre-cleaned text (output of `clean_text`).

    Returns
    -------
    list[str]
        List of token strings.
    """
    if not text:
        return []

    if _is_char_level_script(text):
        # Character-level: drop whitespace, keep every other character.
        # Min length 1 (single character is meaningful in CJK).
        return [ch for ch in text if not ch.isspace()]
    else:
        # Whitespace split; drop very short tokens (single char noise).
        return [t for t in text.split() if len(t) > 1]


# ---------------------------------------------------------------------------
# Public preprocessing pipeline
# ---------------------------------------------------------------------------

def preprocess(text: str) -> str:
    """Full pipeline: raw review text → cleaned string ready for char-ngram
    TF-IDF vectorization.

    Unlike the previous word-TF-IDF pipeline we do NOT lemmatize or strip
    stopwords here — the char-ngram vectorizer captures morphology and
    function-word patterns directly from the character sequence.

    Parameters
    ----------
    text : str
        Raw review text.

    Returns
    -------
    str
        Cleaned, normalised string.
    """
    return clean_text(text)


def preprocess_batch(texts) -> list:
    """Vectorised wrapper around `preprocess` for DataFrame columns."""
    return [preprocess(t) for t in texts]


# Exported for use in predict.py (structural features need raw tokens).
def tokenize_text(text: str) -> list:
    """Clean then tokenize.  Convenience wrapper used by structural_features."""
    return tokenize(clean_text(text))


if __name__ == "__main__":
    samples = [
        "This product is AMAZING!!! Best purchase I've EVER made <br> visit www.spam.com",
        "¡Producto increíble! Muy recomendable, superó mis expectativas.",
        "这个产品非常好用，物超所值！强烈推荐给所如此有需要的人。",
        "منتج رائع جداً، أنصح به بشدة لكل من يبحث عن الجودة.",
        "Отличный продукт! Очень рекомендую всем покупателям.",
    ]
    for s in samples:
        print(f"IN : {s[:60]}")
        print(f"OUT: {preprocess(s)[:60]}")
        print(f"TOK: {tokenize_text(s)[:8]}")
        print()
