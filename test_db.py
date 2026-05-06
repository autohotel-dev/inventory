from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.routers.rooms import get_rooms_dashboard
from backend.database import get_db

DATABASE_URL = "postgresql://adminluxor:Michicondrias_20-10_94%23@luxor-backend-db.ckhca040an8w.us-east-1.rds.amazonaws.com:5432/luxor"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

try:
    rooms = get_rooms_dashboard(db=db)
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
