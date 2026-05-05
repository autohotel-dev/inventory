from pydantic import BaseModel
from typing import Optional

class OCRRequest(BaseModel):
    image: str

class OCRResponse(BaseModel):
    plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    raw: Optional[str] = None
    error: Optional[str] = None
    message: Optional[str] = None

from typing import Dict, Any

class PushNotificationRequest(BaseModel):
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    user_id: Optional[str] = None  # To target a specific user
    role: Optional[str] = None     # To broadcast to a role

class PushNotificationResponse(BaseModel):
    success: bool
    sent: int
    result: Optional[Dict[str, Any]] = None
