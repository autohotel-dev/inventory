import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Cargar variables de entorno desde .env (útil para local)
load_dotenv()

app = FastAPI(title="Luxor API", version="1.0.0")

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Bienvenido a Luxor Backend API (FastAPI + Serverless)"}

@app.get("/health")
def health_check():
    return {"status": "ok", "environment": os.getenv("STAGE", "dev")}

@app.get("/db-test")
def test_db_connection():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL no está configurada")
    
    try:
        # Crea el motor de SQLAlchemy (idealmente esto se hace globalmente, aquí es solo test)
        engine = create_engine(database_url)
        with engine.connect() as connection:
            # Ejecuta una consulta simple para verificar la conexión
            result = connection.execute(text("SELECT version();"))
            version = result.scalar()
            return {"status": "success", "message": "¡Conectado a AWS RDS exitosamente!", "db_version": version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error conectando a la BD: {str(e)}")

# Este es el handler que invoca AWS Lambda
handler = Mangum(app)
