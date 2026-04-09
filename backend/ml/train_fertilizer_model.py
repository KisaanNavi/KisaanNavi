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
DATA_PATH = BASE_DIR / "data" / "fertilizer.csv"
MODELS_DIR = BASE_DIR / "models"
RESULTS_DIR = MODELS_DIR / "results"

RAW_FEATURE_COLUMNS = [
    "Temparature",
    "Humidity",
    "Moisture",
    "Soil Type",
    "Crop Type",
    "Nitrogen",
    "Potassium",
    "Phosphorous",
]
MODEL_FEATURE_COLUMNS = [
    "Temparature",
    "Humidity",
    "Moisture",
    "Nitrogen",
    "Potassium",
    "Phosphorous",
    "Soil_Type_Encoded",
    "Crop_Type_Encoded",
]
TARGET_COLUMN = "Fertilizer Name"


def ensure_dirs() -> None:
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def normalize_text(value: str) -> str:
    return " ".join(str(value).strip().split())


def load_data() -> tuple[pd.DataFrame, np.ndarray, np.ndarray, dict, StandardScaler]:
    df = pd.read_csv(DATA_PATH)
    df.columns = [c.strip() for c in df.columns]

    required = RAW_FEATURE_COLUMNS + [TARGET_COLUMN]
    df = df.dropna(subset=required).copy()

    for col in ["Soil Type", "Crop Type", TARGET_COLUMN]:
        df[col] = df[col].astype(str).map(normalize_text)

    soil_encoder = LabelEncoder()
    crop_encoder = LabelEncoder()
    fertilizer_encoder = LabelEncoder()

    df["Soil_Type_Encoded"] = soil_encoder.fit_transform(df["Soil Type"])
    df["Crop_Type_Encoded"] = crop_encoder.fit_transform(df["Crop Type"])

    X = df[MODEL_FEATURE_COLUMNS].astype(float)
    y = fertilizer_encoder.fit_transform(df[TARGET_COLUMN])

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    encoders = {
        "soil": soil_encoder,
        "crop": crop_encoder,
        "fertilizer": fertilizer_encoder,
    }
    return df, X_scaled, y, encoders, scaler


def build_candidates() -> Dict[str, object]:
    return {
        "random_forest": RandomForestClassifier(
            n_estimators=500,
            class_weight="balanced_subsample",
            random_state=SEED,
            n_jobs=1,
        ),
        "extra_trees": ExtraTreesClassifier(
            n_estimators=600,
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
        "top2": float(top_k_accuracy_score(y_true, probas, k=2)),
        "top3": float(top_k_accuracy_score(y_true, probas, k=3)),
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
    plt.title("Fertilizer Model Comparison")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def save_confusion_matrix_plot(y_true: np.ndarray, y_pred: np.ndarray, classes: np.ndarray, out_path: str) -> None:
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, cmap="Blues", xticklabels=classes, yticklabels=classes, annot=True, fmt="d")
    plt.title("Fertilizer Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.xticks(rotation=30, ha="right")
    plt.yticks(rotation=0)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def save_roc_plot(y_true: np.ndarray, probas: np.ndarray, classes: np.ndarray, out_path: str) -> None:
    y_bin = label_binarize(y_true, classes=np.arange(len(classes)))
    plt.figure(figsize=(10, 8))
    for i in range(len(classes)):
        fpr, tpr, _ = roc_curve(y_bin[:, i], probas[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{classes[i]} (AUC={roc_auc:.2f})")
    plt.plot([0, 1], [0, 1], "k--")
    plt.title("Fertilizer ROC Curves")
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.legend(loc="lower right", fontsize=8)
    plt.tight_layout()
    plt.savefig(out_path, dpi=250)
    plt.close()


def train() -> None:
    ensure_dirs()
    _, X_scaled, y, encoders, scaler = load_data()

    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled,
        y,
        test_size=0.2,
        random_state=SEED,
        stratify=y,
    )

    candidates = build_candidates()
    results = evaluate_candidates(candidates, X_train, y_train, X_test, y_test)
    results_csv = RESULTS_DIR / "fertilizer_model_comparison.csv"
    results_plot = RESULTS_DIR / "fertilizer_model_comparison.png"
    confusion_plot = RESULTS_DIR / "fertilizer_confusion_matrix.png"
    roc_plot = RESULTS_DIR / "fertilizer_roc_curves.png"
    report_path = RESULTS_DIR / "fertilizer_classification_report.txt"
    metadata_path = MODELS_DIR / "fertilizer_metadata.json"
    model_path = MODELS_DIR / "fertilizer_model.pkl"
    encoders_path = MODELS_DIR / "fertilizer_encoders.pkl"
    label_encoder_path = MODELS_DIR / "fertilizer_label_encoder.pkl"
    soil_encoder_path = MODELS_DIR / "soil_encoder.pkl"
    crop_encoder_path = MODELS_DIR / "crop_encoder.pkl"
    scaler_path = MODELS_DIR / "fertilizer_scaler.pkl"

    results.to_csv(results_csv, index=False)
    save_model_comparison_plot(results, str(results_plot))

    best_name = str(results.iloc[0]["model"])
    best_model = candidates[best_name]

    calibrated_model = CalibratedClassifierCV(best_model, method="sigmoid", cv=3)
    calibrated_model.fit(X_train, y_train)

    test_proba = calibrated_model.predict_proba(X_test)
    test_pred = calibrated_model.predict(X_test)
    save_confusion_matrix_plot(y_test, test_pred, encoders["fertilizer"].classes_, str(confusion_plot))
    save_roc_plot(y_test, test_proba, encoders["fertilizer"].classes_, str(roc_plot))

    metrics = {
        "accuracy": float(accuracy_score(y_test, test_pred)),
        "f1_macro": float(f1_score(y_test, test_pred, average="macro")),
        "f1_weighted": float(f1_score(y_test, test_pred, average="weighted")),
        "top_k": topk_metrics(y_test, test_proba),
    }

    report = classification_report(y_test, test_pred, target_names=encoders["fertilizer"].classes_)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("Fertilizer Recommendation - Classification Report\n")
        f.write(f"Best model: {best_name}\n")
        f.write("=" * 60 + "\n\n")
        f.write(report)
        f.write("\n\nMetrics\n")
        f.write(json.dumps(metrics, indent=2))

    metadata = {
        "task": "fertilizer_recommendation",
        "best_model": best_name,
        "calibrated": True,
        "feature_columns": MODEL_FEATURE_COLUMNS,
        "class_count": int(len(encoders["fertilizer"].classes_)),
        "classes": [str(v) for v in encoders["fertilizer"].classes_.tolist()],
        "metrics": metrics,
    }
    artifact_paths: list[Path] = [
        model_path,
        encoders_path,
        label_encoder_path,
        soil_encoder_path,
        crop_encoder_path,
        scaler_path,
        metadata_path,
        results_csv,
        results_plot,
        confusion_plot,
        roc_plot,
        report_path,
    ]
    metadata = prepare_metadata(
        task="fertilizer_recommendation",
        metadata=metadata,
        dataset_paths=[str(DATA_PATH.relative_to(BASE_DIR)).replace("\\", "/")],
        artifact_paths=artifact_paths,
    )

    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    joblib.dump(calibrated_model, model_path)
    joblib.dump(encoders, encoders_path)
    # Compatibility artifacts
    joblib.dump(encoders["fertilizer"], label_encoder_path)
    joblib.dump(encoders["soil"], soil_encoder_path)
    joblib.dump(encoders["crop"], crop_encoder_path)
    joblib.dump(scaler, scaler_path)

    copied_artifacts = snapshot_version("fertilizer_recommendation", metadata["model_version"], artifact_paths)
    update_registry("fertilizer_recommendation", metadata, copied_artifacts)

    print("Fertilizer training complete")
    print(json.dumps(metrics, indent=2))
    print(f"Model version: {metadata['model_version']}")


if __name__ == "__main__":
    train()
