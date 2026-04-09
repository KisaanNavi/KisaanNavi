import os
from typing import Optional

import httpx

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_BASE_URL = os.getenv("SARVAM_BASE_URL", "https://api.sarvam.ai")
SARVAM_TRANSLATE_MODEL = os.getenv("SARVAM_TRANSLATE_MODEL", "mayura:v1")

LANGUAGE_CODES = {
    "en": "en-IN",
    "hi": "hi-IN",
    "te": "te-IN",
    "ta": "ta-IN",
    "mr": "mr-IN",
    "bn": "bn-IN",
    "gu": "gu-IN",
    "kn": "kn-IN",
    "ml": "ml-IN",
    "pa": "pa-IN",
    "or": "od-IN",
    "od": "od-IN",
    "ur": "ur-IN",
}


def _lang_code(value: str) -> str:
    if not value:
        return "en-IN"
    lowered = value.strip().lower()
    return LANGUAGE_CODES.get(lowered, value)


def _headers() -> dict:
    return {
        "api-subscription-key": SARVAM_API_KEY,
        "Content-Type": "application/json",
    }


async def translate(text: str, source_lang: str, target_lang: str) -> str:
    if not text:
        return text
    if source_lang == target_lang:
        return text
    if not SARVAM_API_KEY:
        return text

    payload = {
        "input": text,
        "source_language_code": _lang_code(source_lang),
        "target_language_code": _lang_code(target_lang),
        "model": SARVAM_TRANSLATE_MODEL,
        "mode": "formal",
        "numerals_format": "international",
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{SARVAM_BASE_URL}/translate", headers=_headers(), json=payload)
            data = response.json()

        if response.status_code >= 400:
            print(f"Sarvam translation error HTTP {response.status_code}: {str(data)[:300]}")
            return text

        return data.get("translated_text", text)
    except Exception as e:
        print(f"Sarvam translation error: {e}")
        return text


async def detect_language(text: str) -> str:
    if not text:
        return "en"
    if not SARVAM_API_KEY:
        return "en"

    payload = {"input": text[:1000]}
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(f"{SARVAM_BASE_URL}/text-lid", headers=_headers(), json=payload)
            data = response.json()

        if response.status_code >= 400:
            print(f"Sarvam language detect error HTTP {response.status_code}: {str(data)[:300]}")
            return "en"

        lang = str(data.get("language_code", "en-IN")).lower()
        if lang.startswith("hi"):
            return "hi"
        if lang.startswith("te"):
            return "te"
        if lang.startswith("en"):
            return "en"
        short = lang.split("-")[0]
        return short if short else "en"
    except Exception as e:
        print(f"Sarvam language detect error: {e}")
        return "en"


async def transliterate(text: str, source_lang: str = "en", target_lang: str = "hi") -> str:
    if not text:
        return text
    if source_lang == target_lang:
        return text
    if not SARVAM_API_KEY:
        return text

    payload = {
        "input": text,
        "source_language_code": _lang_code(source_lang),
        "target_language_code": _lang_code(target_lang),
        "numerals_format": "international",
        "spoken_form": False,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(f"{SARVAM_BASE_URL}/transliterate", headers=_headers(), json=payload)
            data = response.json()

        if response.status_code >= 400:
            print(f"Sarvam transliteration error HTTP {response.status_code}: {str(data)[:300]}")
            return text

        return data.get("transliterated_text", text)
    except Exception as e:
        print(f"Sarvam transliteration error: {e}")
        return text
