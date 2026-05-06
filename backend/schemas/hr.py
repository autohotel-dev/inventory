from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime, date, time
import uuid
from decimal import Decimal

# --- Employees ---
class EmployeeBase(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str = "receptionist"
    phone: Optional[str] = None
    is_active: bool = True
    pin_code: Optional[str] = None
    avatar_url: Optional[str] = None
    hired_at: Optional[date] = None

class EmployeeCreate(EmployeeBase):
    auth_user_id: Optional[uuid.UUID] = None
    role_id: Optional[uuid.UUID] = None

class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    pin_code: Optional[str] = None
    avatar_url: Optional[str] = None

class EmployeeResponse(EmployeeBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Shift Definitions ---
class ShiftDefinitionBase(BaseModel):
    name: str
    code: str
    start_time: time
    end_time: time
    crosses_midnight: bool = False
    color: Optional[str] = "#3B82F6"
    is_active: bool = True

class ShiftDefinitionCreate(ShiftDefinitionBase):
    pass

class ShiftDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    is_active: Optional[bool] = None

class ShiftDefinitionResponse(ShiftDefinitionBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Employee Schedules ---
class EmployeeScheduleBase(BaseModel):
    employee_id: uuid.UUID
    shift_definition_id: uuid.UUID
    schedule_date: date
    is_day_off: bool = False
    notes: Optional[str] = None

class EmployeeScheduleCreate(EmployeeScheduleBase):
    pass

class EmployeeScheduleUpdate(BaseModel):
    shift_definition_id: Optional[uuid.UUID] = None
    is_day_off: Optional[bool] = None
    notes: Optional[str] = None

class EmployeeScheduleResponse(EmployeeScheduleBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Shift Sessions ---
class ShiftSessionBase(BaseModel):
    employee_id: uuid.UUID
    shift_definition_id: uuid.UUID
    schedule_id: Optional[uuid.UUID] = None
    status: str = "active"
    notes: Optional[str] = None

class ShiftSessionCreate(ShiftSessionBase):
    clock_in_at: Optional[datetime] = None

class ShiftSessionUpdate(BaseModel):
    status: Optional[str] = None
    clock_out_at: Optional[datetime] = None
    notes: Optional[str] = None

class ShiftSessionResponse(ShiftSessionBase):
    id: uuid.UUID
    clock_in_at: datetime
    clock_out_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ShiftSessionWithRelationsResponse(ShiftSessionResponse):
    employees: Optional[EmployeeResponse] = None
    shift_definitions: Optional[ShiftDefinitionResponse] = None

class ManagerDataResponse(BaseModel):
    shifts: List[ShiftDefinitionResponse]
    employees: List[EmployeeResponse]
    active_sessions: List[ShiftSessionWithRelationsResponse]
    user_role: Optional[str] = None

# --- Shift Closings ---
class ShiftClosingBase(BaseModel):
    shift_session_id: uuid.UUID
    employee_id: uuid.UUID
    shift_definition_id: uuid.UUID
    period_start: datetime
    period_end: datetime
    total_cash: Optional[Decimal] = Decimal('0.00')
    total_card_bbva: Optional[Decimal] = Decimal('0.00')
    total_card_getnet: Optional[Decimal] = Decimal('0.00')
    total_sales: Optional[Decimal] = Decimal('0.00')
    total_transactions: Optional[int] = 0
    total_expenses: Optional[Decimal] = Decimal('0.00')
    expenses_count: Optional[int] = 0
    declared_card_bbva: Optional[Decimal] = Decimal('0.00')
    declared_card_getnet: Optional[Decimal] = Decimal('0.00')
    card_difference_bbva: Optional[Decimal] = Decimal('0.00')
    card_difference_getnet: Optional[Decimal] = Decimal('0.00')
    counted_cash: Optional[Decimal] = None
    cash_difference: Optional[Decimal] = None
    cash_breakdown: Optional[Dict[str, Any]] = None
    status: str = "pending"
    notes: Optional[str] = None

class ShiftClosingDetailCreate(BaseModel):
    payment_id: uuid.UUID
    sales_order_id: Optional[uuid.UUID] = None
    amount: Decimal
    payment_method: str
    terminal_code: Optional[str] = None

class ShiftClosingCreate(ShiftClosingBase):
    details: Optional[List[ShiftClosingDetailCreate]] = None

class ShiftClosingUpdate(BaseModel):
    status: Optional[str] = None
    reviewed_by: Optional[uuid.UUID] = None
    rejection_reason: Optional[str] = None

class ShiftClosingResponse(ShiftClosingBase):
    id: uuid.UUID
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
