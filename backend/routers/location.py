from fastapi import APIRouter
from typing import Optional

from services.location_service import (
    get_all_states,
    get_districts_by_state,
    get_crops_by_state_and_season,
    get_district_soil_data
)

router = APIRouter()


@router.get("/states")
async def get_states():
    """Get all Indian states with NPK data"""
    states = get_all_states()
    return {"states": states}


@router.get("/districts/{state}")
async def get_districts(state: str):
    """Get all districts in a state"""
    districts = get_districts_by_state(state)
    if not districts:
        # Return empty list, don't error
        return {"state": state, "districts": []}
    return {"state": state, "districts": districts}


@router.get("/crops/{state}")
async def get_crops(state: str, season: Optional[str] = None, soil_type: Optional[str] = None):
    """Get crops suitable for a state, optional season, and optional soil type"""
    crops = get_crops_by_state_and_season(state, season, soil_type)
    return {"state": state, "season": season, "soil_type": soil_type, "crops": crops}


@router.get("/soil-data/{state}/{district}")
async def get_soil_data(state: str, district: str):
    """Get NPK and soil data for a specific district"""
    data = get_district_soil_data(state, district)
    return {
        "state": state,
        "district": district,
        "soil_data": data
    }
