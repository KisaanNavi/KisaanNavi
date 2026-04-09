import os
from datetime import datetime, timedelta

from fastapi import APIRouter, Body, Header, HTTPException
from jose import JWTError, jwt
from bson import ObjectId

from database.schemas import FeedbackRequest, FeedbackResponse
from database.mongodb import get_database

router = APIRouter()
JWT_SECRET = os.getenv("JWT_SECRET", "kisaannavi-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"


def _extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.strip().split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


async def _resolve_feedback_user(db, authorization: str | None) -> dict | None:
    token = _extract_bearer_token(authorization)
    if not token:
        return None

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None

        try:
            object_id = ObjectId(user_id)
        except Exception:
            return None

        user = await db.users.find_one({"_id": object_id}, {"name": 1, "state": 1})
        if not user:
            return None

        return {
            "id": str(user.get("_id")),
            "name": user.get("name") or "Anonymous",
            "state": user.get("state") or "",
        }
    except JWTError:
        return None


@router.post("/", response_model=FeedbackResponse)
async def submit_feedback(
    payload: FeedbackRequest = Body(...),
    authorization: str | None = Header(default=None, alias="Authorization"),
):
    db = get_database()
    user = await _resolve_feedback_user(db, authorization)

    doc = {
        "feature": payload.feature,
        "subject": payload.subject,
        "helpful": payload.helpful,
        "note": payload.note,
        "metadata": payload.metadata or {},
        "user_id": user["id"] if user else None,
        "user_name": user["name"] if user else "Anonymous",
        "user_state": user["state"] if user else "",
        "is_anonymous": user is None,
        "created_at": datetime.utcnow(),
    }
    created = await db.feedback.insert_one(doc)

    return FeedbackResponse(
        id=str(created.inserted_id),
        success=True,
        queued=False,
    )


@router.get("/analytics")
async def get_feedback_analytics(
    x_analytics_key: str | None = Header(default=None, alias="X-Analytics-Key")
):
    required_key = os.getenv("ANALYTICS_ACCESS_KEY", "kisaannavi-admin")
    if x_analytics_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid analytics access key")

    db = get_database()

    total_feedback = await db.feedback.count_documents({})
    positive_feedback = await db.feedback.count_documents({"helpful": True})
    negative_feedback = await db.feedback.count_documents({"helpful": False})
    total_comments = await db.feedback.count_documents({"note": {"$exists": True, "$regex": r"\S"}})
    anonymous_feedback = await db.feedback.count_documents({"is_anonymous": True})
    unique_feedback_users = len(await db.feedback.distinct("user_id", {"user_id": {"$ne": None}}))
    total_users = await db.users.count_documents({})

    by_feature_pipeline = [
        {
            "$group": {
                "_id": "$feature",
                "total": {"$sum": 1},
                "positive": {"$sum": {"$cond": [{"$eq": ["$helpful", True]}, 1, 0]}},
                "negative": {"$sum": {"$cond": [{"$eq": ["$helpful", False]}, 1, 0]}},
            }
        },
        {"$sort": {"total": -1}},
    ]
    by_feature_raw = await db.feedback.aggregate(by_feature_pipeline).to_list(length=100)
    by_feature = [
        {
            "feature": item.get("_id") or "unknown",
            "total": int(item.get("total", 0)),
            "positive": int(item.get("positive", 0)),
            "negative": int(item.get("negative", 0)),
        }
        for item in by_feature_raw
    ]

    recent_note_docs = (
        db.feedback.find(
            {
                "note": {"$exists": True, "$ne": None, "$nin": ["", " "]},
            }
        )
        .sort("created_at", -1)
        .limit(20)
    )
    recent_notes = []
    async for item in recent_note_docs:
        recent_notes.append(
            {
                "id": str(item.get("_id")),
                "feature": item.get("feature", "unknown"),
                "subject": item.get("subject", ""),
                "helpful": bool(item.get("helpful", False)),
                "note": item.get("note", ""),
                "user_name": item.get("user_name") or "Anonymous",
                "is_anonymous": bool(item.get("is_anonymous", True)),
                "created_at": item.get("created_at"),
            }
        )

    start_date = datetime.utcnow() - timedelta(days=13)
    daily_pipeline = [
        {"$match": {"created_at": {"$gte": start_date}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"}},
                "total": {"$sum": 1},
                "positive": {"$sum": {"$cond": [{"$eq": ["$helpful", True]}, 1, 0]}},
                "negative": {"$sum": {"$cond": [{"$eq": ["$helpful", False]}, 1, 0]}},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily_raw = await db.feedback.aggregate(daily_pipeline).to_list(length=50)
    daily_map = {
        item["_id"]: {
            "date": item["_id"],
            "total": int(item.get("total", 0)),
            "positive": int(item.get("positive", 0)),
            "negative": int(item.get("negative", 0)),
        }
        for item in daily_raw
    }

    daily_feedback = []
    for offset in range(14):
        day = (start_date + timedelta(days=offset)).strftime("%Y-%m-%d")
        daily_feedback.append(
            daily_map.get(day, {"date": day, "total": 0, "positive": 0, "negative": 0})
        )

    return {
        "generated_at": datetime.utcnow(),
        "total_users": total_users,
        "total_feedback": total_feedback,
        "positive_feedback": positive_feedback,
        "negative_feedback": negative_feedback,
        "total_comments": total_comments,
        "anonymous_feedback": anonymous_feedback,
        "unique_feedback_users": unique_feedback_users,
        "positive_rate": round((positive_feedback / total_feedback) * 100, 1) if total_feedback else 0.0,
        "by_feature": by_feature,
        "daily_feedback": daily_feedback,
        "recent_notes": recent_notes,
    }
