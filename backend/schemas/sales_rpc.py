from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
from decimal import Decimal
from schemas.rooms_rpc import PaymentData

class CancelChargeRequest(BaseModel):
    payment_id: uuid.UUID
    employee_id: uuid.UUID

class CancelItemRequest(BaseModel):
    item_id: uuid.UUID
    employee_id: uuid.UUID
    reason: str

class CancelItemRefundRequest(BaseModel):
    item_id: uuid.UUID
    employee_id: uuid.UUID
    reason: str

class ProcessPaymentRequest(BaseModel):
    order_id: uuid.UUID
    payment_amount: Decimal
