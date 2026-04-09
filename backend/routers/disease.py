from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import logging

from database.schemas import DiseaseDetectResponse
from ml.predictor import get_disease_predictor
from services.disease_advisory import get_label_details

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/detect", response_model=DiseaseDetectResponse)
async def detect_disease(
    file: UploadFile = File(...),
    crop: str | None = Form(default=None),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Image file is required")

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        predictor = get_disease_predictor()
        result = predictor.predict(image_bytes, top_k=3, expected_crop=crop)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Disease model not found. Run backend/ml/train_disease_model.py first."
        )
    except Exception as error:
        logger.exception("Disease detection failed")
        raise HTTPException(status_code=500, detail="Disease detection failed. Please try again.")

    primary = get_label_details(result["label"])
    top_predictions = []
    for item in result["top_predictions"]:
        details = get_label_details(item["label"])
        top_predictions.append(
            {
                "label": item["label"],
                "crop": details["crop"],
                "disease": details["disease"],
                "healthy": details["healthy"],
                "confidence": item["confidence"],
            }
        )

    return DiseaseDetectResponse(
        label=result["label"],
        crop=primary["crop"],
        disease=primary["disease"],
        healthy=primary["healthy"],
        confidence=result["confidence"],
        summary=primary["summary"],
        immediate_actions=primary["immediate_actions"],
        prevention_tips=primary["prevention_tips"],
        top_predictions=top_predictions,
    )
