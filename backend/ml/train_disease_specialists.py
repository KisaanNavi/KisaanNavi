from __future__ import annotations

import json
import os
import random
from pathlib import Path

import numpy as np
from PIL import Image
from sklearn.metrics import accuracy_score, top_k_accuracy_score
from sklearn.model_selection import train_test_split

from ml.model_registry import BASE_DIR
from ml.train_disease_model import CNN_IMAGE_SIZE, CNN_MEAN, CNN_STD, _read_split_rows
from services.disease_advisory import get_label_details


MODELS_DIR = BASE_DIR / "models"
SPECIALIST_DIR = MODELS_DIR / "disease_specialists"


def _slug(value: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in value.strip().lower()).strip("_")


def _normalize_crop(value: str) -> str:
    return " ".join(str(value).strip().lower().replace("_", " ").split())


def _crop_for_label(label: str) -> str:
    return str(get_label_details(label).get("crop", "")).strip()


def train_specialist(crop_name: str) -> dict:
    try:
        import torch
        from torch import nn
        from torch.utils.data import DataLoader, Dataset
        from torchvision import models, transforms
        from torchvision.models import MobileNet_V3_Small_Weights
    except Exception as error:
        raise RuntimeError("PyTorch/torchvision is required for specialist training.") from error

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

    random_seed = int(os.getenv("DISEASE_SEED", "42"))
    random.seed(random_seed)
    np.random.seed(random_seed)
    torch.manual_seed(random_seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(random_seed)

    torch_cache_dir = Path(os.getenv("TORCH_HOME", str(BASE_DIR / ".torch_cache")))
    torch_cache_dir.mkdir(parents=True, exist_ok=True)
    os.environ["TORCH_HOME"] = str(torch_cache_dir)

    target_crop = _normalize_crop(crop_name)
    if not target_crop:
        raise ValueError("crop_name is required")

    train_rows, _ = _read_split_rows("train")
    test_rows, _ = _read_split_rows("test")

    train_rows = [(path, label) for path, label in train_rows if _normalize_crop(_crop_for_label(label)) == target_crop]
    test_rows = [(path, label) for path, label in test_rows if _normalize_crop(_crop_for_label(label)) == target_crop]
    if not train_rows or not test_rows:
        raise RuntimeError(f"No data available for crop: {crop_name}")

    class_names = sorted({label for _, label in train_rows})
    if len(class_names) < 2:
        raise RuntimeError(f"Need at least 2 classes for crop specialist: {crop_name}")
    class_to_idx = {name: idx for idx, name in enumerate(class_names)}

    filtered_test_rows = [(path, label) for path, label in test_rows if label in class_to_idx]
    test_rows = filtered_test_rows
    if not test_rows:
        raise RuntimeError(f"No valid test samples remain for crop: {crop_name}")

    labels_for_split = np.asarray([label for _, label in train_rows], dtype=object)
    train_indices = np.arange(len(train_rows))
    if len(train_rows) >= 60:
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
    class_counts = np.bincount(train_label_indices, minlength=len(class_names)).astype(np.float32)
    class_weights_arr = class_counts.sum() / np.maximum(class_counts, 1.0)
    class_weights_arr = class_weights_arr / max(float(class_weights_arr.mean()), 1e-8)

    train_transform = transforms.Compose(
        [
            transforms.Resize(CNN_IMAGE_SIZE),
            transforms.RandomHorizontalFlip(),
            transforms.RandomRotation(10),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2, hue=0.03),
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

    batch_size = int(os.getenv("DISEASE_SPECIALIST_BATCH_SIZE", "16"))
    epochs = int(os.getenv("DISEASE_SPECIALIST_EPOCHS", "12"))
    lr = float(os.getenv("DISEASE_SPECIALIST_LR", "0.0005"))
    device = "cuda" if torch.cuda.is_available() else "cpu"

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, num_workers=0)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False, num_workers=0)

    weights = MobileNet_V3_Small_Weights.DEFAULT
    model = models.mobilenet_v3_small(weights=weights)
    in_features = model.classifier[-1].in_features
    model.classifier[-1] = nn.Linear(in_features, len(class_names))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss(weight=torch.tensor(class_weights_arr, dtype=torch.float32, device=device))
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer,
        T_max=max(epochs, 1),
        eta_min=max(lr * 0.1, 1e-6),
    )

    best_state = None
    best_top1 = -1.0
    best_top3 = -1.0

    print(f"Training specialist for {crop_name} on {device} for {epochs} epochs...")
    for epoch in range(epochs):
        model.train()
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

            total += labels.size(0)
            correct += int((logits.argmax(dim=1) == labels).sum().item())

        model.eval()
        all_probs = []
        all_true = []
        with torch.no_grad():
            for images, labels in val_loader:
                images = images.to(device)
                logits = model(images)
                probs = torch.softmax(logits, dim=1).detach().cpu().numpy()
                all_probs.append(probs)
                all_true.append(labels.numpy())

        y_true = np.concatenate(all_true)
        y_prob = np.vstack(all_probs)
        y_pred = y_prob.argmax(axis=1)
        val_top1 = float(accuracy_score(y_true, y_pred))
        k_for_top = min(3, len(class_names))
        val_top3 = float(top_k_accuracy_score(y_true, y_prob, k=k_for_top, labels=np.arange(len(class_names))))
        train_acc = (correct / total) if total else 0.0
        print(
            f"Epoch {epoch + 1:02d}/{epochs} | "
            f"train_acc={train_acc:.4f} val_top1={val_top1:.4f} val_top3={val_top3:.4f}"
        )
        scheduler.step()

        if val_top1 > best_top1:
            best_top1 = val_top1
            best_top3 = val_top3
            best_state = {key: value.detach().cpu() for key, value in model.state_dict().items()}

    if best_state is None:
        raise RuntimeError("Specialist training failed to produce a valid checkpoint.")

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
    k_for_top = min(3, len(class_names))
    top3 = float(top_k_accuracy_score(y_true, y_prob, k=k_for_top, labels=np.arange(len(class_names))))

    SPECIALIST_DIR.mkdir(parents=True, exist_ok=True)
    crop_slug = _slug(crop_name)
    model_path = SPECIALIST_DIR / f"{crop_slug}_specialist.pt"
    metadata_path = SPECIALIST_DIR / f"{crop_slug}_specialist_metadata.json"

    torch.save(
        {
            "state_dict": best_state,
            "class_names": class_names,
            "input_size": list(CNN_IMAGE_SIZE),
            "mean": CNN_MEAN,
            "std": CNN_STD,
            "architecture": "mobilenet_v3_small",
            "crop": crop_name,
        },
        model_path,
    )

    metadata = {
        "crop": crop_name,
        "class_names": class_names,
        "train_samples": len(train_rows_fit),
        "validation_samples": len(val_rows),
        "test_samples": len(test_rows),
        "top1": top1,
        "top3": top3,
    }
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    print(f"Saved specialist model: {model_path}")
    print(f"{crop_name} top1={top1:.3f} top3={top3:.3f}")
    return metadata


def main() -> None:
    raw = os.getenv("DISEASE_SPECIALIST_CROPS", "Tomato")
    crops = [value.strip() for value in raw.split(",") if value.strip()]
    if not crops:
        crops = ["Tomato"]
    for crop in crops:
        train_specialist(crop)


if __name__ == "__main__":
    main()
