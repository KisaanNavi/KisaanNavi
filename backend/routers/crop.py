from fastapi import APIRouter, HTTPException

from database.schemas import CropRecommendRequest, CropRecommendResponse
from services.location_service import get_district_soil_data, get_coordinates
from services.weather_client import get_weather
from ml.predictor import get_crop_predictor

router = APIRouter()


@router.post("/recommend", response_model=CropRecommendResponse)
async def recommend_crops(request: CropRecommendRequest):
    state = request.state.strip()
    district = request.district.strip()
    
    if not state or not district:
        raise HTTPException(status_code=400, detail="State and district are required")
    
    soil_data = get_district_soil_data(state, district)
    
    coords = get_coordinates(district)
    if not coords:
        coords = get_coordinates(state)
    
    if coords:
        weather = await get_weather(coords["lat"], coords["lon"], f"{district}, {state}")
        temp = weather["current"]["temperature"]
        humidity = weather["current"]["humidity"]
        rainfall = sum(f["precipitation"] for f in weather["forecast"][:7])
    else:
        temp = 28
        humidity = 65
        rainfall = 150
    
    try:
        predictor = get_crop_predictor()
        crops = predictor.predict(
            n=soil_data["nitrogen"],
            p=soil_data["phosphorus"],
            k=soil_data["potassium"],
            temperature=temp,
            humidity=humidity,
            ph=soil_data["ph"],
            rainfall=rainfall,
            top_k=5,
            state=state,
            season=request.season
        )
    except Exception as e:
        crops = _get_fallback_crops(soil_data, request.season)
    
    crops_with_info = []
    for crop in crops:
        confidence = crop.get("confidence", 0)
        suitable = crop.get("suitable", False)
        crops_with_info.append({
            "name": crop["crop"],
            "confidence": float(confidence),
            "suitable": bool(suitable),
            "season": _get_crop_season(crop["crop"]),
            "duration": _get_crop_duration(crop["crop"]),
            "water_requirement": _get_water_requirement(crop["crop"])
        })
    
    weather_info = {
        "temperature": temp,
        "humidity": humidity,
        "expected_rainfall": rainfall,
        "location": f"{district}, {state}"
    }
    
    return CropRecommendResponse(
        crops=crops_with_info,
        soil_info=soil_data,
        weather_info=weather_info
    )


@router.get("/info/{crop_name}")
async def get_crop_info(crop_name: str):
    crop_info = CROP_DATABASE.get(crop_name.lower())
    
    if not crop_info:
        return {
            "name": crop_name,
            "info": "Detailed information not available. Consult local Krishi Vigyan Kendra."
        }
    
    return crop_info


def _get_fallback_crops(soil_data: dict, season: str = None) -> list:
    n_status = soil_data.get("n_status", "Medium")
    
    if n_status == "High":
        return [
            {"crop": "rice", "confidence": 80, "suitable": True},
            {"crop": "wheat", "confidence": 75, "suitable": True},
            {"crop": "maize", "confidence": 70, "suitable": True}
        ]
    else:
        return [
            {"crop": "pulses", "confidence": 80, "suitable": True},
            {"crop": "groundnut", "confidence": 75, "suitable": True},
            {"crop": "soybean", "confidence": 70, "suitable": True}
        ]


def _get_crop_season(crop: str) -> str:
    seasons = {
        "rice": "Kharif (June-July)",
        "wheat": "Rabi (October-November)",
        "maize": "Kharif/Rabi",
        "cotton": "Kharif (May-June)",
        "sugarcane": "Year-round",
        "groundnut": "Kharif (June-July)",
        "soybean": "Kharif (June-July)",
        "mustard": "Rabi (October)",
        "chickpea": "Rabi (October-November)",
        "pigeon pea": "Kharif (June-July)"
    }
    return seasons.get(crop.lower(), "Consult local calendar")


def _get_crop_duration(crop: str) -> str:
    durations = {
        "rice": "120-150 days",
        "wheat": "120-140 days", 
        "maize": "90-120 days",
        "cotton": "150-180 days",
        "sugarcane": "12-18 months",
        "groundnut": "100-130 days",
        "soybean": "90-120 days",
        "mustard": "110-140 days",
        "chickpea": "90-120 days"
    }
    return durations.get(crop.lower(), "90-120 days")


def _get_water_requirement(crop: str) -> str:
    water = {
        "rice": "High (1200-1400 mm)",
        "wheat": "Medium (400-500 mm)",
        "maize": "Medium (500-600 mm)",
        "cotton": "Medium-High (700-900 mm)",
        "sugarcane": "High (1500-2000 mm)",
        "groundnut": "Low-Medium (400-500 mm)",
        "soybean": "Medium (450-550 mm)",
        "mustard": "Low (300-400 mm)",
        "chickpea": "Low (300-400 mm)"
    }
    return water.get(crop.lower(), "Medium")


CROP_DATABASE = {
    "rice": {
        "name": "Rice (धान)",
        "hindi_name": "धान / चावल",
        "telugu_name": "వరి",
        "season": "Kharif (June-July sowing)",
        "duration": "120-150 days",
        "water": "High - needs standing water",
        "soil": "Clay or clay loam, pH 5.5-6.5",
        "temperature": "20-35°C",
        "fertilizer": {
            "nitrogen": "80-120 kg/ha",
            "phosphorus": "40-60 kg/ha",
            "potassium": "40-60 kg/ha"
        },
        "tips": [
            "Maintain 5cm water level during tillering",
            "Apply nitrogen in 3 splits",
            "Drain field 15 days before harvest"
        ]
    },
    "wheat": {
        "name": "Wheat (गेहूं)",
        "hindi_name": "गेहूं",
        "telugu_name": "గోధుమ",
        "season": "Rabi (October-November sowing)",
        "duration": "120-140 days",
        "water": "4-6 irrigations needed",
        "soil": "Loamy, well-drained, pH 6.0-7.5",
        "temperature": "15-25°C",
        "fertilizer": {
            "nitrogen": "120-150 kg/ha",
            "phosphorus": "60 kg/ha",
            "potassium": "40 kg/ha"
        },
        "tips": [
            "First irrigation at crown root stage (21 days)",
            "Critical irrigation at flowering",
            "Avoid late sowing after November 25"
        ]
    }
}
