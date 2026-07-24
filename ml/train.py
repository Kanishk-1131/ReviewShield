"""
ReviewShield - Model Training Script
--------------------------------------
Pipeline (per PRD section 8):
  Dataset -> Cleaning -> Preprocessing -> TF-IDF -> Train/Test Split
  -> Logistic Regression -> Evaluation -> Save Model -> Deployment

Dataset: Kaggle "Fake Reviews Dataset" (Salminen et al.) - 40,432 labelled
Amazon-style reviews across 10 categories. label: CG = computer-generated
(fake), OR = original (genuine human review). Mapped to 1 = Fake, 0 = Genuine
to match the PRD's dataset spec.

Usage:
    python train.py                 # trains on the bundled dataset
    python train.py --data path.csv # trains on a custom CSV (needs columns: text_, label)
"""

import argparse
import json
import os
import time

import joblib
import numpy as np
import pandas as pd
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

from preprocessing import preprocess_batch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)


def load_dataset(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df = df.dropna(subset=["text_", "label"]).drop_duplicates(subset=["text_"])
    # CG (computer-generated) = fake = 1, OR (original) = genuine = 0
    df["target"] = df["label"].map({"CG": 1, "OR": 0})
    df = df.dropna(subset=["target"])
    df["target"] = df["target"].astype(int)
    return df


def main(data_path: str, max_features: int, test_size: float):
    print(f"[1/6] Loading dataset from {data_path} ...")
    df = load_dataset(data_path)
    print(f"        {len(df):,} labelled reviews "
          f"({(df['target'] == 1).sum():,} fake / {(df['target'] == 0).sum():,} genuine)")

    print("[2/6] Cleaning + preprocessing text (lowercase, stopwords, lemmatize) ...")
    t0 = time.time()
    df["clean_text"] = preprocess_batch(df["text_"].tolist())
    df = df[df["clean_text"].str.len() > 0]
    print(f"        done in {time.time() - t0:.1f}s")

    print("[3/6] Splitting train/test ...")
    X_train, X_test, y_train, y_test = train_test_split(
        df["clean_text"], df["target"], test_size=test_size,
        random_state=42, stratify=df["target"]
    )
    print(f"        train={len(X_train):,}  test={len(X_test):,}")

    print("[4/6] Fitting TF-IDF vectorizer ...")
    vectorizer = TfidfVectorizer(
        max_features=max_features,
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=3,
    )
    X_train_tfidf = vectorizer.fit_transform(X_train)
    X_test_tfidf = vectorizer.transform(X_test)

    print("[5/6] Training Logistic Regression classifier ...")
    model = LogisticRegression(max_iter=1000, C=5.0, class_weight="balanced")
    model.fit(X_train_tfidf, y_train)

    print("[6/6] Evaluating ...")
    y_pred = model.predict(X_test_tfidf)
    y_proba = model.predict_proba(X_test_tfidf)[:, 1]

    metrics = {
        "accuracy": round(accuracy_score(y_test, y_pred), 4),
        "precision": round(precision_score(y_test, y_pred), 4),
        "recall": round(recall_score(y_test, y_pred), 4),
        "f1_score": round(f1_score(y_test, y_pred), 4),
        "roc_auc": round(roc_auc_score(y_test, y_proba), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "vocab_size": len(vectorizer.vocabulary_),
        "trained_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model": "TF-IDF + Logistic Regression",
    }
    print(json.dumps(metrics, indent=2))

    joblib.dump(model, os.path.join(MODEL_DIR, "model.pkl"))
    joblib.dump(vectorizer, os.path.join(MODEL_DIR, "vectorizer.pkl"))
    with open(os.path.join(MODEL_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # Save top fake / genuine indicator terms for the Explainable AI panel
    feature_names = np.array(vectorizer.get_feature_names_out())
    coefs = model.coef_[0]
    top_fake_idx = np.argsort(coefs)[-40:][::-1]
    top_genuine_idx = np.argsort(coefs)[:40]
    explain = {
        "fake_indicators": feature_names[top_fake_idx].tolist(),
        "genuine_indicators": feature_names[top_genuine_idx].tolist(),
    }
    with open(os.path.join(MODEL_DIR, "explain_terms.json"), "w") as f:
        json.dump(explain, f, indent=2)

    print(f"\nSaved model.pkl, vectorizer.pkl, metrics.json, explain_terms.json -> {MODEL_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--data", default=os.path.join(BASE_DIR, "dataset", "fake_reviews_dataset.csv")
    )
    parser.add_argument("--max-features", type=int, default=15000)
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()
    main(args.data, args.max_features, args.test_size)
