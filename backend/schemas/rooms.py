from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid
from decimal import Decimal

# --- Room Types ---
class RoomTypeBase(BaseModel):
    name: str
    base_price: Decimal
    weekday_hours: int = 12
    weekend_hours: int = 8
    is_hotel: bool = False
    is_active: bool = True
    extra_person_price: Decimal = Decimal('0.00')
    extra_hour_price: Decimal = Decimal('0.00')
    max_people: int = 2

class RoomTypeCreate(RoomTypeBase):
    pass

class RoomTypeUpdate(RoomTypeBase):
    name: Optional[str] = None
    base_price: Optional[Decimal] = None

class RoomTypeResponse(RoomTypeBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Rooms ---
class RoomBase(BaseModel):
    number: str
    room_type_id: uuid.UUID
    status: str = "LIBRE"
    notes: Optional[str] = None
    maintenance_image_url: Optional[str] = None

class RoomCreate(RoomBase):
    pass

class RoomUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    maintenance_image_url: Optional[str] = None
    cleaning_started_at: Optional[datetime] = None
    cleaning_by_employee_id: Optional[uuid.UUID] = None

class RoomResponse(RoomBase):
    id: uuid.UUID
    created_at: datetime
    cleaning_started_at: Optional[datetime] = None
    cleaning_by_employee_id: Optional[uuid.UUID] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Room Cleanings ---
class RoomCleaningBase(BaseModel):
    room_id: uuid.UUID
    employee_id: Optional[uuid.UUID] = None

class RoomCleaningCreate(RoomCleaningBase):
    started_at: Optional[datetime] = None

class RoomCleaningUpdate(BaseModel):
    ended_at: datetime
    duration_minutes: Optional[int] = None

class RoomCleaningResponse(RoomCleaningBase):
    id: uuid.UUID
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- Room Stays ---
class RoomStayBase(BaseModel):
    room_id: uuid.UUID
    sales_order_id: uuid.UUID
    expected_check_out_at: datetime
    status: str = "ACTIVA"
    current_people: int = 2
    total_people: int = 2
    vehicle_plate: Optional[str] = None
    vehicle_brand: Optional[str] = None
    vehicle_model: Optional[str] = None

class RoomStayCreate(RoomStayBase):
    shift_session_id: Optional[uuid.UUID] = None
    valet_employee_id: Optional[uuid.UUID] = None

class RoomStayUpdate(BaseModel):
    status: Optional[str] = None
    actual_check_out_at: Optional[datetime] = None
    vehicle_requested_at: Optional[datetime] = None
    valet_checkout_requested_at: Optional[datetime] = None

class RoomStayResponse(RoomStayBase):
    id: uuid.UUID
    check_in_at: datetime
    created_at: datetime
    actual_check_out_at: Optional[datetime] = None
    valet_employee_id: Optional[uuid.UUID] = None
    shift_session_id: Optional[uuid.UUID] = None
    
    model_config = ConfigDict(from_attributes=True)
