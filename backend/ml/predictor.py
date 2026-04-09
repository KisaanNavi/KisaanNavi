import joblib
import numpy as np
import os
import json
import pandas as pd
from io import BytesIO

from PIL import Image
from services.disease_advisory import get_label_details

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models")
SPECIALIST_MODEL_DIR = os.path.join(MODEL_PATH, "disease_specialists")


def _specialist_signature() -> str:
    if not os.path.isdir(SPECIALIST_MODEL_DIR):
        return ""
    entries: list[str] = []
    for file_name in sorted(os.listdir(SPECIALIST_MODEL_DIR)):
        if not file_name.endswith("_specialist.pt"):
            continue
        path = os.path.join(SPECIALIST_MODEL_DIR, file_name)
        try:
            mtime = int(os.path.getmtime(path))
            entries.append(f"{file_name}:{mtime}")
        except Exception:
            continue
    return "|".join(entries)


class CropPredictor:
    def __init__(self):
        self.model = joblib.load(os.path.join(MODEL_PATH, "crop_model.pkl"))
        self.label_encoder = joblib.load(os.path.join(MODEL_PATH, "crop_label_encoder.pkl"))
        self.scaler = joblib.load(os.path.join(MODEL_PATH, "crop_scaler.pkl"))
        metadata_path = os.path.join(MODEL_PATH, "crop_metadata.json")
        self.metadata = {}
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception:
                self.metadata = {}
    
    def _normalize_crop(self, name: str) -> str:
        if not name:
            return ""
        return " ".join(str(name).strip().lower().split())

    def _expand_aliases(self, crop_name: str) -> set[str]:
        value = self._normalize_crop(crop_name)
        alias_map = {
            "rice": {"paddy"},
            "paddy": {"rice"},
            "groundnut": {"ground nuts"},
            "ground nuts": {"groundnut"},
            "gram": {"pulses", "bengal gram", "chickpea"},
            "bengal gram": {"gram", "chickpea", "pulses"},
            "chickpea": {"gram", "bengal gram", "pulses"},
            "green gram": {"moong", "pulses"},
            "moong": {"green gram", "pulses"},
            "black gram": {"urad", "pulses"},
            "urad": {"black gram", "pulses"},
            "pigeonpea": {"pigeonpeas", "pigeon pea", "tur", "arhar"},
            "pigeonpeas": {"pigeonpea", "pigeon pea", "tur", "arhar"},
            "pigeon pea": {"pigeonpeas", "pigeonpea", "tur", "arhar"},
            "kidneybeans": {"kidney beans", "rajma"},
            "kidney beans": {"kidneybeans", "rajma"},
        }
        aliases = {value}
        aliases.update(alias_map.get(value, set()))
        return aliases

    def _confidence_level(self, confidence: float, margin: float) -> str:
        if confidence >= 60:
            return "very_high"
        if confidence >= 40:
            return "high"
        if confidence >= 25 or margin >= 8:
            return "medium"
        return "low"

    def _filter_state_crops(self, probabilities, state: str = None, season: str = None):
        if not state:
            return probabilities
        try:
            from services.location_service import get_crops_by_state_and_season
            allowed = get_crops_by_state_and_season(state, season=season)
            if not allowed:
                return probabilities

            allowed_values = set()
            for item in allowed:
                if isinstance(item, dict):
                    name = item.get("name", "")
                else:
                    name = str(item)
                allowed_values.update(self._expand_aliases(name))

            masked = np.array(probabilities, dtype=float)
            labels = self.label_encoder.classes_
            for idx, label in enumerate(labels):
                aliases = self._expand_aliases(str(label))
                if not (aliases & allowed_values):
                    masked[idx] = 0.0

            total = masked.sum()
            if total > 0:
                return masked / total
            return probabilities
        except Exception:
            return probabilities

    def predict(self, n, p, k, temperature, humidity, ph, rainfall, top_k=5, state=None, season=None):
        feature_columns = self.metadata.get("feature_columns", ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"])
        feature_map = {
            "N": float(n),
            "P": float(p),
            "K": float(k),
            "temperature": float(temperature),
            "humidity": float(humidity),
            "ph": float(ph),
            "rainfall": float(rainfall),
        }
        frame = pd.DataFrame([{col: feature_map.get(col, 0.0) for col in feature_columns}])
        features_scaled = self.scaler.transform(frame)
        
        probabilities = self.model.predict_proba(features_scaled)[0]
        probabilities = self._filter_state_crops(probabilities, state=state, season=season)
        sorted_indices = np.argsort(probabilities)[::-1]
        top_confidence = float(probabilities[sorted_indices[0]] * 100) if len(sorted_indices) else 0.0
        if top_confidence >= 60:
            dynamic_top_k = 2
        else:
            dynamic_top_k = 3
        nonzero_indices = [idx for idx in sorted_indices if probabilities[idx] > 1e-6]
        top_indices = nonzero_indices[:dynamic_top_k]
        if not top_indices:
            top_indices = sorted_indices[:dynamic_top_k]
        sorted_probs = np.sort(probabilities)[::-1]
        margin = float((sorted_probs[0] - sorted_probs[1]) * 100) if len(sorted_probs) > 1 else float(sorted_probs[0] * 100)
        
        results = []
        for idx in top_indices:
            crop_name = self.label_encoder.inverse_transform([idx])[0]
            confidence = probabilities[idx] * 100
            confidence_level = self._confidence_level(float(confidence), margin)
            results.append({
                "crop": crop_name,
                "confidence": float(round(float(confidence), 1)),
                "confidence_level": confidence_level,
                "suitable": bool(confidence >= 20 or margin >= 6)
            })
        
        return results


class FertilizerPredictor:
    def __init__(self):
        self.model = joblib.load(os.path.join(MODEL_PATH, "fertilizer_model.pkl"))
        self.scaler = joblib.load(os.path.join(MODEL_PATH, "fertilizer_scaler.pkl"))
        encoders_path = os.path.join(MODEL_PATH, "fertilizer_encoders.pkl")
        metadata_path = os.path.join(MODEL_PATH, "fertilizer_metadata.json")
        self.metadata = {}
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
            except Exception:
                self.metadata = {}

        if os.path.exists(encoders_path):
            self.encoders = joblib.load(encoders_path)
        else:
            # Backward compatibility
            soil_encoder = joblib.load(os.path.join(MODEL_PATH, "soil_encoder.pkl"))
            crop_encoder = joblib.load(os.path.join(MODEL_PATH, "crop_encoder.pkl"))
            fertilizer_encoder = joblib.load(os.path.join(MODEL_PATH, "fertilizer_label_encoder.pkl"))
            self.encoders = {"soil": soil_encoder, "crop": crop_encoder, "fertilizer": fertilizer_encoder}

        self.feature_columns = self.metadata.get(
            "feature_columns",
            ["Temparature", "Humidity", "Moisture", "Nitrogen", "Potassium", "Phosphorous", "Soil_Type_Encoded", "Crop_Type_Encoded"]
        )

    def _safe_encode(self, encoder, value: str) -> int:
        if value in getattr(encoder, "classes_", []):
            return int(encoder.transform([value])[0])
        value_lower = str(value).strip().lower()
        for class_name in getattr(encoder, "classes_", []):
            if str(class_name).strip().lower() == value_lower:
                return int(encoder.transform([class_name])[0])
        return 0

    def _confidence_level(self, confidence: float, margin: float) -> str:
        if confidence >= 80:
            return "very_high"
        if confidence >= 60:
            return "high"
        if confidence >= 35 or margin >= 10:
            return "medium"
        return "low"
    
    def predict(self, temperature, humidity, moisture, soil_type, crop_type, n, p, k):
        soil_encoded = self._safe_encode(self.encoders["soil"], str(soil_type))
        crop_encoded = self._safe_encode(self.encoders["crop"], str(crop_type))

        feature_map = {
            "Temparature": float(temperature),
            "Temperature": float(temperature),
            "Humidity": float(humidity),
            "Moisture": float(moisture),
            "Nitrogen": float(n),
            "Potassium": float(k),
            "Phosphorous": float(p),
            "Phosphorus": float(p),
            "Soil_Type_Encoded": float(soil_encoded),
            "Crop_Type_Encoded": float(crop_encoded),
        }
        ordered = [feature_map.get(name, 0.0) for name in self.feature_columns]
        frame = pd.DataFrame([ordered], columns=self.feature_columns)
        features_scaled = self.scaler.transform(frame)
        
        probabilities = self.model.predict_proba(features_scaled)[0]
        sorted_indices = np.argsort(probabilities)[::-1]
        top_confidence = float(probabilities[sorted_indices[0]] * 100) if len(sorted_indices) else 0.0
        dynamic_top_k = 2 if top_confidence >= 60 else 3
        top_indices = sorted_indices[:dynamic_top_k]
        sorted_probs = np.sort(probabilities)[::-1]
        margin = float((sorted_probs[0] - sorted_probs[1]) * 100) if len(sorted_probs) > 1 else float(sorted_probs[0] * 100)
        
        results = []
        for idx in top_indices:
            fertilizer = self.encoders["fertilizer"].inverse_transform([idx])[0]
            confidence = probabilities[idx] * 100
            results.append({
                "name": fertilizer,
                "confidence": float(round(float(confidence), 1)),
                "confidence_level": self._confidence_level(float(confidence), margin),
                "dosage": self._get_dosage(fertilizer),
                "application": self._get_application_method(fertilizer)
            })
        
        return results
    
    def _get_dosage(self, fertilizer):
        dosages = {
            "Urea": "50-60 kg/acre",
            "DAP": "40-50 kg/acre",
            "MOP": "30-40 kg/acre",
            "NPK": "50 kg/acre",
            "SSP": "100 kg/acre",
            "Ammonium Sulphate": "50 kg/acre",
            "Potassium Sulphate": "25-30 kg/acre"
        }
        return dosages.get(fertilizer, "As per soil test recommendation")
    
    def _get_application_method(self, fertilizer):
        methods = {
            "Urea": "Apply in 2-3 splits during crop growth",
            "DAP": "Apply at sowing as basal dose",
            "MOP": "Apply at sowing or in 2 splits",
            "NPK": "Apply at sowing as basal dose",
            "SSP": "Apply at sowing, mix well with soil"
        }
        return methods.get(fertilizer, "Apply as per crop requirement")


class DiseasePredictor:
    def __init__(self):
        self.model = None
        self.cnn_model = None
        self.torch = None
        self.class_names = np.asarray([], dtype=object)
        metadata_path = os.path.join(MODEL_PATH, "disease_metadata.json")
        self.metadata = {}
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, "r", encoding="utf-8") as file:
                    self.metadata = json.load(file)
            except Exception:
                self.metadata = {}
        self.model_version = str(self.metadata.get("model_version", "")).strip()
        self.specialist_signature = _specialist_signature()

        self.model_type = str(self.metadata.get("model_type", "")).strip().lower()
        self.input_size = tuple(self.metadata.get("input_size", [224, 224]))
        self.normalization_mean = np.asarray(
            self.metadata.get("normalization", {}).get("mean", [0.485, 0.456, 0.406]),
            dtype=np.float32,
        )
        self.normalization_std = np.asarray(
            self.metadata.get("normalization", {}).get("std", [0.229, 0.224, 0.225]),
            dtype=np.float32,
        )

        self.reference_features = np.asarray([], dtype=np.float32)
        self.reference_labels = np.asarray([], dtype=object)
        self.specialist_models: dict[str, dict] = {}

        if self.model_type.startswith("cnn_transfer"):
            try:
                self._load_cnn_model()
            except Exception:
                self._load_reference_model()
        else:
            self._load_reference_model()

        if self.class_names.size == 0:
            self.class_names = np.asarray(self.reference_labels, dtype=object)

        self.supported_crops = sorted(
            {
                str(get_label_details(str(label)).get("crop", "")).strip().lower()
                for label in self.class_names
                if str(get_label_details(str(label)).get("crop", "")).strip()
            }
        )

    def _load_reference_model(self) -> None:
        model_path = os.path.join(MODEL_PATH, "disease_model.pkl")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                "Disease model not found. Run backend/ml/train_disease_model.py first."
            )
        self.model = joblib.load(model_path)
        image_size = self.metadata.get("image_size", [32, 32])
        gray_size = self.metadata.get("gray_size", [16, 16])
        self.image_size = (int(image_size[0]), int(image_size[1]))
        self.gray_size = (int(gray_size[0]), int(gray_size[1]))
        self.reference_features = np.asarray(self.model.get("features", []), dtype=np.float32)
        self.reference_labels = np.asarray(self.model.get("labels", []), dtype=object)
        self.class_names = np.asarray(self.reference_labels, dtype=object)
        self.model_type = "nearest_neighbor_reference"

    def _load_cnn_model(self) -> None:
        model_path = os.path.join(MODEL_PATH, "disease_model.pt")
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                "CNN disease model not found. Run backend/ml/train_disease_model.py first."
            )

        try:
            import torch
            from torch import nn
            from torchvision import models
        except Exception as error:
            raise RuntimeError(
                "CNN disease model requires torch + torchvision. Install backend requirements and retry."
            ) from error

        checkpoint = torch.load(model_path, map_location="cpu")
        class_names = checkpoint.get("class_names") or self.metadata.get("class_names") or []
        if not class_names:
            raise RuntimeError("Invalid CNN checkpoint: class_names missing.")

        architecture = checkpoint.get("architecture", "mobilenet_v3_small")
        if architecture != "mobilenet_v3_small":
            raise RuntimeError(f"Unsupported CNN architecture in checkpoint: {architecture}")

        model = models.mobilenet_v3_small(weights=None)
        in_features = model.classifier[-1].in_features
        model.classifier[-1] = nn.Linear(in_features, len(class_names))
        model.load_state_dict(checkpoint["state_dict"])
        model.eval()

        self.torch = torch
        self.cnn_model = model
        self.class_names = np.asarray(class_names, dtype=object)
        ck_input = checkpoint.get("input_size")
        if ck_input:
            self.input_size = (int(ck_input[0]), int(ck_input[1]))
        self.normalization_mean = np.asarray(
            checkpoint.get("mean", self.normalization_mean.tolist()), dtype=np.float32
        )
        self.normalization_std = np.asarray(
            checkpoint.get("std", self.normalization_std.tolist()), dtype=np.float32
        )
        self.model_type = "cnn_transfer_mobilenet_v3_small"
        self._load_specialist_models()

    @staticmethod
    def _normalize_crop_name(value: str) -> str:
        return " ".join(str(value).strip().lower().replace("_", " ").split())

    def _load_specialist_models(self) -> None:
        if self.torch is None or not os.path.isdir(SPECIALIST_MODEL_DIR):
            return
        try:
            from torch import nn
            from torchvision import models
        except Exception:
            return

        for file_name in os.listdir(SPECIALIST_MODEL_DIR):
            if not file_name.endswith("_specialist.pt"):
                continue
            file_path = os.path.join(SPECIALIST_MODEL_DIR, file_name)
            try:
                checkpoint = self.torch.load(file_path, map_location="cpu")
                crop_name = str(checkpoint.get("crop", "")).strip()
                class_names = checkpoint.get("class_names") or []
                if not crop_name or not class_names:
                    continue
                if checkpoint.get("architecture", "mobilenet_v3_small") != "mobilenet_v3_small":
                    continue

                model = models.mobilenet_v3_small(weights=None)
                in_features = model.classifier[-1].in_features
                model.classifier[-1] = nn.Linear(in_features, len(class_names))
                model.load_state_dict(checkpoint["state_dict"])
                model.eval()

                normalized_crop = self._normalize_crop_name(crop_name)
                self.specialist_models[normalized_crop] = {
                    "model": model,
                    "class_names": np.asarray(class_names, dtype=object),
                    "input_size": tuple(checkpoint.get("input_size", [224, 224])),
                    "mean": np.asarray(checkpoint.get("mean", self.normalization_mean.tolist()), dtype=np.float32),
                    "std": np.asarray(checkpoint.get("std", self.normalization_std.tolist()), dtype=np.float32),
                }
            except Exception:
                continue

    def _image_to_tensor(self, image_bytes: bytes, input_size: tuple[int, int], mean: np.ndarray, std: np.ndarray):
        with Image.open(BytesIO(image_bytes)) as image:
            rgb = image.convert("RGB").resize(input_size)
        arr = np.asarray(rgb, dtype=np.float32) / 255.0
        arr = (arr - mean.reshape(1, 1, 3)) / np.maximum(std.reshape(1, 1, 3), 1e-8)
        return self.torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0).float()

    def _predict_with_specialist(self, image_bytes: bytes, top_k: int, expected_crop: str | None) -> dict | None:
        if self.torch is None or not expected_crop:
            return None
        normalized_crop = self._normalize_crop_name(expected_crop)
        specialist = self.specialist_models.get(normalized_crop)
        if not specialist:
            return None

        tensor = self._image_to_tensor(
            image_bytes=image_bytes,
            input_size=tuple(specialist["input_size"]),
            mean=np.asarray(specialist["mean"], dtype=np.float32),
            std=np.asarray(specialist["std"], dtype=np.float32),
        )

        with self.torch.no_grad():
            logits = specialist["model"](tensor)
            probs = self.torch.softmax(logits, dim=1).cpu().numpy()[0]

        class_names = specialist["class_names"]
        ranked_indices = np.argsort(probs)[::-1][: max(top_k, 1)]
        top_predictions = [
            {
                "label": str(class_names[idx]),
                "confidence": float(round(float(probs[idx] * 100.0), 2)),
            }
            for idx in ranked_indices
        ]
        return {
            "label": top_predictions[0]["label"],
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions,
        }

    def _indices_for_crop(self, labels: np.ndarray, expected_crop: str | None) -> np.ndarray:
        if not expected_crop:
            return np.arange(len(labels), dtype=np.int32)

        normalized = self._normalize_crop_name(expected_crop)
        if not normalized:
            return np.arange(len(labels), dtype=np.int32)

        matched_indices = []
        for index, label in enumerate(labels):
            crop = self._normalize_crop_name(get_label_details(str(label)).get("crop", ""))
            if crop == normalized:
                matched_indices.append(index)

        if not matched_indices:
            raise ValueError(
                f"Unsupported crop '{expected_crop}'. Supported crops: {', '.join(sorted({c.title() for c in self.supported_crops}))}"
            )
        return np.asarray(matched_indices, dtype=np.int32)

    def _extract_features(self, image_bytes: bytes) -> np.ndarray:
        with Image.open(BytesIO(image_bytes)) as img:
            rgb = img.convert("RGB").resize(self.image_size)
            rgb_arr = np.asarray(rgb, dtype=np.float32) / 255.0

            gray = rgb.convert("L").resize(self.gray_size)
            gray_arr = np.asarray(gray, dtype=np.float32) / 255.0

        flat_rgb = rgb_arr.reshape(-1)
        flat_gray = gray_arr.reshape(-1)
        mean_rgb = rgb_arr.mean(axis=(0, 1))
        std_rgb = rgb_arr.std(axis=(0, 1))

        hist_features = []
        for channel_idx in range(3):
            hist, _ = np.histogram(rgb_arr[:, :, channel_idx], bins=8, range=(0.0, 1.0))
            hist_features.extend(hist.astype(np.float32) / max(hist.sum(), 1))

        feature_vector = np.concatenate(
            [flat_rgb, flat_gray, mean_rgb, std_rgb, np.array(hist_features, dtype=np.float32)]
        )
        norm = np.linalg.norm(feature_vector)
        normalized = feature_vector / max(float(norm), 1e-8)
        return normalized.reshape(1, -1)

    def _predict_with_reference(self, image_bytes: bytes, top_k: int, expected_crop: str | None) -> dict:
        if len(self.reference_labels) == 0:
            raise RuntimeError("Disease reference index is empty")

        features = self._extract_features(image_bytes)
        candidate_indices = self._indices_for_crop(self.reference_labels, expected_crop)
        candidate_features = self.reference_features[candidate_indices]
        similarities = np.matmul(features, candidate_features.T)[0]
        top_neighbor_local = np.argsort(similarities)[::-1][:12]
        top_neighbor_indices = candidate_indices[top_neighbor_local]
        top_neighbor_scores = similarities[top_neighbor_local]

        crop_scores: dict[str, float] = {}
        neighbor_crop_map: dict[int, str] = {}
        label_scores: dict[str, float] = {}
        for local_idx, index in enumerate(top_neighbor_indices):
            label = str(self.reference_labels[index])
            crop = str(get_label_details(label).get("crop", "Unknown"))
            similarity = float(max(top_neighbor_scores[local_idx], 0.0))
            neighbor_crop_map[index] = crop
            crop_scores[crop] = crop_scores.get(crop, 0.0) + similarity
            label_scores[label] = label_scores.get(label, 0.0) + similarity

        ranked_crops = sorted(crop_scores.items(), key=lambda item: item[1], reverse=True)
        selected_crop = ranked_crops[0][0] if ranked_crops else None

        if selected_crop:
            cropped_label_scores: dict[str, float] = {}
            for local_idx, index in enumerate(top_neighbor_indices):
                if neighbor_crop_map.get(index) != selected_crop:
                    continue
                label = str(self.reference_labels[index])
                similarity = float(max(top_neighbor_scores[local_idx], 0.0))
                cropped_label_scores[label] = cropped_label_scores.get(label, 0.0) + similarity
            if cropped_label_scores:
                label_scores = cropped_label_scores

        ranked = sorted(label_scores.items(), key=lambda item: item[1], reverse=True)
        total_score = sum(score for _, score in ranked) or 1.0
        top_predictions = [
            {
                "label": label,
                "confidence": float(round((score / total_score) * 100, 2)),
            }
            for label, score in ranked[:top_k]
        ]

        return {
            "label": top_predictions[0]["label"],
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions,
        }

    def _predict_with_cnn(self, image_bytes: bytes, top_k: int, expected_crop: str | None) -> dict:
        if self.cnn_model is None or self.torch is None or self.class_names.size == 0:
            raise RuntimeError("CNN disease model is not initialized.")

        specialist_result = self._predict_with_specialist(
            image_bytes=image_bytes,
            top_k=top_k,
            expected_crop=expected_crop,
        )
        if specialist_result is not None:
            return specialist_result

        tensor = self._image_to_tensor(
            image_bytes=image_bytes,
            input_size=self.input_size,
            mean=self.normalization_mean,
            std=self.normalization_std,
        )

        with self.torch.no_grad():
            logits = self.cnn_model(tensor)
            probs = self.torch.softmax(logits, dim=1).cpu().numpy()[0]

        candidate_indices = self._indices_for_crop(self.class_names, expected_crop)
        masked = np.zeros_like(probs)
        masked[candidate_indices] = probs[candidate_indices]
        total = float(masked.sum())
        if total <= 0:
            raise RuntimeError("No prediction confidence available for selected crop.")
        masked = masked / total

        ranked_indices = np.argsort(masked)[::-1][: max(top_k, 1)]
        top_predictions = [
            {
                "label": str(self.class_names[idx]),
                "confidence": float(round(float(masked[idx] * 100.0), 2)),
            }
            for idx in ranked_indices
        ]
        return {
            "label": top_predictions[0]["label"],
            "confidence": top_predictions[0]["confidence"],
            "top_predictions": top_predictions,
        }

    def predict(self, image_bytes: bytes, top_k: int = 3, expected_crop: str | None = None):
        if self.model_type.startswith("cnn_transfer"):
            return self._predict_with_cnn(image_bytes, top_k=top_k, expected_crop=expected_crop)
        return self._predict_with_reference(image_bytes, top_k=top_k, expected_crop=expected_crop)


crop_predictor = None
fertilizer_predictor = None
disease_predictor = None


def get_crop_predictor():
    global crop_predictor
    if crop_predictor is None:
        crop_predictor = CropPredictor()
    return crop_predictor


def get_fertilizer_predictor():
    global fertilizer_predictor
    if fertilizer_predictor is None:
        fertilizer_predictor = FertilizerPredictor()
    return fertilizer_predictor


def get_disease_predictor():
    global disease_predictor
    metadata_path = os.path.join(MODEL_PATH, "disease_metadata.json")
    current_version = ""
    current_specialist_signature = _specialist_signature()
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, "r", encoding="utf-8") as file:
                current_version = str(json.load(file).get("model_version", "")).strip()
        except Exception:
            current_version = ""

    if (
        disease_predictor is None
        or (current_version and getattr(disease_predictor, "model_version", "") != current_version)
        or getattr(disease_predictor, "specialist_signature", "") != current_specialist_signature
    ):
        disease_predictor = DiseasePredictor()
    return disease_predictor
