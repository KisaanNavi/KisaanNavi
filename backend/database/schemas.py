from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class UserRegister(BaseModel):
    name: str
    phone: str
    password: str
    state: str
    district: Optional[str] = None
    language: str = "en"


class UserLogin(BaseModel):
    name: str
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    phone: str
    state: str
    district: Optional[str]
    language: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None


class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    messages: List[ChatMessage] = Field(default_factory=list)


class ConversationSummary(BaseModel):
    id: str
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class ConversationDetail(BaseModel):
    id: str
    title: str
    preview: str
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessage]


class ChatRequest(BaseModel):
    message: str
    language: str = "en"
    context: Optional[List[dict]] = None


class ChatResponse(BaseModel):
    response: str
    intent: Optional[str] = None
    data: Optional[dict] = None


class CropRecommendRequest(BaseModel):
    state: str
    district: str
    season: Optional[str] = None


class CropRecommendResponse(BaseModel):
    crops: List[dict]
    soil_info: dict
    weather_info: dict


class FertilizerRequest(BaseModel):
    state: str
    district: Optional[str] = None
    crop: str
    soil_type: Optional[str] = None
    nitrogen: Optional[str] = None
    phosphorus: Optional[str] = None
    potassium: Optional[str] = None


class FertilizerResponse(BaseModel):
    fertilizers: List[dict]
    application_info: str
    warnings: Optional[List[str]] = None


class WeatherResponse(BaseModel):
    location: str
    current: dict
    forecast: List[dict]
    advisories: List[dict]


class DiseasePredictionOption(BaseModel):
    label: str
    crop: str
    disease: str
    healthy: bool
    confidence: float


class DiseaseDetectResponse(BaseModel):
    label: str
    crop: str
    disease: str
    healthy: bool
    confidence: float
    summary: str
    immediate_actions: List[str]
    prevention_tips: List[str]
    top_predictions: List[DiseasePredictionOption]


class FeedbackRequest(BaseModel):
    feature: str
    subject: str
    helpful: bool
    note: Optional[str] = None
    metadata: Optional[dict] = None


class FeedbackResponse(BaseModel):
    id: str
    success: bool
    queued: bool = False
