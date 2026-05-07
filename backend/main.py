import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from fastapi.middleware.gzip import GZipMiddleware
from routers import system, catalogs, inventory, rooms, sales, hr, services
from telemetry_middleware import TelemetryMiddleware

app = FastAPI(title="Luxor API", version="1.0.0")

# Telemetría Global
app.add_middleware(TelemetryMiddleware)

# Compresión GZIP para payloads JSON grandes
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Configurar CORS (ajustar en producción)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar Routers
app.include_router(system.router)
app.include_router(catalogs.router)
app.include_router(inventory.router)
app.include_router(rooms.router)
app.include_router(sales.router)
app.include_router(hr.router)
app.include_router(services.router)
from routers import analytics
app.include_router(analytics.router)

from routers import ws
app.include_router(ws.router)

import asyncio
from ws_manager import listen_to_pg

@app.on_event("startup")
async def startup_event():
    # Iniciar la escucha de PostgreSQL en segundo plano
    asyncio.create_task(listen_to_pg())

@app.get("/")
@app.head("/")
def read_root():
    return {"message": "Luxor API is running!"}

@app.get("/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/debug/shift-closings")
def debug_shift_closings(limit: int = 3):
    """TEMP: debug endpoint sin auth para diagnosticar 500."""
    import traceback, uuid, decimal, datetime
    from database import get_db as _get_db
    from models.hr import ShiftClosings, Employees, ShiftDefinitions
    
    def _ser(val):
        if val is None: return None
        if isinstance(val, uuid.UUID): return str(val)
        if isinstance(val, decimal.Decimal): return float(val)
        if isinstance(val, (datetime.datetime, datetime.date)): return val.isoformat()
        if isinstance(val, datetime.time): return str(val)
        if isinstance(val, dict): return {k: _ser(v) for k, v in val.items()}
        if isinstance(val, (list, tuple)): return [_ser(v) for v in val]
        return val
    
    db = next(_get_db())
    try:
        total = db.query(ShiftClosings).count()
        closings = db.query(ShiftClosings).order_by(ShiftClosings.created_at.desc()).limit(limit).all()
        results = []
        for c in closings:
            emp = db.query(Employees).filter(Employees.id == c.employee_id).first()
            shift = db.query(ShiftDefinitions).filter(ShiftDefinitions.id == c.shift_definition_id).first()
            c_dict = {}
            for col in c.__table__.columns:
                c_dict[col.name] = _ser(getattr(c, col.name))
            c_dict["employees"] = {"first_name": emp.first_name, "last_name": emp.last_name, "role": emp.role} if emp else None
            c_dict["shift_definitions"] = {"name": shift.name} if shift else None
            results.append(c_dict)
        return {"data": results, "total": total, "fetched": len(results), "debug": "OK"}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
    finally:
        db.close()

# Handler para AWS Lambda (Solo para endpoints HTTP, WebSockets requieren un servidor persistente)
handler = Mangum(app)
