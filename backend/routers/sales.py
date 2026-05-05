import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.sales import Customers, SalesOrders, SalesOrderItems, Payments, PaymentTerminals
from sqlalchemy import text
from schemas.sales import (
    CustomerCreate, CustomerUpdate, CustomerResponse,
    SalesOrderCreate, SalesOrderUpdate, SalesOrderResponse,
    SalesOrderItemCreate, SalesOrderItemResponse,
    PaymentCreate, PaymentUpdate, PaymentResponse,
    PaymentTerminalCreate, PaymentTerminalUpdate, PaymentTerminalResponse,
    ProcessPaymentRequest
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

@router.post("/orders/{order_id}/process", status_code=status.HTTP_200_OK)
def process_payments(order_id: uuid.UUID, request: ProcessPaymentRequest, db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    db_order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")

    from models.system import Employees
    from models.hr import ShiftSessions
    from models.rooms import RoomStays, Rooms
    
    employee = db.query(Employees).filter(Employees.auth_user_id == current_user.id).first()
    if not employee:
        raise HTTPException(status_code=400, detail="Employee profile not found")

    # 1. Marcar ítems seleccionados como pagados
    if request.item_ids:
        db.query(SalesOrderItems).filter(
            SalesOrderItems.id.in_(request.item_ids)
        ).update({"is_paid": True, "paid_at": datetime.utcnow()}, synchronize_session=False)

    # 1.5. Limpiar pagos PENDIENTE
    db.query(Payments).filter(
        Payments.sales_order_id == order_id,
        Payments.status == "PENDIENTE"
    ).delete(synchronize_session=False)

    # 2. Obtener sesión activa de RECEPCIONISTA
    active_session = db.query(ShiftSessions).filter(
        ShiftSessions.employee_id == employee.id,
        ShiftSessions.status.in_(["active", "open"])
    ).first()
    
    session_id = active_session.id if active_session else None

    # Log audit
    total_amount = sum(float(p.amount) for p in request.payments)
    
    try:
        db.execute(text("""
            SELECT log_audit(
                'PAYMENT_PROCESSING_STARTED',
                'SALES_ORDER',
                :order_id,
                'UPDATE',
                :desc,
                :meta,
                'INFO'
            )
        """), {
            "order_id": str(order_id),
            "desc": f"Inicio de procesamiento de {len(request.payments)} pago(s) para orden",
            "meta": f'{{"payment_count": {len(request.payments)}, "total_amount": {total_amount}}}'
        })
    except Exception as e:
        print("Audit log error:", e)

    # 3. Cola de pagos
    existing_payments = db.query(Payments).filter(
        Payments.sales_order_id == order_id,
        Payments.status.in_(["COBRADO_POR_VALET", "CORROBORADO_RECEPCION"]),
        Payments.collected_by.isnot(None)
    ).order_by(Payments.created_at.asc()).all()

    valet_queue = existing_payments.copy()
    valid_payments = [p for p in request.payments if p.amount > 0]
    
    payment_type_val = "PARCIAL" if len(valid_payments) > 1 else "COMPLETO"

    for p in valid_payments:
        if valet_queue:
            existing_payment = valet_queue.pop(0)
            existing_payment.amount = p.amount
            existing_payment.payment_method = p.method
            existing_payment.status = "PAGADO"
            existing_payment.confirmed_at = datetime.utcnow()
            existing_payment.confirmed_by = employee.id
            existing_payment.shift_session_id = session_id
            existing_payment.terminal_code = p.terminal
            if p.reference:
                existing_payment.reference = p.reference
            existing_payment.card_last_4 = p.cardLast4
            existing_payment.card_type = p.cardType
            existing_payment.payment_type = payment_type_val
        else:
            new_payment = Payments(
                sales_order_id=order_id,
                amount=p.amount,
                payment_method=p.method,
                card_last_4=p.cardLast4,
                card_type=p.cardType,
                terminal_code=p.terminal,
                reference=p.reference or f"PAGO-{uuid.uuid4().hex[:8].upper()}",
                concept="PAGO_POR_CONCEPTOS",
                status="PAGADO",
                payment_type=payment_type_val,
                created_by=current_user.id,
                shift_session_id=session_id,
                collected_at=datetime.utcnow(),
                collected_by=p.collected_by
            )
            db.add(new_payment)

    # 3.5 Sobrantes
    for remaining in valet_queue:
        remaining.status = "PAGADO"
        remaining.confirmed_at = datetime.utcnow()
        remaining.confirmed_by = employee.id
        remaining.shift_session_id = session_id

    # 4. Propina
    if request.tip_amount > 0:
        main_method = valid_payments[0].method if valid_payments else "EFECTIVO"
        tip_payment = Payments(
            sales_order_id=order_id,
            amount=request.tip_amount,
            payment_method=main_method,
            concept="PROPINA",
            status="PAGADO",
            created_by=current_user.id,
            shift_session_id=session_id,
            collected_at=datetime.utcnow()
        )
        db.add(tip_payment)

    # 5. Totales
    selected_total = sum(float(p.amount) for p in valid_payments)
    db_order.paid_amount = float(db_order.paid_amount or 0) + selected_total
    db_order.remaining_amount = max(0.0, float(db_order.total or 0) - float(db_order.paid_amount))
    if db_order.remaining_amount <= 0:
        db_order.status = "PAID"
    else:
        db_order.status = "PARTIAL"

    # 6. Sincronizar
    try:
        db.execute(text("SELECT sync_payment_items(:order, :emp)"), {
            "order": str(order_id),
            "emp": str(employee.id)
        })
    except Exception as e:
        print("Sync items error:", e)

    # 7 & 8. Room Stays & Rooms
    db_stay = db.query(RoomStays).filter(RoomStays.sales_order_id == order_id).first()
    if db_stay:
        db_stay.checkout_payment_data = None
        if db_stay.room_id:
            db_room = db.query(Rooms).filter(Rooms.id == db_stay.room_id).first()
            if db_room and db_room.status == "BLOQUEADA":
                db_room.status = "OCUPADA"

    db.commit()
    return {"success": True, "message": "Payments processed successfully"}

# --- TRANSACTIONAL RPC BRIDGES ---
from sqlalchemy import text
from schemas.sales_rpc import CancelChargeRequest, CancelItemRequest, CancelItemRefundRequest, ProcessPaymentRequest

@router.post("/cancel-charge")
def cancel_charge(req: CancelChargeRequest, db: Session = Depends(get_db)):
    """Bridge for cancel_reception_charge RPC"""
    query = text("""
        SELECT cancel_reception_charge(
            :p_payment_id, :p_employee_id
        )
    """)
    try:
        result = db.execute(query, {
            "p_payment_id": str(req.payment_id),
            "p_employee_id": str(req.employee_id)
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Cancellation failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel-item")
def cancel_item(req: CancelItemRequest, db: Session = Depends(get_db)):
    """Bridge for cancel_reception_item_v1 RPC"""
    query = text("""
        SELECT cancel_reception_item_v1(
            :p_item_id, :p_employee_id, :p_reason
        )
    """)
    try:
        result = db.execute(query, {
            "p_item_id": str(req.item_id),
            "p_employee_id": str(req.employee_id),
            "p_reason": req.reason
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Item cancellation failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cancel-refund")
def cancel_item_refund(req: CancelItemRefundRequest, db: Session = Depends(get_db)):
    """Bridge for cancel_item_with_refund RPC"""
    query = text("""
        SELECT cancel_item_with_refund(
            :p_item_id, :p_employee_id, :p_reason
        )
    """)
    try:
        result = db.execute(query, {
            "p_item_id": str(req.item_id),
            "p_employee_id": str(req.employee_id),
            "p_reason": req.reason
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Item refund cancellation failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-payment")
def process_payment(req: ProcessPaymentRequest, db: Session = Depends(get_db)):
    """Bridge for process_payment RPC"""
    query = text("""
        SELECT process_payment(
            :p_order_id, :p_payment_amount
        )
    """)
    try:
        result = db.execute(query, {
            "p_order_id": str(req.order_id),
            "p_payment_amount": req.payment_amount
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Payment processing failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
