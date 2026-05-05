import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import system, catalogs, inventory, rooms, sales, hr, services
from telemetry_middleware import TelemetryMiddleware

app = FastAPI(title="Luxor API", version="1.0.0")

# Telemetría Global
app.add_middleware(TelemetryMiddleware)

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

# Handler para AWS Lambda (Solo para endpoints HTTP, WebSockets requieren un servidor persistente)
handler = Mangum(app)
