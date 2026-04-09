import json
import os
import pandas as pd
from typing import Optional, List

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data")

cities_data = None
district_npk_data = None
fertilizer_data = None


def load_cities():
    global cities_data
    if cities_data is None:
        cities_path = os.path.join(DATA_PATH, "cities.json")
        if os.path.exists(cities_path):
            with open(cities_path, "r", encoding="utf-8") as f:
                cities_data = json.load(f)
        else:
            cities_data = {}
    return cities_data


def load_district_npk():
    global district_npk_data
    if district_npk_data is None:
        npk_path = os.path.join(DATA_PATH, "district_npk.csv")
        if os.path.exists(npk_path):
            district_npk_data = pd.read_csv(npk_path)
        else:
            district_npk_data = pd.DataFrame()
    return district_npk_data


def load_fertilizer_data():
    global fertilizer_data
    if fertilizer_data is None:
        fertilizer_path = os.path.join(DATA_PATH, "fertilizer.csv")
        if os.path.exists(fertilizer_path):
            fertilizer_data = pd.read_csv(fertilizer_path)
        else:
            fertilizer_data = pd.DataFrame()
    return fertilizer_data


def _normalize_text(value: str) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def _get_crop_aliases(crop_name: str) -> set[str]:
    normalized = _normalize_text(crop_name)
    aliases = {normalized}
    alias_map = {
        "rice": {"paddy"},
        "paddy": {"rice"},
        "groundnut": {"ground nuts"},
        "ground nuts": {"groundnut"},
        "gram": {"pulses"},
        "bengal gram": {"gram", "pulses"},
        "green gram": {"moong", "pulses"},
        "moong": {"green gram", "pulses"},
        "black gram": {"urad", "pulses"},
        "urad": {"black gram", "pulses"},
    }
    aliases.update(alias_map.get(normalized, set()))
    return aliases


def get_coordinates(city: str) -> Optional[dict]:
    cities = load_cities()
    
    city_lower = city.lower().strip()
    
    if city_lower in cities:
        return {
            "lat": float(cities[city_lower]["latitude"]),
            "lon": float(cities[city_lower]["longitude"]),
            "name": cities[city_lower].get("accentcity", city)
        }
    
    for key, data in cities.items():
        if city_lower in key or city_lower in data.get("accentcity", "").lower():
            return {
                "lat": float(data["latitude"]),
                "lon": float(data["longitude"]),
                "name": data.get("accentcity", city)
            }
    
    return None


def get_district_soil_data(state: str, district: str) -> dict:
    df = load_district_npk()
    
    if df.empty:
        return _get_default_soil_data()
    
    mask = (df["State"].str.lower() == state.lower()) & \
           (df["District"].str.lower() == district.lower())
    
    row = df[mask]
    
    if row.empty:
        state_mask = df["State"].str.lower() == state.lower()
        row = df[state_mask]
        if row.empty:
            return _get_default_soil_data()
        row = row.iloc[[0]]
    else:
        row = row.iloc[[0]]
    
    row = row.iloc[0]
    
    n_score = _calculate_npk_score(
        row.get("n_High", 0),
        row.get("n_Medium", 0),
        row.get("n_Low", 0)
    )
    p_score = _calculate_npk_score(
        row.get("p_High", 0),
        row.get("p_Medium", 0),
        row.get("p_Low", 0)
    )
    k_score = _calculate_npk_score(
        row.get("k_High", 0),
        row.get("k_Medium", 0),
        row.get("k_Low", 0)
    )
    
    ph_value = 7.0
    if row.get("pH_Acidic", 0) > row.get("pH_Alkaline", 0):
        ph_value = 5.5
    elif row.get("pH_Alkaline", 0) > row.get("pH_Acidic", 0):
        ph_value = 8.0
    
    return {
        "nitrogen": n_score,
        "phosphorus": p_score,
        "potassium": k_score,
        "ph": ph_value,
        "n_status": _get_status(row.get("n_High", 0), row.get("n_Medium", 0), row.get("n_Low", 0)),
        "p_status": _get_status(row.get("p_High", 0), row.get("p_Medium", 0), row.get("p_Low", 0)),
        "k_status": _get_status(row.get("k_High", 0), row.get("k_Medium", 0), row.get("k_Low", 0)),
        "organic_carbon": _get_oc_status(row),
        "state": state,
        "district": district
    }


def _calculate_npk_score(high: float, medium: float, low: float) -> float:
    high = float(high) if pd.notna(high) else 0
    medium = float(medium) if pd.notna(medium) else 0
    low = float(low) if pd.notna(low) else 0
    
    total = high + medium + low
    if total == 0:
        return 50
    
    score = (high * 100 + medium * 60 + low * 20) / total
    
    if score > 70:
        return 80
    elif score > 40:
        return 50
    else:
        return 25


def _get_status(high: float, medium: float, low: float) -> str:
    high = float(high) if pd.notna(high) else 0
    medium = float(medium) if pd.notna(medium) else 0
    low = float(low) if pd.notna(low) else 0
    
    if high >= medium and high >= low:
        return "High"
    elif medium >= high and medium >= low:
        return "Medium"
    else:
        return "Low"


def _get_oc_status(row) -> str:
    high = float(row.get("OC_High", 0)) if pd.notna(row.get("OC_High", 0)) else 0
    medium = float(row.get("OC_Medium", 0)) if pd.notna(row.get("OC_Medium", 0)) else 0
    low = float(row.get("OC_Low", 0)) if pd.notna(row.get("OC_Low", 0)) else 0
    
    if high >= medium and high >= low:
        return "Good"
    elif medium >= high and medium >= low:
        return "Moderate"
    else:
        return "Low"


def _get_default_soil_data() -> dict:
    return {
        "nitrogen": 50,
        "phosphorus": 50,
        "potassium": 50,
        "ph": 6.5,
        "n_status": "Medium",
        "p_status": "Medium", 
        "k_status": "Medium",
        "organic_carbon": "Moderate"
    }


def get_all_states() -> List[str]:
    df = load_district_npk()
    if df.empty:
        return []
    return sorted(df["State"].unique().tolist())


def get_districts_by_state(state: str) -> List[str]:
    df = load_district_npk()
    if df.empty:
        return []
    
    mask = df["State"].str.lower() == state.lower()
    return sorted(df[mask]["District"].unique().tolist())


def get_crops_by_state_and_season(state: str, season: str = None, soil_type: str = None) -> List[dict]:
    """Get crops suitable for a state and season"""
    
    # State-wise crop mapping based on Indian agricultural data
    state_crops = {
        "andhra pradesh": {
            "kharif": ["Rice", "Cotton", "Groundnut", "Maize", "Red Gram", "Green Gram", "Sugarcane", "Chilli"],
            "rabi": ["Rice", "Groundnut", "Bengal Gram", "Sunflower", "Jowar", "Wheat", "Tobacco"],
            "zaid": ["Groundnut", "Sunflower", "Watermelon", "Muskmelon"]
        },
        "telangana": {
            "kharif": ["Rice", "Cotton", "Maize", "Red Gram", "Soybean", "Groundnut", "Chilli"],
            "rabi": ["Rice", "Bengal Gram", "Groundnut", "Sunflower", "Maize", "Jowar"],
            "zaid": ["Groundnut", "Watermelon", "Green Gram"]
        },
        "maharashtra": {
            "kharif": ["Cotton", "Soybean", "Rice", "Jowar", "Bajra", "Groundnut", "Sugarcane", "Tur"],
            "rabi": ["Wheat", "Jowar", "Bengal Gram", "Safflower", "Sunflower", "Onion"],
            "zaid": ["Groundnut", "Sunflower", "Watermelon"]
        },
        "karnataka": {
            "kharif": ["Rice", "Maize", "Groundnut", "Cotton", "Jowar", "Ragi", "Sugarcane"],
            "rabi": ["Rice", "Jowar", "Bengal Gram", "Safflower", "Wheat", "Sunflower"],
            "zaid": ["Groundnut", "Watermelon", "Cucumber"]
        },
        "tamil nadu": {
            "kharif": ["Rice", "Cotton", "Groundnut", "Sugarcane", "Maize", "Millets"],
            "rabi": ["Rice", "Groundnut", "Bengal Gram", "Gingelly", "Sunflower"],
            "zaid": ["Groundnut", "Pulses", "Watermelon"]
        },
        "uttar pradesh": {
            "kharif": ["Rice", "Maize", "Bajra", "Jowar", "Sugarcane", "Groundnut", "Soybean"],
            "rabi": ["Wheat", "Barley", "Mustard", "Peas", "Gram", "Potato", "Lentil"],
            "zaid": ["Moong", "Urad", "Watermelon", "Cucumber"]
        },
        "punjab": {
            "kharif": ["Rice", "Cotton", "Maize", "Sugarcane", "Bajra", "Groundnut"],
            "rabi": ["Wheat", "Barley", "Mustard", "Gram", "Potato", "Peas"],
            "zaid": ["Moong", "Watermelon", "Muskmelon"]
        },
        "haryana": {
            "kharif": ["Rice", "Cotton", "Bajra", "Jowar", "Sugarcane", "Guar"],
            "rabi": ["Wheat", "Barley", "Mustard", "Gram", "Potato"],
            "zaid": ["Moong", "Watermelon", "Cucumber"]
        },
        "gujarat": {
            "kharif": ["Cotton", "Groundnut", "Rice", "Bajra", "Jowar", "Castor", "Sugarcane"],
            "rabi": ["Wheat", "Mustard", "Gram", "Cumin", "Potato", "Tobacco"],
            "zaid": ["Groundnut", "Watermelon", "Sesame"]
        },
        "rajasthan": {
            "kharif": ["Bajra", "Jowar", "Maize", "Groundnut", "Cotton", "Guar", "Moth"],
            "rabi": ["Wheat", "Barley", "Mustard", "Gram", "Cumin", "Coriander"],
            "zaid": ["Moong", "Watermelon", "Cucumber"]
        },
        "madhya pradesh": {
            "kharif": ["Soybean", "Rice", "Maize", "Jowar", "Cotton", "Groundnut", "Tur"],
            "rabi": ["Wheat", "Gram", "Mustard", "Lentil", "Peas", "Linseed"],
            "zaid": ["Moong", "Urad", "Watermelon"]
        },
        "west bengal": {
            "kharif": ["Rice", "Jute", "Maize", "Sugarcane", "Groundnut"],
            "rabi": ["Rice", "Wheat", "Mustard", "Potato", "Gram", "Lentil"],
            "zaid": ["Jute", "Sesame", "Moong"]
        },
        "bihar": {
            "kharif": ["Rice", "Maize", "Sugarcane", "Jute", "Groundnut"],
            "rabi": ["Wheat", "Maize", "Gram", "Mustard", "Potato", "Lentil", "Peas"],
            "zaid": ["Moong", "Watermelon", "Cucumber"]
        },
        "odisha": {
            "kharif": ["Rice", "Groundnut", "Maize", "Cotton", "Sugarcane", "Jute"],
            "rabi": ["Rice", "Groundnut", "Mustard", "Gram", "Sunflower"],
            "zaid": ["Groundnut", "Green Gram", "Black Gram"]
        },
        "kerala": {
            "kharif": ["Rice", "Coconut", "Rubber", "Pepper", "Cardamom", "Banana"],
            "rabi": ["Rice", "Tapioca", "Banana"],
            "zaid": ["Banana", "Pineapple"]
        },
        "assam": {
            "kharif": ["Rice", "Jute", "Sugarcane", "Maize", "Tea"],
            "rabi": ["Rice", "Wheat", "Mustard", "Potato", "Pulses"],
            "zaid": ["Jute", "Summer Rice"]
        }
    }
    
    state_lower = state.lower()
    
    if state_lower in state_crops:
        if season and season.lower() in state_crops[state_lower]:
            crops = state_crops[state_lower][season.lower()]
        else:
            # Return all crops for the state
            all_crops = set()
            for season_crops in state_crops[state_lower].values():
                all_crops.update(season_crops)
            crops = list(all_crops)
    else:
        # Default crops
        crops = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Groundnut", "Soybean", "Pulses"]
    
    if soil_type:
        fertilizer_df = load_fertilizer_data()
        if not fertilizer_df.empty and "Soil Type" in fertilizer_df.columns and "Crop Type" in fertilizer_df.columns:
            soil_mask = fertilizer_df["Soil Type"].astype(str).str.lower() == soil_type.lower()
            soil_rows = fertilizer_df[soil_mask]

            fertilizer_crops = {
                _normalize_text(crop_name)
                for crop_name in soil_rows["Crop Type"].dropna().astype(str).tolist()
            }

            if fertilizer_crops:
                crops = [
                    crop_name for crop_name in crops
                    if bool(_get_crop_aliases(crop_name) & fertilizer_crops)
                ]
            else:
                crops = []

    crops = _sanitize_crop_options(crops)
    return [{"name": crop, "name_hi": get_crop_hindi_name(crop)} for crop in sorted(crops)]


def _sanitize_crop_options(crops: List[str]) -> List[str]:
    """Remove generic/non-actionable labels from crop dropdown options."""
    blocked = {"vegetable", "vegetables"}
    alias_map = {
        "summer rice": "Rice",
    }

    sanitized: List[str] = []
    seen = set()

    for crop in crops:
        raw = str(crop).strip()
        if not raw:
            continue

        normalized = raw.lower()
        if normalized in blocked:
            continue

        mapped = alias_map.get(normalized, raw)
        key = mapped.lower()
        if key in seen:
            continue

        seen.add(key)
        sanitized.append(mapped)

    return sanitized


def get_crop_hindi_name(crop: str) -> str:
    """Get Hindi name for crop"""
    hindi_names = {
        "Rice": "à¤§à¤¾à¤¨",
        "Wheat": "à¤—à¥‡à¤¹à¥‚à¤‚",
        "Maize": "à¤®à¤•à¥à¤•à¤¾",
        "Cotton": "à¤•à¤ªà¤¾à¤¸",
        "Sugarcane": "à¤—à¤¨à¥à¤¨à¤¾",
        "Groundnut": "à¤®à¥‚à¤‚à¤—à¤«à¤²à¥€",
        "Soybean": "à¤¸à¥‹à¤¯à¤¾à¤¬à¥€à¤¨",
        "Jowar": "à¤œà¥à¤µà¤¾à¤°",
        "Bajra": "à¤¬à¤¾à¤œà¤°à¤¾",
        "Mustard": "à¤¸à¤°à¤¸à¥‹à¤‚",
        "Gram": "à¤šà¤¨à¤¾",
        "Bengal Gram": "à¤šà¤¨à¤¾",
        "Red Gram": "à¤…à¤°à¤¹à¤°",
        "Tur": "à¤…à¤°à¤¹à¤°",
        "Green Gram": "à¤®à¥‚à¤‚à¤—",
        "Moong": "à¤®à¥‚à¤‚à¤—",
        "Black Gram": "à¤‰à¤¡à¤¼à¤¦",
        "Urad": "à¤‰à¤¡à¤¼à¤¦",
        "Lentil": "à¤®à¤¸à¥‚à¤°",
        "Peas": "à¤®à¤Ÿà¤°",
        "Potato": "à¤†à¤²à¥‚",
        "Onion": "à¤ªà¥à¤¯à¤¾à¤œ",
        "Chilli": "à¤®à¤¿à¤°à¥à¤š",
        "Sunflower": "à¤¸à¥‚à¤°à¤œà¤®à¥à¤–à¥€",
        "Safflower": "à¤•à¥à¤¸à¥à¤®",
        "Castor": "à¤…à¤°à¤‚à¤¡à¥€",
        "Jute": "à¤œà¥‚à¤Ÿ",
        "Tea": "à¤šà¤¾à¤¯",
        "Coffee": "à¤•à¥‰à¤«à¥€",
        "Tobacco": "à¤¤à¤‚à¤¬à¤¾à¤•à¥‚",
        "Barley": "à¤œà¥Œ",
        "Ragi": "à¤°à¤¾à¤—à¥€",
        "Millets": "à¤¬à¤¾à¤œà¤°à¤¾",
        "Pulses": "à¤¦à¤¾à¤²à¥‡à¤‚",
        "Watermelon": "à¤¤à¤°à¤¬à¥‚à¤œ",
        "Muskmelon": "à¤–à¤°à¤¬à¥‚à¤œà¤¾",
        "Cucumber": "à¤–à¥€à¤°à¤¾",
        "Banana": "à¤•à¥‡à¤²à¤¾",
        "Coconut": "à¤¨à¤¾à¤°à¤¿à¤¯à¤²",
        "Rubber": "à¤°à¤¬à¤¡à¤¼",
        "Pepper": "à¤•à¤¾à¤²à¥€ à¤®à¤¿à¤°à¥à¤š",
        "Cardamom": "à¤‡à¤²à¤¾à¤¯à¤šà¥€",
        "Guar": "à¤—à¥à¤µà¤¾à¤°",
        "Cumin": "à¤œà¥€à¤°à¤¾",
        "Coriander": "à¤§à¤¨à¤¿à¤¯à¤¾",
        "Sesame": "à¤¤à¤¿à¤²",
        "Gingelly": "à¤¤à¤¿à¤²",
        "Linseed": "à¤…à¤²à¤¸à¥€",
        "Tapioca": "à¤Ÿà¥ˆà¤ªà¤¿à¤“à¤•à¤¾",
        "Pineapple": "à¤…à¤¨à¤¾à¤¨à¤¾à¤¸",
        "Moth": "à¤®à¥‹à¤ "
    }
    return hindi_names.get(crop, crop)

