from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from decimal import Decimal

class PaymentData(BaseModel):
    amount: Decimal
    method: str
    reference: Optional[str] = None
    terminal: Optional[str] = None
    cardLast4: Optional[str] = None
    cardType: Optional[str] = None

class CheckInRequest(BaseModel):
    warehouse_id: uuid.UUID
    room_type_name: str
    room_number: str
    base_price: Decimal
    extra_person_price: Decimal
    total_price: Decimal
    total_paid: Decimal
    initial_people: int
    extra_people_count: int
    check_in_at: datetime
    expected_checkout_at: datetime
    vehicle_plate: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None
    is_hotel: bool = False
    duration_nights: int = 1
    notes: Optional[str] = None
    payment_data: List[PaymentData] = []
    employee_id: uuid.UUID

class CheckOutRequest(BaseModel):
    stay_id: uuid.UUID
    sales_order_id: uuid.UUID
    payment_data: List[PaymentData] = []
    checkout_valet_id: Optional[uuid.UUID] = None
    employee_id: Optional[uuid.UUID] = None

class ExtraHoursRequest(BaseModel):
    stay_id: uuid.UUID
    employee_id: Optional[uuid.UUID] = None

class AssignAssetRequest(BaseModel):
    employee_id: uuid.UUID
    asset_type: str
    action_by_employee_id: Optional[uuid.UUID] = None
