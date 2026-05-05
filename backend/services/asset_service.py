import uuid
from typing import Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from models.rooms import RoomAssets, RoomAssetLogs

def assign_asset_to_employee(
    db: Session, 
    room_id: uuid.UUID, 
    asset_type: str, 
    employee_id: uuid.UUID, 
    action_by_employee_id: uuid.UUID
) -> Dict[str, Any]:
    asset = db.query(RoomAssets).with_for_update().filter(
        RoomAssets.room_id == room_id,
        RoomAssets.asset_type == asset_type
    ).first()

    previous_status = 'NO_EXISTIA'
    
    if not asset:
        asset = RoomAssets(
            room_id=room_id, 
            asset_type=asset_type, 
            status='CON_COCHERO', 
            assigned_employee_id=employee_id
        )
        db.add(asset)
        db.flush() # Para obtener ID
    else:
        previous_status = asset.status
        asset.status = 'CON_COCHERO'
        asset.assigned_employee_id = employee_id

    log = RoomAssetLogs(
        asset_id=asset.id,
        previous_status=previous_status,
        new_status='CON_COCHERO',
        employee_id=action_by_employee_id,
        action_type='ASSIGNED_TO_COCHERO'
    )
    db.add(log)
    return {"success": True, "message": "Activo asignado exitosamente al cochero"}

def mark_asset_in_room(
    db: Session,
    room_id: uuid.UUID,
    asset_type: str,
    employee_id: uuid.UUID
) -> Dict[str, Any]:
    asset = db.query(RoomAssets).with_for_update().filter(
        RoomAssets.room_id == room_id,
        RoomAssets.asset_type == asset_type
    ).first()

    if not asset:
        raise HTTPException(status_code=404, detail="Activo no encontrado para esta habitación")

    previous_status = asset.status
    asset.status = 'EN_HABITACION'
    asset.assigned_employee_id = None

    log = RoomAssetLogs(
        asset_id=asset.id,
        previous_status=previous_status,
        new_status='EN_HABITACION',
        employee_id=employee_id,
        action_type='DROPPED_IN_ROOM'
    )
    db.add(log)
    return {"success": True, "message": "Activo marcado como presente en habitación"}

def verify_asset_presence(
    db: Session,
    room_id: uuid.UUID,
    asset_type: str,
    is_present: bool,
    employee_id: uuid.UUID
) -> Dict[str, Any]:
    asset = db.query(RoomAssets).with_for_update().filter(
        RoomAssets.room_id == room_id,
        RoomAssets.asset_type == asset_type
    ).first()

    previous_status = 'NO_EXISTIA'
    new_status = 'EN_HABITACION' if is_present else 'EXTRAVIADO'
    action_type = 'VERIFIED_IN_ROOM' if is_present else 'MARKED_MISSING'

    if not asset:
        asset = RoomAssets(
            room_id=room_id,
            asset_type=asset_type,
            status=new_status
        )
        db.add(asset)
        db.flush()
    else:
        previous_status = asset.status
        asset.status = new_status
        asset.assigned_employee_id = None

    log = RoomAssetLogs(
        asset_id=asset.id,
        previous_status=previous_status,
        new_status=new_status,
        employee_id=employee_id,
        action_type=action_type
    )
    db.add(log)
    return {"success": True, "message": "Estado del activo actualizado en limpieza"}
