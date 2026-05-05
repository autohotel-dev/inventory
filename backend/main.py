import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import system, catalogs, inventory, rooms, sales, hr
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

@app.get("/")
def read_root():
    return {"message": "Luxor API is running!"}

# Handler para AWS Lambda
handler = Mangum(app)
