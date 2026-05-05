from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session
from database import get_db, engine

router = APIRouter(prefix="/system", tags=["System"])

@router.get("/db-test")
def test_db_connection(db: Session = Depends(get_db)):
    if not engine:
        raise HTTPException(status_code=500, detail="DATABASE_URL no está configurada")
    
    try:
        result = db.execute(text("SELECT version();"))
        version = result.scalar()
        return {"status": "success", "message": "¡Conectado a AWS RDS exitosamente!", "db_version": version}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error conectando a la BD: {str(e)}")

@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """))
        tables = [row[0] for row in result.fetchall()]
        return {"status": "success", "table_count": len(tables), "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo tablas: {str(e)}")
