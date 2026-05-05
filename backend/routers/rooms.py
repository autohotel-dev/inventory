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
