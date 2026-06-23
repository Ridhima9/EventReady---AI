
from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, roc_auc_score, precision_score, recall_score, f1_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.preprocessing import OrdinalEncoder

DATA_DIR = Path("data")
DATASET_DIR = Path("dataset")
INPUT_CSV = DATASET_DIR / "events_cleaned.csv"

CLOSURE_MODEL_PATH = DATA_DIR / "closure_model.pkl"
DURATION_MODEL_PATH = DATA_DIR / "duration_model.pkl"
SIMILARITY_INDEX_PATH = DATA_DIR / "similarity_index.json"
ENCODER_PATH = DATA_DIR / "encoder.pkl"
FEATURE_COLUMNS_PATH = DATA_DIR / "feature_columns.pkl"
MODEL_METRICS_PATH = DATA_DIR / "model_metrics.json"
EDA_REPORT_PATH = DATA_DIR / "eda_report.json"

DURATION_CAP_HOURS = 48

HOTSPOT_JUNCTIONS: List[str] = [
    "Mekhri Circle",
    "Ayyappa Temple Junction",
    "Satellite Bus Stand Junction",
    "Yeshwanthpura Circle",
    "Yelahanka Circle",
    "Silk Board Junction",
    "Nagavara ORR Junction",
    "Jalahalli Cross",
]

FEATURE_COLUMNS: List[str] = ["event_cause", "corridor", "priority", "hour_bucket"]

RANDOM_STATE = 42
N_ESTIMATORS = 100
N_JOBS = -1

ENCODER_UNKNOWN_VALUE = -1

LOW_LIGHT_HOUR_BUCKETS = {"night_peak", "evening"}

CLOSURE_PROB_THRESHOLD = 0.5

CAUSE_RULES: List[Tuple[str, str]] = [
    ("vehicle breakdown", "Pre-position tow truck"),
    ("water logging",     "Deploy drain-clearing team"),
    ("tree fall",         "Call tree-cutting squad"),
    ("accident",          "Dispatch ambulance & crane"),
    ("public event",      "Assign crowd-control officers"),
    ("procession",        "Assign crowd-control officers"),
    ("vip movement",      "Assign crowd-control officers"),
    ("protest",           "Assign crowd-control officers"),
    ("construction",      "Verify diversion signage"),
    ("pot holes",         "Alert BBMP road repair"),
    ("road conditions",   "Alert BBMP road repair"),
]


def _normalise_junction(name: str) -> str:
    """Lowercase and keep only alphanumerics, so "Mekhri Circle",
    "MekhriCircle" and "Mekhri-Circle" all reduce to "mekhricircle"."""
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


_HOTSPOT_NORMALISED = {_normalise_junction(j) for j in HOTSPOT_JUNCTIONS}


_HOTSPOT_MIN_MATCH_LEN = 8


def _is_hotspot(junction_name: str) -> bool:
    """
    Return True if `junction_name` matches any of the canonical hotspot
    junctions. Matching is case- and punctuation-insensitive and uses
    bidirectional substring comparison so that both
        "MekhriCircle"          (data)   vs "Mekhri Circle"          (spec)
        "JalahalliCross(SM..."  (data)   vs "Jalahalli Cross"        (spec)
    are recognised.
    """
    j = _normalise_junction(junction_name)
    if len(j) < _HOTSPOT_MIN_MATCH_LEN:
        return False
    for h in _HOTSPOT_NORMALISED:
        if len(h) < _HOTSPOT_MIN_MATCH_LEN:
            continue
        if h in j or j in h:
            return True
    return False


def generate_checklist(
    event_cause: str,
    closure_probability: float,
    top_junctions: List[Dict[str, Any]],
    hour_bucket: str,
    priority: str,
) -> List[str]:
    """
    Build a deterministic operational checklist for one
    (event_cause, corridor, priority, hour_bucket) group.

    Rules are applied in a fixed order so the output is reproducible:

      1. Closure probability > 0.5  -> deploy barricades at junction.
      2. event_cause keyword match  -> cause-specific dispatch
         (case-insensitive, underscore-insensitive substring match;
          the first matching keyword wins).
      3. Priority == 'High' AND any top junction is a hotspot
         -> assign extra officers at junction.
      4. hour_bucket in {night_peak, evening}
         -> ensure sufficient lighting and visibility.

    The output list is de-duplicated while preserving first-occurrence order,
    so adding future rules that emit duplicate strings is safe.
    """
    checklist: List[str] = []

    # Rule 1 -- closure probability.
    if closure_probability > CLOSURE_PROB_THRESHOLD:
        checklist.append("Deploy barricades at junction")

    # Rule 2 -- cause-specific dispatch.
    cause_norm = (event_cause or "").replace("_", " ").lower()
    for keyword, action in CAUSE_RULES:
        if keyword in cause_norm and action not in checklist:
            checklist.append(action)
            break  # one cause -> one cause-specific dispatch

    # Rule 3 -- hotspot + high priority.
    if priority == "High":
        for j in top_junctions:
            if _is_hotspot(j.get("name", "")):
                if "Assign extra officers at junction" not in checklist:
                    checklist.append("Assign extra officers at junction")
                break

    # Rule 4 -- low-light hour bucket.
    if hour_bucket in LOW_LIGHT_HOUR_BUCKETS:
        action = "Ensure sufficient lighting and visibility"
        if action not in checklist:
            checklist.append(action)

    return checklist

def load_data() -> pd.DataFrame:
    """Load the cleaned events CSV. Fail gracefully with a clear message
    if the file or required columns are missing."""
    if not INPUT_CSV.exists():
        print(f"[ERROR] Input file not found: {INPUT_CSV.resolve()}",
              file=sys.stderr)
        print("        Place events_cleaned.csv under ./data/ and re-run.",
              file=sys.stderr)
        sys.exit(1)

    df = pd.read_csv(INPUT_CSV)

    required = [
        "event_cause", "corridor", "priority", "hour_bucket",
        "requires_road_closure", "duration_hours",
        "junction", "police_station",
    ]
    missing = [c for c in required if c not in df.columns]
    if missing:
        print(f"[ERROR] Input CSV is missing required columns: {missing}",
              file=sys.stderr)
        sys.exit(1)

    
    n_before_unique = df["event_cause"].astype(str).nunique()
    df["event_cause"] = df["event_cause"].astype(str).str.strip().str.lower()
    n_after_unique = df["event_cause"].nunique()
    merged = n_before_unique - n_after_unique
    if merged > 0:
        print(f"[INFO] Normalised event_cause to lowercase: "
              f"{n_before_unique} -> {n_after_unique} unique values "
              f"({merged} casing-split categor{'y' if merged == 1 else 'ies'} merged).")

    n_before = len(df)
    df = df[df["event_cause"] != "unknown"].copy()
    n_dropped = n_before - len(df)
    if n_dropped:
        print(f"[INFO] Dropped {n_dropped} rows with event_cause == 'unknown'.")

    needed = FEATURE_COLUMNS + ["requires_road_closure", "duration_hours"]
    n_before = len(df)
    df = df.dropna(subset=needed).copy()
    n_dropped = n_before - len(df)
    if n_dropped:
        print(f"[INFO] Dropped {n_dropped} rows with NaN in required columns.")

    return df


def encode_features(df: pd.DataFrame) -> Tuple[np.ndarray, OrdinalEncoder]:
    """Fit an OrdinalEncoder on FEATURE_COLUMNS and return (X, encoder).

    `handle_unknown='use_encoded_value'` with `unknown_value=-1` ensures the
    encoder never raises on a category unseen at fit time -- critical for a
    backend that may receive a brand-new corridor or hour bucket.
    """
    enc = OrdinalEncoder(
        handle_unknown="use_encoded_value",
        unknown_value=ENCODER_UNKNOWN_VALUE,
    )
    
    X = enc.fit_transform(df[FEATURE_COLUMNS].astype(str).values)
    return X, enc


def train_closure_model(X: np.ndarray, y_close: np.ndarray) -> RandomForestClassifier:
    """Train the road-closure classifier on encoded features."""
    clf = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
        class_weight='balanced'
    )
    clf.fit(X, y_close)
    return clf


def train_duration_model(X: np.ndarray, y_dur: np.ndarray) -> RandomForestRegressor:
    """Train the duration regressor. Target is log1p(duration_hours) because
    duration is heavily right-skewed (most incidents <2h, a few near 48h).
    Predicting log-hours is much more numerically stable; the backend
    applies expm1 to recover hours at inference time."""
    reg = RandomForestRegressor(
        n_estimators=N_ESTIMATORS,
        random_state=RANDOM_STATE,
        n_jobs=N_JOBS,
    )
    reg.fit(X, y_dur)
    return reg


def _top3(series: pd.Series) -> List[Dict[str, Any]]:
    """Return up to 3 most frequent non-null values as
    [{"name": str, "count": int}, ...]."""
    counts = Counter(series.dropna().astype(str))
    return [{"name": name, "count": int(c)} for name, c in counts.most_common(3)]


def build_similarity_index(df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    """
    Group the original (un-encoded) DataFrame by the composite key
    event_cause | corridor | priority | hour_bucket
    and summarise each group.

    For each group we record:
      - count                       : number of rows
      - median_duration_hours       : median of duration_hours
      - closure_probability         : mean of requires_road_closure (0..1)
      - top_junctions               : up to 3 most frequent junctions
      - typical_police_stations     : up to 3 most frequent police stations
      - checklist                   : deterministic heuristic checklist
    """
    index: Dict[str, Dict[str, Any]] = {}
    group_cols = FEATURE_COLUMNS  # event_cause, corridor, priority, hour_bucket

    for key, g in df.groupby(group_cols, dropna=False):
        # `key` is a tuple aligned with group_cols.
        event_cause, corridor, priority, hour_bucket = (str(k) for k in key)
        composite_key = f"{event_cause}|{corridor}|{priority}|{hour_bucket}"

        closure_prob = float(g["requires_road_closure"].mean())
        top_junctions = _top3(g["junction"])

        index[composite_key] = {
            "count": int(len(g)),
            "median_duration_hours": float(g["duration_hours"].median()),
            "closure_probability": closure_prob,
            "top_junctions": top_junctions,
            "typical_police_stations": _top3(g["police_station"]),
            "checklist": generate_checklist(
                event_cause=event_cause,
                closure_probability=closure_prob,
                top_junctions=top_junctions,
                hour_bucket=hour_bucket,
                priority=priority,
            ),
        }

    return index


def print_summary(
    df: pd.DataFrame,
    clf: RandomForestClassifier,
    reg: RandomForestRegressor,
    index: Dict[str, Dict[str, Any]],
) -> None:
    """Print a clean operational summary to stdout."""
    print("\n" + "=" * 64)
    print("TRAINING SUMMARY")
    print("=" * 64)
    print(f"Rows used for training       : {len(df):,}")
    print(f"Unique event_cause values    : {df['event_cause'].nunique()}")
    print(f"Unique corridors             : {df['corridor'].nunique()}")
    print(f"Unique hour_buckets          : {df['hour_bucket'].nunique()}")
    print(f"Road-closure positive rate   : {df['requires_road_closure'].mean():.4f}")
    print(f"Duration (h) median / mean   : "
          f"{df['duration_hours'].median():.2f} / {df['duration_hours'].mean():.2f}")
    print(f"Duration (h) min / max       : "
          f"{df['duration_hours'].min():.2f} / {df['duration_hours'].max():.2f}")

    print("\nTop-5 feature importances (closure classifier):")
    pairs = sorted(zip(FEATURE_COLUMNS, clf.feature_importances_),
                   key=lambda x: -x[1])
    for col, imp in pairs[:5]:
        print(f"  {col:<14} {imp:.4f}")

    print("\nTop-5 feature importances (duration regressor):")
    pairs = sorted(zip(FEATURE_COLUMNS, reg.feature_importances_),
                   key=lambda x: -x[1])
    for col, imp in pairs[:5]:
        print(f"  {col:<14} {imp:.4f}")

    print(f"\nSimilarity index groups      : {len(index):,}")

    # Transparency: how many groups actually triggered each checklist rule.
    rule_counts = Counter()
    hotspot_groups = 0
    for entry in index.values():
        for item in entry["checklist"]:
            rule_counts[item] += 1
        if any(_is_hotspot(j["name"]) for j in entry["top_junctions"]):
            hotspot_groups += 1
    print(f"Groups touching a hotspot    : {hotspot_groups:,}")
    print("Checklist rule fire counts (across groups):")
    for action, c in rule_counts.most_common():
        print(f"  {c:>5}  {action}")

    print("\nSaved files:")
    for p in [CLOSURE_MODEL_PATH, DURATION_MODEL_PATH, SIMILARITY_INDEX_PATH,
              ENCODER_PATH, FEATURE_COLUMNS_PATH, MODEL_METRICS_PATH,
              EDA_REPORT_PATH]:
        if p.exists():
            print(f"  {p}  ({p.resolve().stat().st_size:,} bytes)")
        else:
            print(f"  {p}  [MISSING]")
    print("=" * 64)


def build_eda_report(df: pd.DataFrame) -> Dict[str, Any]:
    """Build the EDA report JSON from the (already-normalised) training frame.

    IMPORTANT: this runs AFTER load_data() has lower-cased event_cause, so the
    distribution and closure-rate maps it emits are already canonical -- there
    is exactly one "debris" entry (n=13), not split "Debris"/"debris". This is
    what the frontend "Closure Rates by Cause" panel renders, so the casing fix
    is visible there without any frontend change.
    """
    import numpy as _np

    def _value_counts_dict(series: pd.Series) -> Dict[str, int]:
        # Object columns may contain NaN; coerce to str for stable keys.
        return {str(k): int(v) for k, v in series.value_counts(dropna=False).items()}

    def _pct_dict(counts: Dict[str, int], total: int) -> Dict[str, float]:
        return {k: (v / total if total else 0.0) for k, v in counts.items()}

    total = len(df)
    report: Dict[str, Any] = {
        "row_count": int(total),
        "columns": list(df.columns),
        "dtypes": {c: str(df[c].dtype) for c in df.columns},
        "null_counts": {c: int(df[c].isna().sum()) for c in df.columns},
    }

    closure_counts = _value_counts_dict(df["requires_road_closure"])
    report["closure_balance"] = {str(k): v for k, v in closure_counts.items()}
    report["closure_balance_pct"] = _pct_dict(closure_counts, total)

    if "priority" in df.columns:
        pc = _value_counts_dict(df["priority"])
        report["priority_balance"] = pc
        report["priority_balance_pct"] = _pct_dict(pc, total)

    if "event_cause" in df.columns:
        ecd = _value_counts_dict(df["event_cause"])
        report["event_cause_distribution"] = ecd
        report["event_cause_distribution_pct"] = _pct_dict(ecd, total)
        # Closure rate per cause -- computed on the SAME normalised frame, so
        # casing variants are already merged before the mean is taken.
        report["closure_rate_by_event_cause"] = {
            str(cause): float(rate)
            for cause, rate in df.groupby("event_cause")["requires_road_closure"].mean().items()
        }

    if "corridor" in df.columns:
        cd = _value_counts_dict(df["corridor"])
        report["corridor_distribution"] = cd
        report["corridor_distribution_pct"] = _pct_dict(cd, total)

    if "hour_bucket" in df.columns:
        hbd = _value_counts_dict(df["hour_bucket"])
        report["hour_bucket_distribution"] = hbd
        report["hour_bucket_distribution_pct"] = _pct_dict(hbd, total)
        report["closure_rate_by_hour_bucket"] = {
            str(b): float(r)
            for b, r in df.groupby("hour_bucket")["requires_road_closure"].mean().items()
        }

    if "priority" in df.columns:
        report["closure_rate_by_priority"] = {
            str(p): float(r)
            for p, r in df.groupby("priority")["requires_road_closure"].mean().items()
        }

    if "day_of_week" in df.columns:
        dwd = _value_counts_dict(df["day_of_week"])
        report["day_of_week_distribution"] = dwd
        report["day_of_week_distribution_pct"] = _pct_dict(dwd, total)

    if "month" in df.columns:
        md = _value_counts_dict(df["month"])
        report["month_distribution"] = md
        report["month_distribution_pct"] = _pct_dict(md, total)

    if "duration_hours" in df.columns:
        dh = df["duration_hours"].astype(float)
        report["duration_stats"] = {
            "min": float(dh.min()),
            "max": float(dh.max()),
            "mean": float(dh.mean()),
            "median": float(dh.median()),
            "std": float(dh.std()),
            "capped_at_48_count": int((dh > DURATION_CAP_HOURS).sum()),
            "capped_at_48_pct": float((dh > DURATION_CAP_HOURS).mean()),
        }

    return report


def main() -> None:
    """Run the full training + index-building pipeline."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1 -- load
    print(f"[1/6] Loading {INPUT_CSV} ...")
    df = load_data()
    print(f"      Loaded {len(df):,} rows.")

    # Step 2 -- encode features
    print("[2/6] Encoding categorical features ...")
    X, encoder = encode_features(df)
    
    cap_mask = df["duration_hours"] > DURATION_CAP_HOURS
    capped_count = int(cap_mask.sum())
    print(f"      Capped {capped_count} rows at DURATION_CAP_HOURS ({DURATION_CAP_HOURS}).")
    df.loc[cap_mask, "duration_hours"] = DURATION_CAP_HOURS

    y_close = df["requires_road_closure"].astype(int).values
    y_dur = np.log1p(df["duration_hours"].astype(float).values)
    joblib.dump(encoder, ENCODER_PATH)
    joblib.dump(FEATURE_COLUMNS, FEATURE_COLUMNS_PATH)
    print(f"      X shape={X.shape}, "
          f"closure positives={int(y_close.sum())}, "
          f"log1p(duration) range=[{y_dur.min():.3f}, {y_dur.max():.3f}]")

    print("[3/6] Evaluating on held-out 20% split ...")
    X_train, X_test, y_close_train, y_close_test, y_dur_train, y_dur_test = train_test_split(
        X, y_close, y_dur, test_size=0.2, random_state=RANDOM_STATE, stratify=y_close
    )
    
    clf_eval = train_closure_model(X_train, y_close_train)
    y_close_pred = clf_eval.predict(X_test)
    y_close_prob = clf_eval.predict_proba(X_test)[:, 1]
    
    reg_eval = train_duration_model(X_train, y_dur_train)
    y_dur_pred = reg_eval.predict(X_test)
    
    # Duration metrics need to be calculated on real hours, not log-hours
    y_dur_test_hours = np.expm1(y_dur_test)
    y_dur_pred_hours = np.expm1(y_dur_pred)

    metrics = {
        "closure_model": {
            "accuracy": float(accuracy_score(y_close_test, y_close_pred)),
            "roc_auc": float(roc_auc_score(y_close_test, y_close_prob)),
            "precision": float(precision_score(y_close_test, y_close_pred)),
            "recall": float(recall_score(y_close_test, y_close_pred)),
            "f1": float(f1_score(y_close_test, y_close_pred))
        },
        "duration_model": {
            "mae": float(mean_absolute_error(y_dur_test_hours, y_dur_pred_hours)),
            "rmse": float(np.sqrt(mean_squared_error(y_dur_test_hours, y_dur_pred_hours))),
            "r2": float(r2_score(y_dur_test_hours, y_dur_pred_hours))
        }
    }
    
    with MODEL_METRICS_PATH.open("w", encoding="utf-8") as f:
        json.dump(metrics, f, indent=2)

    print("[4/6] Retraining final models on FULL dataset ...")
    clf = train_closure_model(X, y_close)
    joblib.dump(clf, CLOSURE_MODEL_PATH)

    reg = train_duration_model(X, y_dur)
    joblib.dump(reg, DURATION_MODEL_PATH)

    print("[5/6] Building similarity index ...")
    index = build_similarity_index(df)
    with SIMILARITY_INDEX_PATH.open("w", encoding="utf-8") as f:
        json.dump(index, f, indent=2, ensure_ascii=False)

    # EDA report -- computed on the SAME normalised frame the models were
    # trained on, so event_cause casing variants ("Debris"/"debris") are
    # already merged into a single "debris" category before any distribution
    # or closure-rate aggregation runs. This is what the frontend "Closure
    # Rates by Cause" panel renders.
    eda = build_eda_report(df)
    with EDA_REPORT_PATH.open("w", encoding="utf-8") as f:
        json.dump(eda, f, indent=2)
    debris_n = eda["event_cause_distribution"].get("debris", 0)
    debris_rate = eda["closure_rate_by_event_cause"].get("debris", 0.0)
    print(f"      EDA: event_cause 'debris' (merged) n={debris_n}, "
          f"closure rate={debris_rate:.4f}")

    print("[6/6] Done.")
    print_summary(df, clf, reg, index)
    
    # Save feature importances
    feature_importances = {
        "closure_model": dict(zip(FEATURE_COLUMNS, clf.feature_importances_)),
        "duration_model": dict(zip(FEATURE_COLUMNS, reg.feature_importances_))
    }
    with (DATA_DIR / "feature_importances.json").open("w") as f:
        json.dump(feature_importances, f, indent=2)

    from collections import Counter
    rule_counts = Counter()
    hotspot_groups = 0
    _hotspot_norm = {h.replace(" ", "").lower() for h in HOTSPOT_JUNCTIONS}
    for entry in index.values():
        for item in entry["checklist"]:
            rule_counts[item] += 1

        # "SilkBoardJunc") that never match HOTSPOT_JUNCTIONS verbatim, so a
        # plain `j["name"] in HOTSPOT_JUNCTIONS` always returns False.
        for j in entry.get("top_junctions", []):
            jn = j["name"].replace(" ", "").lower() if j.get("name") else ""
            if any(jn in h or h in jn for h in _hotspot_norm if len(h) >= 8 and len(jn) >= 8):
                hotspot_groups += 1
                break
    
    checklist_stats = {
        "hotspot_groups": hotspot_groups,
        "rule_counts": dict(rule_counts.most_common())
    }
    with (DATA_DIR / "checklist_stats.json").open("w") as f:
        json.dump(checklist_stats, f, indent=2)

    
    hotspot_stats = []
    for hj in HOTSPOT_JUNCTIONS:
        hj_df = df[df["junction"] == hj]
        if not hj_df.empty:
            count = len(hj_df)
            high_pct = (hj_df["priority"] == "High").mean()
            closure_pct = hj_df["requires_road_closure"].mean()
            dominant_cause = hj_df["event_cause"].value_counts().index[0]
            hotspot_stats.append({
                "junction": hj,
                "count": int(count),
                "high_priority_pct": float(high_pct),
                "closure_pct": float(closure_pct),
                "dominant_cause": dominant_cause
            })
    
    with (DATA_DIR / "hotspot_stats.json").open("w") as f:
        json.dump(hotspot_stats, f, indent=2)

if __name__ == "__main__":
    main()
