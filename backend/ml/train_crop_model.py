import json
import os
from typing import Dict, List
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score, roc_curve, auc, top_k_accuracy_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.neighbors import KNeighborsClassifier
from sklearn.preprocessing import LabelEncoder, StandardScaler, label_binarize
from sklearn.svm import SVC

from ml.model_registry import BASE_DIR, prepare_metadata, snapshot_version, update_registry

SEED = 42
DATA_PATH = BASE_DIR / "data" / "crop_recommendation.csv"
MODELS_DIR = BASE_DIR / "models"
RESULTS_DIR = MODELS_DIR / "results"

FEATURE_COLUMNS = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET_COLUMN = "label"


def ensure_dirs() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def load_data() -> tuple[pd.DataFrame, np.ndarray, LabelEncoder, StandardScaler]:
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=FEATURE_COLUMNS + [TARGET_COLUMN]).copy()

    X = df[FEATURE_COLUMNS].astype(float)
    y_raw = df[TARGET_COLUMN].astype(str).str.strip().str.lower()

    encoder = LabelEncoder()
    y = encoder.fit_transform(y_raw)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    return df, X_scaled, y, encoder, scaler


def build_candidates() -> Dict[str, object]:
    return {
        "random_forest": RandomForestClassifier(
            n_estimators=400,
            max_depth=None,
            min_samples_split=2,
            min_samples_leaf=1,
            class_weight="balanced_subsample",
            random_state=SEED,
            n_jobs=1,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=500,
            class_weight="balanced",
            random_state=SEED,
            n_jobs=1,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            n_estimators=250,
            learning_rate=0.08,
            max_depth=3,
            random_state=SEED,
        ),
        "svc_rbf": SVC(
            kernel="rbf",
            C=8.0,
            gamma="scale",
            probability=True,
            class_weight="balanced",
            random_state=SEED,
        ),
        "knn": KNeighborsClassifier(
            n_neighbors=7,
            weights="distance",
        ),
    }


def evaluate_candidates(models: Dict[str, object], X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray) -> pd.DataFrame:
    rows: List[dict] = []
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)

    for name, model in models.items():
        cv_f1 = cross_val_score(model, X_train, y_train, cv=cv, scoring="f1_macro", n_jobs=1)
        model.fit(X_train, y_train)
        pred = model.predict(X_test)
        rows.append(
            {
                "model": name,
                "cv_f1_macro_mean": float(cv_f1.mean()),
                "cv_f1_macro_std": float(cv_f1.std()),
                "test_accuracy": float(accuracy_score(y_test, pred)),
                "test_f1_macro": float(f1_score(y_test, pred, average="macro")),
                "test_f1_weighted": float(f1_score(y_test, pred, average="weighted")),
            }
        )
    return pd.DataFrame(rows).sort_values(["cv_f1_macro_mean", "test_f1_macro"], ascending=False)


def topk_metrics(y_true: np.ndarray, probas: np.ndarray) -> dict:
    return {
        "top1": float(top_k_accuracy_score(y_true, probas, k=1)),
        "top3": float(top_k_accuracy_score(y_true, probas, k=3)),
        "top5": float(top_k_accuracy_score(y_true, probas, k=5)),
    }


def save_model_comparison_plot(results_df: pd.DataFrame, out_path: str) -> None:
    plot_df = results_df.copy()
    metrics = ["test_accuracy", "test_f1_macro", "test_f1_weighted", "cv_f1_macro_mean"]
    labels = ["Accuracy", "F1 Macro", "F1 Weighted", "CV F1 Macro"]

    x = np.arange(len(plot_df))
    width = 0.2
    plt.figure(figsize=(10, 6))
    for idx, (metric, label) in enumerate(zip(metrics, labels)):
        plt.bar(x + idx * width, plot_df[metric].values, width=width, label=label)
    plt.xticks(x + width * 1.5, plot_df["model"].values, rotation=20)
    plt.ylim(0.7, 1.01)
    plt.ylabel("Score")
    plt.title("Crop Model Comparison")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def save_confusion_matrix_plot(y_true: np.ndarray, y_pred: np.ndarray, classes: np.ndarray, out_path: str) -> None:
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(14, 12))
    sns.heatmap(cm, cmap="Greens", xticklabels=classes, yticklabels=classes)
    plt.title("Crop Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.xticks(rotation=45, ha="right")
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def save_roc_plot(y_true: np.ndarray, probas: np.ndarray, classes: np.ndarray, out_path: str, max_classes: int = 10) -> None:
    y_bin = label_binarize(y_true, classes=np.arange(len(classes)))
    class_indices = np.argsort(probas.mean(axis=0))[::-1][:max_classes]
    plt.figure(figsize=(10, 8))
    for i in class_indices:
        fpr, tpr, _ = roc_curve(y_bin[:, i], probas[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{classes[i]} (AUC={roc_auc:.2f})")
    plt.plot([0, 1], [0, 1], "k--")
    plt.title("Crop ROC Curves (Top Classes)")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right", fontsize=8)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def train() -> None:
    ensure_dirs()
    _, X_scaled, y, label_encoder, scaler = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled,
        y,
        test_size=0.2,
        random_state=SEED,
        stratify=y,
    )

    candidates = build_candidates()
    results = evaluate_candidates(candidates, X_train, y_train, X_test, y_test)
    results_csv = RESULTS_DIR / "crop_model_comparison.csv"
    results_plot = RESULTS_DIR / "crop_model_comparison.png"
    confusion_plot = RESULTS_DIR / "crop_confusion_matrix.png"
    roc_plot = RESULTS_DIR / "crop_roc_curves.png"
    report_path = RESULTS_DIR / "crop_classification_report.txt"
    metadata_path = MODELS_DIR / "crop_metadata.json"
    model_path = MODELS_DIR / "crop_model.pkl"
    label_encoder_path = MODELS_DIR / "crop_label_encoder.pkl"
    scaler_path = MODELS_DIR / "crop_scaler.pkl"

    results.to_csv(results_csv, index=False)
    save_model_comparison_plot(results, str(results_plot))

    best_name = str(results.iloc[0]["model"])
    best_model = candidates[best_name]

    calibrated_model = CalibratedClassifierCV(best_model, method="sigmoid", cv=3)
    calibrated_model.fit(X_train, y_train)

    test_proba = calibrated_model.predict_proba(X_test)
    test_pred = calibrated_model.predict(X_test)
    save_confusion_matrix_plot(y_test, test_pred, label_encoder.classes_, str(confusion_plot))
    save_roc_plot(y_test, test_proba, label_encoder.classes_, str(roc_plot))

    metrics = {
        "accuracy": float(accuracy_score(y_test, test_pred)),
        "f1_macro": float(f1_score(y_test, test_pred, average="macro")),
        "f1_weighted": float(f1_score(y_test, test_pred, average="weighted")),
        "top_k": topk_metrics(y_test, test_proba),
    }

    report = classification_report(y_test, test_pred, target_names=label_encoder.classes_)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("Crop Recommendation - Classification Report\n")
        f.write(f"Best model: {best_name}\n")
        f.write("=" * 60 + "\n\n")
        f.write(report)
        f.write("\n\nMetrics\n")
        f.write(json.dumps(metrics, indent=2))

    metadata = {
        "task": "crop_recommendation",
        "best_model": best_name,
        "calibrated": True,
        "feature_columns": FEATURE_COLUMNS,
        "class_count": int(len(label_encoder.classes_)),
        "classes": [str(v) for v in label_encoder.classes_.tolist()],
        "metrics": metrics,
    }
    artifact_paths: list[Path] = [
        model_path,
        label_encoder_path,
        scaler_path,
        metadata_path,
        results_csv,
        results_plot,
        confusion_plot,
        roc_plot,
        report_path,
    ]
    metadata = prepare_metadata(
        task="crop_recommendation",
        metadata=metadata,
        dataset_paths=[str(DATA_PATH.relative_to(BASE_DIR)).replace("\\", "/")],
        artifact_paths=artifact_paths,
    )

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    joblib.dump(calibrated_model, model_path)
    joblib.dump(label_encoder, label_encoder_path)
    joblib.dump(scaler, scaler_path)

    copied_artifacts = snapshot_version("crop_recommendation", metadata["model_version"], artifact_paths)
    update_registry("crop_recommendation", metadata, copied_artifacts)

    print("Crop training complete")
    print(json.dumps(metrics, indent=2))
    print(f"Model version: {metadata['model_version']}")


if __name__ == "__main__":
    train()
