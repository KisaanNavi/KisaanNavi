from __future__ import annotations

import argparse
import json
import os
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable
import sys

from dotenv import load_dotenv
from pymongo import MongoClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from ml.model_registry import BASE_DIR
from ml.train_crop_model import train as train_crop_model
from ml.train_disease_model import train as train_disease_model
from ml.train_fertilizer_model import train as train_fertilizer_model


MODELS_DIR = BASE_DIR / "models"
SUMMARY_PATH = MODELS_DIR / "feedback_summary.json"

TRAINERS: dict[str, Callable[[], None]] = {
    "crop": train_crop_model,
    "fertilizer": train_fertilizer_model,
    "disease": train_disease_model,
}


def summarize_feedback(limit: int = 5000) -> dict:
    load_dotenv(BASE_DIR / ".env")
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = None

    summary = {
        "generated_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "total_feedback": 0,
        "helpful": 0,
        "not_helpful": 0,
        "by_feature": {},
        "top_subjects": [],
    }

    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=3000)
        items = list(client.kisaannavi.feedback.find().sort("created_at", -1).limit(limit))
    except Exception:
        items = []
    finally:
        try:
            if client is not None:
                client.close()
        except Exception:
            pass

    summary["total_feedback"] = len(items)
    summary["helpful"] = sum(1 for item in items if bool(item.get("helpful")) is True)
    summary["not_helpful"] = sum(1 for item in items if bool(item.get("helpful")) is False)

    by_feature: dict[str, dict[str, int]] = {}
    subject_counter: Counter[str] = Counter()
    for item in items:
        feature = str(item.get("feature", "unknown")).strip() or "unknown"
        subject = str(item.get("subject", "")).strip()
        bucket = by_feature.setdefault(feature, {"total": 0, "helpful": 0, "not_helpful": 0})
        bucket["total"] += 1
        if bool(item.get("helpful")) is True:
            bucket["helpful"] += 1
        else:
            bucket["not_helpful"] += 1
        if subject:
            subject_counter[subject] += 1

    summary["by_feature"] = by_feature
    summary["top_subjects"] = [
        {"subject": subject, "count": count}
        for subject, count in subject_counter.most_common(10)
    ]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    SUMMARY_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export feedback summary and retrain selected KisaanNavi models.")
    parser.add_argument(
        "--models",
        nargs="+",
        choices=["crop", "fertilizer", "disease", "all"],
        default=["all"],
        help="Which models to retrain after exporting feedback summary.",
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Only export feedback summary without retraining any models.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = summarize_feedback()
    print(f"Feedback summary exported to {SUMMARY_PATH}")
    print(json.dumps(summary, indent=2))

    if args.export_only:
        return

    targets = ["crop", "fertilizer", "disease"] if "all" in args.models else args.models
    for target in targets:
        print(f"\nRetraining {target} model...")
        TRAINERS[target]()


if __name__ == "__main__":
    main()
