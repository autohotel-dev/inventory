import uuid
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from models.system import OperationFlows, FlowEvents

def get_or_create_flow(
    db: Session,
    room_stay_id: uuid.UUID,
    employee_id: uuid.UUID,
    sales_order_id: Optional[uuid.UUID] = None,
    room_id: Optional[uuid.UUID] = None,
    room_number: str = "",
    shift_session_id: Optional[uuid.UUID] = None
) -> OperationFlows:
    # Buscar flujo activo existente para esta estancia
    flow = db.query(OperationFlows).filter(
        OperationFlows.room_stay_id == room_stay_id,
        OperationFlows.status == 'ACTIVO'
    ).first()

    if not flow:
        flow = OperationFlows(
            room_stay_id=room_stay_id,
            sales_order_id=sales_order_id,
            room_id=room_id,
            room_number=room_number,
            shift_session_id=shift_session_id,
            created_by=employee_id,
            status='ACTIVO'
        )
        db.add(flow)
        db.flush()

    return flow

def add_flow_event(
    db: Session,
    flow_id: uuid.UUID,
    event_type: str,
    event_category: str,
    description: str,
    actor_id: Optional[uuid.UUID] = None,
    actor_name: Optional[str] = None,
    actor_role: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> FlowEvents:
    # 1. Obtener el último evento de este flujo para calcular secuencia y duración
    last_event = db.query(FlowEvents).filter(
        FlowEvents.flow_id == flow_id
    ).order_by(FlowEvents.sequence_number.desc()).first()

    sequence_number = 1
    duration_ms = 0
    now_ts = datetime.utcnow()

    if last_event:
        sequence_number = last_event.sequence_number + 1
        if last_event.created_at:
            duration_ms = int((now_ts - last_event.created_at).total_seconds() * 1000)

    # 2. Crear evento
    new_event = FlowEvents(
        flow_id=flow_id,
        event_type=event_type,
        event_category=event_category,
        description=description,
        actor_id=actor_id,
        actor_name=actor_name,
        actor_role=actor_role,
        metadata=metadata or {},
        sequence_number=sequence_number,
        duration_from_previous_ms=duration_ms,
        created_at=now_ts
    )
    db.add(new_event)

    # 3. Actualizar el flujo maestro
    flow = db.query(OperationFlows).filter(OperationFlows.id == flow_id).first()
    if flow:
        flow.current_stage = event_type
        flow.updated_at = now_ts

    db.flush()
    return new_event
