from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime
from typing import Any
from bson import ObjectId

from database.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationCreateRequest,
    ConversationUpdateRequest,
    ConversationSummary,
    ConversationDetail,
)
from database.mongodb import get_database
from routers.auth import get_current_user
from services.groq_client import chat_completion
from services.location_service import get_district_soil_data, get_coordinates
from services.weather_client import get_weather
from ml.predictor import get_crop_predictor, get_fertilizer_predictor

router = APIRouter()


def _to_json_safe(value):
    if isinstance(value, dict):
        return {k: _to_json_safe(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_to_json_safe(v) for v in value]
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            return value
    return value


def _conversation_preview(messages: list[dict[str, Any]]) -> str:
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            return str(message["content"])[:140]
    if messages and messages[0].get("content"):
        return str(messages[0]["content"])[:140]
    return "New chat"


def _conversation_title(messages: list[dict[str, Any]], explicit_title: str | None = None) -> str:
    if explicit_title:
        return explicit_title[:80]
    for message in messages:
        if message.get("role") == "user" and message.get("content"):
            content = str(message["content"]).strip()
            if content:
                return content[:80]
    return "New Chat"


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(user_id: str = Depends(get_current_user)):
    db = get_database()
    cursor = db.conversations.find({"user_id": user_id}).sort("updated_at", -1)
    conversations = await cursor.to_list(length=200)

    result: list[ConversationSummary] = []
    for conv in conversations:
        messages = conv.get("messages", [])
        result.append(
            ConversationSummary(
                id=str(conv["_id"]),
                title=conv.get("title", "New Chat"),
                preview=conv.get("preview", _conversation_preview(messages)),
                created_at=conv.get("created_at", datetime.utcnow()),
                updated_at=conv.get("updated_at", conv.get("created_at", datetime.utcnow())),
                message_count=len(messages),
            )
        )
    return result


@router.post("/conversations", response_model=ConversationSummary)
async def create_conversation(
    payload: ConversationCreateRequest | None = Body(default=None),
    user_id: str = Depends(get_current_user),
):
    db = get_database()
    now = datetime.utcnow()
    title = ((payload.title if payload else None) or "New Chat")[:80]
    doc = {
        "user_id": user_id,
        "title": title,
        "preview": "",
        "messages": [],
        "created_at": now,
        "updated_at": now,
    }
    created = await db.conversations.insert_one(doc)
    return ConversationSummary(
        id=str(created.inserted_id),
        title=title,
        preview="",
        created_at=now,
        updated_at=now,
        message_count=0,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: str, user_id: str = Depends(get_current_user)):
    db = get_database()
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    conv = await db.conversations.find_one({"_id": oid, "user_id": user_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    raw_messages = conv.get("messages", [])
    messages = []
    for m in raw_messages:
        timestamp = m.get("timestamp", datetime.utcnow())
        if isinstance(timestamp, str):
            try:
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            except Exception:
                timestamp = datetime.utcnow()
        messages.append({"role": m.get("role", "assistant"), "content": m.get("content", ""), "timestamp": timestamp})

    return ConversationDetail(
        id=str(conv["_id"]),
        title=conv.get("title", "New Chat"),
        preview=conv.get("preview", _conversation_preview(raw_messages)),
        created_at=conv.get("created_at", datetime.utcnow()),
        updated_at=conv.get("updated_at", conv.get("created_at", datetime.utcnow())),
        messages=messages,
    )


@router.put("/conversations/{conversation_id}", response_model=ConversationSummary)
async def update_conversation(
    conversation_id: str,
    payload: ConversationUpdateRequest,
    user_id: str = Depends(get_current_user),
):
    db = get_database()
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    existing = await db.conversations.find_one({"_id": oid, "user_id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Conversation not found")

    raw_messages = [
        {"role": m.role, "content": m.content, "timestamp": m.timestamp}
        for m in (payload.messages or [])
    ]
    title = _conversation_title(raw_messages, payload.title)
    preview = _conversation_preview(raw_messages)
    now = datetime.utcnow()

    await db.conversations.update_one(
        {"_id": oid, "user_id": user_id},
        {
            "$set": {
                "title": title,
                "preview": preview,
                "messages": raw_messages,
                "updated_at": now,
            }
        },
    )

    return ConversationSummary(
        id=conversation_id,
        title=title,
        preview=preview,
        created_at=existing.get("created_at", now),
        updated_at=now,
        message_count=len(raw_messages),
    )


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(conversation_id: str, user_id: str = Depends(get_current_user)):
    db = get_database()
    try:
        oid = ObjectId(conversation_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid conversation id")

    deleted = await db.conversations.delete_one({"_id": oid, "user_id": user_id})
    if deleted.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return {"success": True}


@router.post("/", response_model=ChatResponse)
async def chat(request: ChatRequest):
    message = request.message.strip()
    language = request.language
    context = request.context or []
    
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    
    result = await chat_completion(message, context, language)
    
    intent = result.get("intent", "general")
    additional_data = None
    
    if intent == "crop_recommendation":
        additional_data = await _handle_crop_intent(message, language)
    elif intent == "fertilizer_recommendation":
        additional_data = await _handle_fertilizer_intent(message, language)
    elif intent == "weather":
        additional_data = await _handle_weather_intent(message)
    
    return ChatResponse(
        response=result["response"],
        intent=intent,
        data=additional_data
    )


@router.post("/quick-action")
async def quick_action(payload: dict = Body(...)):
    action = payload.get("action", "")
    data = payload.get("data", {})

    if action == "crop":
        state = data.get("state", "")
        district = data.get("district", "")
        
        if not state:
            return {"response": "Please provide state", "success": False}
        if not district:
            district = state
        
        soil_data = get_district_soil_data(state, district)
        coords = get_coordinates(district)
        if not coords:
            coords = get_coordinates(state)
        
        if coords:
            weather = await get_weather(coords["lat"], coords["lon"], district)
            temp = weather["current"]["temperature"]
            humidity = weather["current"]["humidity"]
            rainfall = sum(f["precipitation"] for f in weather["forecast"][:7]) / 7
        else:
            temp, humidity, rainfall = 25, 60, 100
        
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
                state=state
            )
            
            return {
                "success": True,
                "crops": _to_json_safe(crops),
                "soil_info": _to_json_safe(soil_data),
                "weather": _to_json_safe({"temp": temp, "humidity": humidity, "rainfall": rainfall})
            }
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    elif action == "fertilizer":
        crop = data.get("crop", "")
        state = data.get("state", "")
        district = data.get("district", "")
        soil_type = data.get("soil_type", "Loamy")
        
        if not crop:
            return {"response": "Please specify the crop", "success": False}
        
        soil_data = get_district_soil_data(state, district) if state and district else {}
        
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
            
            return {
                "success": True,
                "fertilizers": _to_json_safe(fertilizers),
                "crop": crop,
                "soil_info": _to_json_safe(soil_data)
            }
        
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    elif action == "weather":
        location = data.get("location", "")
        
        if not location:
            return {"response": "Please provide location", "success": False}
        
        coords = get_coordinates(location)
        if not coords:
            return {"response": f"Could not find location: {location}", "success": False}
        
        weather = await get_weather(coords["lat"], coords["lon"], location)
        return {"success": True, "weather": weather}
    
    return {"success": False, "error": "Unknown action"}


async def _handle_crop_intent(message: str, language: str) -> dict:
    return {"type": "crop_recommendation", "needs_input": ["state", "district"]}


async def _handle_fertilizer_intent(message: str, language: str) -> dict:
    return {"type": "fertilizer_recommendation", "needs_input": ["crop", "soil_type"]}


async def _handle_weather_intent(message: str) -> dict:
    return {"type": "weather", "needs_input": ["location"]}
