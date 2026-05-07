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
    checkout_valet_employee_id: Optional[uuid.UUID] = None
    checkout_payment_data: Optional[dict] = None
    sales_orders: Optional[dict] = None
    tolerance_started_at: Optional[datetime] = None
    checkout_shift_session_id: Optional[uuid.UUID] = None
    vehicle_requested_at: Optional[datetime] = None
    guest_access_token: Optional[str] = None
    valet_checkout_requested_at: Optional[datetime] = None
    tolerance_type: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

# --- DASHBOARD BFF (Backend For Frontend) ---
class SensorStatus(BaseModel):
    is_open: bool = False
    battery_level: int = 100
    is_online: bool = True

class VehicleStatus(BaseModel):
    has_vehicle: bool = False
    is_ready: bool = False
    plate: Optional[str] = None
    brand: Optional[str] = None
    model: Optional[str] = None
    is_waiting_authorization: bool = False

class ActiveStayDashboard(BaseModel):
    id: uuid.UUID
    sales_order_id: uuid.UUID
    check_in_at: datetime
    expected_check_out_at: datetime
    valet_employee_id: Optional[uuid.UUID] = None
    has_pending_payment: bool = False
    has_pending_service: bool = False
    is_critical_service: bool = False
    is_valet_pending: bool = False
    vehicle_status: Optional[VehicleStatus] = None

class RoomDashboardResponse(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    notes: Optional[str] = None
    room_type_name: Optional[str] = None
    is_hotel: bool = False
    tv_remote_status: str = "SIN_REGISTRO"
    active_stay: Optional[ActiveStayDashboard] = None
    sensor_status: Optional[SensorStatus] = None
    
    # Original data needed for Modals
    room_types: Optional[RoomTypeResponse] = None
    room_stays: Optional[List[RoomStayResponse]] = None
    room_assets: Optional[List[dict]] = None
    
    model_config = ConfigDict(from_attributes=True)
