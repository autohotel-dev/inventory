import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Products, Warehouses, Stock, t_products_view
from sqlalchemy import select, or_, and_, func
from schemas.inventory import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductViewResponse, ProductDashboardResponse, ProductDashboardStats,
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

@router.get("/dashboard/products", response_model=ProductDashboardResponse)
def get_products_dashboard(
    page: int = 0,
    search: Optional[str] = None,
    category_id: Optional[str] = None,
    subcategory_id: Optional[str] = None,
    supplier_id: Optional[str] = None,
    stock_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
    price_min: Optional[float] = None,
    price_max: Optional[float] = None,
    db: Session = Depends(get_db)
):
    ITEMS_PER_PAGE = 20
    
    # Construir base query
    base_query = select(t_products_view)
    
    # Aplicar filtros
    filters = []
    if search:
        search_term = f"%{search}%"
        filters.append(or_(
            t_products_view.c.name.ilike(search_term),
            t_products_view.c.sku.ilike(search_term),
            t_products_view.c.description.ilike(search_term)
        ))
    
    if category_id:
        if category_id == "sin-categoria":
            filters.append(t_products_view.c.category_id.is_(None))
        else:
            filters.append(t_products_view.c.category_id == category_id)
            
    if subcategory_id:
        if subcategory_id == "sin-subcategoria":
            filters.append(t_products_view.c.subcategory_id.is_(None))
        else:
            filters.append(t_products_view.c.subcategory_id == subcategory_id)
            
    if supplier_id:
        if supplier_id == "sin-proveedor":
            filters.append(t_products_view.c.supplier_id.is_(None))
        else:
            filters.append(t_products_view.c.supplier_id == supplier_id)
            
    if stock_filter:
        if stock_filter == "sin-stock":
            filters.append(t_products_view.c.total_stock <= 0)
        elif stock_filter == "stock-critico":
            filters.append(t_products_view.c.stock_status == "critical")
        elif stock_filter == "stock-bajo":
            filters.append(t_products_view.c.stock_status == "low")
        elif stock_filter == "stock-normal":
            filters.append(t_products_view.c.stock_status == "normal")
        elif stock_filter == "stock-alto":
            filters.append(t_products_view.c.stock_status == "high")
            
    if status_filter:
        if status_filter == "activo":
            filters.append(t_products_view.c.is_active == True)
        elif status_filter == "inactivo":
            filters.append(t_products_view.c.is_active == False)
            
    if price_min is not None:
        filters.append(t_products_view.c.price >= price_min)
        
    if price_max is not None:
        filters.append(t_products_view.c.price <= price_max)
        
    if filters:
        base_query = base_query.where(and_(*filters))
        
    # Obtener productos paginados
    query = base_query.order_by(t_products_view.c.created_at.desc())
    query = query.offset(page * ITEMS_PER_PAGE).limit(ITEMS_PER_PAGE + 1) # Pedir 1 extra para saber si hay más
    
    results = db.execute(query).mappings().all()
    
    has_more = len(results) > ITEMS_PER_PAGE
    paginated_results = results[:ITEMS_PER_PAGE]
    
    # Calcular estadísticas globales (SIN aplicar la mayoría de los filtros, solo los generales de la app)
    # Por ahora emularemos lo que hacía el frontend: llamar a todo
    
    from sqlalchemy import cast, Integer
    stats_query = select(
        func.count().label("total"),
        func.sum(cast(t_products_view.c.is_active, Integer)).label("active"),
        func.sum(
            cast(
                or_(t_products_view.c.stock_status == 'low', t_products_view.c.stock_status == 'critical'),
                Integer
            )
        ).label("low_stock"),
        func.sum(cast(t_products_view.c.stock_status == 'critical', Integer)).label("critical_stock"),
        func.sum(t_products_view.c.inventory_value).label("total_value")
    )
    
    stats_row = db.execute(stats_query).mappings().first()
    
    # Formatear la respuesta
    products_response = []
    for r in paginated_results:
        # Reconstruir los diccionarios anidados para frontend legacy
        legacy_category = {"id": str(r["category_id"]), "name": r["category_name"]} if r["category_id"] else None
        legacy_subcategory = {"id": str(r["subcategory_id"]), "name": r["subcategory_name"]} if r["subcategory_id"] else None
        legacy_supplier = {"id": str(r["supplier_id"]), "name": r["supplier_name"]} if r["supplier_id"] else None
        
        product_dict = dict(r)
        product_dict["category"] = legacy_category
        product_dict["subcategory"] = legacy_subcategory
        product_dict["supplier"] = legacy_supplier
        products_response.append(ProductViewResponse(**product_dict))
        
    return ProductDashboardResponse(
        products=products_response,
        has_more=has_more,
        stats=ProductDashboardStats(
            totalProducts=stats_row["total"] or 0,
            activeProducts=stats_row["active"] or 0,
            lowStockProducts=stats_row["low_stock"] or 0,
            criticalStockProducts=stats_row["critical_stock"] or 0,
            totalValue=stats_row["total_value"] or 0
        )
    )

@router.get("/products", response_model=list[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    return db.query(Products).all()

@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(product_id: uuid.UUID, db: Session = Depends(get_db)):
    db_product = db.query(Products).filter(Products.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    return db_product

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


@router.get("/movements")
def get_inventory_movements(
    page: int = 0,
    limit: int = 20,
    search: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InventoryMovements)
    if type:
        query = query.filter(InventoryMovements.movement_type == type)
    if search:
        query = query.filter(or_(
            InventoryMovements.notes.ilike(f"%{search}%"),
            InventoryMovements.reference_id.ilike(f"%{search}%")
        ))
        
    total = query.count()
    items = query.order_by(InventoryMovements.created_at.desc()).offset(page * limit).limit(limit).all()
    
    # Needs related data format (products, warehouses, users) for frontend compat
    # We will just return the raw models and let the frontend adapt, or we can format it here.
    # To keep it simple, we format it.
    formatted_items = []
    for item in items:
        prod = db.query(Products).filter(Products.id == item.product_id).first()
        wh = db.query(Warehouses).filter(Warehouses.id == item.warehouse_id).first()
        formatted_items.append({
            **item.__dict__,
            "products": {"name": prod.name if prod else "", "sku": prod.sku if prod else "", "price": prod.price if prod else 0},
            "warehouses": {"name": wh.name if wh else "", "code": wh.code if wh else ""},
            "users": {"email": "system@app.com", "id": item.created_by}
        })
        
    return {"items": formatted_items, "total": total}
