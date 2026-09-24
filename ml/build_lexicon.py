"""
ReviewShield - Offline NRC Lexicon Compiler
--------------------------------------------
Run this ONCE after downloading the NRC Emotion Lexicon to produce a
compact, runtime-ready compiled JSON at ml/model/nrc_compiled.json.

WHY AN OFFLINE COMPILER?
The raw NRC files are large (~14 MB for the multilingual version, ~2.5 MB for
the word-level version) and have an inefficient format for per-request O(1)
lookup. Compiling offline gives us:
  - A tiny in-memory dict (~200-400 KB of RAM per language set)
  - Sub-microsecond token lookup (Python dict hash)
  - Zero pandas/csv overhead at inference time

SUPPORTED INPUT FORMATS
This compiler auto-detects two common NRC distribution layouts:

  FORMAT A — Multilingual wide CSV  (NRC-Emotion-Lexicon-ForVariousLanguages.csv)
    Columns: English Word | Positive | Negative | Anger | Anticipation |
             Disgust | Fear | Joy | Sadness | Surprise | Trust |
             <Language1> | <Language2> | ...
    (first row is a header)

  FORMAT B — English word-level long TSV  (NRC-Emotion-Lexicon-Wordlevel-v0.92.txt)
    Columns: word | emotion | association  (tab-separated, NO header)
    This gives English words only.  Non-English languages will be empty sets
    in this case — the closed-class closed-class dictionary in lexicon_features.py
    covers negations and pronouns for all priority languages independently.

HOW TO OBTAIN THE NRC LEXICON
  1. Visit: https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm
  2. Fill in the short academic-use form to receive the download link.
  3. Extract and place the relevant CSV/TSV at:
       ml/dataset/NRC-Emotion-Lexicon.csv   (rename if needed)

USAGE
  cd ml
  python build_lexicon.py
  python build_lexicon.py --input dataset/NRC-Emotion-Lexicon.csv --output model/nrc_compiled.json
  python build_lexicon.py --dry-run   # prints stats without writing

OUTPUT SCHEMA
  {
    "en": {"excellent": 1, "happy": 1, ...},
    "es": {"excelente": 1, "feliz": 1, ...},
    "fr": {...},
    "zh": {...},
    "hi": {...},
    "ta": {...},
    "te": {...},
    "_meta": {
      "source":        "<input filename>",
      "format":        "wide" | "long",
      "emotions_kept": ["positive", "joy", "trust"],
      "compiled_at":   "<ISO timestamp>",
      "counts":        {"en": 3420, "es": 2891, ...}
    }
  }
"""

import argparse
import json
import os
import sys
import time

import pandas as pd

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DEFAULT_IN  = os.path.join(BASE_DIR, "dataset", "NRC-Emotion-Lexicon.csv")
DEFAULT_OUT = os.path.join(BASE_DIR, "model", "nrc_compiled.json")

# Emotions to retain (positive sentiment signals used by lexicon_features.py)
KEEP_EMOTIONS = {"positive", "joy", "trust"}

# ---------------------------------------------------------------------------
# Priority language mapping
#   key   = language code used in our system
#   value = the column name as it appears in the NRC multilingual wide CSV.
#           (NRC uses full language names as column headers.)
# ---------------------------------------------------------------------------
LANG_COLUMNS = {
    "en": None,          # handled via the 'word' column in wide format
    "es": "Spanish",
    "fr": "French",
    "zh": "Chinese-Simplified",
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
}

# Fallback column name variants seen across different NRC release versions.
# The tab-separated wide CSV uses hyphens: "Chinese-Simplified".
LANG_COLUMN_ALIASES = {
    "zh": ["Chinese-Simplified", "Chinese (Simplified)", "Chinese", "Mandarin", "Chinese_Simplified"],
    "hi": ["Hindi"],
    "ta": ["Tamil"],
    "te": ["Telugu"],
    "es": ["Spanish"],
    "fr": ["French"],
}


# ---------------------------------------------------------------------------
# Format detection
# ---------------------------------------------------------------------------

def _detect_format(path: str) -> str:
    """Return 'wide' or 'long' based on a lightweight header/column inspection."""
    # Peek at the first line to decide
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        first = fh.readline().strip()

    # Wide format header always starts with "English Word" or "Word" and has
    # emotion labels (anger, joy, trust, positive, …) in the first ~200 chars.
    first_lower = first.lower()
    if (
        "english" in first_lower or
        "positive" in first_lower or
        "joy" in first_lower or
        "anger" in first_lower
    ):
        return "wide"

    # Long/word-level TSV: first line is a word, an emotion name, and 0 or 1
    parts = first.replace(",", "\t").split("\t")
    if len(parts) == 3:
        try:
            int(parts[2].strip())
            return "long"
        except ValueError:
            pass

    # Fallback: try reading as wide
    return "wide"


# ---------------------------------------------------------------------------
# Wide-format parser (multilingual CSV)
# ---------------------------------------------------------------------------

def _resolve_col(df_columns: list, aliases: list) -> str | None:
    """Return the first alias found among df_columns, case-insensitively."""
    col_lower = {c.lower(): c for c in df_columns}
    for alias in aliases:
        if alias.lower() in col_lower:
            return col_lower[alias.lower()]
    return None


def _parse_wide(path: str, verbose: bool = True) -> dict:
    """Parse the NRC multilingual wide CSV.

    Expected columns (may vary slightly between NRC release versions):
        English Word | Positive | Negative | Anger | Anticipation |
        Disgust | Fear | Joy | Sadness | Surprise | Trust |
        [language columns …]
    """
    if verbose:
        print(f"  Reading wide-format CSV: {path}")
    # The official NRC wide file is TAB-separated despite the .csv extension.
    # We try tab first; fall back to comma if column count looks wrong.
    df = pd.read_csv(path, encoding="utf-8", sep="\t", low_memory=False)
    if len(df.columns) < 5:
        df = pd.read_csv(path, encoding="utf-8", sep=",", low_memory=False)
    df.columns = [c.strip() for c in df.columns]

    if verbose:
        print(f"  Columns detected ({len(df.columns)}): {df.columns.tolist()[:15]} ...")
        print(f"  Rows: {len(df):,}")

    # Locate the English word column
    word_col = _resolve_col(df.columns.tolist(), ["English Word", "Word", "word", "English_Word"])
    if word_col is None:
        raise ValueError(
            "Could not find the English word column. "
            f"Available columns: {df.columns.tolist()}"
        )

    # Locate emotion columns
    pos_col   = _resolve_col(df.columns.tolist(), ["Positive", "positive"])
    joy_col   = _resolve_col(df.columns.tolist(), ["Joy", "joy"])
    trust_col = _resolve_col(df.columns.tolist(), ["Trust", "trust"])

    missing = [e for e, c in [("Positive", pos_col), ("Joy", joy_col), ("Trust", trust_col)] if c is None]
    if missing:
        raise ValueError(f"Could not find emotion columns: {missing}. Columns: {df.columns.tolist()}")

    # Filter to positive/joy/trust == 1 rows
    mask = (
        (df[pos_col].fillna(0).astype(int) == 1) |
        (df[joy_col].fillna(0).astype(int) == 1) |
        (df[trust_col].fillna(0).astype(int) == 1)
    )
    df_pos = df[mask].copy()
    if verbose:
        print(f"  Words with positive/joy/trust=1: {len(df_pos):,} / {len(df):,}")

    result = {}

    # English words (from the word column itself)
    en_words = (
        df_pos[word_col]
        .dropna()
        .str.strip()
        .str.lower()
        .unique()
        .tolist()
    )
    result["en"] = {w: 1 for w in en_words if w}

    # Non-English languages
    for lang_code, canonical_name in LANG_COLUMNS.items():
        if lang_code == "en":
            continue
        aliases = LANG_COLUMN_ALIASES.get(lang_code, [canonical_name])
        col = _resolve_col(df.columns.tolist(), aliases)
        if col is None:
            if verbose:
                print(f"  [WARN] Language '{lang_code}' column not found — skipping.")
            result[lang_code] = {}
            continue

        words = (
            df_pos[col]
            .dropna()
            .astype(str)
            .str.strip()
            .str.lower()
            .unique()
            .tolist()
        )
        # Filter out empty strings, NaN artefacts, and English carry-overs
        words = [w for w in words if w and w not in ("nan", "none", "")]
        result[lang_code] = {w: 1 for w in words}
        if verbose:
            print(f"  [{lang_code}] {len(result[lang_code]):,} words loaded.")

    return result


# ---------------------------------------------------------------------------
# Long-format parser (English-only word-level TSV)
# ---------------------------------------------------------------------------

def _parse_long(path: str, verbose: bool = True) -> dict:
    """Parse the NRC word-level long TSV (English only).

    Format: word <TAB> emotion <TAB> association  (no header row)
    """
    if verbose:
        print(f"  Reading long-format (word-level) TSV: {path}")

    # Try tab separator first; fall back to comma
    try:
        df = pd.read_csv(
            path, sep="\t", header=None,
            names=["word", "emotion", "association"],
            encoding="utf-8", low_memory=False,
        )
        if df["association"].nunique() <= 2:
            pass  # looks right
        else:
            raise ValueError("Unexpected association column values")
    except Exception:
        df = pd.read_csv(
            path, sep=",", header=None,
            names=["word", "emotion", "association"],
            encoding="utf-8", low_memory=False,
        )

    if verbose:
        print(f"  Rows: {len(df):,}")

    mask = (
        df["emotion"].str.lower().isin(KEEP_EMOTIONS) &
        (df["association"].astype(int) == 1)
    )
    words = (
        df[mask]["word"]
        .str.strip()
        .str.lower()
        .unique()
        .tolist()
    )
    en_dict = {w: 1 for w in words if w}
    if verbose:
        print(f"  [en] {len(en_dict):,} words with positive/joy/trust=1")
        print("  [WARN] Long format is English-only. Non-English dicts will be empty.")
        print("         Re-run with the multilingual wide CSV for full coverage.")

    # Fill other languages with empty dicts (closed-class pronouns/negations
    # in lexicon_features.py still work without these).
    result = {lang: {} for lang in LANG_COLUMNS}
    result["en"] = en_dict
    return result


# ---------------------------------------------------------------------------
# Main compiler entry point
# ---------------------------------------------------------------------------

def compile_lexicon(
    input_path: str,
    output_path: str,
    dry_run: bool = False,
    verbose: bool = True,
) -> dict:
    """Parse the NRC file, filter to positive/joy/trust, save compiled JSON.

    Parameters
    ----------
    input_path  : Path to the raw NRC CSV/TSV file.
    output_path : Destination path for nrc_compiled.json.
    dry_run     : If True, print stats but do not write the output file.
    verbose     : Print progress messages.

    Returns
    -------
    dict  The compiled lexicon dict (also written to output_path unless dry_run).
    """
    if not os.path.exists(input_path):
        print(f"[ERROR] NRC Lexicon file not found: {input_path}")
        print()
        print("How to obtain the NRC Emotion Lexicon:")
        print("  1. Visit https://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm")
        print("  2. Fill in the short academic-use form.")
        print("  3. Download and extract the archive.")
        print("  4. Place the main CSV at:")
        print(f"       {input_path}")
        print("  5. Re-run: python build_lexicon.py")
        sys.exit(1)

    fmt = _detect_format(input_path)
    if verbose:
        print(f"\n  Detected format: {fmt.upper()}")

    t0 = time.time()
    if fmt == "wide":
        lexicon = _parse_wide(input_path, verbose=verbose)
    else:
        lexicon = _parse_long(input_path, verbose=verbose)

    # Metadata block
    counts = {lang: len(words) for lang, words in lexicon.items()}
    meta = {
        "source":        os.path.basename(input_path),
        "format":        fmt,
        "emotions_kept": sorted(KEEP_EMOTIONS),
        "compiled_at":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "counts":        counts,
    }
    lexicon["_meta"] = meta

    total_words = sum(v for v in counts.values())
    elapsed = time.time() - t0

    if verbose:
        print(f"\n  Summary:")
        for lang, count in counts.items():
            print(f"    {lang:4s}  {count:>6,} positive/joy/trust terms")
        print(f"  Total: {total_words:,} words  |  compiled in {elapsed:.2f}s")

    if dry_run:
        print("\n  [DRY RUN] Output not written.")
        return lexicon

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as fh:
        # separators=(',', ':') gives the most compact JSON without spaces
        json.dump(lexicon, fh, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(output_path) / 1024
    if verbose:
        print(f"\n  Saved -> {output_path}  ({size_kb:.1f} KB)")

    return lexicon


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Compile NRC Emotion Lexicon to a compact JSON for ReviewShield.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python build_lexicon.py
  python build_lexicon.py --input dataset/NRC-Emotion-Lexicon.csv
  python build_lexicon.py --input dataset/NRC-Emotion-Lexicon.csv --output model/nrc_compiled.json
  python build_lexicon.py --dry-run   # stats only, no file written
        """,
    )
    parser.add_argument(
        "--input", "-i",
        default=DEFAULT_IN,
        help=f"Path to raw NRC Lexicon file (default: {DEFAULT_IN})",
    )
    parser.add_argument(
        "--output", "-o",
        default=DEFAULT_OUT,
        help=f"Output path for compiled JSON (default: {DEFAULT_OUT})",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print stats without writing the output file.",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Suppress verbose progress output.",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("  ReviewShield — NRC Lexicon Compiler")
    print("=" * 60)
    compile_lexicon(
        input_path=args.input,
        output_path=args.output,
        dry_run=args.dry_run,
        verbose=not args.quiet,
    )
