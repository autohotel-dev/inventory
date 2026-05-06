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

@router.get("/orders")
def get_sales_orders(
    status: Optional[str] = None,
    employee_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                so.id, so.created_at, so.status, so.currency, so.subtotal, so.tax, so.total, so.notes, so.created_by,
                c.name as customer_name,
                w.code as warehouse_code, w.name as warehouse_name,
                e.first_name as employee_first_name, e.last_name as employee_last_name
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            LEFT JOIN warehouses w ON so.warehouse_id = w.id
            LEFT JOIN employees e ON so.created_by = e.auth_user_id
            WHERE 1=1
        """
        params = []
        
        # Check permissions (only admins can see everything, others see only their own)
        if current_user.get('role') != 'admin' and current_user.get('role') != 'manager':
            query += " AND so.created_by = %s"
            params.append(current_user.get('id'))
        elif employee_id and employee_id != 'ALL':
            # Need to get auth_user_id for this employee
            cursor.execute("SELECT auth_user_id FROM employees WHERE id = %s", (employee_id,))
            emp = cursor.fetchone()
            if emp and emp['auth_user_id']:
                query += " AND so.created_by = %s"
                params.append(emp['auth_user_id'])
                
        if status and status != 'ALL':
            query += " AND so.status = %s"
            params.append(status)
            
        if date_from:
            query += " AND so.created_at >= %s"
            params.append(date_from)
            
        if date_to:
            query += " AND so.created_at <= %s"
            params.append(date_to)
            
        if min_amount is not None:
            query += " AND so.total >= %s"
            params.append(min_amount)
            
        if max_amount is not None:
            query += " AND so.total <= %s"
            params.append(max_amount)
            
        query += " ORDER BY so.created_at DESC"
        
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        
        # Transform to expected format
        result = []
        for r in rows:
            result.append({
                'id': str(r['id']),
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'status': r['status'],
                'currency': r['currency'],
                'subtotal': float(r['subtotal'] or 0),
                'tax': float(r['tax'] or 0),
                'total': float(r['total'] or 0),
                'notes': r['notes'],
                'created_by': r['created_by'],
                'customers': {'name': r['customer_name']} if r['customer_name'] else None,
                'warehouses': {'code': r['warehouse_code'], 'name': r['warehouse_name']} if r['warehouse_code'] else None,
                'employees': {'first_name': r['employee_first_name'], 'last_name': r['employee_last_name']} if r['employee_first_name'] else None
            })
        return result
    except Exception as e:
        print(f"Error in get_sales_orders: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/orders/{order_id}/receipt")
def get_receipt(order_id: str, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get order
        cursor.execute("""
            SELECT id, created_at, total, paid_amount, remaining_amount, currency, status
            FROM sales_orders WHERE id = %s
        """, (order_id,))
        order = cursor.fetchone()
        
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        # Get items
        cursor.execute("""
            SELECT i.id, i.qty, i.unit_price, i.total, i.concept_type, i.is_paid, i.payment_method,
                   p.name as product_name, p.sku as product_sku
            FROM sales_order_items i
            LEFT JOIN products p ON i.product_id = p.id
            WHERE i.sales_order_id = %s
        """, (order_id,))
        items_rows = cursor.fetchall()
        
        items = []
        for i in items_rows:
            items.append({
                'id': str(i['id']),
                'qty': i['qty'],
                'unit_price': float(i['unit_price'] or 0),
                'total': float(i['total'] or 0),
                'concept_type': i['concept_type'],
                'is_paid': i['is_paid'],
                'payment_method': i['payment_method'],
                'products': {'name': i['product_name'], 'sku': i['product_sku']} if i['product_name'] else None
            })

        # Get payments
        cursor.execute("""
            SELECT id, amount, payment_method, reference, created_at, tip_amount
            FROM payments
            WHERE sales_order_id = %s
        """, (order_id,))
        payments_rows = cursor.fetchall()
        
        payments = []
        for p in payments_rows:
            payments.append({
                'id': str(p['id']),
                'amount': float(p['amount'] or 0),
                'payment_method': p['payment_method'],
                'reference': p['reference'],
                'created_at': p['created_at'].isoformat() if p['created_at'] else None,
                'tip_amount': float(p['tip_amount'] or 0)
            })
            
        return {
            'order': {
                'id': str(order['id']),
                'created_at': order['created_at'].isoformat() if order['created_at'] else None,
                'total': float(order['total'] or 0),
                'paid_amount': float(order['paid_amount'] or 0),
                'remaining_amount': float(order['remaining_amount'] or 0),
                'currency': order['currency'],
                'status': order['status']
            },
            'items': items,
            'payments': payments
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_receipt: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

from pydantic import BaseModel
from typing import List

class AdvancedOrderItem(BaseModel):
    product_id: str
    quantity: int
    unit_price: float

class AdvancedPayment(BaseModel):
    amount: float
    method: str
    reference: Optional[str] = None

class AdvancedOrderCreate(BaseModel):
    customer_id: Optional[str] = None
    warehouse_id: str
    currency: str
    notes: Optional[str] = None
    subtotal: float
    tax: float
    total: float
    items: List[AdvancedOrderItem]
    payments: List[AdvancedPayment]

@router.post("/orders/advanced")
def create_advanced_order(order: AdvancedOrderCreate, current_user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        conn.autocommit = False
        
        # Calculate totals
        total_paid = sum(p.amount for p in order.payments if p.amount > 0)
        remaining_amount = max(0, order.total - total_paid)
        
        # Generate ID
        order_id = str(uuid.uuid4())
        
        # Insert Sales Order
        cursor.execute("""
            INSERT INTO sales_orders (
                id, customer_id, warehouse_id, currency, notes, subtotal, tax, total, 
                status, remaining_amount, paid_amount, created_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            order_id, order.customer_id, order.warehouse_id, order.currency, order.notes,
            order.subtotal, order.tax, order.total, "OPEN", remaining_amount, total_paid, current_user.get('id')
        ))
        
        # Process Payments
        valid_payments = [p for p in order.payments if p.amount > 0]
        if valid_payments:
            is_multipago = len(valid_payments) > 1
            if is_multipago:
                main_payment_id = str(uuid.uuid4())
                cursor.execute("""
                    INSERT INTO payments (
                        id, sales_order_id, amount, payment_method, reference, concept, status, payment_type, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    main_payment_id, order_id, total_paid, "PENDIENTE", f"VTA-{int(time.time())}", 
                    "VENTA", "PAGADO", "COMPLETO", current_user.get('id')
                ))
                
                for p in valid_payments:
                    cursor.execute("""
                        INSERT INTO payments (
                            id, sales_order_id, amount, payment_method, reference, concept, status, payment_type, parent_payment_id, created_by
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        str(uuid.uuid4()), order_id, p.amount, p.method, p.reference or f"SUB-{int(time.time())}",
                        "VENTA", "PAGADO", "PARCIAL", main_payment_id, current_user.get('id')
                    ))
            else:
                p = valid_payments[0]
                cursor.execute("""
                    INSERT INTO payments (
                        id, sales_order_id, amount, payment_method, reference, concept, status, payment_type, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    str(uuid.uuid4()), order_id, p.amount, p.method, p.reference or f"VTA-{int(time.time())}",
                    "VENTA", "PAGADO", "COMPLETO", current_user.get('id')
                ))

        # Insert Items
        for item in order.items:
            cursor.execute("""
                INSERT INTO sales_order_items (
                    id, sales_order_id, product_id, qty, unit_price, total
                ) VALUES (%s, %s, %s, %s, %s, %s)
            """, (
                str(uuid.uuid4()), order_id, item.product_id, item.quantity, item.unit_price, item.quantity * item.unit_price
            ))
            
        conn.commit()
        return {"id": order_id}
    except Exception as e:
        conn.rollback()
        print(f"Error in create_advanced_order: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

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

@router.get("/orders/{order_id}", response_model=SalesOrderResponse)
def get_order(order_id: uuid.UUID, db: Session = Depends(get_db)):
    db_order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found")
    return db_order


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

from pydantic import BaseModel
from typing import List, Optional

class PendingChargeRequest(BaseModel):
    amount: float
    concept: str
    reference_prefix: str
    shift_session_id: Optional[str] = None
    notes: Optional[str] = None

@router.post("/orders/{order_id}/pending-charge")
def create_pending_charge(order_id: uuid.UUID, req: PendingChargeRequest, db: Session = Depends(get_db)):
    import random
    import string
    import time
    
    # Simple reference generator
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    timestamp_str = str(int(time.time() * 1000))[-6:]
    reference = f"{req.reference_prefix}-{timestamp_str}-{random_str}"
    
    new_payment = Payments(
        sales_order_id=order_id,
        amount=req.amount,
        payment_method="PENDIENTE",
        reference=reference,
        concept=req.concept,
        status="PENDIENTE",
        payment_type="COMPLETO",
        shift_session_id=uuid.UUID(req.shift_session_id) if req.shift_session_id else None,
        notes=req.notes
    )
    db.add(new_payment)
    
    order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if order:
        order.subtotal = (order.subtotal or 0) + req.amount
        order.total = order.subtotal + (order.tax or 0)
        order.remaining_amount = (order.remaining_amount or 0) + req.amount
        
    db.commit()
    return {"success": True, "newRemaining": order.remaining_amount if order else 0}

class ReconcilePaymentEntry(BaseModel):
    amount: float
    method: str
    reference: Optional[str] = None
    terminal: Optional[str] = None
    cardLast4: Optional[str] = None
    cardType: Optional[str] = None

class ReconcileRequest(BaseModel):
    payments: List[ReconcilePaymentEntry]
    total_paid: float
    reference_prefix: str = "PAG"
    shift_session_id: Optional[str] = None
    employee_id: Optional[str] = None

@router.post("/orders/{order_id}/reconcile-pending")
def reconcile_pending_payments(order_id: uuid.UUID, req: ReconcileRequest, db: Session = Depends(get_db)):
    pending_payments = db.query(Payments).filter(
        Payments.sales_order_id == order_id,
        Payments.status == "PENDIENTE",
        Payments.parent_payment_id.is_(None)
    ).order_by(Payments.created_at.asc()).all()
    
    remaining_to_pay = req.total_paid
    valid_payments = [p for p in req.payments if p.amount > 0]
    is_multipago = len(valid_payments) > 1
    
    for pending in pending_payments:
        if remaining_to_pay <= 0:
            break
            
        amount_for_this = min(pending.amount, remaining_to_pay)
        remaining_to_pay -= amount_for_this
        
        if is_multipago:
            pending.status = "PAGADO"
            pending.payment_method = "PENDIENTE"
            
            proportion = amount_for_this / req.total_paid
            for p in valid_payments:
                sub = Payments(
                    sales_order_id=order_id,
                    amount=round(p.amount * proportion, 2),
                    payment_method=p.method,
                    reference=p.reference or f"SUB-{int(time.time()*1000)}",
                    concept=pending.concept,
                    status="PAGADO",
                    payment_type="PARCIAL",
                    parent_payment_id=pending.id,
                    shift_session_id=uuid.UUID(req.shift_session_id) if req.shift_session_id else None,
                    collected_by=uuid.UUID(req.employee_id) if req.employee_id else None,
                    terminal_code=p.terminal if p.method == 'TARJETA' else None,
                    card_last_4=p.cardLast4 if p.method == 'TARJETA' else None,
                    card_type=p.cardType if p.method == 'TARJETA' else None
                )
                db.add(sub)
        else:
            p = valid_payments[0]
            pending.status = "PAGADO"
            pending.payment_method = p.method
            pending.reference = p.reference or f"{req.reference_prefix}-{int(time.time()*1000)}"
            if req.shift_session_id:
                pending.shift_session_id = uuid.UUID(req.shift_session_id)
            if req.employee_id:
                pending.collected_by = uuid.UUID(req.employee_id)
            if p.method == 'TARJETA':
                pending.terminal_code = p.terminal
                pending.card_last_4 = p.cardLast4
                pending.card_type = p.cardType
                
    # Update order remaining amount
    paid_amount_applied = req.total_paid - remaining_to_pay
    if paid_amount_applied > 0:
        order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
        if order:
            order.remaining_amount = max(0, (order.remaining_amount or 0) - paid_amount_applied)
            
    db.commit()
    return {"remaining_to_pay": remaining_to_pay}

from schemas.sales import SalesOrderItemCreate
from models.inventory import Stock, InventoryMovements

class AddItemsRequest(BaseModel):
    items: List[SalesOrderItemCreate]
    warehouse_id: Optional[uuid.UUID] = None
    employee_id: Optional[uuid.UUID] = None

@router.post("/orders/{order_id}/items/bulk")
def add_items_to_order(order_id: uuid.UUID, req: AddItemsRequest, db: Session = Depends(get_db)):
    # 1. Verify stock
    if req.warehouse_id:
        for item in req.items:
            stock = db.query(Stock).filter(Stock.product_id == item.product_id, Stock.warehouse_id == req.warehouse_id).first()
            if not stock or stock.qty < item.qty:
                raise HTTPException(status_code=400, detail=f"Stock insuficiente para producto {item.product_id}")
    
    total_new = 0
    productos_nota = []
    
    for item in req.items:
        # Create item
        db_item = SalesOrderItems(
            sales_order_id=order_id,
            product_id=item.product_id,
            qty=item.qty,
            unit_price=item.unit_price,
            is_courtesy=item.is_courtesy,
            courtesy_reason=item.courtesy_reason
        )
        db.add(db_item)
        
        total_new += (item.qty * item.unit_price)
        
        # Product name for notes
        prod = db.query(Products).filter(Products.id == item.product_id).first()
        prod_name = prod.name if prod else "Producto"
        productos_nota.append(f"{item.qty}x {prod_name}")
        
        # Create inventory movement
        if req.warehouse_id:
            stock = db.query(Stock).filter(Stock.product_id == item.product_id, Stock.warehouse_id == req.warehouse_id).first()
            stock.qty -= item.qty
            
            movement = InventoryMovements(
                product_id=item.product_id,
                warehouse_id=req.warehouse_id,
                quantity=item.qty,
                movement_type="OUT",
                reason_id=6, # Assuming 6 is SALE
                reason="SALE",
                notes=f"Consumo vendido en orden {order_id}",
                reference_table="sales_orders",
                reference_id=str(order_id),
                created_by=req.employee_id
            )
            db.add(movement)
            
    # Create payment pending
    import random, string, time
    random_str = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    timestamp_str = str(int(time.time() * 1000))[-6:]
    
    payment = Payments(
        sales_order_id=order_id,
        amount=total_new,
        payment_method="PENDIENTE",
        reference=f"CON-{timestamp_str}-{random_str}",
        concept="CONSUMO",
        status="PENDIENTE",
        payment_type="COMPLETO",
        notes=", ".join(productos_nota),
        collected_by=req.employee_id
    )
    db.add(payment)
    
    # Update order
    order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    if order:
        order.subtotal = (order.subtotal or 0) + total_new
        order.total = order.subtotal + (order.tax or 0)
        order.remaining_amount = (order.remaining_amount or 0) + total_new
        
    db.commit()
    return {"success": True, "added_total": total_new}

@router.delete("/orders/items/{item_id}")
def remove_item(item_id: uuid.UUID, db: Session = Depends(get_db)):
    item = db.query(SalesOrderItems).filter(SalesOrderItems.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
        
    order_id = item.sales_order_id
    db.delete(item)
    db.commit()
    
    # Recalculate totals
    order = db.query(SalesOrders).filter(SalesOrders.id == order_id).first()
    items_subtotal = sum([(i.qty or 0) * (i.unit_price or 0) for i in db.query(SalesOrderItems).filter(SalesOrderItems.sales_order_id == order_id).all()])
    
    payments = db.query(Payments).filter(Payments.sales_order_id == order_id, Payments.parent_payment_id.is_(None)).all()
    non_item_charges = sum([(p.amount or 0) for p in payments if p.concept != "CONSUMO"])
    
    new_subtotal = items_subtotal + non_item_charges
    order.subtotal = new_subtotal
    order.total = new_subtotal + (order.tax or 0)
    order.remaining_amount = max(0, order.total - (order.paid_amount or 0))
    
    db.commit()
    return {"success": True}

@router.get("/promotions/active")
def get_active_promotions(db: Session = Depends(get_db)):
    query = text("""
        SELECT id, name, promo_type, buy_quantity, pay_quantity, discount_percent, 
               fixed_price, product_id, category_id, subcategory_id, conditions
        FROM product_promotions
        WHERE (start_date IS NULL OR start_date <= NOW())
          AND (end_date IS NULL OR end_date >= NOW())
    """)
    promos = db.execute(query).mappings().all()
    return [dict(p) for p in promos]

@router.get("/orders/{order_id}/previous-orders-context")
def get_previous_orders_context(order_id: uuid.UUID, db: Session = Depends(get_db)):
    # Get the booking_id for the current order
    order_query = text("SELECT booking_id FROM sales_orders WHERE id = :order_id")
    current_order = db.execute(order_query, {"order_id": str(order_id)}).mappings().first()
    
    if not current_order or not current_order.get('booking_id'):
        return {"previousOrdersCount": 0, "consumedItems": []}
        
    booking_id = current_order['booking_id']
    
    # Count previous orders
    count_query = text("""
        SELECT COUNT(id) as count 
        FROM sales_orders 
        WHERE booking_id = :booking_id 
          AND id != :order_id 
          AND total > 0
    """)
    count_result = db.execute(count_query, {"booking_id": booking_id, "order_id": str(order_id)}).mappings().first()
    count = count_result['count'] if count_result else 0
    
    # Get consumed items
    items_query = text("""
        SELECT i.product_id, p.category_id, p.subcategory_id
        FROM sales_order_items i
        JOIN sales_orders so ON so.id = i.sales_order_id
        JOIN products p ON p.id = i.product_id
        WHERE so.booking_id = :booking_id 
          AND i.sales_order_id != :order_id
    """)
    items = db.execute(items_query, {"booking_id": booking_id, "order_id": str(order_id)}).mappings().all()
    
    consumed_items = [
        {
            "productId": str(i['product_id']), 
            "categoryId": str(i['category_id']) if i['category_id'] else None, 
            "subcategoryId": str(i['subcategory_id']) if i['subcategory_id'] else None
        } for i in items
    ]
    
    return {
        "previousOrdersCount": count,
        "consumedItems": consumed_items
    }


@router.get("/orders/{order_id}/consumptions")
def get_order_consumptions(order_id: uuid.UUID, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT i.*, 
                   json_build_object('name', p.name, 'sku', p.sku) as products,
                   CASE WHEN e.id IS NOT NULL THEN json_build_object('first_name', e.first_name, 'last_name', e.last_name) ELSE NULL END as valet_employee
            FROM sales_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            LEFT JOIN employees e ON e.id = i.delivery_accepted_by
            WHERE i.sales_order_id = %s
        """, (str(order_id),))
        items = cursor.fetchall()
        return items
    except Exception as e:
        print(f"Error fetching consumptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/valet/consumptions/pending")
def get_pending_valet_consumptions(db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT i.*,
                   json_build_object('name', p.name, 'sku', p.sku) as products,
                   json_build_object('id', so.id, 'room_stays', 
                        json_build_object('room_id', rs.room_id, 'rooms', 
                            json_build_object('number', r.number)
                        )
                   ) as sales_orders
            FROM sales_order_items i
            JOIN products p ON p.id = i.product_id
            JOIN sales_orders so ON so.id = i.sales_order_id
            JOIN room_stays rs ON rs.id = so.room_stay_id
            JOIN rooms r ON r.id = rs.room_id
            WHERE i.concept_type = 'CONSUMPTION'
              AND i.delivery_accepted_by IS NULL
              AND i.is_paid = false
              AND i.delivery_status NOT IN ('CANCELLED', 'COMPLETED', 'DELIVERED')
            ORDER BY i.id DESC
        """)
        items = cursor.fetchall()
        return items
    except Exception as e:
        print(f"Error fetching pending consumptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/valet/consumptions/me")
def get_my_valet_consumptions(employee_id: uuid.UUID, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT i.*,
                   json_build_object('name', p.name, 'sku', p.sku) as products,
                   json_build_object('id', so.id, 'room_stays', 
                        json_build_object('room_id', rs.room_id, 'rooms', 
                            json_build_object('number', r.number)
                        )
                   ) as sales_orders
            FROM sales_order_items i
            JOIN products p ON p.id = i.product_id
            JOIN sales_orders so ON so.id = i.sales_order_id
            JOIN room_stays rs ON rs.id = so.room_stay_id
            JOIN rooms r ON r.id = rs.room_id
            WHERE i.concept_type = 'CONSUMPTION'
              AND i.delivery_accepted_by = %s
              AND i.delivery_status IN ('ACCEPTED', 'IN_TRANSIT')
            ORDER BY i.id DESC
        """, (str(employee_id),))
        items = cursor.fetchall()
        return items
    except Exception as e:
        print(f"Error fetching my consumptions: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/orders/{order_id}/has-pending-valet-payments")
def has_pending_valet_payments(order_id: uuid.UUID, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT 1 FROM payments WHERE sales_order_id = %s AND confirmed_at IS NULL LIMIT 1", (str(order_id),))
        if cursor.fetchone():
            return {"hasPendingValetPayment": True}
        
        cursor.execute("""
            SELECT 1 FROM sales_order_items 
            WHERE sales_order_id = %s 
              AND delivery_status IN ('ACCEPTED', 'IN_TRANSIT', 'DELIVERED')
              AND is_paid = false
            LIMIT 1
        """, (str(order_id),))
        if cursor.fetchone():
            return {"hasPendingValetPayment": True}
            
        return {"hasPendingValetPayment": False}
    except Exception as e:
        print(f"Error checking pending valet payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/orders/{order_id}/valet-interaction")
def get_valet_interaction(order_id: uuid.UUID, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT rs.status, rs.checkout_payment_data, rs.id
            FROM room_stays rs
            JOIN sales_orders so ON so.room_stay_id = rs.id
            WHERE so.id = %s
        """, (str(order_id),))
        stay_data = cursor.fetchone()
        
        cursor.execute("""
            SELECT p.*,
                   json_build_object('first_name', e.first_name, 'last_name', e.last_name) as employees
            FROM payments p
            LEFT JOIN employees e ON e.id = p.payments_collected_by_fkey
            WHERE p.sales_order_id = %s
              AND p.status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION')
        """, (str(order_id),))
        payments_data = cursor.fetchall()
        
        return {
            "stayData": stay_data,
            "paymentsData": payments_data
        }
    except Exception as e:
        print(f"Error fetching valet interaction: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

from pydantic import BaseModel
from typing import List, Optional

class CorroboratePayload(BaseModel):
    paymentIds: List[str]
    employeeId: Optional[str] = None

@router.post("/orders/{order_id}/corroborate-valet-payments")
def corroborate_valet_payments(order_id: uuid.UUID, payload: CorroboratePayload, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        real_ids = [pid for pid in payload.paymentIds if '-' in pid and len(pid) > 20 and not pid.startswith('check-in')]
        now = datetime.now().isoformat()
        
        if real_ids:
            cursor.execute("""
                UPDATE payments 
                SET status = 'CORROBORADO_RECEPCION', confirmed_at = %s, confirmed_by = %s
                WHERE id = ANY(%s)
            """, (now, payload.employeeId, real_ids))
            
        if 'check-in-fixed' in payload.paymentIds:
            cursor.execute("""
                UPDATE payments
                SET status = 'CORROBORADO_RECEPCION', confirmed_at = %s, confirmed_by = %s
                WHERE sales_order_id = %s AND (concept = 'ENTRADA' OR concept = 'STAY' OR concept = 'ESTANCIA')
            """, (now, payload.employeeId, str(order_id)))
            
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        print(f"Error corroborating valet payments: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/orders/{order_id}/full-detail")
def get_order_full_detail(order_id: uuid.UUID, db: Session = Depends(get_db)):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # Get order
        cursor.execute("""
            SELECT o.*,
                   json_build_object('name', c.name, 'email', c.email, 'phone', c.phone) as customers,
                   json_build_object('code', w.code, 'name', w.name) as warehouses
            FROM sales_orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN warehouses w ON w.id = o.warehouse_id
            WHERE o.id = %s
        """, (str(order_id),))
        order_data = cursor.fetchone()
        
        if not order_data:
            raise HTTPException(status_code=404, detail="Order not found")

        # Get items
        cursor.execute("""
            SELECT i.id, i.product_id, i.qty, i.unit_price, i.total, i.payment_method, 
                   i.is_paid, i.paid_at, i.concept_type, i.is_courtesy, i.courtesy_reason,
                   json_build_object('name', p.name, 'sku', p.sku) as products
            FROM sales_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            WHERE i.sales_order_id = %s
        """, (str(order_id),))
        items_data = cursor.fetchall()
        
        # Get products
        cursor.execute("SELECT id, name, sku, price FROM products")
        products_data = cursor.fetchall()
        
        # Get payments
        cursor.execute("""
            SELECT id, amount, payment_method, reference, concept, status, created_at
            FROM payments
            WHERE sales_order_id = %s
        """, (str(order_id),))
        payments_data = cursor.fetchall()
        
        return {
            "order": order_data,
            "items": items_data,
            "products": products_data,
            "payments": payments_data
        }
    except Exception as e:
        print(f"Error fetching full order detail: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
