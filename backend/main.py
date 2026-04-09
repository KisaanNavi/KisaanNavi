from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
from contextlib import asynccontextmanager

load_dotenv()

from database.mongodb import init_db
from routers import chat, crop, fertilizer, weather, auth, location, disease, feedback


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db() 
    yield
    print("Shutting down...")


app = FastAPI(
    title="KisaanNavi API",
    description="AI-Powered Decision Support System for Indian Farmers",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(crop.router, prefix="/api/crop", tags=["Crop Recommendation"])
app.include_router(fertilizer.router, prefix="/api/fertilizer", tags=["Fertilizer Recommendation"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(location.router, prefix="/api/location", tags=["Location Data"])
app.include_router(disease.router, prefix="/api/disease", tags=["Disease Detection"])
app.include_router(feedback.router, prefix="/api/feedback", tags=["Feedback"])


@app.get("/")
async def root():
    return {
        "name": "KisaanNavi API",
        "version": "2.0.0",
        "status": "running",
        "endpoints": {
            "chat": "/api/chat",
            "crop": "/api/crop/recommend",
            "fertilizer": "/api/fertilizer/recommend",
            "weather": "/api/weather/{district}",
            "disease": "/api/disease/detect"
        }
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    print("\n " + "=" * 40)
    print("   KisaanNavi Backend (Production Ready)")
    print("=" * 42)
    print(" Server: http://localhost:5000")
    print(" ML Model: Integrated")
    print(" Weather API: Open-Meteo (Live)")
    print(" Auth: JWT")
    print(" Database: MongoDB")
    print("=" * 42 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=5000)
