"""
ReviewShield - Model Training Script (Multilingual Edition v2)
--------------------------------------------------------------
Full feature pipeline (all language-agnostic, no PyTorch):

  Dataset  →  Language detection (langdetect)
           →  Unicode-safe cleaning  (preprocessing.py)
           →  char n-gram TF-IDF    (sparse, 15k features, ngram 2-4)
           →  Structural features   (repetition_ratio, sentence_length_variance)
           →  Lexicon features      (nrc_superlative_ratio, pronoun_ratio)
           →  MaxAbsScaler on 4 dense features
           →  scipy.sparse.hstack   (TF-IDF | struct_scaled | lex_scaled)
           →  LogisticRegression (saga, C=3, balanced)
           →  Evaluation + artifact save

Memory target : < 150 MB loaded model
Latency target: < 5 ms per single prediction

Usage:
    python train.py                       # trains on bundled dataset
    python train.py --data path.csv       # custom CSV (columns: text_, label)
    python train.py --max-features 12000  # smaller vocab → less RAM
"""

import argparse
import json
import os
import time
import warnings

import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import MaxAbsScaler

from lexicon_features import extract_lexicon_features
from preprocessing import preprocess_batch
from structural_features import extract_structural_features

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)


# ---------------------------------------------------------------------------
# Language detection helper
# ---------------------------------------------------------------------------

def _detect_lang(text: str) -> str:
    """Detect ISO 639-1 language code.  Falls back to 'en' on any error.

    langdetect can raise LangDetectException on very short or ambiguous
    text.  We also suppress the non-determinism warning by seeding the
    detector inside this wrapper.
    """
    try:
        from langdetect import detect, DetectorFactory
        DetectorFactory.seed = 0          # make results deterministic
        return detect(str(text))
    except Exception:
        return "en"


def detect_languages_batch(texts: list, verbose: bool = True) -> list:
    """Detect language for every review.  Progress is printed every 5k rows."""
    langs = []
    n = len(texts)
    for i, text in enumerate(texts):
        langs.append(_detect_lang(text))
        if verbose and (i + 1) % 5000 == 0:
            print(f"        language detection: {i + 1:,}/{n:,}")
    return langs


# ---------------------------------------------------------------------------
# Dataset loading
# ---------------------------------------------------------------------------

def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.dropna(subset=["text_", "label"]).drop_duplicates(subset=["text_"])
    # CG (computer-generated / fake) = 1 ; OR (original human) = 0
    df["target"] = df["label"].map({"CG": 1, "OR": 0})
    df = df.dropna(subset=["target"])
    df["target"] = df["target"].astype(int)
    return df


# ---------------------------------------------------------------------------
# Main training routine
# ---------------------------------------------------------------------------

def main(data_path: str, max_features: int, test_size: float):

    # ── Step 1: Load ─────────────────────────────────────────────────────── #
    print(f"[1/8] Loading dataset from {data_path} ...")
    df = load_dataset(data_path)
    print(
        f"        {len(df):,} labelled reviews "
        f"({(df['target'] == 1).sum():,} fake / {(df['target'] == 0).sum():,} genuine)"
    )

    # ── Step 2: Language detection ────────────────────────────────────────── #
    print("[2/8] Detecting language for each review (langdetect, seed=0) ...")
    t0 = time.time()
    raw_texts = df["text_"].tolist()
    langs = detect_languages_batch(raw_texts, verbose=True)
    df["lang"] = langs
    elapsed = time.time() - t0
    lang_counts = pd.Series(langs).value_counts().head(8).to_dict()
    print(f"        done in {elapsed:.1f}s  top languages: {lang_counts}")

    # ── Step 3: Clean text ────────────────────────────────────────────────── #
    print("[3/8] Cleaning text (Unicode-safe, script-aware) ...")
    t0 = time.time()
    df["clean_text"] = preprocess_batch(raw_texts)
    df = df[df["clean_text"].str.len() > 0].reset_index(drop=True)
    raw_texts = df["text_"].tolist()      # realign after dropping empties
    langs = df["lang"].tolist()
    print(f"        done in {time.time() - t0:.1f}s  ({len(df):,} rows remain)")

    # ── Step 4: Extract structural features (on RAW text) ─────────────────── #
    print("[4/8] Extracting structural features ...")
    t0 = time.time()
    struct_feats = extract_structural_features(raw_texts)   # shape (N, 2)
    print(f"        shape={struct_feats.shape}  done in {time.time() - t0:.1f}s")

    # ── Step 5: Extract lexicon features (per-review language) ────────────── #
    print("[5/8] Extracting lexicon features (per-review language) ...")
    t0 = time.time()
    # extract_lexicon_features accepts a single lang for the whole batch;
    # since the dataset is predominantly English we use per-row extraction.
    n = len(df)
    lex_feats = np.zeros((n, 2), dtype=np.float32)
    from lexicon_features import extract_lexicon_features_single
    for i, (text, lang) in enumerate(zip(raw_texts, langs)):
        lex_feats[i] = extract_lexicon_features_single(text, lang)
        if (i + 1) % 10000 == 0:
            print(f"        lexicon features: {i + 1:,}/{n:,}")
    print(f"        shape={lex_feats.shape}  done in {time.time() - t0:.1f}s")

    # ── Step 6: Train / test split ────────────────────────────────────────── #
    print("[6/8] Splitting train/test ...")
    indices = np.arange(len(df))
    idx_train, idx_test = train_test_split(
        indices, test_size=test_size, random_state=42, stratify=df["target"]
    )
    X_text_train     = df["clean_text"].iloc[idx_train].tolist()
    X_text_test      = df["clean_text"].iloc[idx_test].tolist()
    X_struct_train   = struct_feats[idx_train]
    X_struct_test    = struct_feats[idx_test]
    X_lex_train      = lex_feats[idx_train]
    X_lex_test       = lex_feats[idx_test]
    y_train          = df["target"].iloc[idx_train].values
    y_test           = df["target"].iloc[idx_test].values
    print(f"        train={len(idx_train):,}  test={len(idx_test):,}")

    # ── Step 7: Char n-gram TF-IDF ────────────────────────────────────────── #
    print("[7/8] Fitting char n-gram TF-IDF (analyzer=char_wb, ngram 2-4) ...")
    t0 = time.time()
    vectorizer = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(2, 4),
        max_features=max_features,
        sublinear_tf=True,
        min_df=5,
        strip_accents=None,    # preserve non-ASCII characters
    )
    X_tfidf_train = vectorizer.fit_transform(X_text_train)
    X_tfidf_test  = vectorizer.transform(X_text_test)
    print(
        f"        vocab={len(vectorizer.vocabulary_):,}  "
        f"done in {time.time() - t0:.1f}s"
    )

    # ── Step 8: Scale 4 dense features, hstack, train, evaluate ──────────── #
    print("[8/8] Scaling dense features, combining, and training ...")

    # Stack all 4 dense features: [rep_ratio, sent_len_var, nrc_ratio, pron_ratio]
    X_dense_train = np.hstack([X_struct_train, X_lex_train])   # (N_train, 4)
    X_dense_test  = np.hstack([X_struct_test,  X_lex_test])    # (N_test,  4)

    scaler = MaxAbsScaler()
    X_dense_train_sc = scaler.fit_transform(X_dense_train)
    X_dense_test_sc  = scaler.transform(X_dense_test)

    # Combine sparse TF-IDF with scaled dense features
    X_train = sp.hstack(
        [X_tfidf_train, sp.csr_matrix(X_dense_train_sc)], format="csr"
    )
    X_test = sp.hstack(
        [X_tfidf_test, sp.csr_matrix(X_dense_test_sc)], format="csr"
    )
    print(
        f"        combined shape: train={X_train.shape}, test={X_test.shape}  "
        f"[TF-IDF({X_tfidf_train.shape[1]}) + dense(4)]"
    )

    t0 = time.time()
    model = LogisticRegression(
        max_iter=1000,
        C=3.0,
        class_weight="balanced",
        solver="saga",
    )
    model.fit(X_train, y_train)
    print(f"        LogReg trained in {time.time() - t0:.1f}s")

    # ── Evaluate ──────────────────────────────────────────────────────────── #
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":         round(accuracy_score(y_test, y_pred), 4),
        "precision":        round(precision_score(y_test, y_pred), 4),
        "recall":           round(recall_score(y_test, y_pred), 4),
        "f1_score":         round(f1_score(y_test, y_pred), 4),
        "roc_auc":          round(roc_auc_score(y_test, y_proba), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "train_size":       int(len(idx_train)),
        "test_size":        int(len(idx_test)),
        "vocab_size":       len(vectorizer.vocabulary_),
        "n_features_total": int(X_train.shape[1]),
        "trained_at":       time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": (
            "Char-ngram TF-IDF (2-4) + "
            "Structural (rep_ratio, sent_len_var) + "
            "Lexicon (nrc_ratio, pron_ratio) + "
            "LogisticRegression"
        ),
        "max_features": max_features,
    }
    print("\n" + json.dumps(metrics, indent=2))

    # ── Persist artifacts ─────────────────────────────────────────────────── #
    joblib.dump(model,      os.path.join(MODEL_DIR, "model.pkl"))
    joblib.dump(vectorizer, os.path.join(MODEL_DIR, "vectorizer.pkl"))
    joblib.dump(scaler,     os.path.join(MODEL_DIR, "scaler.pkl"))

    with open(os.path.join(MODEL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Dense feature coefficients for audit / debugging
    dense_coef_start = X_tfidf_train.shape[1]
    feature_names    = ["repetition_ratio", "sentence_length_variance",
                        "nrc_superlative_ratio", "pronoun_ratio"]
    dense_coefs      = model.coef_[0][dense_coef_start:]
    explain = {
        "note": (
            "Char n-gram model: per-review explainability is provided "
            "deterministically via structural_features.get_structural_signals() "
            "and lexicon_features.get_lexicon_signals()."
        ),
        "dense_feature_names":  feature_names,
        "dense_feature_coefs":  {
            name: round(float(coef), 6)
            for name, coef in zip(feature_names, dense_coefs)
        },
    }
    with open(os.path.join(MODEL_DIR, "explain_terms.json"), "w") as f:
        json.dump(explain, f, indent=2)

    print(
        f"\nSaved model.pkl, vectorizer.pkl, scaler.pkl, "
        f"metrics.json, explain_terms.json -> {MODEL_DIR}"
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train ReviewShield multilingual feature pipeline."
    )
    parser.add_argument(
        "--data",
        default=os.path.join(BASE_DIR, "dataset", "fake_reviews_dataset.csv"),
    )
    parser.add_argument("--max-features", type=int, default=15000)
    parser.add_argument("--test-size",    type=float, default=0.2)
    args = parser.parse_args()
    main(args.data, args.max_features, args.test_size)
