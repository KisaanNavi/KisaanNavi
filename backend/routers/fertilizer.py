from fastapi import APIRouter, HTTPException

from database.schemas import FertilizerRequest, FertilizerResponse
from services.location_service import get_district_soil_data
from ml.predictor import get_fertilizer_predictor

router = APIRouter()

NPK_STATUS_TO_VALUE = {
    "low": 25,
    "medium": 50,
    "high": 80,
}


@router.post("/recommend", response_model=FertilizerResponse)
async def recommend_fertilizer(request: FertilizerRequest):
    crop = request.crop.strip()
    
    if not crop:
        raise HTTPException(status_code=400, detail="Crop name is required")
    
    district = request.district.strip() if request.district else ""

    if request.state and district:
        soil_data = get_district_soil_data(request.state, district)
    else:
        soil_data = _build_manual_soil_data(request)

    soil_data = _apply_manual_nutrient_overrides(soil_data, request)
    
    soil_type = request.soil_type or "Loamy"
    
    try:
        predictor = get_fertilizer_predictor()
        fertilizers = predictor.predict(
            temperature=25,
            humidity=60,
            moisture=50,
            soil_type=soil_type,
            crop_type=crop,
            n=soil_data.get("nitrogen", 50),
            p=soil_data.get("phosphorus", 50),
            k=soil_data.get("potassium", 50)
        )
    except Exception:
        fertilizers = _get_rule_based_recommendation(soil_data, crop)
    
    application_info = _get_application_schedule(crop, fertilizers)
    warnings = _get_warnings(soil_data, fertilizers)
    
    return FertilizerResponse(
        fertilizers=fertilizers,
        application_info=application_info,
        warnings=warnings
    )


def _normalize_nutrient_status(value: str | None, default: str = "Medium") -> str:
    if not value:
        return default
    status = str(value).strip().lower()
    if status in {"low", "medium", "high"}:
        return status.capitalize()
    return default


def _status_to_numeric(status: str) -> int:
    return NPK_STATUS_TO_VALUE.get(status.lower(), 50)


def _build_manual_soil_data(request: FertilizerRequest) -> dict:
    n_status = _normalize_nutrient_status(request.nitrogen, "Medium")
    p_status = _normalize_nutrient_status(request.phosphorus, "Medium")
    k_status = _normalize_nutrient_status(request.potassium, "Medium")
    return {
        "nitrogen": _status_to_numeric(n_status),
        "phosphorus": _status_to_numeric(p_status),
        "potassium": _status_to_numeric(k_status),
        "n_status": n_status,
        "p_status": p_status,
        "k_status": k_status,
        "ph": 6.5,
    }


def _apply_manual_nutrient_overrides(soil_data: dict, request: FertilizerRequest) -> dict:
    n_status = _normalize_nutrient_status(request.nitrogen, soil_data.get("n_status", "Medium"))
    p_status = _normalize_nutrient_status(request.phosphorus, soil_data.get("p_status", "Medium"))
    k_status = _normalize_nutrient_status(request.potassium, soil_data.get("k_status", "Medium"))

    updated = {**soil_data}
    updated["n_status"] = n_status
    updated["p_status"] = p_status
    updated["k_status"] = k_status
    updated["nitrogen"] = _status_to_numeric(n_status)
    updated["phosphorus"] = _status_to_numeric(p_status)
    updated["potassium"] = _status_to_numeric(k_status)
    return updated


@router.get("/info/{fertilizer_name}")
async def get_fertilizer_info(fertilizer_name: str):
    info = FERTILIZER_DATABASE.get(fertilizer_name.lower())
    
    if not info:
        return {
            "name": fertilizer_name,
            "info": "Detailed information not available"
        }
    
    return info


def _get_rule_based_recommendation(soil_data: dict, crop: str) -> list:
    recommendations = []
    
    n_status = soil_data.get("n_status", "Medium")
    p_status = soil_data.get("p_status", "Medium")
    k_status = soil_data.get("k_status", "Medium")
    
    if n_status == "Low":
        recommendations.append({
            "name": "Urea",
            "confidence": 90,
            "dosage": "60-80 kg/acre",
            "application": "Apply in 2-3 splits during crop growth",
            "reason": "Nitrogen deficiency detected"
        })
    elif n_status == "Medium":
        recommendations.append({
            "name": "Urea",
            "confidence": 70,
            "dosage": "40-50 kg/acre",
            "application": "Apply in 2 splits",
            "reason": "Moderate nitrogen level"
        })
    
    if p_status == "Low":
        recommendations.append({
            "name": "DAP",
            "confidence": 85,
            "dosage": "50 kg/acre",
            "application": "Apply at sowing as basal dose",
            "reason": "Phosphorus deficiency detected"
        })
    elif p_status == "Medium":
        recommendations.append({
            "name": "SSP",
            "confidence": 75,
            "dosage": "100 kg/acre",
            "application": "Apply at sowing",
            "reason": "Maintain phosphorus levels"
        })
    
    if k_status == "Low":
        recommendations.append({
            "name": "MOP",
            "confidence": 85,
            "dosage": "40 kg/acre",
            "application": "Apply at sowing or in 2 splits",
            "reason": "Potassium deficiency detected"
        })
    
    if not recommendations:
        recommendations.append({
            "name": "NPK 10-26-26",
            "confidence": 80,
            "dosage": "50 kg/acre",
            "application": "Apply at sowing as basal dose",
            "reason": "Balanced nutrition for your crop"
        })
    
    return recommendations


def _get_application_schedule(crop: str, fertilizers: list) -> str:
    crop_lower = crop.lower()
    
    schedules = {
        "rice": "Basal: DAP/SSP at transplanting. Top dress: Urea at tillering (21 days), panicle initiation (45 days), and flowering (60 days).",
        "wheat": "Basal: Full P & K + 1/3 N at sowing. First irrigation: 1/3 N. Second irrigation: 1/3 N.",
        "maize": "Basal: Full P & K + 1/4 N. Knee-high stage: 1/2 N. Tasseling: 1/4 N.",
        "cotton": "Basal: Full P & K. Square formation: 1/3 N. Flowering: 1/3 N. Boll development: 1/3 N.",
        "sugarcane": "Basal: Full P + 1/3 N + 1/2 K. 45 days: 1/3 N + 1/2 K. 90 days: 1/3 N."
    }
    
    return schedules.get(crop_lower, "Apply basal dose at sowing. Top dress nitrogen in 2-3 splits at 25-30 day intervals.")


def _get_warnings(soil_data: dict, fertilizers: list) -> list:
    warnings = []
    
    ph = soil_data.get("ph", 7.0)
    
    if ph < 5.5:
        warnings.append("Soil is acidic. Consider adding lime before fertilizer application.")
    elif ph > 8.0:
        warnings.append("Soil is alkaline. Phosphorus availability may be reduced. Consider gypsum application.")
    
    has_urea = any(f.get("name", "").lower() == "urea" for f in fertilizers)
    if has_urea:
        warnings.append("Apply urea in evening or before irrigation/rain to reduce nitrogen loss.")
    
    return warnings


FERTILIZER_DATABASE = {
    "urea": {
        "name": "Urea",
        "hindi_name": "यूरिया",
        "composition": "46% Nitrogen",
        "appearance": "White crystalline granules",
        "usage": "Nitrogen source for vegetative growth",
        "dosage": "50-100 kg/acre depending on crop",
        "application": [
            "Never apply in standing water",
            "Apply in evening or before irrigation",
            "Split into 2-3 applications",
            "Do not mix with SSP"
        ],
        "price_range": "₹266/50kg bag (subsidized)"
    },
    "dap": {
        "name": "DAP (Diammonium Phosphate)",
        "hindi_name": "डीएपी",
        "composition": "18% Nitrogen, 46% Phosphorus",
        "appearance": "Brown/grey granules",
        "usage": "Phosphorus source for root development",
        "dosage": "40-50 kg/acre",
        "application": [
            "Apply as basal dose at sowing",
            "Place 5-7 cm below seed",
            "Best for phosphorus deficient soils"
        ],
        "price_range": "₹1350/50kg bag (subsidized)"
    },
    "mop": {
        "name": "MOP (Muriate of Potash)",
        "hindi_name": "एमओपी / पोटाश",
        "composition": "60% Potassium",
        "appearance": "Pink/white crystals",
        "usage": "Potassium for disease resistance and quality",
        "dosage": "25-40 kg/acre",
        "application": [
            "Apply at sowing or in 2 splits",
            "Essential for fruit and grain quality",
            "Avoid in chloride-sensitive crops"
        ],
        "price_range": "₹1700/50kg bag"
    },
    "ssp": {
        "name": "SSP (Single Super Phosphate)",
        "hindi_name": "सिंगल सुपर फास्फेट",
        "composition": "16% Phosphorus, 11% Sulphur",
        "appearance": "Grey powder/granules",
        "usage": "Phosphorus + Sulphur for oilseeds",
        "dosage": "100 kg/acre",
        "application": [
            "Apply at sowing",
            "Good for sulphur deficient soils",
            "Ideal for oilseeds and pulses"
        ],
        "price_range": "₹550/50kg bag"
    }
}
