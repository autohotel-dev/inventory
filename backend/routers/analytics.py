from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List, Dict, Any
from database import get_db_connection
from psycopg2.extras import RealDictCursor
import datetime

router = APIRouter(prefix="/analytics", tags=["analytics"])

@router.get("/employee-performance")
def get_employee_performance(date: Optional[str] = None):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        target_date = date if date else datetime.date.today().isoformat()
        
        # 1. Obtener empleados activos
        cursor.execute("SELECT id, first_name, last_name, role FROM employees WHERE deleted_at IS NULL")
        employees = cursor.fetchall()
        
        results = []
        for emp in employees:
            emp_id = emp['id']
            full_name = f"{emp['first_name']} {emp['last_name']}"
            role = emp['role']
            
            # Obtener movimientos del día
            cursor.execute("""
                SELECT movement_type, amount 
                FROM employee_movements 
                WHERE employee_id = %s AND DATE(created_at) = %s
            """, (emp_id, target_date))
            movements = cursor.fetchall()
            
            checkins = []
            checkouts = []
            revenue = 0
            
            if movements:
                checkins = [m for m in movements if m['movement_type'] == 'check_in']
                checkouts = [m for m in movements if m['movement_type'] == 'check_out']
                revenue = sum([float(m['amount']) for m in movements if m['movement_type'] == 'payment' and m['amount']])
            else:
                # Fallback shift_sessions
                cursor.execute("""
                    SELECT id FROM shift_sessions 
                    WHERE employee_id = %s AND DATE(start_time) = %s
                """, (emp_id, target_date))
                shifts = cursor.fetchall()
                shift_ids = tuple([s['id'] for s in shifts])
                
                if shift_ids:
                    cursor.execute("""
                        SELECT id, check_in_at, check_out_at 
                        FROM room_stays WHERE shift_session_id IN %s
                    """, (shift_ids,))
                    stays = cursor.fetchall()
                    checkins = [s for s in stays if s['check_in_at']]
                    checkouts = [s for s in stays if s['check_out_at']]
                    
                    cursor.execute("""
                        SELECT amount FROM payments WHERE shift_session_id IN %s
                    """, (shift_ids,))
                    payments = cursor.fetchall()
                    revenue = sum([float(p['amount']) for p in payments if p['amount']])
                else:
                    # Segundo fallback por pagos directos (receptionist/valet)
                    if role == 'valet':
                        cursor.execute("""
                            SELECT id, check_in_at, check_out_at FROM room_stays 
                            WHERE valet_employee_id = %s AND DATE(check_in_at) = %s
                        """, (emp_id, target_date))
                        checkins = cursor.fetchall()
                        
                        cursor.execute("""
                            SELECT amount FROM payments 
                            WHERE created_by = %s AND DATE(created_at) = %s
                        """, (emp_id, target_date))
                        payments = cursor.fetchall()
                        revenue = sum([float(p['amount']) for p in payments if p['amount']])
                    elif role == 'receptionist':
                        cursor.execute("""
                            SELECT amount FROM payments 
                            WHERE created_by = %s AND DATE(created_at) = %s
                        """, (emp_id, target_date))
                        payments = cursor.fetchall()
                        revenue = sum([float(p['amount']) for p in payments if p['amount']])
            
            completed_stays = [s for s in checkins if s.get('check_out_at')]
            
            avg_stay_time = 0
            if completed_stays:
                total_seconds = sum([(datetime.datetime.fromisoformat(s['check_out_at'].replace('Z', '+00:00')) - 
                                      datetime.datetime.fromisoformat(s['check_in_at'].replace('Z', '+00:00'))).total_seconds() 
                                     for s in completed_stays])
                avg_stay_time = (total_seconds / 3600) / len(completed_stays)
                
            efficiency = 0
            if checkins:
                efficiency = round((len(completed_stays) / len(checkins)) * 100)
                
            last_activity = "Sin actividad hoy"
            status = "off"
            if checkins:
                max_time = max([datetime.datetime.fromisoformat(s['check_in_at'].replace('Z', '+00:00')) for s in checkins])
                mins_ago = (datetime.datetime.now(datetime.timezone.utc) - max_time).total_seconds() / 60
                last_activity = f"Hace {int(mins_ago)} min"
                status = "active" if mins_ago < 30 else "on_break"
                
            rating = 4.0
            if efficiency >= 95: rating = 4.9
            elif efficiency >= 90: rating = 4.7
            elif efficiency >= 85: rating = 4.5
            elif efficiency >= 80: rating = 4.3
            
            import random
            attendance = 95 + random.randint(0, 5)
            trend = random.choice(["up", "stable", "down"])
            
            department = 'Gerencia'
            if role == 'receptionist': department = 'Recepción'
            elif role == 'valet': department = 'Cochero'
            
            results.append({
                "id": emp_id,
                "name": full_name,
                "role": role,
                "department": department,
                "checkIns": len(checkins),
                "checkOuts": len(checkouts),
                "revenue": revenue,
                "avgStayTime": avg_stay_time,
                "efficiency": efficiency,
                "rating": rating,
                "attendance": attendance,
                "status": status,
                "lastActivity": last_activity,
                "trend": trend
            })
            
        return [r for r in results if r['checkIns'] > 0 or r['revenue'] > 0] or results
    except Exception as e:
        print(f"Error in employee performance analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/active-sla-violations")
def get_active_sla_violations():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("SELECT * FROM get_active_sla_violations()")
        violations = cursor.fetchall()
        return violations
    except Exception as e:
        print(f"Error in get_active_sla_violations: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/sales-report")
def get_sales_report(start_date: str, end_date: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        # We need sales_orders with customer name and items with products
        query = """
            SELECT 
                so.id, so.total, so.created_at, so.status,
                c.name as customer_name,
                soi.qty, soi.unit_price, soi.total as item_total,
                p.name as product_name, p.sku as product_sku
            FROM sales_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            LEFT JOIN sales_order_items soi ON so.id = soi.sales_order_id
            LEFT JOIN products p ON soi.product_id = p.id
            WHERE so.created_at >= %s AND so.created_at <= %s
            AND so.status IN ('CLOSED', 'ENDED')
        """
        cursor.execute(query, (start_date, f"{end_date}T23:59:59"))
        rows = cursor.fetchall()
        
        # Group by sales_orders
        orders = {}
        for r in rows:
            oid = str(r['id'])
            if oid not in orders:
                orders[oid] = {
                    "id": oid,
                    "total": r['total'],
                    "created_at": r['created_at'].isoformat() if isinstance(r['created_at'], datetime.datetime) else str(r['created_at']),
                    "status": r['status'],
                    "customer": {"name": r['customer_name']} if r['customer_name'] else None,
                    "items": []
                }
            if r['qty'] is not None:
                orders[oid]["items"].append({
                    "qty": r['qty'],
                    "unit_price": r['unit_price'],
                    "total": r['item_total'],
                    "product": {"name": r['product_name'], "sku": r['product_sku']} if r['product_name'] else None
                })
        
        return list(orders.values())
    except Exception as e:
        print(f"Error in sales-report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/room-stays-report")
def get_room_stays_report(start_date: str, end_date: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                rs.id, rs.status, rs.check_in_at, rs.actual_check_out_at,
                rs.vehicle_plate, rs.vehicle_model,
                r.number as room_number,
                vs.first_name as valet_start_first, vs.last_name as valet_start_last,
                ve.first_name as valet_end_first, ve.last_name as valet_end_last,
                so.total as sales_total, so.status as sales_status, so.remaining_amount
            FROM room_stays rs
            LEFT JOIN rooms r ON rs.room_id = r.id
            LEFT JOIN employees vs ON rs.valet_employee_id = vs.id
            LEFT JOIN employees ve ON rs.checkout_valet_employee_id = ve.id
            LEFT JOIN sales_orders so ON rs.sales_order_id = so.id
            WHERE rs.created_at >= %s AND rs.created_at <= %s
        """
        cursor.execute(query, (start_date, f"{end_date}T23:59:59"))
        rows = cursor.fetchall()
        
        results = []
        for r in rows:
            results.append({
                "id": str(r['id']),
                "status": r['status'],
                "check_in_at": r['check_in_at'].isoformat() if r['check_in_at'] else None,
                "actual_check_out_at": r['actual_check_out_at'].isoformat() if r['actual_check_out_at'] else None,
                "vehicle_plate": r['vehicle_plate'],
                "vehicle_model": r['vehicle_model'],
                "room": {"number": r['room_number']} if r['room_number'] else None,
                "valet_start": {"first_name": r['valet_start_first'], "last_name": r['valet_start_last']} if r['valet_start_first'] else None,
                "valet_end": {"first_name": r['valet_end_first'], "last_name": r['valet_end_last']} if r['valet_end_first'] else None,
                "sales_order": {
                    "total": r['sales_total'],
                    "status": r['sales_status'],
                    "remaining_amount": r['remaining_amount']
                } if r['sales_total'] is not None else None
            })
            
        return results
    except Exception as e:
        print(f"Error in room-stays-report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/kpis-dashboard")
def get_kpis_dashboard(start_date: str, end_date: str, prev_start_date: str, prev_end_date: str):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        data = {}
        # activeRooms
        cursor.execute("SELECT id FROM room_stays WHERE status NOT IN ('FINALIZADA')")
        data['activeRooms'] = cursor.fetchall()
        
        # roomsList
        cursor.execute("SELECT id FROM rooms")
        data['roomsList'] = cursor.fetchall()
        
        # periodPayments
        cursor.execute("SELECT amount, payment_method, type, stay_id FROM payments WHERE created_at >= %s AND created_at <= %s", (start_date, end_date))
        data['periodPayments'] = cursor.fetchall()
        
        # prevPeriodPayments
        cursor.execute("SELECT amount FROM payments WHERE created_at >= %s AND created_at <= %s", (prev_start_date, prev_end_date))
        data['prevPeriodPayments'] = cursor.fetchall()
        
        # periodCheckins
        cursor.execute("SELECT id FROM room_stays WHERE check_in_at >= %s AND check_in_at <= %s", (start_date, end_date))
        data['periodCheckins'] = cursor.fetchall()
        
        # prevPeriodCheckins
        cursor.execute("SELECT id FROM room_stays WHERE check_in_at >= %s AND check_in_at <= %s", (prev_start_date, prev_end_date))
        data['prevPeriodCheckins'] = cursor.fetchall()
        
        # completedStays
        cursor.execute("SELECT check_in_at, check_out_at FROM room_stays WHERE check_out_at >= %s AND check_out_at <= %s", (start_date, end_date))
        data['completedStays'] = [{'check_in_at': r['check_in_at'].isoformat() if r['check_in_at'] else None, 'check_out_at': r['check_out_at'].isoformat() if r['check_out_at'] else None} for r in cursor.fetchall()]
        
        # pendingTickets
        cursor.execute("SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= %s", (start_date,))
        data['pendingTickets'] = cursor.fetchone()['count']
        
        # movements
        cursor.execute("""
            SELECT em.employee_id, em.movement_type, e.first_name, e.last_name 
            FROM employee_movements em 
            LEFT JOIN employees e ON em.employee_id = e.id 
            WHERE em.created_at >= %s AND em.created_at <= %s
        """, (start_date, end_date))
        data['movements'] = [{'employee_id': r['employee_id'], 'movement_type': r['movement_type'], 'employees': {'first_name': r['first_name'], 'last_name': r['last_name']} if r['first_name'] else None} for r in cursor.fetchall()]
        
        # recentLogs
        cursor.execute("""
            SELECT em.movement_type, em.created_at, e.first_name 
            FROM employee_movements em 
            LEFT JOIN employees e ON em.employee_id = e.id 
            ORDER BY em.created_at DESC LIMIT 5
        """)
        data['recentLogs'] = [{'movement_type': r['movement_type'], 'created_at': r['created_at'].isoformat() if r['created_at'] else None, 'employees': {'first_name': r['first_name']} if r['first_name'] else None} for r in cursor.fetchall()]

        return data
    except Exception as e:
        print(f"Error in kpis-dashboard: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/ai-context")
def get_ai_context():
    from datetime import datetime, timedelta
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        now = datetime.now()
        today = now.strftime('%Y-%m-%d')
        yesterday = (now - timedelta(days=1)).strftime('%Y-%m-%d')
        one_hour_ago = (now - timedelta(hours=1)).isoformat()
        
        data = {}
        
        # 1. activeStays
        cursor.execute("SELECT id FROM room_stays WHERE status NOT IN ('FINALIZADA')")
        data['activeStays'] = cursor.fetchall()
        
        # 2. totalRooms
        cursor.execute("SELECT id FROM rooms")
        data['totalRooms'] = cursor.fetchall()
        
        # 3. todayPayments
        cursor.execute("SELECT amount, status, created_at FROM payments WHERE created_at >= %s", (today,))
        data['todayPayments'] = [{'amount': r['amount'], 'status': r['status'], 'created_at': r['created_at'].isoformat() if r['created_at'] else None} for r in cursor.fetchall()]
        
        # 4. yesterdayPayments
        cursor.execute("SELECT amount, status FROM payments WHERE created_at >= %s AND created_at < %s", (yesterday, today))
        data['yesterdayPayments'] = cursor.fetchall()
        
        # 5. todayCheckins
        cursor.execute("SELECT id, check_in_at, valet_employee_id FROM room_stays WHERE check_in_at >= %s", (today,))
        data['todayCheckins'] = [{'id': str(r['id']), 'check_in_at': r['check_in_at'].isoformat() if r['check_in_at'] else None, 'valet_employee_id': str(r['valet_employee_id']) if r['valet_employee_id'] else None} for r in cursor.fetchall()]
        
        # 6. employees
        cursor.execute("SELECT id, first_name, last_name, role FROM employees WHERE deleted_at IS NULL")
        data['employees'] = [{'id': str(r['id']), 'first_name': r['first_name'], 'last_name': r['last_name'], 'role': r['role']} for r in cursor.fetchall()]
        
        # 7. recentAlerts
        cursor.execute("SELECT id, severity, event_type, created_at FROM audit_logs WHERE created_at >= %s", (one_hour_ago,))
        data['recentAlerts'] = [{'id': str(r['id']), 'severity': r['severity'], 'event_type': r['event_type'], 'created_at': r['created_at'].isoformat() if r['created_at'] else None} for r in cursor.fetchall()]
        
        return data
    except Exception as e:
        print(f"Error in ai-context: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/stock-alerts")
def get_stock_alerts():
    from datetime import datetime, timedelta
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        now = datetime.now()
        thirty_days_ago = (now - timedelta(days=30)).isoformat()
        
        # 1. Get products and nested stock info
        cursor.execute("""
            SELECT 
                p.id, p.name, p.sku, p.min_stock, c.name as category_name,
                s.qty, w.name as warehouse_name, w.code as warehouse_code
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN stock s ON p.id = s.product_id
            LEFT JOIN warehouses w ON s.warehouse_id = w.id
            WHERE p.is_active = TRUE
        """)
        raw_products = cursor.fetchall()
        
        # 2. Get recent consumptions
        cursor.execute("""
            SELECT product_id, SUM(quantity) as total_quantity
            FROM order_items 
            WHERE created_at >= %s
            GROUP BY product_id
        """, (thirty_days_ago,))
        consumptions = cursor.fetchall()
        
        consumption_map = {str(c['product_id']): float(c['total_quantity']) / 30.0 for c in consumptions}
        
        products = {}
        for row in raw_products:
            pid = str(row['id'])
            if pid not in products:
                products[pid] = {
                    'id': pid,
                    'name': row['name'],
                    'sku': row['sku'],
                    'min_stock': row['min_stock'],
                    'category_name': row['category_name'],
                    'stock': []
                }
            if row['qty'] is not None:
                products[pid]['stock'].append({
                    'qty': row['qty'],
                    'warehouse': {
                        'name': row['warehouse_name'],
                        'code': row['warehouse_code']
                    }
                })
        
        stock_alerts = []
        for pid, p in products.items():
            current_stock = sum(s['qty'] for s in p['stock'])
            min_stock = p['min_stock'] or 0
            
            status = 'normal'
            if current_stock == 0:
                status = 'critical'
            elif current_stock <= min_stock:
                status = 'low'
                
            deficit = max(0, min_stock - current_stock)
            
            warehouses = [{
                'warehouse_name': s['warehouse']['name'] or 'Desconocido',
                'warehouse_code': s['warehouse']['code'] or '',
                'qty': s['qty']
            } for s in p['stock']]
            
            daily_consumption = consumption_map.get(pid, 0)
            days_until_stockout = round(current_stock / daily_consumption) if daily_consumption > 0 else (999 if current_stock > 0 else 0)
            
            stock_alerts.append({
                'product_id': pid,
                'product_name': p['name'],
                'product_sku': p['sku'],
                'category_name': p['category_name'] or 'Sin categoría',
                'current_stock': current_stock,
                'min_stock': min_stock,
                'max_stock': 0,
                'status': status,
                'deficit': deficit,
                'days_until_stockout': days_until_stockout,
                'warehouses': warehouses
            })
            
        return stock_alerts
    except Exception as e:
        print(f"Error in stock-alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/profitability-report")
def get_profitability_report():
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute("""
            SELECT 
                p.id, p.name, p.sku, p.price, c.name as category_name,
                soi.qty, soi.unit_price
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            INNER JOIN sales_order_items soi ON p.id = soi.product_id
            INNER JOIN sales_orders so ON soi.sales_order_id = so.id
            WHERE so.status = 'CLOSED' AND p.is_active = TRUE
        """)
        rows = cursor.fetchall()
        
        products = {}
        category_map = {}
        
        for r in rows:
            pid = str(r['id'])
            if pid not in products:
                cost_price = float(r['price'] or 0) * 0.6
                products[pid] = {
                    'product_name': r['name'],
                    'product_sku': r['sku'],
                    'cost_price': cost_price,
                    'sell_price': float(r['price'] or 0),
                    'quantity_sold': 0,
                    'total_cost': 0,
                    'total_revenue': 0,
                    'profit': 0,
                    'margin_percentage': 0,
                    'roi': 0,
                    'category_name': r['category_name'] or 'Sin categoría'
                }
            
            qty = float(r['qty'] or 0)
            unit_price = float(r['unit_price'] or 0)
            
            products[pid]['quantity_sold'] += qty
            products[pid]['total_revenue'] += qty * unit_price
            products[pid]['total_cost'] += qty * products[pid]['cost_price']
            
        product_profitability = []
        for pid, p in products.items():
            if p['quantity_sold'] > 0:
                p['profit'] = p['total_revenue'] - p['total_cost']
                p['margin_percentage'] = (p['profit'] / p['total_revenue'] * 100) if p['total_revenue'] > 0 else 0
                p['roi'] = (p['profit'] / p['total_cost'] * 100) if p['total_cost'] > 0 else 0
                
                product_profitability.append(p)
                
                cat = p['category_name']
                if cat not in category_map:
                    category_map[cat] = {
                        'category_name': cat,
                        'total_cost': 0,
                        'total_revenue': 0,
                        'profit': 0
                    }
                category_map[cat]['total_cost'] += p['total_cost']
                category_map[cat]['total_revenue'] += p['total_revenue']
                category_map[cat]['profit'] += p['profit']

        category_profitability = []
        for cat, c in category_map.items():
            c['margin'] = (c['profit'] / c['total_revenue'] * 100) if c['total_revenue'] > 0 else 0
            category_profitability.append(c)
            
        category_profitability.sort(key=lambda x: x['profit'], reverse=True)
        
        total_cost = sum(p['total_cost'] for p in product_profitability)
        total_revenue = sum(p['total_revenue'] for p in product_profitability)
        total_profit = total_revenue - total_cost
        profit_margin = (total_profit / total_revenue * 100) if total_revenue > 0 else 0
        
        return {
            'totalProfit': total_profit,
            'totalCost': total_cost,
            'totalRevenue': total_revenue,
            'profitMargin': profit_margin,
            'productProfitability': product_profitability,
            'categoryProfitability': category_profitability
        }
    except Exception as e:
        print(f"Error in profitability-report: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/dashboard-overview")
def get_dashboard_overview():
    from datetime import datetime
    import calendar
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1).isoformat()
        
        # Calculate start and end of last month
        if now.month == 1:
            start_of_last_month = datetime(now.year - 1, 12, 1).isoformat()
            last_day = calendar.monthrange(now.year - 1, 12)[1]
            end_of_last_month = datetime(now.year - 1, 12, last_day, 23, 59, 59).isoformat()
        else:
            start_of_last_month = datetime(now.year, now.month - 1, 1).isoformat()
            last_day = calendar.monthrange(now.year, now.month - 1)[1]
            end_of_last_month = datetime(now.year, now.month - 1, last_day, 23, 59, 59).isoformat()
            
        start_of_today = datetime(now.year, now.month, now.day).isoformat()
        
        # 1. Current month sales
        cursor.execute("SELECT SUM(total) as total FROM sales_orders WHERE created_at >= %s AND status IN ('CLOSED', 'ENDED')", (start_of_month,))
        current_revenue = float(cursor.fetchone()['total'] or 0)
        
        # 2. Last month sales
        cursor.execute("SELECT SUM(total) as total FROM sales_orders WHERE created_at >= %s AND created_at <= %s AND status IN ('CLOSED', 'ENDED')", (start_of_last_month, end_of_last_month))
        last_revenue = float(cursor.fetchone()['total'] or 0)
        
        # 3. Today sales
        cursor.execute("SELECT SUM(total) as total, COUNT(*) as count FROM sales_orders WHERE created_at >= %s AND status IN ('CLOSED', 'ENDED')", (start_of_today,))
        today_row = cursor.fetchone()
        today_revenue = float(today_row['total'] or 0)
        today_orders_count = int(today_row['count'] or 0)
        
        # 4. Critical stock count
        cursor.execute("""
            SELECT p.id, p.min_stock, COALESCE(SUM(s.qty), 0) as total_stock
            FROM products p
            LEFT JOIN stock s ON p.id = s.product_id
            WHERE p.is_active = TRUE
            GROUP BY p.id, p.min_stock
        """)
        critical_stock_count = 0
        for row in cursor.fetchall():
            min_stock = row['min_stock'] or 0
            if row['total_stock'] < min_stock:
                critical_stock_count += 1
                
        # 5. Top products
        cursor.execute("""
            SELECT 
                p.id, p.name, p.sku,
                SUM(soi.qty) as sold,
                SUM(COALESCE(soi.total, soi.qty * soi.unit_price)) as revenue
            FROM sales_order_items soi
            INNER JOIN products p ON soi.product_id = p.id
            WHERE soi.created_at >= %s AND p.is_active = TRUE
            GROUP BY p.id, p.name, p.sku
            ORDER BY revenue DESC
            LIMIT 5
        """, (start_of_month,))
        
        top_products = [
            {
                'name': r['name'],
                'sku': r['sku'],
                'sold': r['sold'],
                'revenue': float(r['revenue'])
            } for r in cursor.fetchall()
        ]
        
        growth = 0
        if last_revenue > 0:
            growth = ((current_revenue - last_revenue) / last_revenue) * 100
        elif current_revenue > 0:
            growth = 100
            
        return {
            'monthlyRevenue': current_revenue,
            'monthlyRevenueGrowth': growth,
            'todaySales': today_revenue,
            'todayOrders': today_orders_count,
            'criticalStockCount': critical_stock_count,
            'topProducts': top_products
        }
    except Exception as e:
        print(f"Error in dashboard-overview: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
