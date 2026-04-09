import httpx
from typing import Optional
from datetime import datetime


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


async def get_weather(lat: float, lon: float, location_name: str = ""):
    params = {
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code",
        "timezone": "Asia/Kolkata",
        "forecast_days": 7
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.get(OPEN_METEO_URL, params=params)
        data = response.json()
    
    current = {
        "temperature": data["current"]["temperature_2m"],
        "humidity": data["current"]["relative_humidity_2m"],
        "precipitation": data["current"]["precipitation"],
        "wind_speed": data["current"]["wind_speed_10m"],
        "condition": _get_condition(data["current"]["weather_code"]),
        "icon": _get_icon(data["current"]["weather_code"])
    }
    
    forecast = []
    daily = data["daily"]
    for i in range(len(daily["time"])):
        forecast.append({
            "date": daily["time"][i],
            "day": _get_day_name(daily["time"][i]),
            "temp_max": daily["temperature_2m_max"][i],
            "temp_min": daily["temperature_2m_min"][i],
            "precipitation": daily["precipitation_sum"][i],
            "rain_chance": daily["precipitation_probability_max"][i],
            "condition": _get_condition(daily["weather_code"][i]),
            "icon": _get_icon(daily["weather_code"][i])
        })
    
    advisories = _generate_advisories(current, forecast)
    
    return {
        "location": location_name,
        "current": current,
        "forecast": forecast,
        "advisories": advisories
    }


def _get_condition(code: int) -> str:
    conditions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Foggy",
        48: "Fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        80: "Slight showers",
        81: "Moderate showers",
        82: "Violent showers",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Severe thunderstorm"
    }
    return conditions.get(code, "Unknown")


def _get_icon(code: int) -> str:
    if code == 0:
        return "☀️"
    elif code in [1, 2]:
        return "🌤️"
    elif code == 3:
        return "☁️"
    elif code in [45, 48]:
        return "🌫️"
    elif code in [51, 53, 55, 61, 63, 80, 81]:
        return "🌧️"
    elif code in [65, 82]:
        return "⛈️"
    elif code in [71, 73, 75]:
        return "🌨️"
    elif code in [95, 96, 99]:
        return "⛈️"
    return "🌤️"


def _get_day_name(date_str: str) -> str:
    date = datetime.strptime(date_str, "%Y-%m-%d")
    return date.strftime("%A")


def _generate_advisories(current: dict, forecast: list) -> list:
    advisories = []
    
    if current["temperature"] > 40:
        advisories.append({
            "type": "warning",
            "title": "Extreme Heat",
            "message": "Very high temperature. Irrigate crops early morning or evening. Protect livestock."
        })
    
    if current["temperature"] < 10:
        advisories.append({
            "type": "warning",
            "title": "Cold Weather",
            "message": "Low temperature may affect crops. Consider covering sensitive plants."
        })
    
    heavy_rain_days = [f for f in forecast[:3] if f["rain_chance"] > 70]
    if heavy_rain_days:
        advisories.append({
            "type": "info",
            "title": "Rain Expected",
            "message": f"High chance of rain in next 3 days. Postpone fertilizer application and harvesting."
        })
    
    total_rain = sum(f["precipitation"] for f in forecast)
    if total_rain < 5 and current["humidity"] < 40:
        advisories.append({
            "type": "warning",
            "title": "Dry Conditions",
            "message": "Low rainfall expected. Ensure adequate irrigation for crops."
        })
    
    if not advisories:
        advisories.append({
            "type": "success",
            "title": "Good Conditions",
            "message": "Weather conditions are favorable for farming activities."
        })
    
    return advisories
