from fastapi import APIRouter, HTTPException

from database.schemas import WeatherResponse
from services.weather_client import get_weather
from services.location_service import get_coordinates

router = APIRouter()


@router.get("/{location}", response_model=WeatherResponse)
async def get_weather_by_location(location: str):
    location = location.strip()
    
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    
    coords = get_coordinates(location)
    
    if not coords:
        raise HTTPException(
            status_code=404,
            detail=f"Could not find coordinates for: {location}"
        )
    
    weather_data = await get_weather(
        lat=coords["lat"],
        lon=coords["lon"],
        location_name=coords.get("name", location)
    )
    
    return WeatherResponse(
        location=weather_data["location"],
        current=weather_data["current"],
        forecast=weather_data["forecast"],
        advisories=weather_data["advisories"]
    )


@router.get("/coords/{lat}/{lon}")
async def get_weather_by_coords(lat: float, lon: float, name: str = ""):
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    weather_data = await get_weather(lat, lon, name)
    
    return WeatherResponse(
        location=weather_data["location"],
        current=weather_data["current"],
        forecast=weather_data["forecast"],
        advisories=weather_data["advisories"]
    )
