from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid
from decimal import Decimal

# --- Customers ---
class CustomerBase(BaseModel):
    name: str
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(CustomerBase):
    name: Optional[str] = None

class CustomerResponse(CustomerBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Payment Terminals ---
class PaymentTerminalBase(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    is_active: bool = True

class PaymentTerminalCreate(PaymentTerminalBase):
    pass

class PaymentTerminalUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class PaymentTerminalResponse(PaymentTerminalBase):
    id: uuid.UUID
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

# --- Sales Orders ---
class SalesOrderItemBase(BaseModel):
    product_id: uuid.UUID
    qty: Decimal
    unit_price: Decimal
    discount: Optional[Decimal] = Decimal('0.00')
    tax: Optional[Decimal] = Decimal('0.00')
    concept_type: str = "PRODUCT"
    is_courtesy: bool = False
    courtesy_reason: Optional[str] = None
    delivery_status: str = "PENDING_VALET"

class SalesOrderItemCreate(SalesOrderItemBase):
    sales_order_id: uuid.UUID
    is_paid: Optional[bool] = False
    paid_at: Optional[datetime] = None
    payment_method: Optional[str] = None
    shift_session_id: Optional[uuid.UUID] = None

class SalesOrderItemResponse(SalesOrderItemBase):
    id: uuid.UUID
    sales_order_id: uuid.UUID
    total: Optional[Decimal] = None
    is_paid: bool
    paid_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class SalesOrderBase(BaseModel):
    warehouse_id: uuid.UUID
    customer_id: Optional[uuid.UUID] = None
    status: str = "OPEN"
    currency: str = "MXN"
    subtotal: Optional[Decimal] = Decimal('0.00')
    tax: Optional[Decimal] = Decimal('0.00')
    total: Optional[Decimal] = Decimal('0.00')
    notes: Optional[str] = None
    payment_method: Optional[str] = None

class SalesOrderCreate(SalesOrderBase):
    shift_session_id: Optional[uuid.UUID] = None

class SalesOrderUpdate(BaseModel):
    status: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None

class SalesOrderResponse(SalesOrderBase):
    id: uuid.UUID
    order_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    remaining_amount: Optional[Decimal] = Decimal('0.00')
    paid_amount: Optional[Decimal] = Decimal('0.00')
    items: List[SalesOrderItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

# --- Payments ---
class PaymentBase(BaseModel):
    sales_order_id: uuid.UUID
    amount: Decimal
    payment_method: str
    reference: Optional[str] = None
    concept: Optional[str] = None
    status: str = "PAGADO"
    payment_type: str = "PARCIAL"
    terminal_id: Optional[uuid.UUID] = None
    terminal_code: Optional[str] = None
    card_last_4: Optional[str] = None
    card_type: Optional[str] = None
    shift_session_id: Optional[uuid.UUID] = None

class PaymentCreate(PaymentBase):
    collected_by: Optional[uuid.UUID] = None
    employee_id: Optional[uuid.UUID] = None

class PaymentProcessInput(BaseModel):
    amount: Decimal
    method: str
    terminal: Optional[str] = None
    reference: Optional[str] = None
    cardLast4: Optional[str] = None
    cardType: Optional[str] = None
    collected_by: Optional[uuid.UUID] = None
    original_payment_id: Optional[uuid.UUID] = None

class ProcessPaymentRequest(BaseModel):
    item_ids: List[uuid.UUID]
    payments: List[PaymentProcessInput]
    tip_amount: Decimal = Decimal('0.00')
    room_number: Optional[str] = None

class PaymentUpdate(BaseModel):
    status: Optional[str] = None
    confirmed_by: Optional[uuid.UUID] = None

class PaymentResponse(PaymentBase):
    id: uuid.UUID
    payment_number: Optional[str] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
