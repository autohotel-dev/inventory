import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from routers import system

app = FastAPI(title="Luxor API", version="1.0.0")

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

@app.get("/")
def read_root():
    return {"message": "Luxor API is running!"}

# Handler para AWS Lambda
handler = Mangum(app)
