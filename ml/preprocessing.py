"""
ReviewShield - Text Preprocessing Module
------------------------------------------
Implements the NLP preprocessing pipeline defined in the PRD:
  lowercase -> remove punctuation/digits -> tokenize -> remove stopwords -> lemmatize

This module is shared by train.py, predict.py and app.py so that the exact
same transformation is applied at training time and at inference time.
"""

import re
import string
import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

# Ensure required corpora are available (no-op if already downloaded)
for pkg in ["stopwords", "wordnet", "omw-1.4", "punkt", "punkt_tab"]:
    try:
        nltk.data.find(
            f"corpora/{pkg}" if pkg not in ("punkt", "punkt_tab") else f"tokenizers/{pkg}"
        )
    except LookupError:
        nltk.download(pkg, quiet=True)

_STOPWORDS = set(stopwords.words("english"))
_LEMMATIZER = WordNetLemmatizer()

# Keep a few negation words - they flip sentiment and matter for authenticity signals
_NEGATIONS = {"no", "not", "nor", "never", "none"}
_STOPWORDS = _STOPWORDS - _NEGATIONS


def clean_text(text: str) -> str:
    """Lowercase, strip URLs/HTML, remove digits and punctuation."""
    if not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"http\S+|www\.\S+", " ", text)
    text = re.sub(r"<.*?>", " ", text)
    text = re.sub(r"\d+", " ", text)
    text = text.translate(str.maketrans("", "", string.punctuation))
    text = re.sub(r"\s+", " ", text).strip()
    return text


def tokenize_and_lemmatize(text: str) -> list:
    """Tokenize, drop stopwords/short tokens, lemmatize the remainder."""
    tokens = word_tokenize(text)
    tokens = [t for t in tokens if t not in _STOPWORDS and len(t) > 2]
    tokens = [_LEMMATIZER.lemmatize(t) for t in tokens]
    return tokens


def preprocess(text: str) -> str:
    """Full pipeline: raw review text -> cleaned, lemmatized string ready for TF-IDF."""
    cleaned = clean_text(text)
    tokens = tokenize_and_lemmatize(cleaned)
    return " ".join(tokens)


def preprocess_batch(texts) -> list:
    return [preprocess(t) for t in texts]


if __name__ == "__main__":
    sample = "This product is AMAZING!!! Best purchase I've EVER made, 10/10 would buy again <br>."
    print("Original :", sample)
    print("Processed:", preprocess(sample))
