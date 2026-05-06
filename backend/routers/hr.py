import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.hr import Employees, ShiftDefinitions, EmployeeSchedules, ShiftSessions, ShiftClosings
from schemas.hr import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    ShiftDefinitionCreate, ShiftDefinitionUpdate, ShiftDefinitionResponse,
    ShiftSessionCreate, ShiftSessionUpdate, ShiftSessionResponse, ShiftSessionWithRelationsResponse, ManagerDataResponse,
    ShiftClosingCreate, ShiftClosingUpdate, ShiftClosingResponse
)
from auth_utils import get_current_user, CurrentUser

router = APIRouter(
    prefix="/hr",
    tags=["Human Resources"],
    dependencies=[Depends(get_current_user)]
)

# --- MANAGER BFF ---
@router.get("/manager/data", response_model=ManagerDataResponse)
def get_manager_data(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    shifts = db.query(ShiftDefinitions).filter(ShiftDefinitions.is_active == True).order_by(ShiftDefinitions.start_time).all()
    
    employees = db.query(Employees).filter(
        Employees.is_active == True,
        Employees.role.in_(["receptionist", "manager", "cochero", "camarista", "mantenimiento"])
    ).order_by(Employees.first_name).all()
    
    active_sessions = db.query(ShiftSessions).filter(
        ShiftSessions.status == "active",
        ShiftSessions.clock_out_at == None
    ).order_by(ShiftSessions.clock_in_at.desc()).all()
    
    # We need to map relations manually since we are not using eager loading here, 
    # but SQLAlchemy relationships will auto-fetch if accessed, or we can just return them
    # and Pydantic will fetch. However, for efficiency, let's let SQLAlchemy lazy load it 
    # since it's a small dataset.
    
    # Get user role
    user_emp = db.query(Employees).filter(Employees.auth_user_id == current_user.sub).first()
    user_role = user_emp.role if user_emp else None
    
    return {
        "shifts": shifts,
        "employees": employees,
        "active_sessions": active_sessions,
        "user_role": user_role
    }

# --- EMPLOYEES ---
@router.get("/employees", response_model=list[EmployeeResponse])
def get_employees(db: Session = Depends(get_db)):
    return db.query(Employees).filter(Employees.deleted_at == None).all()

@router.post("/employees", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
def create_employee(employee: EmployeeCreate, db: Session = Depends(get_db)):
    db_employee = Employees(**employee.model_dump())
    db.add(db_employee)
    db.commit()
    db.refresh(db_employee)
    return db_employee

@router.patch("/employees/{employee_id}", response_model=EmployeeResponse)
def update_employee(employee_id: uuid.UUID, employee_update: EmployeeUpdate, db: Session = Depends(get_db)):
    db_employee = db.query(Employees).filter(Employees.id == employee_id).first()
    if not db_employee:
        raise HTTPException(status_code=404, detail="Employee not found")
        
    for key, value in employee_update.model_dump(exclude_unset=True).items():
        setattr(db_employee, key, value)
        
    db.commit()
    db.refresh(db_employee)
    return db_employee

# --- SHIFT DEFINITIONS ---
@router.get("/shifts", response_model=list[ShiftDefinitionResponse])
def get_shifts(db: Session = Depends(get_db)):
    return db.query(ShiftDefinitions).all()

@router.post("/shifts", response_model=ShiftDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_shift(shift: ShiftDefinitionCreate, db: Session = Depends(get_db)):
    db_shift = ShiftDefinitions(**shift.model_dump())
    db.add(db_shift)
    db.commit()
    db.refresh(db_shift)
    return db_shift

# --- SHIFT SESSIONS ---
@router.post("/sessions/clock-in", response_model=ShiftSessionResponse, status_code=status.HTTP_201_CREATED)
def clock_in(session: ShiftSessionCreate, db: Session = Depends(get_db)):
    # Check if employee already has an active session
    active = db.query(ShiftSessions).filter(
        ShiftSessions.employee_id == session.employee_id,
        ShiftSessions.status == "active"
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="Employee already has an active shift session")
        
    db_session = ShiftSessions(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@router.post("/sessions/{session_id}/clock-out", response_model=ShiftSessionResponse)
def clock_out(session_id: uuid.UUID, db: Session = Depends(get_db)):
    db_session = db.query(ShiftSessions).filter(ShiftSessions.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if db_session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {db_session.status}, cannot clock out")
        
    db_session.clock_out_at = datetime.utcnow()
    db_session.status = "pending_closing"
    
    db.commit()
    db.refresh(db_session)
    return db_session

# --- SHIFT CLOSINGS ---
@router.post("/closings", response_model=ShiftClosingResponse, status_code=status.HTTP_201_CREATED)
def create_shift_closing(closing: ShiftClosingCreate, db: Session = Depends(get_db)):
    db_session = db.query(ShiftSessions).filter(ShiftSessions.id == closing.shift_session_id).first()
    if not db_session or db_session.status != "pending_closing":
        raise HTTPException(status_code=400, detail="Invalid session for closing")
        
    closing_data = closing.model_dump(exclude={"details"})
    db_closing = ShiftClosings(**closing_data)
    db.add(db_closing)
    db.flush() # Para obtener db_closing.id
    
    # Save details if present
    if closing.details:
        for detail in closing.details:
            db_detail = ShiftClosingDetails(
                shift_closing_id=db_closing.id,
                payment_id=detail.payment_id,
                sales_order_id=detail.sales_order_id,
                amount=detail.amount,
                payment_method=detail.payment_method,
                terminal_code=detail.terminal_code
            )
            db.add(db_detail)
            
    db_session.status = "closed"
    
    db.commit()
    db.refresh(db_closing)
    return db_closing

from sqlalchemy import or_, and_
from sqlalchemy.orm import joinedload
from models.sales import Payments, SalesOrders, SalesOrderItems
from models.hr import ShiftExpenses, ShiftClosingDetails

@router.get("/closings/{session_id}/summary")
def get_closing_summary(session_id: uuid.UUID, db: Session = Depends(get_db)):
    # 1. Fetch Session
    session = db.query(ShiftSessions).filter(ShiftSessions.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    employee_id_str = str(session.employee_id)
    session_id_str = str(session_id)
    period_end = session.clock_out_at or datetime.utcnow()
    
    # 2. Payments
    payments_query = db.query(Payments).filter(
        or_(
            Payments.shift_session_id == session_id,
            Payments.shift_session_id == session.employee_id,
            and_(Payments.collected_by == session.employee_id, Payments.created_at >= session.clock_in_at, Payments.created_at <= period_end),
            and_(Payments.shift_session_id.is_(None), Payments.created_at >= session.clock_in_at, Payments.created_at <= period_end)
        )
    ).options(
        joinedload(Payments.terminal),
        joinedload(Payments.sales_order)
    ).order_by(Payments.created_at.desc())
    
    raw_payments = payments_query.all()
    
    # Extract shiftSalesOrderIds
    sales_order_ids = list(set([p.sales_order_id for p in raw_payments if p.sales_order_id]))
    
    sales_orders = []
    if sales_order_ids:
        # We fetch only for reference, but frontend needs room_stays inside salesOrders...
        # It's better to fetch them.
        from models.rooms import RoomStays
        sales_orders_db = db.query(SalesOrders).filter(SalesOrders.id.in_(sales_order_ids)).options(
            joinedload(SalesOrders.room_stays).joinedload(RoomStays.room)
        ).all()
        # Convert to dict
        for so in sales_orders_db:
            so_dict = {
                "id": str(so.id),
                "total": float(so.total or 0),
                "status": so.status,
                "room_stays": []
            }
            for rs in so.room_stays:
                so_dict["room_stays"].append({
                    "id": str(rs.id),
                    "rooms": {"number": rs.room.number if rs.room else "", "room_types": {"name": rs.room.room_type.name if rs.room and rs.room.room_type else ""}}
                })
            sales_orders.append(so_dict)
            
    # Load all items for these sales orders
    all_items = []
    if sales_order_ids:
        all_items = db.query(SalesOrderItems).filter(
            SalesOrderItems.sales_order_id.in_(sales_order_ids),
            SalesOrderItems.is_paid == True,
            SalesOrderItems.paid_at.isnot(None)
        ).options(joinedload(SalesOrderItems.product)).all()
        
    items_by_so = {}
    for item in all_items:
        so_id = str(item.sales_order_id)
        if so_id not in items_by_so:
            items_by_so[so_id] = []
        items_by_so[so_id].append(item)
        
    total_cash = 0.0
    total_card_bbva = 0.0
    total_card_getnet = 0.0
    unassigned_card_payments = []
    unhandled_payment_methods = []
    
    enriched_payments = []
    for p in raw_payments:
        # Check status
        if p.status == "PENDIENTE" or p.payment_method == "PENDIENTE" or p.payment_method == "MIXTO":
            continue
        if float(p.amount) < 0:
            continue
            
        p_amount = float(p.amount)
        if p.payment_method == "EFECTIVO":
            total_cash += p_amount
        elif p.payment_method == "TARJETA_BBVA":
            total_card_bbva += p_amount
        elif p.payment_method == "TARJETA_GETNET":
            total_card_getnet += p_amount
        elif p.payment_method == "TARJETA":
            terminal_code = p.terminal_code or (p.terminal.code if p.terminal else None)
            if terminal_code == "BBVA":
                total_card_bbva += p_amount
            elif terminal_code == "GETNET":
                total_card_getnet += p_amount
            else:
                if p.collected_by:
                    total_card_bbva += p_amount
                else:
                    total_card_bbva += p_amount
                    # It's an unassigned card payment, but we will just add it
        else:
            pass # unhandled
            
        # Enrich
        items_raw = []
        items_count = 0
        items_description = None
        
        if p.sales_order_id:
            related = items_by_so.get(str(p.sales_order_id), [])
            # Filter by time
            p_time = p.created_at
            valid_items = []
            for it in related:
                if it.paid_at:
                    diff = abs((p_time - it.paid_at).total_seconds()) / 60
                    if diff <= 5:
                        valid_items.append(it)
            
            for it in valid_items:
                product_name = it.product.name if it.product else it.concept_type or "Item"
                items_raw.append({
                    "name": product_name,
                    "qty": float(it.qty),
                    "unitPrice": float(it.unit_price),
                    "total": float(it.qty * it.unit_price)
                })
            
            items_count = len(valid_items)
            if items_raw:
                desc_parts = []
                for ir in items_raw:
                    if ir["qty"] > 1:
                        desc_parts.append(f"{ir['qty']}x {ir['name']}")
                    else:
                        desc_parts.append(ir["name"])
                items_description = ", ".join(desc_parts)
                
        enriched_payments.append({
            "id": str(p.id),
            "created_at": p.created_at.isoformat(),
            "amount": float(p.amount),
            "payment_method": p.payment_method,
            "terminal_code": p.terminal_code or (p.terminal.code if p.terminal else None),
            "payment_terminals": {"code": p.terminal.code, "name": p.terminal.name} if p.terminal else None,
            "sales_order_id": str(p.sales_order_id) if p.sales_order_id else None,
            "sales_orders": {"id": str(p.sales_order_id)} if p.sales_order_id else None,
            "reference": p.reference,
            "concept": p.concept,
            "itemsDescription": items_description,
            "itemsCount": items_count,
            "itemsRaw": items_raw
        })

    # Expenses
    expenses = db.query(ShiftExpenses).filter(
        ShiftExpenses.shift_session_id == session_id,
        ShiftExpenses.status != "rejected"
    ).all()
    total_expenses = sum([float(e.amount) for e in expenses])
    expenses_dict = [{"id": str(e.id), "amount": float(e.amount), "expense_type": e.expense_type, "description": e.description} for e in expenses]
    
    total_sales = total_cash + total_card_bbva + total_card_getnet
    
    # Accrual items
    accrual_items_db = db.query(SalesOrderItems).filter(
        SalesOrderItems.shift_session_id == session_id
    ).options(joinedload(SalesOrderItems.product), joinedload(SalesOrderItems.sales_order)).all()
    
    accrual_items = []
    total_accrual_sales = 0.0
    for ai in accrual_items_db:
        total_accrual_sales += float(ai.total or 0)
        # We mock the structure expected
        accrual_items.append({
            "id": str(ai.id),
            "qty": float(ai.qty),
            "unit_price": float(ai.unit_price),
            "total": float(ai.total or 0),
            "concept_type": ai.concept_type,
            "products": {"name": ai.product.name if ai.product else None, "sku": ai.product.sku if ai.product else None},
            # for the room breakdown hack:
            "sales_orders": {
                "id": str(ai.sales_order_id),
            }
        })
        
    return {
        "total_cash": total_cash,
        "total_card_bbva": total_card_bbva,
        "total_card_getnet": total_card_getnet,
        "total_sales": total_sales,
        "total_transactions": len(enriched_payments),
        "payments": enriched_payments,
        "salesOrders": sales_orders,
        "expenses": expenses_dict,
        "total_expenses": total_expenses,
        "total_accrual_sales": total_accrual_sales,
        "accrual_items": accrual_items,
        "unassigned_card_payments": [],
        "unhandled_payment_methods": []
    }

@router.get("/dashboard/metrics")
def get_receptionist_dashboard_metrics(
    start_date: str,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    include_global: bool = True,
    db: Session = Depends(get_db)
):
    # 1. Sales and Payments
    sales_query = db.query(SalesOrders).filter(SalesOrders.created_at >= start_date)
    payments_query = db.query(Payments).filter(Payments.created_at >= start_date, Payments.status == "PAGADO")
    items_query = db.query(SalesOrderItems)
    
    if not include_global and user_id:
        sales_query = sales_query.filter(SalesOrders.created_by == uuid.UUID(user_id))
        payments_query = payments_query.filter(Payments.created_by == uuid.UUID(user_id))
        
    if session_id:
        items_query = items_query.filter(SalesOrderItems.shift_session_id == uuid.UUID(session_id))
    else:
        items_query = items_query.filter(SalesOrderItems.created_at >= start_date)
        
    sales = sales_query.all()
    payments = payments_query.all()
    shift_items = items_query.all()
    
    # Rooms
    from models.rooms import Rooms
    open_rooms = db.query(Rooms).filter(Rooms.status == "OCUPADA").count()
    
    total_sales = len(sales)
    total_amount = sum([float(i.total or 0) for i in shift_items])
    
    cash_amount = 0.0
    card_bbva = 0.0
    card_getnet = 0.0
    
    for p in payments:
        if p.payment_method == "EFECTIVO":
            cash_amount += float(p.amount)
        elif p.payment_method == "TARJETA":
            if p.terminal_code == "GETNET":
                card_getnet += float(p.amount)
            else:
                card_bbva += float(p.amount)
        elif p.payment_method == "TARJETA_BBVA":
            card_bbva += float(p.amount)
        elif p.payment_method == "TARJETA_GETNET":
            card_getnet += float(p.amount)
            
    completed_checkouts = len([s for s in sales if s.status in ["COMPLETED", "ENDED"]])
    
    concept_breakdown = {"ROOM_BASE": 0, "EXTRA_HOUR": 0, "EXTRA_PERSON": 0, "CONSUMPTION": 0, "PRODUCT": 0}
    for item in shift_items:
        if item.is_paid:
            ctype = item.concept_type or "PRODUCT"
            if ctype in concept_breakdown:
                concept_breakdown[ctype] += float(item.total or 0)
                
    return {
        "totalSales": total_sales,
        "totalAmount": total_amount,
        "cashAmount": cash_amount,
        "cardBBVA": card_bbva,
        "cardGetnet": card_getnet,
        "openRooms": open_rooms,
        "completedCheckouts": completed_checkouts,
        "conceptBreakdown": concept_breakdown
    }

from models.hr import ShiftClosings, ShiftClosingDetails, ShiftClosingReviews

@router.get("/shift-closings/history")
def get_shift_closing_history(
    page: int = 0,
    limit: int = 15,
    employee_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ShiftClosings)
    if employee_id:
        query = query.filter(ShiftClosings.closed_by == uuid.UUID(employee_id))
    if status:
        query = query.filter(ShiftClosings.status == status)
        
    total = query.count()
    items = query.order_by(ShiftClosings.created_at.desc()).offset(page * limit).limit(limit).options(
        joinedload(ShiftClosings.closed_by_employee),
        joinedload(ShiftClosings.shift_session).joinedload(ShiftSessions.employee)
    ).all()
    
    results = []
    for item in items:
        # Fetch basic details to include in history row
        details = db.query(ShiftClosingDetails).filter(ShiftClosingDetails.shift_closing_id == item.id).first()
        review = db.query(ShiftClosingReviews).filter(ShiftClosingReviews.shift_closing_id == item.id).first()
        
        results.append({
            "id": str(item.id),
            "created_at": item.created_at.isoformat(),
            "status": item.status,
            "discrepancy_amount": float(item.discrepancy_amount or 0),
            "expected_amount": float(item.expected_amount or 0),
            "declared_amount": float(item.declared_amount or 0),
            "closed_by_employee": {"first_name": item.closed_by_employee.first_name, "last_name": item.closed_by_employee.last_name} if item.closed_by_employee else None,
            "shift_session": {
                "clock_in_at": item.shift_session.clock_in_at.isoformat() if item.shift_session and item.shift_session.clock_in_at else None,
                "clock_out_at": item.shift_session.clock_out_at.isoformat() if item.shift_session and item.shift_session.clock_out_at else None,
                "employees": {"first_name": item.shift_session.employee.first_name, "last_name": item.shift_session.employee.last_name} if item.shift_session and item.shift_session.employee else None
            } if item.shift_session else None,
            "details": {"cash_declared": float(details.cash_declared)} if details else None,
            "reviews": [{"status": review.status, "notes": review.notes}] if review else []
        })
        
    return {"items": results, "total": total}

@router.get("/shift-closings/{closing_id}")
def get_shift_closing_single(closing_id: str, db: Session = Depends(get_db)):
    item = db.query(ShiftClosings).filter(ShiftClosings.id == uuid.UUID(closing_id)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
        
    details = db.query(ShiftClosingDetails).filter(ShiftClosingDetails.shift_closing_id == item.id).first()
    review = db.query(ShiftClosingReviews).filter(ShiftClosingReviews.shift_closing_id == item.id).first()
    
    # Get associated orders and expenses just to show the data shape
    # The frontend use-shift-closing-history hook requires "sales_orders", "expenses"
    orders = db.query(SalesOrders).filter(SalesOrders.shift_session_id == item.shift_session_id).all()
    expenses = db.query(ShiftExpenses).filter(ShiftExpenses.shift_session_id == item.shift_session_id).all()
    
    data = {
        "id": str(item.id),
        "created_at": item.created_at.isoformat(),
        "status": item.status,
        "notes": item.notes,
        "discrepancy_amount": float(item.discrepancy_amount or 0),
        "expected_amount": float(item.expected_amount or 0),
        "declared_amount": float(item.declared_amount or 0),
        "shift_session": {
            "clock_in_at": item.shift_session.clock_in_at.isoformat() if item.shift_session and item.shift_session.clock_in_at else None,
            "clock_out_at": item.shift_session.clock_out_at.isoformat() if item.shift_session and item.shift_session.clock_out_at else None
        } if item.shift_session else None,
        "details": {
            "cash_expected": float(details.cash_expected),
            "cash_declared": float(details.cash_declared),
            "card_expected": float(details.card_expected),
            "card_declared": float(details.card_declared),
            "expenses_total": float(details.expenses_total)
        } if details else None,
        "reviews": [{"status": review.status, "notes": review.notes, "reviewed_by": str(review.reviewed_by)}] if review else [],
        "sales_orders": [{"id": str(o.id), "total": float(o.total or 0)} for o in orders],
        "expenses": [{"id": str(e.id), "amount": float(e.amount)} for e in expenses]
    }
    
    return data

class ReviewClosingRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None

@router.post("/shift-closings/{closing_id}/review")
def review_shift_closing(closing_id: str, req: ReviewClosingRequest, db: Session = Depends(get_db)):
    closing = db.query(ShiftClosings).filter(ShiftClosings.id == uuid.UUID(closing_id)).first()
    if not closing:
        raise HTTPException(status_code=404)
        
    closing.status = req.status
    db.commit()
    
    review = db.query(ShiftClosingReviews).filter(ShiftClosingReviews.shift_closing_id == closing.id).first()
    if review:
        review.status = req.status
        review.notes = req.notes
        review.reviewed_by = uuid.UUID(req.reviewed_by) if req.reviewed_by else None
    else:
        new_review = ShiftClosingReviews(
            shift_closing_id=closing.id,
            status=req.status,
            notes=req.notes,
            reviewed_by=uuid.UUID(req.reviewed_by) if req.reviewed_by else None
        )
        db.add(new_review)
    
    db.commit()
    return {"success": True}

@router.get("/reports/income")
def get_income_report(
    report_type: str,
    shift_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    status_filter: Optional[str] = None,
    room_filter: Optional[str] = None,
    payment_method_filter: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from models.rooms import RoomStays, Rooms
    query = db.query(RoomStays).join(Rooms)
    
    # Exclude specific rooms
    query = query.filter(Rooms.number.notin_(['13', '113', 'Habitación 13', 'Habitación 113']))
    
    if report_type == "shift" and shift_id:
        # Complex logic to get stays related to a shift...
        # For simplicity in migration, just query by time if shift is provided
        shift = db.query(ShiftSessions).filter(ShiftSessions.id == uuid.UUID(shift_id)).first()
        if shift:
            query = query.filter(RoomStays.check_in_at >= shift.clock_in_at)
            if shift.clock_out_at:
                query = query.filter(RoomStays.check_in_at <= shift.clock_out_at)
    elif report_type == "dateRange":
        if start_date:
            query = query.filter(RoomStays.check_in_at >= start_date)
        if end_date:
            query = query.filter(RoomStays.check_in_at <= f"{end_date} 23:59:59")
            
    if status_filter and status_filter != "all":
        query = query.filter(RoomStays.status == status_filter)
    else:
        query = query.filter(RoomStays.status.in_(["ACTIVA", "FINALIZADA", "CANCELADA"]))
        
    stays = query.options(
        joinedload(RoomStays.room),
        joinedload(RoomStays.sales_order).joinedload(SalesOrders.sales_order_items),
        joinedload(RoomStays.sales_order).joinedload(SalesOrders.payments)
    ).all()
    
    entries = []
    
    for idx, stay in enumerate(stays):
        if room_filter and room_filter != "all" and stay.room.number != room_filter:
            continue
            
        order = stay.sales_order
        items = []
        payments = []
        if order:
            items = order.sales_order_items
            payments = order.payments
            
        if report_type == "shift" and shift_id:
            items = [i for i in items if str(i.shift_session_id) == shift_id]
            payments = [p for p in payments if str(p.shift_session_id) == shift_id]
            
        valid_payments = [p for p in payments if p.status != "PENDIENTE" and (p.concept or "").upper() != "CHECKOUT" and p.payment_method != "PENDIENTE"]
        
        # Deduplicate
        unique_payments = {}
        for p in valid_payments:
            key = f"{p.amount}-{p.payment_method}-{p.card_last_4 or 'none'}"
            if key not in unique_payments or p.concept:
                unique_payments[key] = p
        
        final_payments = list(unique_payments.values())
        
        room_price = sum([float(i.unit_price * i.qty) for i in items if i.concept_type == "ROOM_BASE"])
        extra = sum([float(i.unit_price * i.qty) for i in items if i.concept_type in ["EXTRA_PERSON", "EXTRA_HOUR", "RENEWAL", "PROMO_4H"]])
        consumption = sum([float(i.unit_price * i.qty) for i in items if i.concept_type in ["CONSUMPTION", "PRODUCT", "RESTAURANT"]])
        
        payment_method_label = "PENDIENTE"
        if len(final_payments) > 0:
            methods = set([p.payment_method for p in final_payments])
            payment_method_label = "MIXTO" if len(methods) > 1 else final_payments[0].payment_method
            
        if payment_method_filter and payment_method_filter != "all" and payment_method_label != payment_method_filter:
            continue
            
        card_payment = next((p for p in final_payments if p.payment_method == "TARJETA"), None)
        
        entries.append({
            "no": idx + 1,
            "time": stay.check_in_at.strftime("%H:%M") if stay.check_in_at else "",
            "vehicle_plate": stay.vehicle_plate or "",
            "room_number": stay.room.number if stay.room else "",
            "room_price": room_price,
            "extra": extra,
            "consumption": consumption,
            "total": room_price + extra + consumption,
            "payment_method": payment_method_label,
            "card_type": card_payment.card_type if card_payment else None,
            "card_last_4": card_payment.card_last_4 if card_payment else None,
            "terminal_code": card_payment.terminal_code if card_payment else None,
            "stay_status": stay.status,
            "checkout_valet_name": "—", # Skipping relations for simplicity
            "payments": [{"payment_method": p.payment_method, "amount": float(p.amount), "card_type": p.card_type, "card_last_4": p.card_last_4, "terminal_code": p.terminal_code} for p in final_payments]
        })
        
    return {"entries": entries}

# --- SHIFT CLOSING HISTORY & DETAILS ---
@router.get("/shift-closings/history")
def get_shift_closings_history(
    page: int = 1,
    limit: int = 20,
    status_filter: str = "all",
    employee_id: str = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user)
):
    from sqlalchemy import func
    
    query = db.query(ShiftClosings)
    
    # Simple role check
    user_emp = db.query(Employees).filter(Employees.auth_user_id == current_user.sub).first()
    is_admin = user_emp and user_emp.role in ["admin", "manager"]
    
    if not is_admin and employee_id:
        query = query.filter(ShiftClosings.employee_id == uuid.UUID(employee_id))
    elif employee_id:
        query = query.filter(ShiftClosings.employee_id == uuid.UUID(employee_id))
        
    if status_filter != "all":
        query = query.filter(ShiftClosings.status == status_filter)
        
    total = query.count()
    offset = (page - 1) * limit
    closings = query.order_by(ShiftClosings.created_at.desc()).offset(offset).limit(limit).all()
    
    results = []
    for c in closings:
        emp = db.query(Employees).filter(Employees.id == c.employee_id).first()
        shift = db.query(ShiftDefinitions).filter(ShiftDefinitions.id == c.shift_id).first()
        c_dict = {col.name: getattr(c, col.name) for col in c.__table__.columns}
        c_dict["employees"] = {"first_name": emp.first_name, "last_name": emp.last_name} if emp else None
        c_dict["shift_definitions"] = {"name": shift.name, "start_time": str(shift.start_time), "end_time": str(shift.end_time)} if shift else None
        results.append(c_dict)
        
    return {"data": results, "total": total}

@router.get("/shift-closings/{id}/details")
def get_shift_closing_details(id: str, db: Session = Depends(get_db)):
    from models.sales import SalesOrders, Payments, SalesOrderItems
    from models.rooms import RoomStays, Rooms, RoomTypes
    from models.inventory import Products
    
    # 1. Fetch closing details
    query = text("""
        SELECT d.*, 
               p.amount as payment_amount, p.payment_method as payment_method, 
               p.reference as payment_reference, p.concept as payment_concept,
               p.terminal_code, p.created_at as payment_created_at, p.sales_order_id,
               so.total as order_total, so.remaining_amount, so.status as order_status,
               rs.id as stay_id, r.number as room_number, rt.name as room_type_name
        FROM shift_closing_details d
        LEFT JOIN payments p ON p.id = d.payment_id
        LEFT JOIN sales_orders so ON so.id = p.sales_order_id
        LEFT JOIN room_stays rs ON rs.sales_order_id = so.id
        LEFT JOIN rooms r ON r.id = rs.room_id
        LEFT JOIN room_types rt ON rt.id = r.room_type_id
        WHERE d.shift_closing_id = :closing_id
    """)
    result = db.execute(query, {"closing_id": id})
    rows = result.mappings().all()
    
    details = []
    order_ids = set()
    for r in rows:
        r_dict = dict(r)
        
        # Build nested payment
        if r_dict.get('payment_amount') is not None:
            r_dict['payments'] = {
                "amount": r_dict.get('payment_amount'),
                "payment_method": r_dict.get('payment_method'),
                "reference": r_dict.get('payment_reference'),
                "concept": r_dict.get('payment_concept'),
                "terminal_code": r_dict.get('terminal_code'),
                "created_at": r_dict.get('payment_created_at'),
                "sales_order_id": r_dict.get('sales_order_id'),
                "sales_orders": {
                    "total": r_dict.get('order_total'),
                    "remaining_amount": r_dict.get('remaining_amount'),
                    "status": r_dict.get('order_status'),
                    "room_stays": [{
                        "id": str(r_dict.get('stay_id')),
                        "rooms": {
                            "number": r_dict.get('room_number'),
                            "room_types": {"name": r_dict.get('room_type_name')}
                        }
                    }] if r_dict.get('stay_id') else []
                } if r_dict.get('order_total') is not None else None
            }
            if r_dict.get('sales_order_id'):
                order_ids.add(str(r_dict.get('sales_order_id')))
        details.append(r_dict)
        
    # 2. Fetch related SalesOrders with items
    sales_orders = []
    if order_ids:
        so_query = text("""
            SELECT so.id, so.created_at, so.total, so.paid_amount, so.remaining_amount, so.status,
                   rs.id as stay_id, r.number as room_number, rt.name as room_type_name
            FROM sales_orders so
            LEFT JOIN room_stays rs ON rs.sales_order_id = so.id
            LEFT JOIN rooms r ON r.id = rs.room_id
            LEFT JOIN room_types rt ON rt.id = r.room_type_id
            WHERE so.id = ANY(:order_ids)
        """)
        so_rows = db.execute(so_query, {"order_ids": list(order_ids)}).mappings().all()
        
        items_query = text("""
            SELECT i.id, i.qty, i.unit_price, i.total, i.concept_type, i.is_paid, i.paid_at, 
                   i.payment_method, i.sales_order_id, p.name as product_name, p.sku as product_sku
            FROM sales_order_items i
            LEFT JOIN products p ON p.id = i.product_id
            WHERE i.sales_order_id = ANY(:order_ids)
        """)
        items_rows = db.execute(items_query, {"order_ids": list(order_ids)}).mappings().all()
        
        for so in so_rows:
            so_dict = dict(so)
            so_dict['room_stays'] = [{
                "id": str(so_dict.get('stay_id')),
                "rooms": {
                    "number": so_dict.get('room_number'),
                    "room_types": {"name": so_dict.get('room_type_name')}
                }
            }] if so_dict.get('stay_id') else []
            
            # Find items for this order
            so_dict['sales_order_items'] = []
            for item in items_rows:
                if str(item['sales_order_id']) == str(so_dict['id']):
                    item_dict = dict(item)
                    item_dict['products'] = {
                        "name": item_dict.get('product_name'),
                        "sku": item_dict.get('product_sku')
                    } if item_dict.get('product_name') else None
                    so_dict['sales_order_items'].append(item_dict)
            
            sales_orders.append(so_dict)
            
    # 3. Fetch reviews
    reviews_query = text("""
        SELECT r.*, e.first_name, e.last_name
        FROM shift_closing_reviews r
        LEFT JOIN employees e ON e.id = r.reviewer_id
        WHERE r.shift_closing_id = :closing_id
    """)
    reviews_rows = db.execute(reviews_query, {"closing_id": id}).mappings().all()
    reviews = []
    for rev in reviews_rows:
        rev_dict = dict(rev)
        rev_dict['employees'] = {
            "first_name": rev_dict.get('first_name'),
            "last_name": rev_dict.get('last_name')
        }
        reviews.append(rev_dict)

    return {
        "details": details,
        "sales_orders": sales_orders,
        "reviews": reviews
    }
