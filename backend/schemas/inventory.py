from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid
from decimal import Decimal

# --- Products ---
class ProductBase(BaseModel):
    name: str
    sku: str
    unit: str = "EA"
    barcode: Optional[str] = None
    description: Optional[str] = None
    cost: Optional[Decimal] = Decimal('0.00')
    price: Optional[Decimal] = Decimal('0.00')
    is_active: Optional[bool] = True
    min_stock: Optional[Decimal] = Decimal('0.00')
    category_id: Optional[uuid.UUID] = None
    subcategory_id: Optional[uuid.UUID] = None
    supplier_id: Optional[uuid.UUID] = None

class ProductCreate(ProductBase):
    pass

class ProductUpdate(ProductBase):
    name: Optional[str] = None
    sku: Optional[str] = None

class ProductResponse(ProductBase):
    id: uuid.UUID
    created_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Warehouses ---
class WarehouseBase(BaseModel):
    name: str
    code: str
    address: Optional[str] = None
    is_active: Optional[bool] = True

class WarehouseCreate(WarehouseBase):
    pass

class WarehouseUpdate(WarehouseBase):
    name: Optional[str] = None
    code: Optional[str] = None

class WarehouseResponse(WarehouseBase):
    id: uuid.UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Stock ---
class StockBase(BaseModel):
    product_id: uuid.UUID
    warehouse_id: uuid.UUID
    quantity: Decimal = Decimal('0.00')
    last_count_date: Optional[datetime] = None

class StockCreate(StockBase):
    pass

class StockUpdate(BaseModel):
    quantity: Decimal
    last_count_date: Optional[datetime] = None

class StockResponse(StockBase):
    product_id: uuid.UUID
    warehouse_id: uuid.UUID
    qty: Optional[Decimal] = Decimal('0.00')
    
    model_config = ConfigDict(from_attributes=True)

# --- Suppliers ---
class SupplierBase(BaseModel):
    name: str
    tax_id: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = True

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(SupplierBase):
    name: Optional[str] = None

class SupplierResponse(SupplierBase):
    id: uuid.UUID
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Inventory Movements ---
class InventoryMovementBase(BaseModel):
    product_id: uuid.UUID
    warehouse_id: uuid.UUID
    reason_id: int
    quantity: int
    movement_type: Optional[str] = None
    reference_table: Optional[str] = None
    reference_id: Optional[uuid.UUID] = None
    note: Optional[str] = None

class InventoryMovementCreate(InventoryMovementBase):
    pass

class InventoryMovementResponse(InventoryMovementBase):
    id: uuid.UUID
    created_by: Optional[uuid.UUID]
    created_at: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

# --- Purchase Orders ---
class PurchaseOrderItemBase(BaseModel):
    product_id: uuid.UUID
    qty: Decimal
    unit_cost: Decimal
    tax: Optional[Decimal] = Decimal('0.00')

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass

class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    total: Optional[Decimal]
    
    model_config = ConfigDict(from_attributes=True)

class PurchaseOrderBase(BaseModel):
    supplier_id: uuid.UUID
    warehouse_id: uuid.UUID
    status: str = "OPEN"
    currency: str = "MXN"
    subtotal: Optional[Decimal] = Decimal('0.00')
    tax: Optional[Decimal] = Decimal('0.00')
    total: Optional[Decimal] = Decimal('0.00')
    notes: Optional[str] = None

class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None

class PurchaseOrderResponse(PurchaseOrderBase):
    id: uuid.UUID
    created_by: Optional[uuid.UUID]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    items: List[PurchaseOrderItemResponse] = []
    
    model_config = ConfigDict(from_attributes=True)
