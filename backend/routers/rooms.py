import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.rooms import Rooms, RoomTypes, RoomCleanings, RoomStays
from schemas.rooms import (
    RoomCreate, RoomUpdate, RoomResponse,
    RoomTypeCreate, RoomTypeUpdate, RoomTypeResponse,
    RoomCleaningCreate, RoomCleaningUpdate, RoomCleaningResponse,
    RoomStayCreate, RoomStayUpdate, RoomStayResponse
)
from auth_utils import get_current_user, CurrentUser

router = APIRouter(
    prefix="/rooms",
    tags=["Rooms"],
    dependencies=[Depends(get_current_user)]
)

# --- ROOM TYPES ---
@router.get("/types", response_model=list[RoomTypeResponse])
def get_room_types(db: Session = Depends(get_db)):
    return db.query(RoomTypes).all()

@router.post("/types", response_model=RoomTypeResponse, status_code=status.HTTP_201_CREATED)
def create_room_type(room_type: RoomTypeCreate, db: Session = Depends(get_db)):
    db_room_type = RoomTypes(**room_type.model_dump())
    db.add(db_room_type)
    db.commit()
    db.refresh(db_room_type)
    return db_room_type

# --- ROOMS ---
@router.get("/", response_model=list[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    return db.query(Rooms).order_by(Rooms.number).all()

from schemas.rooms import RoomDashboardResponse, ActiveStayDashboard, VehicleStatus, SensorStatus
from models.sales import SalesOrders, Payments, SalesOrderItems
from models.rooms import RoomAssets

@router.get("/dashboard", response_model=list[RoomDashboardResponse])
def get_rooms_dashboard(db: Session = Depends(get_db)):
    rooms = db.query(Rooms).order_by(Rooms.number).all()
    dashboard_data = []

    for room in rooms:
        # Relaciones
        room_type = db.query(RoomTypes).filter(RoomTypes.id == room.room_type_id).first()
        tv_remote = db.query(RoomAssets).filter(
            RoomAssets.room_id == room.id, 
            RoomAssets.asset_type == 'TV_REMOTE'
        ).first()

        active_stay = db.query(RoomStays).filter(
            RoomStays.room_id == room.id, 
            RoomStays.status == 'ACTIVA'
        ).first()

        stay_dashboard = None
        if active_stay:
            order = db.query(SalesOrders).filter(SalesOrders.id == active_stay.sales_order_id).first()
            items = db.query(SalesOrderItems).filter(SalesOrderItems.sales_order_id == active_stay.sales_order_id).all()
            payments = db.query(Payments).filter(Payments.sales_order_id == active_stay.sales_order_id).all()

            has_pending_payment = order and (order.remaining_amount or 0) > 0

            pending_items = [i for i in items if i.concept_type == 'CONSUMPTION' and i.delivery_status in ['PENDING_VALET', 'ACCEPTED', 'IN_TRANSIT']]
            has_pending_service = len(pending_items) > 0

            is_critical_service = False
            for item in pending_items:
                if item.created_at and item.delivery_status != 'IN_TRANSIT':
                    diff_mins = (datetime.utcnow() - item.created_at).total_seconds() / 60.0
                    if diff_mins > 15:
                        is_critical_service = True
                        break

            has_unconfirmed_valet_payment = any(p.status == 'COBRADO_POR_VALET' and not p.confirmed_at for p in payments)
            valet_priority_concepts = ['ROOM_BASE', 'EXTRA_HOUR', 'EXTRA_PERSON', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT']
            has_valet_priority_concept = any(i.concept_type in valet_priority_concepts for i in items)
            is_extra_hour_block = room.status == "BLOQUEADA"

            is_valet_pending = bool(
                room.status in ["OCUPADA", "BLOQUEADA"] and
                not is_extra_hour_block and
                has_pending_payment and
                has_valet_priority_concept and
                not has_unconfirmed_valet_payment
            )

            vehicle_status = VehicleStatus(
                has_vehicle=bool(active_stay.vehicle_plate),
                is_ready=bool(active_stay.checkout_valet_employee_id),
                plate=active_stay.vehicle_plate,
                brand=active_stay.vehicle_brand,
                model=active_stay.vehicle_model,
                is_waiting_authorization=bool(active_stay.valet_checkout_requested_at and not active_stay.vehicle_requested_at)
            )

            stay_dashboard = ActiveStayDashboard(
                id=active_stay.id,
                sales_order_id=active_stay.sales_order_id,
                check_in_at=active_stay.check_in_at or datetime.utcnow(),
                expected_check_out_at=active_stay.expected_check_out_at,
                valet_employee_id=active_stay.valet_employee_id,
                has_pending_payment=bool(has_pending_payment),
                has_pending_service=has_pending_service,
                is_critical_service=is_critical_service,
                is_valet_pending=is_valet_pending,
                vehicle_status=vehicle_status
            )

        dashboard_data.append(RoomDashboardResponse(
            id=room.id,
            number=room.number,
            status=room.status or "LIBRE",
            notes=room.notes,
            room_type_name=room_type.name if room_type else None,
            is_hotel=room_type.is_hotel if room_type else False,
            tv_remote_status=tv_remote.status if tv_remote else "SIN_REGISTRO",
            active_stay=stay_dashboard,
            sensor_status=None,
            room_types=room_type,
            # Construir el grafo legacy mínimo esperado por los modales de UI
            room_stays=[{
                "id": str(active_stay.id),
                "room_id": str(active_stay.room_id),
                "sales_order_id": str(active_stay.sales_order_id),
                "status": active_stay.status,
                "created_at": active_stay.created_at.isoformat() if active_stay.created_at else None,
                "check_in_at": active_stay.check_in_at.isoformat() if active_stay.check_in_at else None,
                "expected_check_out_at": active_stay.expected_check_out_at.isoformat() if active_stay.expected_check_out_at else None,
                "current_people": active_stay.current_people,
                "total_people": active_stay.total_people,
                "valet_employee_id": str(active_stay.valet_employee_id) if active_stay.valet_employee_id else None,
                "sales_orders": {
                    "id": str(active_stay.sales_order_id),
                    "remaining_amount": float(order.remaining_amount) if order and order.remaining_amount else 0,
                    "payments": [{"id": str(p.id), "status": p.status, "confirmed_at": p.confirmed_at.isoformat() if p.confirmed_at else None} for p in payments],
                    "sales_order_items": [{"id": str(i.id), "delivery_status": i.delivery_status, "concept_type": i.concept_type, "created_at": i.created_at.isoformat() if i.created_at else None} for i in items]
                }
            }] if active_stay else [],
            room_assets=[{"id": str(tv_remote.id), "asset_type": "TV_REMOTE", "status": tv_remote.status, "assigned_employee_id": str(tv_remote.assigned_employee_id) if tv_remote.assigned_employee_id else None}] if tv_remote else []
        ))

    return dashboard_data

@router.post("/", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(room: RoomCreate, db: Session = Depends(get_db)):
    db_room = Rooms(**room.model_dump())
    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room

@router.patch("/{room_id}/status", response_model=RoomResponse)
def update_room_status(room_id: uuid.UUID, room_update: RoomUpdate, db: Session = Depends(get_db)):
    db_room = db.query(Rooms).filter(Rooms.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    update_data = room_update.model_dump(exclude_unset=True)
    
    # Lógica de Negocio: Transiciones de estado (ej: a LIMPIANDO)
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == "LIMPIANDO" and db_room.status != "LIMPIANDO":
            # Registrar inicio de limpieza en el modelo Room y crear registro de limpieza
            db_room.cleaning_started_at = datetime.utcnow()
            # Si se manda el empleado, lo asignamos. Podría venir en update_data
            if "cleaning_by_employee_id" in update_data:
                cleaning_entry = RoomCleanings(
                    room_id=db_room.id,
                    started_at=datetime.utcnow(),
                    employee_id=update_data["cleaning_by_employee_id"]
                )
                db.add(cleaning_entry)
        
        elif db_room.status == "LIMPIANDO" and new_status == "LIBRE":
            # Finalizar limpieza
            db_room.cleaning_started_at = None
            db_room.cleaning_by_employee_id = None
            # Cerrar el último cleaning log
            active_cleaning = db.query(RoomCleanings).filter(
                RoomCleanings.room_id == db_room.id,
                RoomCleanings.ended_at.is_(None)
            ).order_by(RoomCleanings.started_at.desc()).first()
            if active_cleaning:
                active_cleaning.ended_at = datetime.utcnow()
                diff = active_cleaning.ended_at - active_cleaning.started_at
                active_cleaning.duration_minutes = int(diff.total_seconds() / 60)
                
    for key, value in update_data.items():
        setattr(db_room, key, value)
        
    db.commit()
    db.refresh(db_room)
    return db_room

# --- ROOM STAYS (Check-in/Check-out) ---
@router.get("/{room_id}/stays", response_model=list[RoomStayResponse])
def get_room_stays(room_id: uuid.UUID, db: Session = Depends(get_db)):
    return db.query(RoomStays).filter(RoomStays.room_id == room_id).order_by(RoomStays.created_at.desc()).all()

@router.post("/{room_id}/stays", response_model=RoomStayResponse, status_code=status.HTTP_201_CREATED)
def create_room_stay(room_id: uuid.UUID, stay: RoomStayCreate, db: Session = Depends(get_db)):
    db_room = db.query(Rooms).filter(Rooms.id == room_id).first()
    if not db_room:
        raise HTTPException(status_code=404, detail="Room not found")
        
    if db_room.status != "LIBRE":
        raise HTTPException(status_code=400, detail=f"Room is currently {db_room.status}, cannot check-in")
        
    # Cambiar estado de habitación a OCUPADA
    db_room.status = "OCUPADA"
    
    db_stay = RoomStays(**stay.model_dump())
    db.add(db_stay)
    db.commit()
    db.refresh(db_stay)
    return db_stay

@router.patch("/stays/{stay_id}", response_model=RoomStayResponse)
def update_room_stay(stay_id: uuid.UUID, stay_update: RoomStayUpdate, db: Session = Depends(get_db)):
    db_stay = db.query(RoomStays).filter(RoomStays.id == stay_id).first()
    if not db_stay:
        raise HTTPException(status_code=404, detail="Stay not found")
        
    update_data = stay_update.model_dump(exclude_unset=True)
    
    if "status" in update_data and update_data["status"] == "FINALIZADA" and db_stay.status != "FINALIZADA":
        # Check-out -> Mover habitación a SUCIA
        db_stay.actual_check_out_at = datetime.utcnow()
        db_room = db.query(Rooms).filter(Rooms.id == db_stay.room_id).first()
        if db_room:
            db_room.status = "SUCIA"
            
    for key, value in update_data.items():
        setattr(db_stay, key, value)
        
    db.commit()
    db.refresh(db_stay)
    return db_stay

@router.get("/stays/by_order/{order_id}")
def get_stay_by_order(order_id: uuid.UUID, db: Session = Depends(get_db)):
    stay = db.query(RoomStays).filter(
        RoomStays.sales_order_id == order_id,
        RoomStays.status == "ACTIVA"
    ).first()
    if not stay:
        raise HTTPException(status_code=404, detail="Active stay not found for this order")
    return {"id": stay.id}

# --- TRANSACTIONAL RPC BRIDGES ---
from sqlalchemy import text
from schemas.rooms_rpc import CheckInRequest, CheckOutRequest, ExtraHoursRequest, AssignAssetRequest

@router.post("/{room_id}/checkin")
def process_checkin(room_id: uuid.UUID, req: CheckInRequest, db: Session = Depends(get_db)):
    """Bridge for process_checkin_transaction RPC"""
    payment_data_json = [p.model_dump() for p in req.payment_data]
    
    query = text("""
        SELECT process_checkin_transaction(
            :p_room_id, :p_warehouse_id, :p_room_type_name, :p_room_number,
            :p_base_price, :p_extra_person_price, :p_total_price, :p_total_paid,
            :p_initial_people, :p_extra_people_count, :p_check_in_at, :p_expected_checkout_at,
            :p_vehicle_plate, :p_vehicle_brand, :p_vehicle_model, :p_is_hotel,
            :p_duration_nights, :p_notes, :p_payment_data::jsonb, :p_employee_id
        )
    """)
    try:
        import json
        result = db.execute(query, {
            "p_room_id": str(room_id),
            "p_warehouse_id": str(req.warehouse_id),
            "p_room_type_name": req.room_type_name,
            "p_room_number": req.room_number,
            "p_base_price": req.base_price,
            "p_extra_person_price": req.extra_person_price,
            "p_total_price": req.total_price,
            "p_total_paid": req.total_paid,
            "p_initial_people": req.initial_people,
            "p_extra_people_count": req.extra_people_count,
            "p_check_in_at": req.check_in_at,
            "p_expected_checkout_at": req.expected_checkout_at,
            "p_vehicle_plate": req.vehicle_plate,
            "p_vehicle_brand": req.vehicle_brand,
            "p_vehicle_model": req.vehicle_model,
            "p_is_hotel": req.is_hotel,
            "p_duration_nights": req.duration_nights,
            "p_notes": req.notes,
            "p_payment_data": json.dumps(payment_data_json, default=str),
            "p_employee_id": str(req.employee_id)
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Checkin failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{room_id}/checkout")
def process_checkout(room_id: uuid.UUID, req: CheckOutRequest, db: Session = Depends(get_db)):
    """Bridge for process_checkout_transaction RPC"""
    payment_data_json = [p.model_dump() for p in req.payment_data]
    query = text("""
        SELECT process_checkout_transaction(
            :p_stay_id, :p_sales_order_id, :p_payment_data::jsonb, :p_checkout_valet_id, :p_employee_id
        )
    """)
    try:
        import json
        result = db.execute(query, {
            "p_stay_id": str(req.stay_id),
            "p_sales_order_id": str(req.sales_order_id),
            "p_payment_data": json.dumps(payment_data_json, default=str),
            "p_checkout_valet_id": str(req.checkout_valet_id) if req.checkout_valet_id else None,
            "p_employee_id": str(req.employee_id) if req.employee_id else None
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Checkout failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{room_id}/extra-hours")
def process_extra_hours(room_id: uuid.UUID, req: ExtraHoursRequest, db: Session = Depends(get_db)):
    """Bridge for process_extra_hours_v2 RPC"""
    query = text("""
        SELECT process_extra_hours_v2(
            :p_stay_id
        )
    """)
    try:
        result = db.execute(query, {
            "p_stay_id": str(req.stay_id)
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Extra hours failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{room_id}/assign-asset")
def assign_asset(room_id: uuid.UUID, req: AssignAssetRequest, db: Session = Depends(get_db)):
    """Bridge for assign_asset_to_employee RPC"""
    query = text("""
        SELECT assign_asset_to_employee(
            :p_room_id, :p_asset_type, :p_employee_id, :p_action_by_employee_id
        )
    """)
    try:
        result = db.execute(query, {
            "p_room_id": str(room_id),
            "p_asset_type": req.asset_type,
            "p_employee_id": str(req.employee_id),
            "p_action_by_employee_id": str(req.action_by_employee_id) if req.action_by_employee_id else None
        }).scalar()
        db.commit()
        if result and not result.get('success', False):
            raise HTTPException(status_code=400, detail=result.get('error', 'Asset assignment failed'))
        return result
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
