from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db, engine, get_db_connection
from psycopg2.extras import RealDictCursor
from auth_utils import get_current_user, CurrentUser

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/db-test")
def test_db_connection(db: Session = Depends(get_db)):
    if not engine:
        raise HTTPException(status_code=500, detail="DATABASE_URL no está configurada")
    
    try:
        result = db.execute(text("SELECT version();"))
        version = result.scalar()
        return {"status": "success", "message": "¡Conectado a AWS RDS exitosamente!", "db_version": version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error conectando a la BD: {str(e)}")

@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """))
        tables = [row[0] for row in result.fetchall()]
        return {"status": "success", "table_count": len(tables), "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo tablas: {str(e)}")

from pydantic import BaseModel
from typing import Dict, Any

class ValetNotificationRequest(BaseModel):
    title: str
    message: str
    data: Dict[str, Any]

@router.post("/notifications/valets")
def notify_valets(req: ValetNotificationRequest, db: Session = Depends(get_db)):
    import json
    query = text("SELECT send_valet_notification(:p_title, :p_message, :p_data::jsonb)")
    try:
        result = db.execute(query, {
            "p_title": req.title,
            "p_message": req.message,
            "p_data": json.dumps(req.data)
        }).scalar()
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from models.system import AuditLogs
from sqlalchemy import or_, func, desc
from datetime import datetime
from typing import Optional

@router.get("/logs")
def get_system_logs(
    page: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    category: Optional[str] = "all",
    severity: Optional[str] = "all",
    employee_id: Optional[str] = None,
    room_number: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(AuditLogs)
    
    if category == "alerts":
        query = query.filter(AuditLogs.severity.in_(["WARNING", "ERROR", "CRITICAL"]))
    elif category == "reception":
        query = query.filter(AuditLogs.event_type.in_(["RECEPTION_ACTION"]))
    elif category == "payments":
        query = query.filter(AuditLogs.event_type.in_(["PAYMENT_CREATED", "PAYMENT_PROCESSED", "PAYMENT_UPDATED", "DATA_CHANGE"]))
    elif category == "auth":
        query = query.filter(AuditLogs.event_type.in_(["AUTH_EVENT"]))
    elif category == "system":
        query = query.filter(AuditLogs.event_type.in_(["SYSTEM_EVENT", "SYSTEM_MAINTENANCE"]))

    if severity and severity != "all":
        query = query.filter(AuditLogs.severity == severity)
        
    if search:
        query = query.filter(or_(
            AuditLogs.description.ilike(f"%{search}%"),
            AuditLogs.employee_name.ilike(f"%{search}%"),
            AuditLogs.action.ilike(f"%{search}%")
        ))
        
    if employee_id:
        query = query.filter(AuditLogs.employee_id == employee_id)
        
    if room_number:
        query = query.filter(AuditLogs.room_number == room_number)
        
    if date_from:
        query = query.filter(AuditLogs.created_at >= f"{date_from} 00:00:00")
        
    if date_to:
        query = query.filter(AuditLogs.created_at <= f"{date_to} 23:59:59")
        
    total = query.count()
    items = query.order_by(AuditLogs.created_at.desc()).offset(page * limit).limit(limit).all()
    
    return {"items": items, "total": total}

@router.get("/logs/stats")
def get_logs_stats(date_from: Optional[str] = None, db: Session = Depends(get_db)):
    if not date_from:
        date_from = datetime.now().strftime("%Y-%m-%d")
        
    base_query = db.query(AuditLogs).filter(AuditLogs.created_at >= f"{date_from} 00:00:00")
    
    total = base_query.count()
    reception = base_query.filter(AuditLogs.event_type == "RECEPTION_ACTION").count()
    payments = base_query.filter(AuditLogs.event_type.in_(["PAYMENT_CREATED", "PAYMENT_PROCESSED", "DATA_CHANGE"])).count()
    auth = base_query.filter(AuditLogs.event_type == "AUTH_EVENT").count()
    alerts = base_query.filter(AuditLogs.severity.in_(["WARNING", "ERROR", "CRITICAL"])).count()
    
    # Group by employee name
    emp_stats = db.query(
        AuditLogs.employee_name, 
        func.count(AuditLogs.id).label('count')
    ).filter(
        AuditLogs.created_at >= f"{date_from} 00:00:00",
        AuditLogs.employee_name.isnot(None)
    ).group_by(AuditLogs.employee_name).order_by(desc('count')).limit(10).all()
    
    by_employee = [{"name": r[0], "count": r[1]} for r in emp_stats]
    
    return {
        "total": total,
        "reception": reception,
        "payments": payments,
        "auth": auth,
        "alerts": alerts,
        "byEmployee": by_employee
    }

class TelemetryEvent(BaseModel):
    event_type: str
    component: str
    action: str
    metadata: Optional[Any] = None
    level: str = "INFO"

@router.post("/telemetry")
def record_telemetry(events: list[TelemetryEvent], db: Session = Depends(get_db)):
    # Very simplified log insertion for telemetry
    import json
    for ev in events:
        log = AuditLogs(
            event_type=ev.event_type,
            action=ev.action,
            description=ev.component,
            severity=ev.level,
            metadata_=ev.metadata,
            source="telemetry"
        )
        db.add(log)
    db.commit()
    return {"success": True}

from models.system import SystemTelemetry
from models.hr import Employees, ShiftSessions
import uuid

@router.get("/telemetry/metadata")
def get_telemetry_metadata(db: Session = Depends(get_db)):
    emps = db.query(Employees).filter(Employees.auth_user_id.isnot(None)).all()
    employees_list = [{"id": str(e.auth_user_id), "name": f"{e.first_name} {e.last_name}".strip()} for e in emps]
    
    shifts = db.query(ShiftSessions).order_by(ShiftSessions.clock_in_at.desc()).limit(20).all()
    shifts_list = []
    for s in shifts:
        emp = db.query(Employees).filter(Employees.id == s.employee_id).first()
        shifts_list.append({
            "id": str(s.id),
            "name": f"{emp.first_name if emp else 'Turno'} - {s.clock_in_at.strftime('%x')}",
            "start": s.clock_in_at.isoformat() if s.clock_in_at else None,
            "end": s.clock_out_at.isoformat() if s.clock_out_at else None
        })
        
    return {"employees": employees_list, "shifts": shifts_list}

@router.get("/telemetry")
def get_telemetry(
    page: int = 0,
    limit: int = 100,
    action_type: Optional[str] = "ALL",
    module: Optional[str] = "ALL",
    status: Optional[str] = "ALL",
    search: Optional[str] = None,
    user_id: Optional[str] = "ALL",
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SystemTelemetry)
    
    if action_type != "ALL":
        query = query.filter(SystemTelemetry.action_type == action_type)
    if module != "ALL":
        query = query.filter(SystemTelemetry.module == module)
    if status == "SUCCESS":
        query = query.filter(SystemTelemetry.is_success == True)
    elif status == "ERROR":
        query = query.filter(SystemTelemetry.is_success == False)
    if user_id != "ALL":
        query = query.filter(SystemTelemetry.user_id == uuid.UUID(user_id))
    if date_from:
        query = query.filter(SystemTelemetry.created_at >= date_from)
    if date_to:
        query = query.filter(SystemTelemetry.created_at <= date_to)
    if search:
        query = query.filter(or_(
            SystemTelemetry.action_name.ilike(f"%{search}%"),
            SystemTelemetry.endpoint.ilike(f"%{search}%")
        ))
        
    total = query.count()
    items = query.order_by(SystemTelemetry.created_at.desc()).offset(page * limit).limit(limit).all()
    
    # Resolve employee names
    resolved_items = []
    for item in items:
        item_dict = {c.name: getattr(item, c.name) for c.table.columns in item.__table__.columns}
        if item.user_id:
            emp = db.query(Employees).filter(Employees.auth_user_id == item.user_id).first()
            item_dict["employee_name"] = f"{emp.first_name} {emp.last_name}".strip() if emp else "Sistema / Anónimo"
        else:
            item_dict["employee_name"] = "Sistema / Anónimo"
        resolved_items.append(item_dict)
        
    return {"items": resolved_items, "total": total}

@router.get("/info/room/{room_id}")
def get_room_info(room_id: str, db: Session = Depends(get_db)):
    from models.rooms import Rooms
    room = db.query(Rooms).filter(Rooms.id == uuid.UUID(room_id)).first()
    return {"number": room.number if room else "??"}

@router.get("/info/employee/{employee_id}")
def get_employee_info(employee_id: str, db: Session = Depends(get_db)):
    from models.hr import Employees
    emp = db.query(Employees).filter(Employees.id == uuid.UUID(employee_id)).first()
    return {"first_name": emp.first_name if emp else "Cochero"}

@router.get("/info/order-room/{order_id}")
def get_order_room_info(order_id: str, db: Session = Depends(get_db)):
    from models.rooms import RoomStays, Rooms
    stay = db.query(RoomStays).join(Rooms).filter(RoomStays.sales_order_id == uuid.UUID(order_id)).first()
    if stay and stay.room:
        return {"number": stay.room.number}
    return {"number": "??"}

from models.base import Base
from sqlalchemy import Table, MetaData, insert, update, select
from typing import Dict, Any, List

def get_table(table_name: str) -> Table:
    if table_name not in Base.metadata.tables:
        raise HTTPException(status_code=400, detail=f"Table {table_name} does not exist or is not registered")
    return Base.metadata.tables[table_name]

@router.post("/crud/{table_name}")
def generic_create(table_name: str, payload: Dict[str, Any] | List[Dict[str, Any]], db: Session = Depends(get_db)):
    table = get_table(table_name)
    try:
        if isinstance(payload, list):
            stmt = insert(table).values(payload).returning(*table.c)
        else:
            stmt = insert(table).values(**payload).returning(*table.c)
            
        result = db.execute(stmt)
        db.commit()
        
        # Return the inserted row(s) to mimic Supabase .select() behavior
        rows = [dict(r) for r in result.mappings().all()]
        
        if not isinstance(payload, list) and len(rows) == 1:
            return rows[0]
            
        return rows
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/crud/{table_name}/{id}")
def generic_update(table_name: str, id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    table = get_table(table_name)
    try:
        # Assuming the primary key is 'id'
        stmt = update(table).where(table.c.id == id).values(**payload).returning(*table.c)
        result = db.execute(stmt)
        db.commit()
        
        row = result.mappings().first()
        if row:
            return dict(row)
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from sqlalchemy import delete

@router.delete("/crud/{table_name}/{id}")
def generic_delete(table_name: str, id: str, db: Session = Depends(get_db)):
    table = get_table(table_name)
    try:
        stmt = delete(table).where(table.c.id == id)
        db.execute(stmt)
        db.commit()
        return {"status": "success"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import Request

@router.get("/crud/{table_name}/{id}")
def generic_read_by_id(table_name: str, id: str, db: Session = Depends(get_db)):
    table = get_table(table_name)
    try:
        stmt = select(table).where(table.c.id == id)
        result = db.execute(stmt)
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return dict(row)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/crud/{table_name}")
def generic_read(table_name: str, request: Request, limit: int = 100, db: Session = Depends(get_db)):
    table = get_table(table_name)
    try:
        stmt = select(table)
        
        # Apply filters from query params
        for key, value in request.query_params.items():
            if key in ('limit', 'offset', 'order', 'select'): continue
            if key in table.columns:
                col = table.c[key]
                if isinstance(value, str):
                    prefix_val = value
                    
                    if prefix_val.startswith("eq."):
                        v = prefix_val[3:]
                        if v.lower() == 'true': v = True
                        elif v.lower() == 'false': v = False
                        elif v.lower() == 'null': v = None
                        stmt = stmt.where(col == v)
                    elif prefix_val.startswith("neq."):
                        v = prefix_val[4:]
                        if v.lower() == 'true': v = True
                        elif v.lower() == 'false': v = False
                        elif v.lower() == 'null': v = None
                        stmt = stmt.where(col != v)
                    elif prefix_val.startswith("gt."):
                        stmt = stmt.where(col > prefix_val[3:])
                    elif prefix_val.startswith("gte."):
                        stmt = stmt.where(col >= prefix_val[4:])
                    elif prefix_val.startswith("lt."):
                        stmt = stmt.where(col < prefix_val[3:])
                    elif prefix_val.startswith("lte."):
                        stmt = stmt.where(col <= prefix_val[4:])
                    elif prefix_val == "is.null":
                        stmt = stmt.where(col.is_(None))
                    elif prefix_val == "not.is.null" or prefix_val == "is.not.null":
                        stmt = stmt.where(col.isnot(None))
                    elif prefix_val.startswith("in."):
                        vals = prefix_val[3:].strip("()").split(",")
                        stmt = stmt.where(col.in_(vals))
                    elif prefix_val.startswith("not.in."):
                        vals = prefix_val[7:].strip("()").split(",")
                        stmt = stmt.where(~col.in_(vals))
                    else:
                        v = prefix_val
                        if str(v).lower() == 'true': v = True
                        elif str(v).lower() == 'false': v = False
                        stmt = stmt.where(col == v)
                else:
                    stmt = stmt.where(table.c[key] == value)
                
        # Handle simple ordering
        order = request.query_params.get('order')
        if order:
            parts = order.split('.')
            col_name = parts[0]
            direction = parts[1] if len(parts) > 1 else 'asc'
            if col_name in table.columns:
                col = table.c[col_name]
                if direction == 'desc':
                    stmt = stmt.order_by(col.desc())
                else:
                    stmt = stmt.order_by(col.asc())
                    
        stmt = stmt.limit(limit)
        result = db.execute(stmt)
        rows = result.mappings().all()
        return [dict(r) for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs/metrics-dashboard")
def get_audit_metrics_dashboard(db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    
    today_start = datetime.now().strftime("%Y-%m-%d 00:00:00")
    yesterday_start = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d 00:00:00")
    
    today_events = db.query(AuditLogs).filter(AuditLogs.created_at >= today_start).count()
    yesterday_events = db.query(AuditLogs).filter(
        AuditLogs.created_at >= yesterday_start,
        AuditLogs.created_at < today_start
    ).count()
    
    reception_actions = db.query(AuditLogs).filter(
        AuditLogs.created_at >= today_start
        # If there's a specific filter for reception, we can add it here. The frontend didn't have one in the `.eq` in the snippet, just a count.
    ).count()
    
    cancellations = db.query(AuditLogs).filter(
        AuditLogs.action.in_(["CANCEL_ITEM", "CANCEL_CHARGE", "COURTESY"]),
        AuditLogs.created_at >= today_start
    ).count()
    
    active_users_result = db.query(AuditLogs.employee_id).filter(
        AuditLogs.created_at >= today_start,
        AuditLogs.employee_id.isnot(None)
    ).distinct().all()
    active_users = len(active_users_result)
    
    return {
        "todayEvents": today_events,
        "yesterdayEvents": yesterday_events,
        "receptionActions": reception_actions,
        "cancellations": cancellations,
        "activeUsers": active_users
    }

@router.get("/analytics/executive-raw")
def get_executive_raw_data(days: int = 30, db: Session = Depends(get_db)):
    from datetime import datetime, timedelta
    from sqlalchemy import text
    from models.sales import Payments
    from models.rooms import RoomStays
    from models.hr import ShiftDefinitions, ShiftSessions
    
    from_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00")
    
    stays_query = text("""
        SELECT id, created_at, check_in_at, check_out_at, status, room_id
        FROM room_stays
        WHERE created_at >= :from_date
    """)
    stays = [dict(r) for r in db.execute(stays_query, {"from_date": from_date}).mappings().all()]
    
    payments_query = text("""
        SELECT id, amount, created_at, status, payment_method
        FROM payments
        WHERE created_at >= :from_date
    """)
    payments = [dict(r) for r in db.execute(payments_query, {"from_date": from_date}).mappings().all()]
    
    shifts_query = text("""
        SELECT id, shift_type, start_time, end_time, created_at
        FROM shifts
        WHERE created_at >= :from_date
    """)
    # Wait, the table might be shift_definitions. The frontend queried 'shifts'. Let's see if the table exists.
    try:
        shifts = [dict(r) for r in db.execute(shifts_query, {"from_date": from_date}).mappings().all()]
    except Exception:
        shifts = []
        
    return {
        "room_stays": stays,
        "payments": payments,
        "shifts": shifts
    }

@router.get("/analytics/hp-income-report/{shift_session_id}")
def get_hp_income_report_data(shift_session_id: str, db: Session = Depends(get_db)):
    from sqlalchemy import text
    
    # 1. Items and payments to find sales_order_ids
    items_query = text("SELECT sales_order_id FROM sales_order_items WHERE shift_session_id = :sid AND sales_order_id IS NOT NULL")
    payments_query = text("SELECT sales_order_id FROM payments WHERE shift_session_id = :sid AND sales_order_id IS NOT NULL")
    
    item_rows = db.execute(items_query, {"sid": shift_session_id}).fetchall()
    payment_rows = db.execute(payments_query, {"sid": shift_session_id}).fetchall()
    
    order_ids = set([r[0] for r in item_rows] + [r[0] for r in payment_rows])
    if not order_ids:
        return {"stays": []}
        
    # 2. room_stays
    stays_query = text("""
        SELECT rs.id, rs.check_in_at, rs.vehicle_plate, rs.status, rs.sales_order_id,
               e.first_name as valet_first_name, e.last_name as valet_last_name,
               r.number as room_number
        FROM room_stays rs
        LEFT JOIN employees e ON e.id = rs.checkout_valet_employee_id
        JOIN rooms r ON r.id = rs.room_id
        WHERE rs.sales_order_id = ANY(:order_ids)
          AND rs.status IN ('ACTIVA', 'FINALIZADA', 'CANCELADA')
        ORDER BY rs.check_in_at ASC
    """)
    stays = db.execute(stays_query, {"order_ids": list(order_ids)}).mappings().all()
    
    # 3. sales_orders
    orders_query = text("""
        SELECT so.id, so.total
        FROM sales_orders so
        WHERE so.id = ANY(:order_ids)
    """)
    orders = {str(r['id']): dict(r) for r in db.execute(orders_query, {"order_ids": list(order_ids)}).mappings().all()}
    
    # 4. payments for these orders
    all_payments_query = text("""
        SELECT id, amount, payment_method, concept, status, terminal_code, card_type, shift_session_id, sales_order_id
        FROM payments
        WHERE sales_order_id = ANY(:order_ids)
    """)
    all_payments = db.execute(all_payments_query, {"order_ids": list(order_ids)}).mappings().all()
    
    # 5. items for these orders
    all_items_query = text("""
        SELECT id, concept_type, unit_price, qty, shift_session_id, sales_order_id
        FROM sales_order_items
        WHERE sales_order_id = ANY(:order_ids)
    """)
    all_items = db.execute(all_items_query, {"order_ids": list(order_ids)}).mappings().all()
    
    # Assembly
    results = []
    for stay in stays:
        stay_dict = dict(stay)
        so_id = str(stay['sales_order_id'])
        
        stay_dict['checkout_valet'] = {
            "first_name": stay['valet_first_name'],
            "last_name": stay['valet_last_name']
        } if stay['valet_first_name'] else None
        
        stay_dict['rooms'] = {"number": stay['room_number']}
        
        order = orders.get(so_id, {})
        order['payments'] = [dict(p) for p in all_payments if str(p['sales_order_id']) == so_id]
        order['sales_order_items'] = [dict(i) for i in all_items if str(i['sales_order_id']) == so_id]
        
        stay_dict['sales_orders'] = [order]
        results.append(stay_dict)
        
    return {"stays": results}
    
@router.get("/analytics/reprint-tickets")
def get_reprint_tickets_raw(from_date: str, to_date: str, db: Session = Depends(get_db)):
    from sqlalchemy import text
    
    entries_query = text("""
        SELECT rs.id, rs.check_in_at, rs.expected_check_out_at, rs.current_people, rs.total_people, rs.vehicle_plate,
               rs.vehicle_brand, rs.vehicle_model, rs.tolerance_started_at, rs.tolerance_type, rs.status,
               r.number as room_number, rt.name as room_type_name, rt.base_price, rt.extra_person_price,
               so.id as so_id, so.total, so.remaining_amount
        FROM room_stays rs
        JOIN rooms r ON r.id = rs.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        LEFT JOIN sales_orders so ON so.id = rs.sales_order_id
        WHERE rs.check_in_at >= :from_date AND rs.check_in_at <= :to_date
          AND rs.status IN ('ACTIVA', 'FINALIZADA')
    """)
    entries = [dict(r) for r in db.execute(entries_query, {"from_date": from_date, "to_date": to_date}).mappings().all()]
    
    checkouts_query = text("""
        SELECT rs.id, rs.check_in_at, rs.actual_check_out_at, rs.total_people, rs.vehicle_plate, rs.sales_order_id,
               r.number as room_number, rt.name as room_type_name,
               so.id as so_id, so.total, so.remaining_amount
        FROM room_stays rs
        JOIN rooms r ON r.id = rs.room_id
        JOIN room_types rt ON rt.id = r.room_type_id
        LEFT JOIN sales_orders so ON so.id = rs.sales_order_id
        WHERE rs.actual_check_out_at >= :from_date AND rs.actual_check_out_at <= :to_date
          AND rs.status = 'FINALIZADA'
    """)
    checkouts = [dict(r) for r in db.execute(checkouts_query, {"from_date": from_date, "to_date": to_date}).mappings().all()]
    
    consumptions_query = text("""
        SELECT i.id, i.qty, i.unit_price, i.total, i.created_at, i.concept_type, i.is_courtesy,
               p.name as product_name,
               so.id as so_id, r.number as room_number
        FROM sales_order_items i
        LEFT JOIN products p ON p.id = i.product_id
        LEFT JOIN sales_orders so ON so.id = i.sales_order_id
        LEFT JOIN room_stays rs ON rs.sales_order_id = so.id
        LEFT JOIN rooms r ON r.id = rs.room_id
        WHERE i.concept_type = 'CONSUMPTION'
          AND i.created_at >= :from_date AND i.created_at <= :to_date
    """)
    consumptions = [dict(r) for r in db.execute(consumptions_query, {"from_date": from_date, "to_date": to_date}).mappings().all()]
    
    payments_query = text("""
        SELECT p.id, p.amount, p.payment_method, p.concept, p.created_at, p.status, p.sales_order_id,
               r.number as room_number, i.qty, i.unit_price, i.concept_type, pr.name as product_name
        FROM payments p
        LEFT JOIN sales_orders so ON so.id = p.sales_order_id
        LEFT JOIN room_stays rs ON rs.sales_order_id = so.id
        LEFT JOIN rooms r ON r.id = rs.room_id
        LEFT JOIN sales_order_items i ON i.sales_order_id = so.id
        LEFT JOIN products pr ON pr.id = i.product_id
        WHERE p.status = 'confirmed'
          AND p.created_at >= :from_date AND p.created_at <= :to_date
    """)
    payments = [dict(r) for r in db.execute(payments_query, {"from_date": from_date, "to_date": to_date}).mappings().all()]
    
    closings_query = text("""
        SELECT c.id, c.period_start, c.period_end, c.total_cash, c.total_card_bbva, c.total_card_getnet, c.total_sales, 
               c.total_transactions, c.counted_cash, c.cash_difference, c.notes, c.status, c.employee_id, c.shift_session_id,
               e.first_name, e.last_name, sd.name as shift_name
        FROM shift_closings c
        LEFT JOIN employees e ON e.id = c.employee_id
        LEFT JOIN shift_sessions ss ON ss.id = c.shift_session_id
        LEFT JOIN shift_definitions sd ON sd.id = ss.shift_definition_id
        WHERE c.status IN ('pending', 'approved', 'rejected')
          AND c.period_end >= :from_date AND c.period_end <= :to_date
    """)
    closings = [dict(r) for r in db.execute(closings_query, {"from_date": from_date, "to_date": to_date}).mappings().all()]
    
    # Let's add extra data for entries/checkouts like payments and items
    so_ids = list(set([str(r['so_id']) for r in entries if r['so_id']] + [str(r['so_id']) for r in checkouts if r['so_id']]))
    extra_items = []
    extra_payments = []
    if so_ids:
        ei_q = text("SELECT sales_order_id, concept_type, unit_price, qty FROM sales_order_items WHERE sales_order_id = ANY(:ids)")
        extra_items = [dict(r) for r in db.execute(ei_q, {"ids": so_ids}).mappings().all()]
        ep_q = text("SELECT sales_order_id, amount, payment_method, created_at FROM payments WHERE sales_order_id = ANY(:ids)")
        extra_payments = [dict(r) for r in db.execute(ep_q, {"ids": so_ids}).mappings().all()]
        
    return {
        "entries": entries,
        "checkouts": checkouts,
        "consumptions": consumptions,
        "payments": payments,
        "closings": closings,
        "extra_items": extra_items,
        "extra_payments": extra_payments
    }

@router.get("/analytics/dashboard-summary")
def get_dashboard_summary(start_date: str, db: Session = Depends(get_db)):
    from sqlalchemy import text
    
    sales_query = text("SELECT id, total, status FROM sales_orders WHERE created_at >= :start_date")
    sales = [dict(r) for r in db.execute(sales_query, {"start_date": start_date}).mappings().all()]
    
    payments_query = text("SELECT amount, payment_method, terminal_code FROM payments WHERE created_at >= :start_date")
    payments = [dict(r) for r in db.execute(payments_query, {"start_date": start_date}).mappings().all()]
    
    items_query = text("SELECT concept_type, total, is_paid FROM sales_order_items WHERE created_at >= :start_date")
    shift_items = [dict(r) for r in db.execute(items_query, {"start_date": start_date}).mappings().all()]
    
    rooms_query = text("SELECT COUNT(id) as count FROM rooms")
    open_rooms = db.execute(rooms_query).scalar()
    
    return {
        "sales": sales,
        "payments": payments,
        "shiftItems": shift_items,
        "openRooms": open_rooms
    }

@router.get("/analytics/prediction-raw-data")
def get_prediction_raw_data(db: Session = Depends(get_db)):
    from sqlalchemy import text
    from datetime import datetime, timedelta
    
    thirty_days_ago = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # 1. Historical stays (last 30 days)
    stays_query = text("SELECT id, created_at, check_in_at, check_out_at, status FROM room_stays WHERE created_at >= :start AND created_at <= :end")
    stays = [dict(r) for r in db.execute(stays_query, {"start": thirty_days_ago, "end": today_str + " 23:59:59"}).mappings().all()]
    
    # 2. Historical payments
    payments_query = text("SELECT id, created_at, amount, status FROM payments WHERE created_at >= :start AND created_at <= :end")
    payments = [dict(r) for r in db.execute(payments_query, {"start": thirty_days_ago, "end": today_str + " 23:59:59"}).mappings().all()]
    
    # 3. Total rooms
    rooms_query = text("SELECT id FROM rooms")
    rooms = [dict(r) for r in db.execute(rooms_query).mappings().all()]
    
    return {
        "stays": stays,
        "payments": payments,
        "rooms": rooms
    }

@router.get("/auth/me")
def get_auth_me(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    from models.hr import Employees, ShiftSessions
    
    # Prioridad 1: Por auth_user_id
    employee = db.query(Employees).filter(Employees.auth_user_id == current_user.id).first()
    
    # Prioridad 2: Por email
    if not employee and current_user.email:
        employee = db.query(Employees).filter(Employees.email == current_user.email).first()
        if employee and not employee.auth_user_id:
            employee.auth_user_id = current_user.id
            db.commit()
            db.refresh(employee)
            
    if not employee:
        # Si no hay empleado asociado, devuelve info base del current_user (posible Admin root)
        return {
            "role": "admin",
            "employeeId": None,
            "employeeName": current_user.email or "Admin",
            "userId": current_user.id,
            "userEmail": current_user.email,
            "hasActiveShift": False
        }
        
    # Verificar turno activo
    active_shift = db.query(ShiftSessions).filter(
        ShiftSessions.employee_id == employee.id,
        ShiftSessions.status == "active"
    ).first()
    
    return {
        "role": employee.role,
        "employeeId": str(employee.id),
        "employeeName": f"{employee.first_name} {employee.last_name}",
        "userId": current_user.id,
        "userEmail": current_user.email,
        "hasActiveShift": active_shift is not None
    }

from pydantic import BaseModel
from typing import Optional, Any, Dict, List

class TelemetryEventFrontend(BaseModel):
    module: Optional[str] = None
    page: str
    action_type: str
    action_name: str
    duration_ms: Optional[int] = None
    payload: Optional[Any] = None
    endpoint: Optional[str] = None
    is_success: Optional[bool] = None
    error_details: Optional[Any] = None
    timestamp: str

class TelemetryBatch(BaseModel):
    events: List[TelemetryEventFrontend]

@router.post("/ops-sync")
def sync_telemetry(batch: TelemetryBatch, db: Session = Depends(get_db)):
    for ev in batch.events:
        log = SystemTelemetry(
            module=ev.module,
            page=ev.page,
            action_type=ev.action_type,
            action_name=ev.action_name,
            duration_ms=ev.duration_ms,
            payload=ev.payload,
            endpoint=ev.endpoint,
            is_success=ev.is_success,
            error_details=ev.error_details
        )
        db.add(log)
    db.commit()
    return {"success": True, "count": len(batch.events)}

from pydantic import BaseModel
from typing import List

class ResolveUuidsRequest(BaseModel):
    uuids: List[str]

@router.post("/resolve-uuids")
def resolve_uuids(req: ResolveUuidsRequest, db: Session = Depends(get_db)):
    if not req.uuids:
        return {"resolved": {}}
        
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    resolved = {}
    try:
        # Check employees
        cursor.execute("SELECT id, first_name, last_name FROM employees WHERE id = ANY(%s)", (req.uuids,))
        for row in cursor.fetchall():
            resolved[str(row['id'])] = f"{row['first_name']} {row['last_name']}"
            
        unresolved = [u for u in req.uuids if u not in resolved]
        
        # Check shift sessions
        if unresolved:
            cursor.execute("""
                SELECT ss.id, e.first_name, e.last_name 
                FROM shift_sessions ss
                JOIN employees e ON e.id = ss.employee_id
                WHERE ss.id = ANY(%s)
            """, (unresolved,))
            for row in cursor.fetchall():
                resolved[str(row['id'])] = f"Turno de {row['first_name']} {row['last_name']}"
                
        return {"resolved": resolved}
    except Exception as e:
        print(f"Error resolving uuids: {e}")
        return {"resolved": {}}
    finally:
        cursor.close()
        conn.close()
from fastapi import APIRouter, HTTPException, Depends, Body
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db
import json

@router.post("/rpc/{function_name}")
def execute_rpc(function_name: str, payload: dict = Body(...), db: Session = Depends(get_db)):
    try:
        # Prevent SQL injection on function_name by simple validation
        if not function_name.isidentifier():
            raise HTTPException(status_code=400, detail="Invalid function name")
        
        # Build parameter string
        params_list = []
        bind_params = {}
        for key, value in payload.items():
            params_list.append(f":{key}")
            # If value is list/dict, pass it as json string to be cast to jsonb in pg
            if isinstance(value, (list, dict)):
                bind_params[key] = json.dumps(value)
            else:
                bind_params[key] = value
                
        # Some params might need explicit casting, but SQLAlchemy handles basic types
        param_str = ", ".join([f"{k} := :{k}" for k in bind_params.keys()])
        
        query = text(f"SELECT {function_name}({param_str})")
        
        result = db.execute(query, bind_params).scalar()
        db.commit()
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class PurgeRequest(BaseModel):
    confirm: str

@router.post("/purge")
def purge_system(req: PurgeRequest, db: Session = Depends(get_db)):
    if req.confirm != "REINICIAR":
        raise HTTPException(status_code=400, detail="Palabra clave incorrecta")
        
    try:
        # Tables to truncate
        tables = [
            "room_stays",
            "sales_orders",
            "sales_order_items",
            "payments",
            "audit_logs",
            "system_telemetry",
            "notifications",
            "shift_sessions",
            "shift_closings",
            "operation_flows",
            "flow_events",
            "room_cleanings"
        ]
        
        truncate_sql = f"TRUNCATE TABLE {', '.join(tables)} RESTART IDENTITY CASCADE;"
        db.execute(text(truncate_sql))
        
        # Reset rooms
        db.execute(text("UPDATE rooms SET status = 'LIBRE', is_hotel = FALSE;"))
        
        db.commit()
        return {"status": "success", "message": "Sistema purgado correctamente"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error purgando datos: {str(e)}")
