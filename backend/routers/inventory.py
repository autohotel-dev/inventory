import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Products, Warehouses, Stock
from schemas.inventory import (
    ProductCreate, ProductUpdate, ProductResponse,
    WarehouseCreate, WarehouseUpdate, WarehouseResponse,
    StockCreate, StockUpdate, StockResponse
)
from auth_utils import get_current_user, CurrentUser

router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
    dependencies=[Depends(get_current_user)]
)

# --- PRODUCTS ---

@router.get("/products", response_model=list[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Products).all()

@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(product: ProductCreate, db: Session = Depends(get_db)):
    db_product = Products(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@router.patch("/products/{product_id}", response_model=ProductResponse)
def update_product(product_id: uuid.UUID, product: ProductUpdate, db: Session = Depends(get_db)):
    db_product = db.query(Products).filter(Products.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = product.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product

@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    db_product = db.query(Products).filter(Products.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db.delete(db_product)
    db.commit()
    return None

# --- WAREHOUSES ---

@router.get("/warehouses", response_model=list[WarehouseResponse])
def get_warehouses(db: Session = Depends(get_db)):
    return db.query(Warehouses).all()

@router.post("/warehouses", response_model=WarehouseResponse, status_code=status.HTTP_201_CREATED)
def create_warehouse(warehouse: WarehouseCreate, db: Session = Depends(get_db)):
    db_warehouse = Warehouses(**warehouse.model_dump())
    db.add(db_warehouse)
    db.commit()
    db.refresh(db_warehouse)
    return db_warehouse

from models.inventory import Suppliers, PurchaseOrders, PurchaseOrderItems, InventoryMovements, MovementReasons
from schemas.inventory import (
    SupplierCreate, SupplierUpdate, SupplierResponse,
    PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse,
    InventoryMovementCreate, InventoryMovementResponse
)

# --- SUPPLIERS ---

@router.get("/suppliers", response_model=list[SupplierResponse])
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(Suppliers).all()

@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(supplier: SupplierCreate, db: Session = Depends(get_db)):
    db_supplier = Suppliers(**supplier.model_dump())
    db.add(db_supplier)
    db.commit()
    db.refresh(db_supplier)
    return db_supplier

# --- INVENTORY MOVEMENTS ---

@router.post("/movements", response_model=InventoryMovementResponse, status_code=status.HTTP_201_CREATED)
def create_movement(movement: InventoryMovementCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    # 1. Verificar razón
    reason = db.query(MovementReasons).filter(MovementReasons.id == movement.reason_id).first()
    if not reason:
        raise HTTPException(status_code=400, detail="Invalid movement reason")
        
    movement_type = reason.movement_type # IN, OUT, ADJUSTMENT
    
    # 2. Registrar movimiento
    db_movement = InventoryMovements(**movement.model_dump())
    db_movement.movement_type = movement_type
    db_movement.reason = reason.name
    # TODO: Asignar current_user.id a db_movement.created_by si el string es un UUID válido.
    
    db.add(db_movement)
    
    # 3. Actualizar Stock
    stock = db.query(Stock).filter(
        Stock.product_id == movement.product_id, 
        Stock.warehouse_id == movement.warehouse_id
    ).first()
    
    if not stock:
        if movement_type == 'OUT':
            raise HTTPException(status_code=400, detail="Not enough stock")
        stock = Stock(product_id=movement.product_id, warehouse_id=movement.warehouse_id, qty=0)
        db.add(stock)
        
    if movement_type == 'IN':
        stock.qty += movement.quantity
    elif movement_type == 'OUT':
        if stock.qty < movement.quantity:
            raise HTTPException(status_code=400, detail="Not enough stock")
        stock.qty -= movement.quantity
    elif movement_type == 'ADJUSTMENT':
        # En ajuste asume que quantity es la nueva cantidad absoluta, o la diferencia? 
        # Depende de la lógica de negocio. Por simplicidad, tomamos la diferencia desde quantity.
        # Mejor: asume que en ADJUSTMENT quantity puede ser pos/neg.
        stock.qty += movement.quantity
        
    db.commit()
    db.refresh(db_movement)
    return db_movement

