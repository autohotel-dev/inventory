import sys
import asyncio
from sqlalchemy import select, or_, and_, func, cast, Integer
from sqlalchemy.orm import Session
from database import SessionLocal
from models import t_products_view

def test_query():
    db = SessionLocal()
    try:
        stats_query = select(
            func.count().label("total"),
            func.sum(func.cast(t_products_view.c.is_active, func.integer())).label("active"),
            func.sum(
                func.cast(
                    or_(t_products_view.c.stock_status == 'low', t_products_view.c.stock_status == 'critical'),
                    func.integer()
                )
            ).label("low_stock"),
            func.sum(func.cast(t_products_view.c.stock_status == 'critical', func.integer())).label("critical_stock"),
            func.sum(t_products_view.c.inventory_value).label("total_value")
        )
        stats_row = db.execute(stats_query).mappings().first()
        print(stats_row)
    except Exception as e:
        print("ERROR:", str(e))
    finally:
        db.close()

test_query()
