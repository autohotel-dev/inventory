from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class RoomTypes(Base):
    __tablename__ = 'room_types'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='room_types_pkey'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    base_price: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    weekday_hours: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('12'))
    weekend_hours: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('8'))
    is_hotel: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('false'))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    extra_person_price: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text('0'))
    extra_hour_price: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default=text('0'))
    max_people: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('2'))

    rooms: Mapped[list['Rooms']] = relationship('Rooms', back_populates='room_type')


class Rooms(Base):
    __tablename__ = 'rooms'
    __table_args__ = (
        CheckConstraint("status = ANY (ARRAY['LIBRE'::text, 'OCUPADA'::text, 'SUCIA'::text, 'BLOQUEADA'::text, 'LIMPIANDO'::text, 'MANTENIMIENTO'::text])", name='rooms_status_check'),
        ForeignKeyConstraint(['cleaning_by_employee_id'], ['employees.id'], ondelete='SET NULL', name='rooms_cleaning_by_employee_id_fkey'),
        ForeignKeyConstraint(['room_type_id'], ['room_types.id'], name='rooms_room_type_id_fkey'),
        PrimaryKeyConstraint('id', name='rooms_pkey'),
        UniqueConstraint('number', name='rooms_number_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    number: Mapped[str] = mapped_column(Text, nullable=False)
    room_type_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'LIBRE'::text"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    maintenance_image_url: Mapped[Optional[str]] = mapped_column(Text, comment='URL pública de la foto de evidencia de mantenimiento/daño cuando la habitación está BLOQUEADA')
    cleaning_started_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    cleaning_by_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    cleaning_by_employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='rooms')
    room_type: Mapped['RoomTypes'] = relationship('RoomTypes', back_populates='rooms')
    room_assets: Mapped[list['RoomAssets']] = relationship('RoomAssets', back_populates='room')
    room_cleanings: Mapped[list['RoomCleanings']] = relationship('RoomCleanings', back_populates='room')
    sensors: Mapped[list['Sensors']] = relationship('Sensors', back_populates='room')
    room_asset_logs: Mapped[list['RoomAssetLogs']] = relationship('RoomAssetLogs', back_populates='room')
    room_stays: Mapped[list['RoomStays']] = relationship('RoomStays', back_populates='room')
    operation_flows: Mapped[list['OperationFlows']] = relationship('OperationFlows', back_populates='room')


class RoomAssets(Base):
    __tablename__ = 'room_assets'
    __table_args__ = (
        ForeignKeyConstraint(['assigned_employee_id'], ['employees.id'], ondelete='SET NULL', name='room_assets_assigned_employee_id_fkey'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE', name='room_assets_room_id_fkey'),
        PrimaryKeyConstraint('id', name='room_assets_pkey'),
        UniqueConstraint('room_id', 'asset_type', name='room_assets_room_id_asset_type_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    room_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    asset_type: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'EN_HABITACION'::text"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    assigned_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    assigned_employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='room_assets')
    room: Mapped['Rooms'] = relationship('Rooms', back_populates='room_assets')
    room_asset_logs: Mapped[list['RoomAssetLogs']] = relationship('RoomAssetLogs', back_populates='asset')


class RoomCleanings(Base):
    __tablename__ = 'room_cleanings'
    __table_args__ = (
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='SET NULL', name='room_cleanings_employee_id_fkey'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='CASCADE', name='room_cleanings_room_id_fkey'),
        PrimaryKeyConstraint('id', name='room_cleanings_pkey'),
        Index('idx_room_cleanings_dates', 'started_at', 'ended_at'),
        Index('idx_room_cleanings_employee', 'employee_id'),
        Index('idx_room_cleanings_room', 'room_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    room_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    started_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    ended_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='room_cleanings')
    room: Mapped['Rooms'] = relationship('Rooms', back_populates='room_cleanings')


class RoomAssetLogs(Base):
    __tablename__ = 'room_asset_logs'
    __table_args__ = (
        ForeignKeyConstraint(['asset_id'], ['room_assets.id'], ondelete='CASCADE', name='room_asset_logs_asset_id_fkey'),
        ForeignKeyConstraint(['assigned_to_employee_id'], ['employees.id'], ondelete='SET NULL', name='room_asset_logs_assigned_to_employee_id_fkey'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='SET NULL', name='room_asset_logs_employee_id_fkey'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='SET NULL', name='room_asset_logs_room_id_fkey'),
        PrimaryKeyConstraint('id', name='room_asset_logs_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    asset_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    new_status: Mapped[str] = mapped_column(Text, nullable=False)
    action_type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    previous_status: Mapped[Optional[str]] = mapped_column(Text)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    assigned_to_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    room_number: Mapped[Optional[str]] = mapped_column(Text)

    asset: Mapped['RoomAssets'] = relationship('RoomAssets', back_populates='room_asset_logs')
    assigned_to_employee: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[assigned_to_employee_id], back_populates='room_asset_logs_assigned_to_employee')
    employee: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[employee_id], back_populates='room_asset_logs_employee')
    room: Mapped[Optional['Rooms']] = relationship('Rooms', back_populates='room_asset_logs')


class RoomStays(Base):
    __tablename__ = 'room_stays'
    __table_args__ = (
        CheckConstraint("status = ANY (ARRAY['ACTIVA'::text, 'FINALIZADA'::text, 'CANCELADA'::text])", name='room_stays_status_check'),
        CheckConstraint("tolerance_type = ANY (ARRAY['PERSON_LEFT'::text, 'ROOM_EMPTY'::text, NULL::text])", name='room_stays_tolerance_type_check'),
        ForeignKeyConstraint(['checkout_shift_session_id'], ['shift_sessions.id'], ondelete='SET NULL', name='room_stays_checkout_shift_session_id_fkey'),
        ForeignKeyConstraint(['checkout_valet_employee_id'], ['employees.id'], name='room_stays_checkout_valet_employee_id_fkey'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], name='room_stays_room_id_fkey'),
        ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], name='room_stays_sales_order_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], name='room_stays_shift_session_id_fkey'),
        ForeignKeyConstraint(['valet_employee_id'], ['employees.id'], name='room_stays_valet_employee_id_fkey'),
        PrimaryKeyConstraint('id', name='room_stays_pkey'),
        UniqueConstraint('guest_access_token', name='room_stays_guest_access_token_key'),
        Index('idx_room_stays_checkout_shift', 'checkout_shift_session_id'),
        Index('idx_room_stays_guest_token', 'guest_access_token'),
        Index('idx_room_stays_shift', 'shift_session_id'),
        Index('idx_room_stays_status', 'status'),
        Index('idx_room_stays_status_room', 'status', 'room_id'),
        Index('idx_room_stays_valet', 'valet_employee_id'),
        Index('idx_room_stays_valet_checkout_requested', 'valet_checkout_requested_at', postgresql_where='(valet_checkout_requested_at IS NOT NULL)'),
        Index('idx_room_stays_vehicle_plate', 'vehicle_plate', postgresql_where='(vehicle_plate IS NOT NULL)'),
        Index('idx_room_stays_vehicle_requested', 'vehicle_requested_at', postgresql_where='(vehicle_requested_at IS NOT NULL)')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    room_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    sales_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    check_in_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    expected_check_out_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'ACTIVA'::text"))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    current_people: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('2'))
    total_people: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('2'))
    actual_check_out_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    tolerance_started_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp cuando inició el período de tolerancia de 1 hora (solo motel)')
    tolerance_type: Mapped[Optional[str]] = mapped_column(Text, comment='Tipo de tolerancia: PERSON_LEFT (persona salió) o ROOM_EMPTY (habitación vacía)')
    vehicle_plate: Mapped[Optional[str]] = mapped_column(String(20), server_default=text('NULL::character varying'), comment='Placas del vehículo del huésped')
    vehicle_brand: Mapped[Optional[str]] = mapped_column(String(50), server_default=text('NULL::character varying'), comment='Marca del vehículo (ej: Toyota, Honda, Ford)')
    vehicle_model: Mapped[Optional[str]] = mapped_column(String(50), server_default=text('NULL::character varying'), comment='Modelo del vehículo (ej: Corolla, Civic, F-150)')
    valet_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Employee (cochero) assigned to this room stay - optional, can be assigned when they bring the order')
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Shift session active when the stay started')
    checkout_valet_employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='ID del empleado (cochero) que entregó el vehículo al cliente durante el checkout')
    guest_access_token: Mapped[Optional[str]] = mapped_column(Text)
    vehicle_requested_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp when reception requested the vehicle (Valet functionality)')
    valet_checkout_requested_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp when valet notified that guest is leaving (proposing checkout)')
    checkout_payment_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    checkout_shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    checkout_shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', foreign_keys=[checkout_shift_session_id], back_populates='room_stays_checkout_shift_session')
    checkout_valet_employee: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[checkout_valet_employee_id], back_populates='room_stays_checkout_valet_employee')
    room: Mapped['Rooms'] = relationship('Rooms', back_populates='room_stays')
    sales_order: Mapped['SalesOrders'] = relationship('SalesOrders', back_populates='room_stays')
    shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', foreign_keys=[shift_session_id], back_populates='room_stays_shift_session')
    valet_employee: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[valet_employee_id], back_populates='room_stays_valet_employee')
    guest_subscriptions: Mapped[list['GuestSubscriptions']] = relationship('GuestSubscriptions', back_populates='room_stay')
    operation_flows: Mapped[list['OperationFlows']] = relationship('OperationFlows', back_populates='room_stay')
    survey_responses: Mapped[list['SurveyResponses']] = relationship('SurveyResponses', back_populates='room_stay')


class GuestSubscriptions(Base):
    __tablename__ = 'guest_subscriptions'
    __table_args__ = (
        ForeignKeyConstraint(['room_stay_id'], ['room_stays.id'], ondelete='CASCADE', name='guest_subscriptions_room_stay_id_fkey'),
        PrimaryKeyConstraint('id', name='guest_subscriptions_pkey'),
        Index('idx_guest_subscriptions_active', 'is_active', postgresql_where='(is_active = true)'),
        Index('idx_guest_subscriptions_room_number', 'room_number'),
        Index('idx_guest_subscriptions_room_stay', 'room_stay_id'),
        {'comment': 'Web push notification subscriptions for hotel guests'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    room_stay_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    room_number: Mapped[str] = mapped_column(Text, nullable=False)
    subscription_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    subscribed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    last_notified_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    room_stay: Mapped['RoomStays'] = relationship('RoomStays', back_populates='guest_subscriptions')
    guest_notifications: Mapped[list['GuestNotifications']] = relationship('GuestNotifications', back_populates='guest_subscription')
