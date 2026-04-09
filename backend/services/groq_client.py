import os
import re
from typing import List, Optional

import httpx

from services.sarvam_client import detect_language, translate

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")

SYSTEM_PROMPT = """You are KisaanNavi, an AI assistant for Indian farmers.
You help with:
- Crop recommendations based on soil and weather
- Fertilizer advice and application methods
- Weather-based farming decisions
- General farming queries

Rules:
1. Be practical and actionable.
2. Keep responses simple and concise.
3. Do not fabricate numeric confidence values unless provided in context.
4. If data is missing, say so clearly.
5. Always refer to yourself exactly as "KisaanNavi".
"""


async def chat_completion(
    message: str,
    context: Optional[List[dict]] = None,
    language: str = "en"
) -> dict:
    if not GROQ_API_KEY:
        return {
            "response": _fallback_response(language),
            "intent": "general"
        }

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    lang_label = {"en": "English", "hi": "Hindi", "te": "Telugu"}.get(language, "English")
    messages.append({"role": "system", "content": f"Final answer language must be {lang_label}."})

    if context:
        for msg in context[-5:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })

    messages.append({"role": "user", "content": message})

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": GROQ_MODEL,
        "messages": messages,
        "temperature": 0.5,
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(GROQ_API_URL, json=payload, headers=headers)
            if response.status_code >= 400:
                print(f"Groq API HTTP {response.status_code}: {response.text[:300]}")
                return {"response": _fallback_response(language), "intent": "error"}
            data = response.json()

        if "choices" not in data or not data["choices"]:
            return {"response": _fallback_response(language), "intent": "error"}

        raw_response = data["choices"][0]["message"]["content"]
        localized_response = await _ensure_language(raw_response, language)
        localized_response = _enforce_brand_name(localized_response)
        return {
            "response": localized_response,
            "intent": _detect_intent(message)
        }
    except Exception as e:
        print(f"Groq API error: {e}")
        return {
            "response": _fallback_response(language),
            "intent": "error"
        }


async def _ensure_language(text: str, target_lang: str) -> str:
    if not text:
        return text
    if target_lang not in {"en", "hi", "te"}:
        return text

    try:
        detected = await detect_language(text)
        if detected == target_lang:
            return text
        translated = await translate(text, detected, target_lang)
        return translated or text
    except Exception:
        return text


def _detect_intent(message: str) -> str:
    text = message.lower()

    crop_keywords = ["crop", "grow", "sow", "plant", "cultivation", "fasal", "kheti"]
    fertilizer_keywords = ["fertilizer", "urea", "dap", "npk", "manure", "khad"]
    weather_keywords = ["weather", "rain", "temperature", "forecast", "humidity", "mausam"]

    if any(k in text for k in crop_keywords):
        return "crop_recommendation"
    if any(k in text for k in fertilizer_keywords):
        return "fertilizer_recommendation"
    if any(k in text for k in weather_keywords):
        return "weather"
    return "general"


def _fallback_response(language: str) -> str:
    if language == "hi":
        return "Server response available nahi hai. Kripya thodi der baad dubara try karein."
    if language == "te":
        return "Server response ippudu andubatlo ledu. Koncham sepu tarvata malli try cheyyandi."
    return "I could not get a live AI response right now. Please try again shortly."


def _enforce_brand_name(text: str) -> str:
    if not text:
        return text

    aliases = [
        r"\bkisanvani\b",
        r"\bkisaanvani\b",
        r"\bkisannavi\b",
        r"\bkisan\s+navi\b",
        r"\bkisaan\s+navi\b",
    ]

    normalized = text
    for alias in aliases:
        normalized = re.sub(alias, "KisaanNavi", normalized, flags=re.IGNORECASE)
    return normalized
