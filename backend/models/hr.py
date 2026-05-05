from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class ShiftDefinitions(Base):
    __tablename__ = 'shift_definitions'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='shift_definitions_pkey'),
        UniqueConstraint('code', name='shift_definitions_code_key'),
        {'comment': 'Definición de los turnos disponibles'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    start_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[datetime.time] = mapped_column(Time, nullable=False)
    crosses_midnight: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'), comment='Indica si el turno cruza la medianoche (ej: 22:00 a 06:00)')
    color: Mapped[Optional[str]] = mapped_column(String(7), server_default=text("'#3B82F6'::character varying"))
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employee_schedules: Mapped[list['EmployeeSchedules']] = relationship('EmployeeSchedules', back_populates='shift_definition')
    shift_sessions: Mapped[list['ShiftSessions']] = relationship('ShiftSessions', back_populates='shift_definition')
    shift_closings: Mapped[list['ShiftClosings']] = relationship('ShiftClosings', back_populates='shift_definition')


class Employees(Base):
    __tablename__ = 'employees'
    __table_args__ = (
        CheckConstraint("role::text = ANY (ARRAY['admin'::character varying::text, 'manager'::character varying::text, 'receptionist'::character varying::text, 'cochero'::character varying::text, 'camarista'::character varying::text, 'mantenimiento'::character varying::text])", name='employees_role_check'),
        ForeignKeyConstraint(['auth_user_id'], ['auth.users.id'], ondelete='SET NULL', name='employees_auth_user_id_fkey'),
        ForeignKeyConstraint(['role_id'], ['roles.id'], name='employees_role_id_fkey'),
        PrimaryKeyConstraint('id', name='employees_pkey'),
        UniqueConstraint('email', name='employees_email_key'),
        Index('employees_auth_user_id_idx', 'auth_user_id'),
        Index('idx_employees_active', 'is_active'),
        Index('idx_employees_auth_user', 'auth_user_id'),
        Index('idx_employees_auth_user_id', 'auth_user_id', postgresql_where='(auth_user_id IS NOT NULL)', unique=True),
        Index('idx_employees_deleted_at', 'deleted_at', postgresql_where='(deleted_at IS NULL)'),
        Index('idx_employees_email', 'email'),
        Index('idx_employees_role', 'role'),
        {'comment': 'Empleados del sistema (recepcionistas, administradores)'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False, server_default=text("'receptionist'::character varying"), comment='Rol: admin (todo), manager (gestión), receptionist (operación)')
    auth_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='UUID del usuario en Supabase Auth para vinculación segura')
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    pin_code: Mapped[Optional[str]] = mapped_column(String(6), comment='PIN de 4-6 dígitos para acceso rápido opcional')
    avatar_url: Mapped[Optional[str]] = mapped_column(Text)
    hired_at: Mapped[Optional[datetime.date]] = mapped_column(Date, server_default=text('CURRENT_DATE'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    deleted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    push_token: Mapped[Optional[str]] = mapped_column(Text)
    push_token_updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    auth_user: Mapped[Optional['Users']] = relationship('Users', back_populates='employees')
    role_: Mapped[Optional['Roles']] = relationship('Roles', back_populates='employees')
    audit_logs: Mapped[list['AuditLogs']] = relationship('AuditLogs', back_populates='employee')
    employee_schedules_created_by: Mapped[list['EmployeeSchedules']] = relationship('EmployeeSchedules', foreign_keys='[EmployeeSchedules.created_by]', back_populates='employees')
    employee_schedules_employee: Mapped[list['EmployeeSchedules']] = relationship('EmployeeSchedules', foreign_keys='[EmployeeSchedules.employee_id]', back_populates='employee')
    notification_templates: Mapped[list['NotificationTemplates']] = relationship('NotificationTemplates', back_populates='employees')
    notifications: Mapped[list['Notifications']] = relationship('Notifications', back_populates='employee')
    push_subscriptions: Mapped[list['PushSubscriptions']] = relationship('PushSubscriptions', back_populates='employee')
    rooms: Mapped[list['Rooms']] = relationship('Rooms', back_populates='cleaning_by_employee')
    surveys: Mapped[list['Surveys']] = relationship('Surveys', back_populates='employees')
    room_assets: Mapped[list['RoomAssets']] = relationship('RoomAssets', back_populates='assigned_employee')
    room_cleanings: Mapped[list['RoomCleanings']] = relationship('RoomCleanings', back_populates='employee')
    shift_sessions: Mapped[list['ShiftSessions']] = relationship('ShiftSessions', back_populates='employee')
    employee_movements: Mapped[list['EmployeeMovements']] = relationship('EmployeeMovements', back_populates='employee')
    room_asset_logs_assigned_to_employee: Mapped[list['RoomAssetLogs']] = relationship('RoomAssetLogs', foreign_keys='[RoomAssetLogs.assigned_to_employee_id]', back_populates='assigned_to_employee')
    room_asset_logs_employee: Mapped[list['RoomAssetLogs']] = relationship('RoomAssetLogs', foreign_keys='[RoomAssetLogs.employee_id]', back_populates='employee')
    shift_closings_employee: Mapped[list['ShiftClosings']] = relationship('ShiftClosings', foreign_keys='[ShiftClosings.employee_id]', back_populates='employee')
    shift_closings_reviewed_by: Mapped[list['ShiftClosings']] = relationship('ShiftClosings', foreign_keys='[ShiftClosings.reviewed_by]', back_populates='employees')
    shift_expenses_authorized_by: Mapped[list['ShiftExpenses']] = relationship('ShiftExpenses', foreign_keys='[ShiftExpenses.authorized_by]', back_populates='employees')
    shift_expenses_employee: Mapped[list['ShiftExpenses']] = relationship('ShiftExpenses', foreign_keys='[ShiftExpenses.employee_id]', back_populates='employee')
    payments_collected_by: Mapped[list['Payments']] = relationship('Payments', foreign_keys='[Payments.collected_by]', back_populates='employees')
    payments_confirmed_by: Mapped[list['Payments']] = relationship('Payments', foreign_keys='[Payments.confirmed_by]', back_populates='employees_')
    payments_employee: Mapped[list['Payments']] = relationship('Payments', foreign_keys='[Payments.employee_id]', back_populates='employee')
    room_stays_checkout_valet_employee: Mapped[list['RoomStays']] = relationship('RoomStays', foreign_keys='[RoomStays.checkout_valet_employee_id]', back_populates='checkout_valet_employee')
    room_stays_valet_employee: Mapped[list['RoomStays']] = relationship('RoomStays', foreign_keys='[RoomStays.valet_employee_id]', back_populates='valet_employee')
    sales_order_items_delivery_accepted_by: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', foreign_keys='[SalesOrderItems.delivery_accepted_by]', back_populates='employees')
    sales_order_items_delivery_picked_up_by: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', foreign_keys='[SalesOrderItems.delivery_picked_up_by]', back_populates='employees_')
    sales_order_items_payment_received_by: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', foreign_keys='[SalesOrderItems.payment_received_by]', back_populates='employees1')
    shift_closing_reviews: Mapped[list['ShiftClosingReviews']] = relationship('ShiftClosingReviews', back_populates='reviewer')


class EmployeeSchedules(Base):
    __tablename__ = 'employee_schedules'
    __table_args__ = (
        ForeignKeyConstraint(['created_by'], ['employees.id'], name='employee_schedules_created_by_fkey'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE', name='employee_schedules_employee_id_fkey'),
        ForeignKeyConstraint(['shift_definition_id'], ['shift_definitions.id'], ondelete='CASCADE', name='employee_schedules_shift_definition_id_fkey'),
        PrimaryKeyConstraint('id', name='employee_schedules_pkey'),
        UniqueConstraint('employee_id', 'schedule_date', name='employee_schedules_employee_id_schedule_date_key'),
        Index('idx_schedules_date', 'schedule_date'),
        Index('idx_schedules_date_shift', 'schedule_date', 'shift_definition_id'),
        Index('idx_schedules_employee', 'employee_id'),
        Index('idx_schedules_shift', 'shift_definition_id'),
        {'comment': 'Calendario de turnos asignados a cada empleado'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    shift_definition_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    schedule_date: Mapped[datetime.date] = mapped_column(Date, nullable=False)
    is_day_off: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'), comment='Marca el día como descanso para el empleado')
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employees: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[created_by], back_populates='employee_schedules_created_by')
    employee: Mapped['Employees'] = relationship('Employees', foreign_keys=[employee_id], back_populates='employee_schedules_employee')
    shift_definition: Mapped['ShiftDefinitions'] = relationship('ShiftDefinitions', back_populates='employee_schedules')
    shift_sessions: Mapped[list['ShiftSessions']] = relationship('ShiftSessions', back_populates='schedule')


class ShiftSessions(Base):
    __tablename__ = 'shift_sessions'
    __table_args__ = (
        CheckConstraint("status::text = ANY (ARRAY['active'::character varying::text, 'pending_closing'::character varying::text, 'closed'::character varying::text, 'cancelled'::character varying::text])", name='shift_sessions_status_check'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE', name='shift_sessions_employee_id_fkey'),
        ForeignKeyConstraint(['schedule_id'], ['employee_schedules.id'], name='shift_sessions_schedule_id_fkey'),
        ForeignKeyConstraint(['shift_definition_id'], ['shift_definitions.id'], name='shift_sessions_shift_definition_id_fkey'),
        PrimaryKeyConstraint('id', name='shift_sessions_pkey'),
        Index('idx_shift_sessions_active_by_role', 'status', postgresql_where="((status)::text = 'active'::text)"),
        Index('idx_shift_sessions_clock_in', 'clock_in_at'),
        Index('idx_shift_sessions_employee', 'employee_id'),
        Index('idx_shift_sessions_pending_by_employee', 'employee_id', 'status', 'clock_out_at', postgresql_where="((status)::text = 'pending_closing'::text)"),
        Index('idx_shift_sessions_status', 'status'),
        {'comment': 'Registro de entrada/salida de empleados por turno'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    shift_definition_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    clock_in_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'), comment='Hora real de entrada del empleado')
    schedule_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    clock_out_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Hora real de salida (NULL = turno activo)')
    status: Mapped[Optional[str]] = mapped_column(String(20), server_default=text("'active'::character varying"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employee: Mapped['Employees'] = relationship('Employees', back_populates='shift_sessions')
    schedule: Mapped[Optional['EmployeeSchedules']] = relationship('EmployeeSchedules', back_populates='shift_sessions')
    shift_definition: Mapped['ShiftDefinitions'] = relationship('ShiftDefinitions', back_populates='shift_sessions')
    employee_movements: Mapped[list['EmployeeMovements']] = relationship('EmployeeMovements', back_populates='shift_session')
    sales_orders: Mapped[list['SalesOrders']] = relationship('SalesOrders', back_populates='shift_session')
    shift_closings: Mapped[list['ShiftClosings']] = relationship('ShiftClosings', back_populates='shift_session')
    shift_expenses: Mapped[list['ShiftExpenses']] = relationship('ShiftExpenses', back_populates='shift_session')
    payments: Mapped[list['Payments']] = relationship('Payments', back_populates='shift_session')
    room_stays_checkout_shift_session: Mapped[list['RoomStays']] = relationship('RoomStays', foreign_keys='[RoomStays.checkout_shift_session_id]', back_populates='checkout_shift_session')
    room_stays_shift_session: Mapped[list['RoomStays']] = relationship('RoomStays', foreign_keys='[RoomStays.shift_session_id]', back_populates='shift_session')
    sales_order_items: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', back_populates='shift_session')


class EmployeeMovements(Base):
    __tablename__ = 'employee_movements'
    __table_args__ = (
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE', name='employee_movements_employee_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], ondelete='SET NULL', name='employee_movements_shift_session_id_fkey'),
        PrimaryKeyConstraint('id', name='employee_movements_pkey'),
        Index('idx_employee_movements_created_at', 'created_at'),
        Index('idx_employee_movements_employee_date', 'employee_id', 'created_at'),
        Index('idx_employee_movements_employee_id', 'employee_id'),
        Index('idx_employee_movements_entity_type', 'entity_type'),
        Index('idx_employee_movements_movement_type', 'movement_type'),
        Index('idx_employee_movements_shift_session_id', 'shift_session_id'),
        Index('idx_employee_movements_status', 'status')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    movement_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    quantity: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('1'))
    status: Mapped[Optional[str]] = mapped_column(String(20), server_default=text("'completed'::character varying"))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    metadata_: Mapped[Optional[dict]] = mapped_column('metadata', JSONB, server_default=text("'{}'::jsonb"))

    employee: Mapped['Employees'] = relationship('Employees', back_populates='employee_movements')
    shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', back_populates='employee_movements')


class ShiftClosings(Base):
    __tablename__ = 'shift_closings'
    __table_args__ = (
        CheckConstraint("status::text = ANY (ARRAY['pending'::character varying::text, 'approved'::character varying::text, 'rejected'::character varying::text, 'reviewed'::character varying::text])", name='shift_closings_status_check'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], name='shift_closings_employee_id_fkey'),
        ForeignKeyConstraint(['original_closing_id'], ['shift_closings.id'], name='shift_closings_original_closing_id_fkey'),
        ForeignKeyConstraint(['reviewed_by'], ['employees.id'], name='shift_closings_reviewed_by_fkey'),
        ForeignKeyConstraint(['shift_definition_id'], ['shift_definitions.id'], name='shift_closings_shift_definition_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], ondelete='CASCADE', name='shift_closings_shift_session_id_fkey'),
        PrimaryKeyConstraint('id', name='shift_closings_pkey'),
        Index('idx_closings_employee', 'employee_id'),
        Index('idx_closings_period', 'period_start', 'period_end'),
        Index('idx_closings_session', 'shift_session_id'),
        Index('idx_closings_status', 'status'),
        Index('idx_shift_closings_original_id', 'original_closing_id'),
        Index('idx_shift_closings_status', 'status'),
        {'comment': 'Cortes de caja al final de cada turno'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    shift_session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    shift_definition_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    period_start: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    period_end: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    total_cash: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2), server_default=text('0'))
    total_card_bbva: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2), server_default=text('0'))
    total_card_getnet: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2), server_default=text('0'))
    total_sales: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2), server_default=text('0'))
    total_transactions: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('0'))
    counted_cash: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2))
    cash_difference: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(12, 2), comment='Positivo = sobrante, Negativo = faltante')
    cash_breakdown: Mapped[Optional[dict]] = mapped_column(JSONB, comment='Desglose de billetes: {"1000": 2, "500": 5, "200": 3, ...}')
    status: Mapped[Optional[str]] = mapped_column(String(20), server_default=text("'pending'::character varying"))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    reviewed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text)
    original_closing_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    is_correction: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    total_expenses: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    expenses_count: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('0'))
    declared_card_bbva: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    declared_card_getnet: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    declared_transfer: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    card_difference_bbva: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    card_difference_getnet: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))
    transfer_difference: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'))

    employee: Mapped['Employees'] = relationship('Employees', foreign_keys=[employee_id], back_populates='shift_closings_employee')
    original_closing: Mapped[Optional['ShiftClosings']] = relationship('ShiftClosings', remote_side=[id], back_populates='original_closing_reverse')
    original_closing_reverse: Mapped[list['ShiftClosings']] = relationship('ShiftClosings', remote_side=[original_closing_id], back_populates='original_closing')
    employees: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[reviewed_by], back_populates='shift_closings_reviewed_by')
    shift_definition: Mapped['ShiftDefinitions'] = relationship('ShiftDefinitions', back_populates='shift_closings')
    shift_session: Mapped['ShiftSessions'] = relationship('ShiftSessions', back_populates='shift_closings')
    shift_closing_reviews: Mapped[list['ShiftClosingReviews']] = relationship('ShiftClosingReviews', back_populates='shift_closing')
    shift_closing_details: Mapped[list['ShiftClosingDetails']] = relationship('ShiftClosingDetails', back_populates='shift_closing')


class ShiftExpenses(Base):
    __tablename__ = 'shift_expenses'
    __table_args__ = (
        CheckConstraint("expense_type::text = ANY (ARRAY['UBER'::character varying::text, 'MAINTENANCE'::character varying::text, 'REPAIR'::character varying::text, 'SUPPLIES'::character varying::text, 'PETTY_CASH'::character varying::text, 'OTHER'::character varying::text, 'CASH_ADJUSTMENT'::character varying::text])", name='shift_expenses_expense_type_check'),
        CheckConstraint("status::text = ANY (ARRAY['pending'::character varying::text, 'approved'::character varying::text, 'rejected'::character varying::text])", name='shift_expenses_status_check'),
        ForeignKeyConstraint(['authorized_by'], ['employees.id'], name='shift_expenses_authorized_by_fkey'),
        ForeignKeyConstraint(['created_by'], ['auth.users.id'], name='shift_expenses_created_by_fkey'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], name='shift_expenses_employee_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], ondelete='CASCADE', name='shift_expenses_shift_session_id_fkey'),
        PrimaryKeyConstraint('id', name='shift_expenses_pkey'),
        Index('idx_shift_expenses_created_at', 'created_at'),
        Index('idx_shift_expenses_employee', 'employee_id'),
        Index('idx_shift_expenses_session', 'shift_session_id'),
        Index('idx_shift_expenses_status', 'status'),
        Index('idx_shift_expenses_type', 'expense_type'),
        {'comment': 'Tracks cash disbursements during shifts (Uber, maintenance, '
                'repairs, etc.)'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    shift_session_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    employee_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    expense_type: Mapped[str] = mapped_column(String(50), nullable=False, comment='Type of expense: UBER, MAINTENANCE, REPAIR, SUPPLIES, PETTY_CASH, OTHER')
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    authorized_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    recipient: Mapped[Optional[str]] = mapped_column(String(255))
    receipt_number: Mapped[Optional[str]] = mapped_column(String(100))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    status: Mapped[Optional[str]] = mapped_column(String(20), server_default=text("'pending'::character varying"), comment='Approval status: pending, approved, rejected')

    employees: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[authorized_by], back_populates='shift_expenses_authorized_by')
    users: Mapped[Optional['Users']] = relationship('Users', back_populates='shift_expenses')
    employee: Mapped['Employees'] = relationship('Employees', foreign_keys=[employee_id], back_populates='shift_expenses_employee')
    shift_session: Mapped['ShiftSessions'] = relationship('ShiftSessions', back_populates='shift_expenses')


class ShiftClosingReviews(Base):
    __tablename__ = 'shift_closing_reviews'
    __table_args__ = (
        CheckConstraint("action::text = ANY (ARRAY['approved'::character varying::text, 'rejected'::character varying::text, 'pending'::character varying::text])", name='shift_closing_reviews_action_check'),
        ForeignKeyConstraint(['reviewer_id'], ['employees.id'], name='shift_closing_reviews_reviewer_id_fkey'),
        ForeignKeyConstraint(['shift_closing_id'], ['shift_closings.id'], ondelete='CASCADE', name='shift_closing_reviews_shift_closing_id_fkey'),
        PrimaryKeyConstraint('id', name='shift_closing_reviews_pkey'),
        Index('idx_shift_closing_reviews_closing_id', 'shift_closing_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    shift_closing_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    reviewer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    reviewer: Mapped['Employees'] = relationship('Employees', back_populates='shift_closing_reviews')
    shift_closing: Mapped['ShiftClosings'] = relationship('ShiftClosings', back_populates='shift_closing_reviews')


class ShiftClosingDetails(Base):
    __tablename__ = 'shift_closing_details'
    __table_args__ = (
        ForeignKeyConstraint(['payment_id'], ['payments.id'], name='shift_closing_details_payment_id_fkey'),
        ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], name='shift_closing_details_sales_order_id_fkey'),
        ForeignKeyConstraint(['shift_closing_id'], ['shift_closings.id'], ondelete='CASCADE', name='shift_closing_details_shift_closing_id_fkey'),
        PrimaryKeyConstraint('id', name='shift_closing_details_pkey'),
        Index('idx_closing_details_closing', 'shift_closing_id'),
        Index('idx_closing_details_payment', 'payment_id'),
        {'comment': 'Detalle de cada transacción incluida en un corte de caja'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    shift_closing_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    payment_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    terminal_code: Mapped[Optional[str]] = mapped_column(String(20))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    payment: Mapped['Payments'] = relationship('Payments', back_populates='shift_closing_details')
    sales_order: Mapped[Optional['SalesOrders']] = relationship('SalesOrders', back_populates='shift_closing_details')
    shift_closing: Mapped['ShiftClosings'] = relationship('ShiftClosings', back_populates='shift_closing_details')
