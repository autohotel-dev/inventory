import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.hr import Employees, ShiftDefinitions, EmployeeSchedules, ShiftSessions, ShiftClosings
from schemas.hr import (
    EmployeeCreate, EmployeeUpdate, EmployeeResponse,
    ShiftDefinitionCreate, ShiftDefinitionUpdate, ShiftDefinitionResponse,
    ShiftSessionCreate, ShiftSessionUpdate, ShiftSessionResponse,
    ShiftClosingCreate, ShiftClosingUpdate, ShiftClosingResponse
)
from auth_utils import get_current_user, CurrentUser

router = APIRouter(
    prefix="/hr",
    tags=["Human Resources"],
    dependencies=[Depends(get_current_user)]
)

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
        
    db_closing = ShiftClosings(**closing.model_dump())
    db.add(db_closing)
    
    db_session.status = "closed"
    
    db.commit()
    db.refresh(db_closing)
    return db_closing
