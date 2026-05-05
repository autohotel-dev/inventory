import uuid
from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from models.sales import SalesOrderItems, SalesOrders, Payments
from models.rooms import RoomStays, RoomTypes
from models.inventory import InventoryMovements, Stock

def cancel_sales_order_item(db: Session, item_id: uuid.UUID, employee_id: uuid.UUID, reason: str) -> Dict[str, Any]:
    if not reason or not reason.strip():
        raise HTTPException(status_code=400, detail="El motivo de cancelación es obligatorio")

    # 1. Get and lock item
    item = db.query(SalesOrderItems).with_for_update().filter(SalesOrderItems.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item no encontrado")
    
    if item.is_cancelled:
        raise HTTPException(status_code=400, detail="Este item ya fue cancelado")

    item_total = float((item.qty * item.unit_price) - (item.discount or 0) + (item.tax or 0))
    was_paid = bool(item.is_paid)

    # 2. Get order
    order = db.query(SalesOrders).with_for_update().filter(SalesOrders.id == item.sales_order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Orden de venta no encontrada")

    # 3. Get active stay
    stay = db.query(RoomStays).with_for_update().filter(
        RoomStays.sales_order_id == item.sales_order_id,
        RoomStays.status == 'ACTIVA'
    ).first()
    
    room_type = None
    if stay:
        from models.rooms import Rooms
        room = db.query(Rooms).filter(Rooms.id == stay.room_id).first()
        if room:
            room_type = db.query(RoomTypes).filter(RoomTypes.id == room.room_type_id).first()

    # 4. Determine time/people adjustments
    hours_to_deduct = 0
    people_to_deduct = 0

    if item.concept_type == 'PROMO_4H':
        hours_to_deduct = 4
    elif item.concept_type == 'EXTRA_HOUR':
        hours_to_deduct = float(item.qty)
    elif item.concept_type == 'EXTRA_PERSON':
        people_to_deduct = int(item.qty)
    elif item.concept_type == 'RENEWAL':
        hours_to_deduct = room_type.weekday_hours if room_type else 4

    # 5. Apply stay adjustments
    if stay:
        if hours_to_deduct > 0:
            stay.expected_check_out_at = stay.expected_check_out_at - timedelta(hours=hours_to_deduct)
        if people_to_deduct > 0:
            stay.current_people = max(1, stay.current_people - people_to_deduct)
            stay.total_people = max(1, stay.total_people - people_to_deduct)

    # 6. Handle payment side
    refund_created = False
    payment_deleted = False

    if was_paid:
        # Create REFUND
        refund_payment = Payments(
            sales_order_id=item.sales_order_id,
            amount=item_total,
            payment_method='EFECTIVO',
            reference=f"REF-{str(uuid.uuid4())[:8]}",
            concept='REFUND',
            status='CANCELADO',
            payment_type='COMPLETO',
            notes=f"Cancelación: {reason} | Item: {item.concept_type or 'PRODUCT'}",
            created_by=employee_id
        )
        db.add(refund_payment)
        refund_created = True

        # Adjust order
        order.subtotal = max(0, float(order.subtotal or 0) - item_total)
        order.total = max(0, float(order.total or 0) - item_total)
        order.paid_amount = max(0, float(order.paid_amount or 0) - item_total)
        order.remaining_amount = max(0, float(order.total) - float(order.paid_amount))

    else:
        # Find and remove PENDIENTE payment
        concept_mapping = {
            'EXTRA_PERSON': 'PERSONA_EXTRA',
            'DAMAGE': 'DAMAGE_CHARGE',
            'CONSUMPTION': 'CONSUMPTION',
            'EXTRA_HOUR': 'EXTRA_HOUR',
            'PROMO_4H': 'PROMO_4H',
            'RENEWAL': 'RENEWAL'
        }
        search_concept = concept_mapping.get(item.concept_type, item.concept_type or 'CONSUMPTION')

        payment = db.query(Payments).with_for_update().filter(
            Payments.sales_order_id == item.sales_order_id,
            Payments.status == 'PENDIENTE',
            Payments.concept == search_concept
        ).order_by(Payments.created_at.desc()).first()

        if payment:
            if float(payment.amount) <= item_total:
                db.delete(payment)
                payment_deleted = True
            else:
                payment.amount = float(payment.amount) - item_total

        # Adjust order
        order.subtotal = max(0, float(order.subtotal or 0) - item_total)
        order.total = max(0, float(order.total or 0) - item_total)
        order.remaining_amount = max(0, float(order.total) - float(order.paid_amount or 0))

    # 7. Return inventory
    inventory_returned = False
    if item.product_id and item.concept_type == 'CONSUMPTION':
        movement = InventoryMovements(
            product_id=item.product_id,
            warehouse_id=order.warehouse_id,
            quantity=int(item.qty),
            movement_type='IN',
            reason_id=7, # Assuming 7 is cancellation, standard mapped in DB
            reason='CANCELLATION',
            notes=f"Devolución por cancelación: {reason}",
            reference_table='sales_order_items',
            reference_id=item.id,
            created_by=employee_id
        )
        db.add(movement)
        
        # update stock
        stock = db.query(Stock).filter(
            Stock.product_id == item.product_id, 
            Stock.warehouse_id == order.warehouse_id
        ).first()
        if stock:
            stock.qty = float(stock.qty or 0) + float(item.qty)
        else:
            new_stock = Stock(product_id=item.product_id, warehouse_id=order.warehouse_id, qty=item.qty)
            db.add(new_stock)

        inventory_returned = True

    # 8. Soft-delete
    item.is_cancelled = True
    item.cancellation_reason = reason
    item.cancelled_at = datetime.utcnow()
    item.cancelled_by = employee_id
    item.delivery_status = 'CANCELLED'

    return {
        "success": True,
        "was_paid": was_paid,
        "refund_created": refund_created,
        "payment_deleted": payment_deleted,
        "inventory_returned": inventory_returned,
        "hours_deducted": hours_to_deduct,
        "people_deducted": people_to_deduct,
        "amount": item_total,
        "stay_id": str(stay.id) if stay else None
    }
