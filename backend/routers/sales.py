import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.sales import Customers, SalesOrders, SalesOrderItems, Payments, PaymentTerminals
from schemas.sales import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse,
    SalesOrderItemCreate, SalesOrderItemResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    PaymentTerminalCreate, PaymentTerminalUpdate, PaymentTerminalResponse
)
from auth_utils import get_current_user, CurrentUser

router = APIRouter(
    prefix="/sales",
    tags=["Sales"],
    dependencies=[Depends(get_current_user)]
)

# --- CUSTOMERS ---
@router.get("/customers", response_model=list[CustomerResponse])
def get_customers(db: Session = Depends(get_db)):
    return db.query(Customers).all()

@router.post("/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    db_customer = Customers(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@router.patch("/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: uuid.UUID, customer: CustomerUpdate, db: Session = Depends(get_db)):
    db_customer = db.query(Customers).filter(Customers.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    for key, value in customer.model_dump(exclude_unset=True).items():
        setattr(db_customer, key, value)
        
    db.commit()
    db.refresh(db_customer)
    return db_customer

# --- PAYMENT TERMINALS ---
@router.get("/terminals", response_model=list[PaymentTerminalResponse])
def get_terminals(db: Session = Depends(get_db)):
    return db.query(PaymentTerminals).all()

@router.post("/terminals", response_model=PaymentTerminalResponse, status_code=status.HTTP_201_CREATED)
def create_terminal(terminal: PaymentTerminalCreate, db: Session = Depends(get_db)):
    db_terminal = PaymentTerminals(**terminal.model_dump())
    db.add(db_terminal)
    db.commit()
    db.refresh(db_terminal)
    return db_terminal

# --- SALES ORDERS ---
@router.get("/orders", response_model=list[SalesOrderResponse])
def get_orders(db: Session = Depends(get_db)):
    return db.query(SalesOrders).all()

@router.post("/orders", response_model=SalesOrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order: SalesOrderCreate, db: Session = Depends(get_db)):
    # Generate simple order number
    count = db.query(SalesOrders).count()
    order_number = f"SO-{datetime.utcnow().year}-{count+1:04d}"
    
    db_order = SalesOrders(**order.model_dump(), order_number=order_number, order_date=datetime.utcnow())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    return db_order

@router.patch("/orders/{order_id}", response_model=SalesOrderResponse)
def update_order(order_id: uuid.UUID, order_update: SalesOrderUpdate, db: Session = Depends(get_db)):
    db_order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    for key, value in order_update.model_dump(exclude_unset=True).items():
        setattr(db_order, key, value)
        
    db.commit()
    db.refresh(db_order)
    return db_order

@router.post("/orders/{order_id}/items", response_model=SalesOrderItemResponse, status_code=status.HTTP_201_CREATED)
def add_order_item(order_id: uuid.UUID, item: SalesOrderItemCreate, db: Session = Depends(get_db)):
    db_order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    db_item = SalesOrderItems(**item.model_dump(), sales_order_id=order_id)
    db.add(db_item)
    
    # Simple Recalculate totals
    total_item = (item.qty * item.unit_price) - (item.discount or 0) + (item.tax or 0)
    db_order.subtotal = float(db_order.subtotal or 0) + float(item.qty * item.unit_price)
    db_order.total = float(db_order.total or 0) + float(total_item)
    db_order.remaining_amount = float(db_order.remaining_amount or 0) + float(total_item)
    
    db.commit()
    db.refresh(db_item)
    return db_item

# --- PAYMENTS ---
@router.get("/orders/{order_id}/payments", response_model=list[PaymentResponse])
def get_order_payments(order_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(Payments).filter(Payments.sales_order_id == order_id).all()

@router.post("/orders/{order_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(order_id: uuid.UUID, payment: PaymentCreate, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    db_order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if payment.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
        
    # Generate payment number
    count = db.query(Payments).filter(Payments.sales_order_id == order_id).count()
    payment_num = f"P{count+1:03d}"
    
    db_payment = Payments(**payment.model_dump(), payment_number=payment_num)
    db.add(db_payment)
    
    # Update order paid amount
    if payment.status == "PAGADO":
        db_order.paid_amount = float(db_order.paid_amount or 0) + float(payment.amount)
        db_order.remaining_amount = float(db_order.remaining_amount or 0) - float(payment.amount)
        if db_order.remaining_amount <= 0:
            db_order.status = "PAID"
            
    db.commit()
    db.refresh(db_payment)
    return db_payment
