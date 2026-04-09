from __future__ import annotations

import json
import os
import random
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from PIL import Image
import seaborn as sns
from sklearn.metrics import accuracy_score, auc, classification_report, confusion_matrix, f1_score, roc_curve, top_k_accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import label_binarize

from ml.model_registry import BASE_DIR, prepare_metadata, snapshot_version, update_registry
from services.disease_advisory import get_label_details


DATASET_DIR = BASE_DIR / "data" / "plantdoc"
MODELS_DIR = BASE_DIR / "models"
RESULTS_DIR = MODELS_DIR / "results"
REGISTRY_PATH = MODELS_DIR / "model_registry.json"

DISEASE_REPORT_PATH = RESULTS_DIR / "disease_classification_report.json"
DISEASE_CONFUSION_PATH = RESULTS_DIR / "disease_confusion_matrix.png"
DISEASE_ROC_PATH = RESULTS_DIR / "disease_roc_curves.png"
DISEASE_COMPARISON_CSV = RESULTS_DIR / "disease_model_comparison.csv"
DISEASE_COMPARISON_PNG = RESULTS_DIR / "disease_model_comparison.png"

REFERENCE_IMAGE_SIZE = (32, 32)
REFERENCE_GRAY_SIZE = (16, 16)

CNN_IMAGE_SIZE = (224, 224)
CNN_MEAN = [0.485, 0.456, 0.406]
CNN_STD = [0.229, 0.224, 0.225]

LABEL_ALIASES = {
    "Soybean leaf": "Soyabean leaf",
}


def _canonical_label(label: str) -> str:
    value = str(label).strip()
    return LABEL_ALIASES.get(value, value)


def _to_float(value) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except Exception:
        return None


def _extract_metrics_from_version_metadata(version: str) -> dict:
    metadata_path = MODELS_DIR / "versions" / "disease_detection" / version / "disease_metadata.json"
    if not metadata_path.exists():
        return {}
    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    except Exception:
        return {}

    metrics = metadata.get("metrics", {}) or {}
    top_k = metrics.get("top_k", {}) if isinstance(metrics, dict) else {}
    top1 = _to_float(metrics.get("accuracy")) if isinstance(metrics, dict) else None
    top3 = _to_float(top_k.get("top3")) if isinstance(top_k, dict) else None

    if top1 is None:
        top1 = _to_float(metadata.get("validation_accuracy"))
    if top3 is None:
        top3 = _to_float(metadata.get("validation_top3_accuracy"))

    return {
        "model_type": str(metadata.get("model_type", "")).strip() or "unknown",
        "top1": top1,
        "top3": top3,
        "f1_macro": _to_float(metrics.get("f1_macro")) if isinstance(metrics, dict) else None,
        "f1_weighted": _to_float(metrics.get("f1_weighted")) if isinstance(metrics, dict) else None,
    }


def _collect_history_rows(extra_entry: dict | None = None) -> list[dict]:
    rows: list[dict] = []
    if REGISTRY_PATH.exists():
        try:
            registry = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
            history = (
                registry.get("models", {})
                .get("disease_detection", {})
                .get("history", [])
            )
            for item in history:
                version = str(item.get("version", "")).strip()
                if not version:
                    continue
                metrics = item.get("metrics", {}) or {}
                top_k = metrics.get("top_k", {}) if isinstance(metrics, dict) else {}
                top1 = _to_float(metrics.get("accuracy")) if isinstance(metrics, dict) else None
                top3 = _to_float(top_k.get("top3")) if isinstance(top_k, dict) else None
                f1_macro = _to_float(metrics.get("f1_macro")) if isinstance(metrics, dict) else None
                f1_weighted = _to_float(metrics.get("f1_weighted")) if isinstance(metrics, dict) else None

                fallback = _extract_metrics_from_version_metadata(version)
                row = {
                    "version": version,
                    "trained_at_utc": str(item.get("trained_at_utc", "")).strip(),
                    "model_type": fallback.get("model_type", "unknown"),
                    "top1": top1 if top1 is not None else fallback.get("top1"),
                    "top3": top3 if top3 is not None else fallback.get("top3"),
                    "f1_macro": f1_macro if f1_macro is not None else fallback.get("f1_macro"),
                    "f1_weighted": f1_weighted if f1_weighted is not None else fallback.get("f1_weighted"),
                }
                rows.append(row)
        except Exception:
            rows = []

    if extra_entry:
        extra_version = str(extra_entry.get("version", "")).strip()
        rows = [row for row in rows if str(row.get("version", "")).strip() != extra_version]
        rows.append(extra_entry)

    rows.sort(key=lambda row: str(row.get("trained_at_utc", "")))
    return rows


def _save_disease_model_comparison(extra_entry: dict | None = None) -> tuple[Path, Path]:
    rows = _collect_history_rows(extra_entry=extra_entry)
    if not rows:
        empty = pd.DataFrame(
            columns=["version", "trained_at_utc", "model_type", "top1", "top3", "f1_macro", "f1_weighted"]
        )
        empty.to_csv(DISEASE_COMPARISON_CSV, index=False)
        return DISEASE_COMPARISON_CSV, DISEASE_COMPARISON_PNG

    df = pd.DataFrame(rows)
    for column in ["top1", "top3", "f1_macro", "f1_weighted"]:
        df[column] = pd.to_numeric(df[column], errors="coerce")
    df.to_csv(DISEASE_COMPARISON_CSV, index=False)

    plot_df = df.copy()
    plot_df["label"] = [f"v{i + 1}" for i in range(len(plot_df))]
    x = np.arange(len(plot_df))
    width = 0.35
    plt.figure(figsize=(max(8, len(plot_df) * 1.6), 6))
    plt.bar(x - width / 2, plot_df["top1"].fillna(0).values, width=width, label="Top-1")
    plt.bar(x + width / 2, plot_df["top3"].fillna(0).values, width=width, label="Top-3")
    plt.ylim(0.0, 1.0)
    plt.ylabel("Score")
    plt.title("Disease Model Comparison Across Versions")
    xtick_labels = [f"{label}\n{version[-6:]}" for label, version in zip(plot_df["label"], plot_df["version"])]
    plt.xticks(x, xtick_labels, rotation=0)
    plt.legend()
    plt.tight_layout()
    plt.savefig(DISEASE_COMPARISON_PNG, dpi=250)
    plt.close()
    return DISEASE_COMPARISON_CSV, DISEASE_COMPARISON_PNG


def _save_disease_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: list[str],
    out_path: Path,
) -> None:
    if len(y_true) == 0:
        return
    labels = np.arange(len(class_names))
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    plt.figure(figsize=(14, 12))
    sns.heatmap(cm, cmap="Oranges", xticklabels=class_names, yticklabels=class_names)
    plt.title("Disease Detection Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.xticks(rotation=45, ha="right")
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def _save_disease_roc_curves(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    class_names: list[str],
    out_path: Path,
    max_classes: int = 10,
) -> None:
    if len(y_true) == 0 or y_prob.size == 0 or len(class_names) < 2:
        return
    y_bin = label_binarize(y_true, classes=np.arange(len(class_names)))
    if y_bin.shape[1] != y_prob.shape[1]:
        return
    class_indices = np.argsort(y_prob.mean(axis=0))[::-1][: max_classes]
    plt.figure(figsize=(10, 8))
    for index in class_indices:
        if len(np.unique(y_bin[:, index])) < 2:
            continue
        fpr, tpr, _ = roc_curve(y_bin[:, index], y_prob[:, index])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{class_names[index]} (AUC={roc_auc:.2f})")
    plt.plot([0, 1], [0, 1], "k--")
    plt.title("Disease ROC Curves (Top Classes)")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right", fontsize=8)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def _read_split_rows(split: str) -> tuple[list[tuple[Path, str]], list[str]]:
    split_dir = DATASET_DIR / split
    classes_file = split_dir / "_classes.csv"
    if not classes_file.exists():
        raise FileNotFoundError(f"Missing classes file: {classes_file}")

    with open(classes_file, "r", encoding="utf-8") as file:
        lines = [line.strip() for line in file.readlines() if line.strip()]

    header_parts = [part.strip() for part in lines[0].split(",")]
    class_names = [_canonical_label(name) for name in header_parts[1:]]

    rows: list[tuple[Path, str]] = []
    for raw_line in lines[1:]:
        parts = [part.strip() for part in raw_line.rsplit(",", len(class_names))]
        if len(parts) != len(class_names) + 1:
            continue

        image_name = parts[0]
        image_path = split_dir / image_name
        if not image_path.exists():
            continue

        label_values = np.array(parts[1:], dtype=np.float32)
        class_idx = int(np.argmax(label_values))
        rows.append((image_path, class_names[class_idx]))

    if not rows:
        raise RuntimeError(f"No samples found in {split_dir}")
    return rows, class_names


def _extract_reference_features(image_path: Path) -> np.ndarray:
    with Image.open(image_path) as img:
        rgb = img.convert("RGB").resize(REFERENCE_IMAGE_SIZE)
        rgb_arr = np.asarray(rgb, dtype=np.float32) / 255.0

        gray = rgb.convert("L").resize(REFERENCE_GRAY_SIZE)
        gray_arr = np.asarray(gray, dtype=np.float32) / 255.0

    flat_rgb = rgb_arr.reshape(-1)
    flat_gray = gray_arr.reshape(-1)
    mean_rgb = rgb_arr.mean(axis=(0, 1))
    std_rgb = rgb_arr.std(axis=(0, 1))

    hist_features = []
    for channel_idx in range(3):
        hist, _ = np.histogram(rgb_arr[:, :, channel_idx], bins=8, range=(0.0, 1.0))
        hist_features.extend(hist.astype(np.float32) / max(hist.sum(), 1))

    return np.concatenate([flat_rgb, flat_gray, mean_rgb, std_rgb, np.array(hist_features, dtype=np.float32)])


def _normalize_features(features: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(features, axis=1, keepdims=True)
    return features / np.maximum(norms, 1e-8)


def _predict_reference(
    query_features: np.ndarray,
    reference_features: np.ndarray,
    reference_labels: np.ndarray,
    *,
    top_k: int = 3,
    vote_neighbors: int = 12,
) -> tuple[np.ndarray, np.ndarray]:
    similarities = np.matmul(query_features, reference_features.T)
    top_neighbor_indices = np.argsort(similarities, axis=1)[:, ::-1][:, :vote_neighbors]

    predicted_labels = []
    top_label_rows = []
    for row_index, neighbor_indices in enumerate(top_neighbor_indices):
        label_scores: dict[str, float] = {}
        for idx in neighbor_indices:
            label = str(reference_labels[idx])
            similarity = float(max(similarities[row_index, idx], 0.0))
            label_scores[label] = label_scores.get(label, 0.0) + similarity

        if not label_scores:
            fallback = str(reference_labels[neighbor_indices[0]])
            predicted_labels.append(fallback)
            top_label_rows.append([fallback])
            continue

        ranked = sorted(label_scores.items(), key=lambda item: item[1], reverse=True)
        predicted_labels.append(ranked[0][0])
        top_label_rows.append([item[0] for item in ranked[:top_k]])

    return np.array(predicted_labels), np.array(top_label_rows, dtype=object)


def _train_reference_index() -> None:
    print("Torch not available. Falling back to reference-index disease model.")
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    train_rows, _ = _read_split_rows("train")
    test_rows, _ = _read_split_rows("test")

    x_train = np.vstack([_extract_reference_features(path) for path, _ in train_rows])
    y_train = np.array([label for _, label in train_rows])
    x_test = np.vstack([_extract_reference_features(path) for path, _ in test_rows])
    y_test = np.array([label for _, label in test_rows])

    x_train_norm = _normalize_features(x_train)
    x_test_norm = _normalize_features(x_test)

    y_pred, top_labels = _predict_reference(x_test_norm, x_train_norm, y_train, top_k=3)
    accuracy = float(accuracy_score(y_test, y_pred))
    top3 = float(np.mean([true_label in list(candidates) for true_label, candidates in zip(y_test, top_labels)]))
    report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    f1_macro = float(f1_score(y_test, y_pred, average="macro", zero_division=0))
    f1_weighted = float(f1_score(y_test, y_pred, average="weighted", zero_division=0))

    unique_labels, label_counts = np.unique(y_train, return_counts=True)
    count_map = {str(label): int(count) for label, count in zip(unique_labels, label_counts)}

    model_path = MODELS_DIR / "disease_model.pkl"
    metadata_path = MODELS_DIR / "disease_metadata.json"
    report_path = DISEASE_REPORT_PATH

    joblib.dump(
        {
            "type": "plantdoc_reference_index",
            "features": x_train_norm.astype(np.float32),
            "labels": y_train.tolist(),
        },
        model_path,
    )

    metadata = {
        "dataset": "PlantDoc.v2-resize-100x100.multiclass",
        "image_size": list(REFERENCE_IMAGE_SIZE),
        "gray_size": list(REFERENCE_GRAY_SIZE),
        "feature_count": int(x_train.shape[1]),
        "class_names": sorted(set(y_train.tolist())),
        "train_samples": int(len(y_train)),
        "test_samples": int(len(y_test)),
        "deployed_reference_samples": int(len(y_train)),
        "model_type": "nearest_neighbor_reference",
        "class_counts": count_map,
        "label_aliases": LABEL_ALIASES,
        "metrics": {
            "accuracy": accuracy,
            "f1_macro": f1_macro,
            "f1_weighted": f1_weighted,
            "top_k": {"top1": accuracy, "top3": top3},
        },
    }

    confusion_labels = sorted(set(y_train.tolist()) | set(y_test.tolist()) | set(y_pred.tolist()))
    y_test_indices = np.asarray([confusion_labels.index(label) for label in y_test], dtype=np.int64)
    y_pred_indices = np.asarray([confusion_labels.index(label) for label in y_pred], dtype=np.int64)
    _save_disease_confusion_matrix(y_test_indices, y_pred_indices, confusion_labels, DISEASE_CONFUSION_PATH)

    comparison_entry = {
        "version": metadata["model_version"],
        "trained_at_utc": metadata["trained_at_utc"],
        "model_type": metadata.get("model_type", "nearest_neighbor_reference"),
        "top1": _to_float(metadata.get("metrics", {}).get("accuracy")),
        "top3": _to_float(metadata.get("metrics", {}).get("top_k", {}).get("top3")),
        "f1_macro": _to_float(metadata.get("metrics", {}).get("f1_macro")),
        "f1_weighted": _to_float(metadata.get("metrics", {}).get("f1_weighted")),
    }
    comparison_csv, comparison_png = _save_disease_model_comparison(extra_entry=comparison_entry)

    artifact_paths = [
        model_path,
        metadata_path,
        report_path,
        DISEASE_CONFUSION_PATH,
        comparison_csv,
        comparison_png,
    ]
    metadata = prepare_metadata(
        task="disease_detection",
        metadata=metadata,
        dataset_paths=[str(DATASET_DIR.relative_to(BASE_DIR)).replace("\\", "/")],
        artifact_paths=artifact_paths,
    )

    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    copied_artifacts = snapshot_version("disease_detection", metadata["model_version"], artifact_paths)
    update_registry("disease_detection", metadata, copied_artifacts)

    print(f"Reference disease model saved to {model_path}")
    print(f"Validation accuracy: {accuracy:.3f}")
    print(f"Validation top-3: {top3:.3f}")
    print(f"Model version: {metadata['model_version']}")


def _train_cnn() -> None:
    try:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, Dataset
        from torchvision import models, transforms
        from torchvision.models import MobileNet_V3_Small_Weights
    except Exception as error:
        raise ImportError("PyTorch/torchvision is required for CNN training.") from error

    class DiseaseCsvDataset(Dataset):
        def __init__(self, rows: list[tuple[Path, str]], class_to_idx: dict[str, int], transform):
            self.rows = rows
            self.class_to_idx = class_to_idx
            self.transform = transform

        def __len__(self) -> int:
            return len(self.rows)

        def __getitem__(self, index: int):
            image_path, label = self.rows[index]
            with Image.open(image_path) as img:
                image = img.convert("RGB")
            return self.transform(image), self.class_to_idx[label]

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    random_seed = int(os.getenv("DISEASE_SEED", "42"))
    random.seed(random_seed)
    np.random.seed(random_seed)
    torch.manual_seed(random_seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(random_seed)

    torch_cache_dir = Path(os.getenv("TORCH_HOME", str(BASE_DIR / ".torch_cache")))
    torch_cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ["TORCH_HOME"] = str(torch_cache_dir)

    train_rows, _ = _read_split_rows("train")
    test_rows, _ = _read_split_rows("test")

    class_names = sorted({label for _, label in train_rows})
    class_to_idx = {name: idx for idx, name in enumerate(class_names)}
    num_classes = len(class_names)

    filtered_test_rows = [(path, label) for path, label in test_rows if label in class_to_idx]
    dropped_test_samples = len(test_rows) - len(filtered_test_rows)
    test_rows = filtered_test_rows
    if not test_rows:
        raise RuntimeError("No valid test samples remain after filtering labels absent from training set.")

    labels_for_split = np.asarray([label for _, label in train_rows], dtype=object)
    train_indices = np.arange(len(train_rows))
    if len(train_rows) >= 100:
        train_idx, val_idx = train_test_split(
            train_indices,
            test_size=0.15,
            random_state=random_seed,
            stratify=labels_for_split,
        )
        train_rows_fit = [train_rows[idx] for idx in train_idx.tolist()]
        val_rows = [train_rows[idx] for idx in val_idx.tolist()]
    else:
        train_rows_fit = train_rows
        val_rows = test_rows

    train_label_indices = np.asarray([class_to_idx[label] for _, label in train_rows_fit], dtype=np.int64)
    class_counts_arr = np.bincount(train_label_indices, minlength=num_classes).astype(np.float32)
    class_weights_arr = class_counts_arr.sum() / np.maximum(class_counts_arr, 1.0)
    class_weights_arr = class_weights_arr / max(float(class_weights_arr.mean()), 1e-8)

    train_transform = transforms.Compose(
        [
            transforms.Resize(CNN_IMAGE_SIZE),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(8),
            transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15, hue=0.02),
            transforms.ToTensor(),
            transforms.Normalize(mean=CNN_MEAN, std=CNN_STD),
        ]
    )
    eval_transform = transforms.Compose(
        [
            transforms.Resize(CNN_IMAGE_SIZE),
            transforms.ToTensor(),
            transforms.Normalize(mean=CNN_MEAN, std=CNN_STD),
        ]
    )

    train_ds = DiseaseCsvDataset(train_rows_fit, class_to_idx, train_transform)
    val_ds = DiseaseCsvDataset(val_rows, class_to_idx, eval_transform)
    test_ds = DiseaseCsvDataset(test_rows, class_to_idx, eval_transform)

    batch_size = int(os.getenv("DISEASE_BATCH_SIZE", "32"))
    epochs = int(os.getenv("DISEASE_EPOCHS", "12"))
    lr = float(os.getenv("DISEASE_LR", "0.0008"))
    device = "cuda" if torch.cuda.is_available() else "cpu"

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    init_mode = "random_init"
    try:
        weights = MobileNet_V3_Small_Weights.DEFAULT
        model = models.mobilenet_v3_small(weights=weights)
        init_mode = "imagenet_pretrained"
    except Exception as error:
        print(f"Unable to load pretrained MobileNet weights ({error}). Using random initialization.")
        model = models.mobilenet_v3_small(weights=None)

    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, num_classes)
    model = model.to(device)

    class_weights = torch.tensor(class_weights_arr, dtype=torch.float32, device=device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=max(epochs, 1),
        eta_min=max(lr * 0.1, 1e-6),
    )

    best_state = None
    best_top1 = -1.0
    best_top3 = -1.0

    print(f"Training CNN disease model on {device} for {epochs} epochs...")
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        total = 0
        correct = 0

        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)

            optimizer.zero_grad(set_to_none=True)
            logits = model(images)
            loss = criterion(logits, labels)
            loss.backward()
            optimizer.step()

            running_loss += float(loss.item()) * labels.size(0)
            total += labels.size(0)
            correct += int((logits.argmax(dim=1) == labels).sum().item())

        model.eval()
        val_probs = []
        val_true = []
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device)
                logits = model(images)
                probs = torch.softmax(logits, dim=1).detach().cpu().numpy()
                val_probs.append(probs)
                val_true.append(labels.numpy())

        y_true = np.concatenate(val_true)
        y_prob = np.vstack(val_probs)
        y_pred = y_prob.argmax(axis=1)
        val_top1 = float(accuracy_score(y_true, y_pred))
        top_k_for_eval = min(3, num_classes)
        val_top3 = float(top_k_accuracy_score(y_true, y_prob, k=top_k_for_eval, labels=np.arange(num_classes)))
        train_acc = (correct / total) if total else 0.0
        train_loss = (running_loss / total) if total else 0.0

        print(
            f"Epoch {epoch + 1:02d}/{epochs} | "
            f"train_loss={train_loss:.4f} train_acc={train_acc:.4f} "
            f"val_top1={val_top1:.4f} val_top3={val_top3:.4f}"
        )
        scheduler.step()

        if val_top1 > best_top1:
            best_top1 = val_top1
            best_top3 = val_top3
            best_state = {key: value.detach().cpu() for key, value in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("CNN training failed to produce a valid checkpoint.")

    model.load_state_dict(best_state)
    model.eval()

    all_probs = []
    all_true = []
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            logits = model(images)
            probs = torch.softmax(logits, dim=1).detach().cpu().numpy()
            all_probs.append(probs)
            all_true.append(labels.numpy())

    y_true = np.concatenate(all_true)
    y_prob = np.vstack(all_probs)
    y_pred = y_prob.argmax(axis=1)

    top1 = float(accuracy_score(y_true, y_pred))
    top_k_for_eval = min(3, num_classes)
    top3 = float(top_k_accuracy_score(y_true, y_prob, k=top_k_for_eval, labels=np.arange(num_classes)))
    label_to_crop = {
        idx: str(get_label_details(name).get("crop", "")).strip().lower()
        for idx, name in enumerate(class_names)
    }
    crop_to_indices: dict[str, list[int]] = {}
    for idx, crop_name in label_to_crop.items():
        crop_to_indices.setdefault(crop_name, []).append(idx)

    crop_filtered_predictions = []
    for true_idx, prob_row in zip(y_true, y_prob):
        true_crop = label_to_crop.get(int(true_idx), "")
        candidate_indices = crop_to_indices.get(true_crop, [])
        if not candidate_indices:
            crop_filtered_predictions.append(int(np.argmax(prob_row)))
            continue
        best_local = int(np.argmax(prob_row[candidate_indices]))
        crop_filtered_predictions.append(int(candidate_indices[best_local]))

    crop_filtered_top1 = float(accuracy_score(y_true, np.asarray(crop_filtered_predictions, dtype=np.int32)))
    f1_macro = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    f1_weighted = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    report = classification_report(
        y_true,
        y_pred,
        labels=np.arange(num_classes),
        target_names=class_names,
        output_dict=True,
        zero_division=0,
    )

    count_map = {name: int(class_counts_arr[idx]) for idx, name in enumerate(class_names)}

    model_path = MODELS_DIR / "disease_model.pt"
    metadata_path = MODELS_DIR / "disease_metadata.json"
    report_path = DISEASE_REPORT_PATH

    torch.save(
        {
            "state_dict": best_state,
            "class_names": class_names,
            "input_size": list(CNN_IMAGE_SIZE),
            "mean": CNN_MEAN,
            "std": CNN_STD,
            "architecture": "mobilenet_v3_small",
        },
        model_path,
    )

    metadata = {
        "dataset": "PlantDoc.v2-resize-100x100.multiclass",
        "class_names": class_names,
        "train_samples": int(len(train_rows_fit)),
        "validation_samples": int(len(val_rows)),
        "test_samples": int(len(test_rows)),
        "dropped_test_samples": int(dropped_test_samples),
        "deployed_reference_samples": int(len(train_rows)),
        "model_type": "cnn_transfer_mobilenet_v3_small",
        "input_size": list(CNN_IMAGE_SIZE),
        "normalization": {"mean": CNN_MEAN, "std": CNN_STD},
        "label_aliases": LABEL_ALIASES,
        "class_counts": count_map,
        "initialization": init_mode,
        "metrics": {
            "accuracy": top1,
            "f1_macro": f1_macro,
            "f1_weighted": f1_weighted,
            "top_k": {"top1": top1, "top3": top3},
            "top1_with_crop_filter": crop_filtered_top1,
        },
    }

    _save_disease_confusion_matrix(y_true, y_pred, class_names, DISEASE_CONFUSION_PATH)
    _save_disease_roc_curves(y_true, y_prob, class_names, DISEASE_ROC_PATH, max_classes=12)
    comparison_entry = {
        "version": metadata["model_version"],
        "trained_at_utc": metadata["trained_at_utc"],
        "model_type": metadata.get("model_type", "cnn_transfer_mobilenet_v3_small"),
        "top1": _to_float(metadata.get("metrics", {}).get("accuracy")),
        "top3": _to_float(metadata.get("metrics", {}).get("top_k", {}).get("top3")),
        "f1_macro": _to_float(metadata.get("metrics", {}).get("f1_macro")),
        "f1_weighted": _to_float(metadata.get("metrics", {}).get("f1_weighted")),
    }
    comparison_csv, comparison_png = _save_disease_model_comparison(extra_entry=comparison_entry)

    artifact_paths = [
        model_path,
        metadata_path,
        report_path,
        DISEASE_CONFUSION_PATH,
        DISEASE_ROC_PATH,
        comparison_csv,
        comparison_png,
    ]
    metadata = prepare_metadata(
        task="disease_detection",
        metadata=metadata,
        dataset_paths=[str(DATASET_DIR.relative_to(BASE_DIR)).replace("\\", "/")],
        artifact_paths=artifact_paths,
    )

    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    copied_artifacts = snapshot_version("disease_detection", metadata["model_version"], artifact_paths)
    update_registry("disease_detection", metadata, copied_artifacts)

    print(f"CNN disease model saved to {model_path}")
    print(f"Validation top-1: {top1:.3f}")
    print(f"Validation top-3: {top3:.3f}")
    print(f"Model version: {metadata['model_version']}")


def refresh_results_from_current_model() -> None:
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    metadata_path = MODELS_DIR / "disease_metadata.json"
    metadata: dict = {}
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            metadata = {}

    model_type = str(metadata.get("model_type", "")).strip().lower()
    computed_metrics: dict = {}

    if model_type.startswith("cnn_transfer") and (MODELS_DIR / "disease_model.pt").exists():
        try:
            import torch
            from torch import nn
            from torch.utils.data import DataLoader, Dataset
            from torchvision import models, transforms
        except Exception as error:
            raise RuntimeError("Cannot refresh disease results for CNN model without torch + torchvision.") from error

        class DiseaseCsvDataset(Dataset):
            def __init__(self, rows: list[tuple[Path, str]], class_to_idx: dict[str, int], transform):
                self.rows = rows
                self.class_to_idx = class_to_idx
                self.transform = transform

            def __len__(self) -> int:
                return len(self.rows)

            def __getitem__(self, index: int):
                image_path, label = self.rows[index]
                with Image.open(image_path) as img:
                    image = img.convert("RGB")
                return self.transform(image), self.class_to_idx[label]

        checkpoint = torch.load(MODELS_DIR / "disease_model.pt", map_location="cpu")
        class_names = checkpoint.get("class_names") or metadata.get("class_names") or []
        if not class_names:
            raise RuntimeError("Cannot refresh disease results: class names are missing in checkpoint/metadata.")
        class_names = [str(name) for name in class_names]
        class_to_idx = {name: idx for idx, name in enumerate(class_names)}

        test_rows, _ = _read_split_rows("test")
        test_rows = [(path, label) for path, label in test_rows if label in class_to_idx]
        if not test_rows:
            raise RuntimeError("No valid test rows found while refreshing disease results.")

        input_size = checkpoint.get("input_size", metadata.get("input_size", [224, 224]))
        mean = checkpoint.get("mean", metadata.get("normalization", {}).get("mean", CNN_MEAN))
        std = checkpoint.get("std", metadata.get("normalization", {}).get("std", CNN_STD))

        eval_transform = transforms.Compose(
            [
                transforms.Resize((int(input_size[0]), int(input_size[1]))),
                transforms.ToTensor(),
                transforms.Normalize(mean=mean, std=std),
            ]
        )
        test_ds = DiseaseCsvDataset(test_rows, class_to_idx, eval_transform)
        test_loader = DataLoader(test_ds, batch_size=32, shuffle=False, num_workers=0)

        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, len(class_names))
        model.load_state_dict(checkpoint["state_dict"])
        model.eval()

        all_probs = []
        all_true = []
        with torch.no_grad():
            for images, labels in test_loader:
                logits = model(images)
                probs = torch.softmax(logits, dim=1).cpu().numpy()
                all_probs.append(probs)
                all_true.append(labels.numpy())

        y_true = np.concatenate(all_true)
        y_prob = np.vstack(all_probs)
        y_pred = y_prob.argmax(axis=1)

        report = classification_report(
            y_true,
            y_pred,
            labels=np.arange(len(class_names)),
            target_names=class_names,
            output_dict=True,
            zero_division=0,
        )
        DISEASE_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        _save_disease_confusion_matrix(y_true, y_pred, class_names, DISEASE_CONFUSION_PATH)
        _save_disease_roc_curves(y_true, y_prob, class_names, DISEASE_ROC_PATH, max_classes=12)

        computed_metrics = {
            "top1": float(accuracy_score(y_true, y_pred)),
            "top3": float(top_k_accuracy_score(y_true, y_prob, k=min(3, len(class_names)), labels=np.arange(len(class_names)))),
            "f1_macro": float(f1_score(y_true, y_pred, average="macro", zero_division=0)),
            "f1_weighted": float(f1_score(y_true, y_pred, average="weighted", zero_division=0)),
        }
    else:
        model_path = MODELS_DIR / "disease_model.pkl"
        if not model_path.exists():
            raise FileNotFoundError("No disease model found for refreshing results.")
        model_payload = joblib.load(model_path)
        reference_features = np.asarray(model_payload.get("features", []), dtype=np.float32)
        reference_labels = np.asarray(model_payload.get("labels", []), dtype=object)
        if reference_features.size == 0 or reference_labels.size == 0:
            raise RuntimeError("Reference model payload is empty.")

        test_rows, _ = _read_split_rows("test")
        x_test = np.vstack([_extract_reference_features(path) for path, _ in test_rows])
        y_test_labels = np.asarray([label for _, label in test_rows], dtype=object)
        x_test = _normalize_features(x_test)
        y_pred_labels, top_labels = _predict_reference(x_test, reference_features, reference_labels, top_k=3)
        top1 = float(accuracy_score(y_test_labels, y_pred_labels))
        top3 = float(np.mean([truth in list(cands) for truth, cands in zip(y_test_labels, top_labels)]))
        confusion_labels = sorted(set(reference_labels.tolist()) | set(y_test_labels.tolist()) | set(y_pred_labels.tolist()))
        y_true = np.asarray([confusion_labels.index(label) for label in y_test_labels], dtype=np.int64)
        y_pred = np.asarray([confusion_labels.index(label) for label in y_pred_labels], dtype=np.int64)

        report = classification_report(y_test_labels, y_pred_labels, output_dict=True, zero_division=0)
        DISEASE_REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
        _save_disease_confusion_matrix(y_true, y_pred, confusion_labels, DISEASE_CONFUSION_PATH)

        computed_metrics = {
            "top1": top1,
            "top3": top3,
            "f1_macro": float(f1_score(y_test_labels, y_pred_labels, average="macro", zero_division=0)),
            "f1_weighted": float(f1_score(y_test_labels, y_pred_labels, average="weighted", zero_division=0)),
        }

    metrics_from_metadata = metadata.get("metrics", {}) if isinstance(metadata.get("metrics", {}), dict) else {}
    top_k = metrics_from_metadata.get("top_k", {}) if isinstance(metrics_from_metadata.get("top_k", {}), dict) else {}
    extra_entry = None
    if metadata.get("model_version") and metadata.get("trained_at_utc"):
        extra_entry = {
            "version": str(metadata.get("model_version")),
            "trained_at_utc": str(metadata.get("trained_at_utc")),
            "model_type": str(metadata.get("model_type", "unknown")),
            "top1": computed_metrics.get("top1", _to_float(metrics_from_metadata.get("accuracy"))),
            "top3": computed_metrics.get("top3", _to_float(top_k.get("top3"))),
            "f1_macro": computed_metrics.get("f1_macro", _to_float(metrics_from_metadata.get("f1_macro"))),
            "f1_weighted": computed_metrics.get("f1_weighted", _to_float(metrics_from_metadata.get("f1_weighted"))),
        }

    _save_disease_model_comparison(extra_entry=extra_entry)
    print("Disease result artifacts refreshed:")
    print(f"- {DISEASE_REPORT_PATH}")
    print(f"- {DISEASE_CONFUSION_PATH}")
    print(f"- {DISEASE_ROC_PATH}")
    print(f"- {DISEASE_COMPARISON_CSV}")
    print(f"- {DISEASE_COMPARISON_PNG}")


def train() -> None:
    try:
        _train_cnn()
    except ImportError as error:
        print(str(error))
        _train_reference_index()


if __name__ == "__main__":
    if os.getenv("DISEASE_RESULTS_ONLY", "0") == "1":
        refresh_results_from_current_model()
    else:
        train()
