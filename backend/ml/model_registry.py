from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
VERSIONS_DIR = MODELS_DIR / "versions"
REGISTRY_PATH = MODELS_DIR / "model_registry.json"


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def build_version(task: str) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"{task}-{timestamp}"


def prepare_metadata(
    *,
    task: str,
    metadata: dict[str, Any],
    dataset_paths: list[str],
    artifact_paths: list[Path],
) -> dict[str, Any]:
    version = build_version(task)
    prepared = dict(metadata)
    prepared["task"] = task
    prepared["model_version"] = version
    prepared["trained_at_utc"] = utc_now_iso()
    prepared["dataset_paths"] = dataset_paths
    prepared["artifact_paths"] = [str(path.relative_to(BASE_DIR)).replace("\\", "/") for path in artifact_paths]
    return prepared


def snapshot_version(task: str, version: str, artifact_paths: list[Path]) -> list[str]:
    version_dir = VERSIONS_DIR / task / version
    version_dir.mkdir(parents=True, exist_ok=True)

    copied: list[str] = []
    for path in artifact_paths:
        if not path.exists() or path.is_dir():
            continue
        destination = version_dir / path.name
        shutil.copy2(path, destination)
        copied.append(str(destination.relative_to(BASE_DIR)).replace("\\", "/"))

    return copied


def update_registry(task: str, metadata: dict[str, Any], copied_artifacts: list[str]) -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    registry: dict[str, Any] = {"updated_at_utc": utc_now_iso(), "models": {}}
    if REGISTRY_PATH.exists():
        try:
            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
        except Exception:
            registry = {"updated_at_utc": utc_now_iso(), "models": {}}

    models = registry.setdefault("models", {})
    history = list(models.get(task, {}).get("history", []))
    history.append(
        {
            "version": metadata["model_version"],
            "trained_at_utc": metadata["trained_at_utc"],
            "metrics": metadata.get("metrics", {}),
            "artifacts": copied_artifacts,
        }
    )

    models[task] = {
        "latest": {
            "version": metadata["model_version"],
            "trained_at_utc": metadata["trained_at_utc"],
            "metrics": metadata.get("metrics", {}),
            "metadata_file": next((path for path in metadata.get("artifact_paths", []) if path.endswith("_metadata.json")), None),
        },
        "history": history[-10:],
    }
    registry["updated_at_utc"] = utc_now_iso()
    REGISTRY_PATH.write_text(json.dumps(registry, indent=2), encoding="utf-8")
