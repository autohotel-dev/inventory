import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()
database_url = os.getenv("DATABASE_URL")

# Engine global de SQLAlchemy
# Configuramos pool_pre_ping para que reintente conexiones muertas, útil en Serverless
engine = create_engine(database_url, pool_pre_ping=True) if database_url else None

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependencia para obtener la sesión de base de datos en los endpoints de FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
