from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class Conversations(Base):
    __tablename__ = 'conversations'
    __table_args__ = (
        CheckConstraint("type = ANY (ARRAY['direct'::text, 'group'::text, 'global'::text])", name='conversations_type_check'),
        PrimaryKeyConstraint('id', name='conversations_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    type: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))

    conversation_participants: Mapped[list['ConversationParticipants']] = relationship('ConversationParticipants', back_populates='conversation')
    messages: Mapped[list['Messages']] = relationship('Messages', back_populates='conversation')


class ConversationParticipants(Base):
    __tablename__ = 'conversation_participants'
    __table_args__ = (
        ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE', name='conversation_participants_conversation_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='conversation_participants_user_id_fkey'),
        PrimaryKeyConstraint('conversation_id', 'user_id', name='conversation_participants_pkey')
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    joined_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))

    conversation: Mapped['Conversations'] = relationship('Conversations', back_populates='conversation_participants')
    user: Mapped['Users'] = relationship('Users', back_populates='conversation_participants')


class MediaLibrary(Base):
    __tablename__ = 'media_library'
    __table_args__ = (
        CheckConstraint("category = ANY (ARRAY['logo'::text, 'banner'::text, 'document'::text, 'other'::text])", name='media_library_category_check'),
        CheckConstraint("file_type = ANY (ARRAY['image'::text, 'document'::text, 'other'::text])", name='media_library_file_type_check'),
        ForeignKeyConstraint(['uploaded_by'], ['auth.users.id'], ondelete='SET NULL', name='media_library_uploaded_by_fkey'),
        PrimaryKeyConstraint('id', name='media_library_pkey'),
        UniqueConstraint('file_path', name='media_library_file_path_key'),
        Index('idx_media_library_category', 'category'),
        Index('idx_media_library_created_at', 'created_at'),
        Index('idx_media_library_file_type', 'file_type'),
        Index('idx_media_library_uploaded_by', 'uploaded_by'),
        {'comment': 'Biblioteca de medios para almacenar logos, imágenes y documentos'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False, comment='Ruta relativa del archivo en Supabase Storage')
    file_url: Mapped[str] = mapped_column(Text, nullable=False, comment='URL pública completa del archivo')
    file_type: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'other'::text"), comment='Categoría del archivo: logo, banner, document, other')
    description: Mapped[Optional[str]] = mapped_column(Text)
    uploaded_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    users: Mapped[Optional['Users']] = relationship('Users', back_populates='media_library')


class Messages(Base):
    __tablename__ = 'messages'
    __table_args__ = (
        CheckConstraint("message_type = ANY (ARRAY['text'::text, 'image'::text])", name='messages_message_type_check'),
        ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE', name='messages_conversation_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], name='messages_user_id_fkey'),
        PrimaryKeyConstraint('id', name='messages_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))
    conversation_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    user_email: Mapped[Optional[str]] = mapped_column(Text)
    is_admin: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    is_read: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    media_url: Mapped[Optional[str]] = mapped_column(Text)
    message_type: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'text'::text"))
    is_edited: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    deleted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    conversation: Mapped['Conversations'] = relationship('Conversations', back_populates='messages')
    user: Mapped['Users'] = relationship('Users', back_populates='messages')


class SystemConfig(Base):
    __tablename__ = 'system_config'
    __table_args__ = (
        ForeignKeyConstraint(['updated_by'], ['auth.users.id'], name='system_config_updated_by_fkey'),
        PrimaryKeyConstraint('id', name='system_config_pkey'),
        {'comment': 'Shared business configuration (singleton). Settings here apply to '
                'all devices.'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    initial_cash_fund: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default=text('500'), comment='Fondo de caja inicial para cada turno de recepción')
    valet_advance_amount: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default=text('300'), comment='Adelanto en efectivo por cada cochero en turno')
    include_global_sales_in_shift: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'), comment='Si incluye ventas de Admin/Otros en el reporte de turno')
    auto_charge_extra_hours: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text('true'), comment='Si está habilitado, genera el cobro de la hora extra de forma automática')
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    max_pending_quick_checkins: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('4'))
    max_shifts_receptionist: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('1'), comment='Máximo de recepcionistas con turno activo simultáneamente')
    max_shifts_valet: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('4'), comment='Máximo de cocheros con turno activo simultáneamente')
    max_shifts_admin: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('2'), comment='Máximo de administradores con turno activo simultáneamente')
    emergency_code: Mapped[Optional[str]] = mapped_column(Text, comment='Código temporal de 4 dígitos para autorización remota de supervisores')
    emergency_code_expires_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Fecha/hora de expiración del código temporal (30 minutos por defecto)')
    thermal_printer_ip: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'192.168.0.106'::text"))
    thermal_printer_port: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('9100'))
    hp_printer_ip: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'192.168.0.108'::text"))
    hp_printer_port: Mapped[Optional[int]] = mapped_column(Integer, server_default=text('9100'))
    print_server_url: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'http://localhost:3001'::text"))

    users: Mapped[Optional['Users']] = relationship('Users', back_populates='system_config')


class SystemTelemetry(Base):
    __tablename__ = 'system_telemetry'
    __table_args__ = (
        CheckConstraint("action_type = ANY (ARRAY['UI_CLICK'::text, 'API_REQUEST'::text, 'PAGE_VIEW'::text])", name='system_telemetry_action_type_check'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='SET NULL', name='system_telemetry_user_id_fkey'),
        PrimaryKeyConstraint('id', name='system_telemetry_pkey'),
        Index('idx_system_telemetry_action_type', 'action_type'),
        Index('idx_system_telemetry_created_at', 'created_at'),
        Index('idx_system_telemetry_module', 'module'),
        Index('idx_system_telemetry_user_id', 'user_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    action_type: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    module: Mapped[Optional[str]] = mapped_column(Text)
    page: Mapped[Optional[str]] = mapped_column(Text)
    action_name: Mapped[Optional[str]] = mapped_column(Text)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    endpoint: Mapped[Optional[str]] = mapped_column(Text)
    is_success: Mapped[Optional[bool]] = mapped_column(Boolean)
    error_details: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    user: Mapped[Optional['Users']] = relationship('Users', back_populates='system_telemetry')


class AuditLogs(Base):
    __tablename__ = 'audit_logs'
    __table_args__ = (
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='SET NULL', name='audit_logs_employee_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='SET NULL', name='audit_logs_user_id_fkey'),
        PrimaryKeyConstraint('id', name='audit_logs_pkey'),
        Index('idx_audit_logs_action', 'action'),
        Index('idx_audit_logs_created', 'created_at'),
        Index('idx_audit_logs_employee', 'employee_id'),
        Index('idx_audit_logs_employee_date', 'employee_id', 'created_at'),
        Index('idx_audit_logs_entity', 'entity_type', 'entity_id'),
        Index('idx_audit_logs_event_date', 'event_type', 'created_at'),
        Index('idx_audit_logs_event_type', 'event_type'),
        Index('idx_audit_logs_payment_method', 'payment_method'),
        Index('idx_audit_logs_room', 'room_number'),
        Index('idx_audit_logs_session', 'session_id'),
        Index('idx_audit_logs_severity', 'severity'),
        Index('idx_audit_logs_severity_date', 'severity', 'created_at'),
        Index('idx_audit_logs_user', 'user_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_type: Mapped[str] = mapped_column(Text, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    action: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'INFO'::text"))
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    employee_name: Mapped[Optional[str]] = mapped_column(Text)
    user_role: Mapped[Optional[str]] = mapped_column(Text)
    old_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    changed_fields: Mapped[Optional[list[str]]] = mapped_column(ARRAY(Text()))
    session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    room_number: Mapped[Optional[str]] = mapped_column(Text)
    payment_method: Mapped[Optional[str]] = mapped_column(Text)
    amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    table_name: Mapped[Optional[str]] = mapped_column(Text)
    record_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    description: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column('metadata', JSONB, server_default=text("'{}'::jsonb"))
    ip_address: Mapped[Optional[str]] = mapped_column(Text)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='audit_logs')
    user: Mapped[Optional['Users']] = relationship('Users', back_populates='audit_logs')


class NotificationTemplates(Base):
    __tablename__ = 'notification_templates'
    __table_args__ = (
        CheckConstraint("template_type = ANY (ARRAY['checkout_reminder'::text, 'service_promo'::text, 'survey'::text, 'welcome'::text, 'custom'::text])", name='notification_templates_template_type_check'),
        ForeignKeyConstraint(['created_by'], ['employees.id'], ondelete='SET NULL', name='notification_templates_created_by_fkey'),
        PrimaryKeyConstraint('id', name='notification_templates_pkey'),
        Index('idx_notification_templates_active', 'is_active', postgresql_where='(is_active = true)'),
        Index('idx_notification_templates_type', 'template_type'),
        {'comment': 'Reusable templates for guest notifications'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    title_template: Mapped[str] = mapped_column(Text, nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    template_type: Mapped[str] = mapped_column(Text, nullable=False)
    icon_url: Mapped[Optional[str]] = mapped_column(Text)
    action_url: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employees: Mapped[Optional['Employees']] = relationship('Employees', back_populates='notification_templates')
    guest_notifications: Mapped[list['GuestNotifications']] = relationship('GuestNotifications', back_populates='template')


class Notifications(Base):
    __tablename__ = 'notifications'
    __table_args__ = (
        CheckConstraint("type = ANY (ARRAY['stock_low'::text, 'stock_critical'::text, 'order_pending'::text, 'payment_due'::text, 'shift_started'::text, 'shift_ended'::text, 'system_alert'::text, 'info'::text, 'NEW_EXTRA'::text, 'NEW_CONSUMPTION'::text, 'DAMAGE_REPORT'::text, 'PROMO_4H'::text, 'ROOM_CHANGE'::text, 'NEW_ENTRY'::text, 'chat_message'::text])", name='notifications_type_check'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='SET NULL', name='notifications_employee_id_fkey'),
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='notifications_user_id_fkey'),
        PrimaryKeyConstraint('id', name='notifications_pkey'),
        Index('idx_notifications_created', 'created_at'),
        Index('idx_notifications_employee', 'employee_id'),
        Index('idx_notifications_type', 'type'),
        Index('idx_notifications_user_read', 'user_id', 'is_read', postgresql_where='(NOT is_archived)'),
        {'comment': 'System notifications for users about important events'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    type: Mapped[str] = mapped_column(Text, nullable=False, comment='Type of notification: stock_low, stock_critical, order_pending, payment_due, etc.')
    title: Mapped[str] = mapped_column(Text, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"), comment='Additional JSON data specific to the notification type')
    action_url: Mapped[Optional[str]] = mapped_column(Text, comment='Optional URL to navigate when notification is clicked')
    is_read: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    is_archived: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    read_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='notifications')
    user: Mapped[Optional['Users']] = relationship('Users', back_populates='notifications')


class Surveys(Base):
    __tablename__ = 'surveys'
    __table_args__ = (
        CheckConstraint("target_audience = ANY (ARRAY['all'::text, 'checkout'::text, 'after_stay'::text, 'specific'::text])", name='surveys_target_audience_check'),
        ForeignKeyConstraint(['created_by'], ['employees.id'], ondelete='SET NULL', name='surveys_created_by_fkey'),
        PrimaryKeyConstraint('id', name='surveys_pkey'),
        Index('idx_surveys_active', 'is_active', postgresql_where='(is_active = true)'),
        Index('idx_surveys_audience', 'target_audience'),
        {'comment': 'Guest satisfaction surveys'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    questions: Mapped[dict] = mapped_column(JSONB, nullable=False)
    target_audience: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employees: Mapped[Optional['Employees']] = relationship('Employees', back_populates='surveys')
    survey_responses: Mapped[list['SurveyResponses']] = relationship('SurveyResponses', back_populates='survey')


class Sensors(Base):
    __tablename__ = 'sensors'
    __table_args__ = (
        CheckConstraint("status = ANY (ARRAY['ONLINE'::text, 'OFFLINE'::text])", name='sensors_status_check'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='SET NULL', name='sensors_room_id_fkey'),
        PrimaryKeyConstraint('id', name='sensors_pkey'),
        UniqueConstraint('device_id', name='sensors_device_id_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    device_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    status: Mapped[Optional[str]] = mapped_column(Text)
    is_open: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    battery_level: Mapped[Optional[int]] = mapped_column(Integer)
    last_seen: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    room: Mapped[Optional['Rooms']] = relationship('Rooms', back_populates='sensors')
    sensor_events: Mapped[list['SensorEvents']] = relationship('SensorEvents', back_populates='sensor')


class SensorEvents(Base):
    __tablename__ = 'sensor_events'
    __table_args__ = (
        ForeignKeyConstraint(['sensor_id'], ['sensors.id'], ondelete='CASCADE', name='sensor_events_sensor_id_fkey'),
        PrimaryKeyConstraint('id', name='sensor_events_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    sensor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    sensor: Mapped[Optional['Sensors']] = relationship('Sensors', back_populates='sensor_events')


class OperationFlows(Base):
    __tablename__ = 'operation_flows'
    __table_args__ = (
        CheckConstraint("status = ANY (ARRAY['ACTIVO'::text, 'COMPLETADO'::text, 'CANCELADO'::text])", name='operation_flows_status_check'),
        ForeignKeyConstraint(['created_by'], ['auth.users.id'], ondelete='SET NULL', name='operation_flows_created_by_fkey'),
        ForeignKeyConstraint(['room_id'], ['rooms.id'], ondelete='SET NULL', name='operation_flows_room_id_fkey'),
        ForeignKeyConstraint(['room_stay_id'], ['room_stays.id'], ondelete='SET NULL', name='operation_flows_room_stay_id_fkey'),
        ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ondelete='SET NULL', name='operation_flows_sales_order_id_fkey'),
        PrimaryKeyConstraint('id', name='operation_flows_pkey'),
        UniqueConstraint('flow_number', name='operation_flows_flow_number_key'),
        Index('idx_operation_flows_created_at', 'created_at'),
        Index('idx_operation_flows_room_number', 'room_number'),
        Index('idx_operation_flows_room_stay', 'room_stay_id'),
        Index('idx_operation_flows_started_at', 'started_at'),
        Index('idx_operation_flows_status', 'status')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    flow_number: Mapped[int] = mapped_column(Integer, nullable=False)
    room_number: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'ACTIVO'::text"))
    started_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    room_stay_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    sales_order_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    room_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    current_stage: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'ROOM_ASSIGNED'::text"))
    completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    users: Mapped[Optional['Users']] = relationship('Users', back_populates='operation_flows')
    room: Mapped[Optional['Rooms']] = relationship('Rooms', back_populates='operation_flows')
    room_stay: Mapped[Optional['RoomStays']] = relationship('RoomStays', back_populates='operation_flows')
    sales_order: Mapped[Optional['SalesOrders']] = relationship('SalesOrders', back_populates='operation_flows')
    flow_events: Mapped[list['FlowEvents']] = relationship('FlowEvents', back_populates='flow')


class SurveyResponses(Base):
    __tablename__ = 'survey_responses'
    __table_args__ = (
        ForeignKeyConstraint(['room_stay_id'], ['room_stays.id'], ondelete='SET NULL', name='survey_responses_room_stay_id_fkey'),
        ForeignKeyConstraint(['survey_id'], ['surveys.id'], ondelete='CASCADE', name='survey_responses_survey_id_fkey'),
        PrimaryKeyConstraint('id', name='survey_responses_pkey'),
        Index('idx_survey_responses_room', 'room_number'),
        Index('idx_survey_responses_submitted', 'submitted_at'),
        Index('idx_survey_responses_survey', 'survey_id'),
        {'comment': 'Guest responses to surveys'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    survey_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    room_number: Mapped[str] = mapped_column(Text, nullable=False)
    responses: Mapped[dict] = mapped_column(JSONB, nullable=False)
    room_stay_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    guest_feedback: Mapped[Optional[str]] = mapped_column(Text)
    submitted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    room_stay: Mapped[Optional['RoomStays']] = relationship('RoomStays', back_populates='survey_responses')
    survey: Mapped['Surveys'] = relationship('Surveys', back_populates='survey_responses')


class FlowEvents(Base):
    __tablename__ = 'flow_events'
    __table_args__ = (
        CheckConstraint("event_category = ANY (ARRAY['ROOM'::text, 'PAYMENT'::text, 'VALET'::text, 'CONSUMPTION'::text, 'CHECKOUT'::text, 'SYSTEM'::text, 'EXTRAS'::text, 'CLIENT'::text])", name='flow_events_event_category_check'),
        ForeignKeyConstraint(['flow_id'], ['operation_flows.id'], ondelete='CASCADE', name='flow_events_flow_id_fkey'),
        PrimaryKeyConstraint('id', name='flow_events_pkey'),
        Index('idx_flow_events_category', 'event_category'),
        Index('idx_flow_events_created_at', 'created_at'),
        Index('idx_flow_events_flow_id', 'flow_id'),
        Index('idx_flow_events_flow_seq', 'flow_id', 'sequence_number'),
        Index('idx_flow_events_type', 'event_type')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    flow_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    event_type: Mapped[str] = mapped_column(Text, nullable=False)
    event_category: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'SYSTEM'::text"))
    description: Mapped[str] = mapped_column(Text, nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'))
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    actor_name: Mapped[Optional[str]] = mapped_column(Text)
    actor_role: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column('metadata', JSONB, server_default=text("'{}'::jsonb"))
    duration_from_previous_ms: Mapped[Optional[int]] = mapped_column(BigInteger, server_default=text('0'))

    flow: Mapped['OperationFlows'] = relationship('OperationFlows', back_populates='flow_events')


class GuestNotifications(Base):
    __tablename__ = 'guest_notifications'
    __table_args__ = (
        CheckConstraint("notification_type = ANY (ARRAY['checkout_reminder'::text, 'service_promo'::text, 'survey'::text, 'welcome'::text, 'custom'::text])", name='guest_notifications_notification_type_check'),
        ForeignKeyConstraint(['guest_subscription_id'], ['guest_subscriptions.id'], ondelete='CASCADE', name='guest_notifications_guest_subscription_id_fkey'),
        ForeignKeyConstraint(['template_id'], ['notification_templates.id'], ondelete='SET NULL', name='guest_notifications_template_id_fkey'),
        PrimaryKeyConstraint('id', name='guest_notifications_pkey'),
        Index('idx_guest_notifications_room', 'room_number'),
        Index('idx_guest_notifications_sent', 'sent_at'),
        Index('idx_guest_notifications_subscription', 'guest_subscription_id'),
        Index('idx_guest_notifications_type', 'notification_type'),
        {'comment': 'History of all notifications sent to guests'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    room_number: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[str] = mapped_column(Text, nullable=False)
    guest_subscription_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    icon_url: Mapped[Optional[str]] = mapped_column(Text)
    action_url: Mapped[Optional[str]] = mapped_column(Text)
    data: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))
    sent_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    delivered: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    opened: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    opened_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    guest_subscription: Mapped[Optional['GuestSubscriptions']] = relationship('GuestSubscriptions', back_populates='guest_notifications')
    template: Mapped[Optional['NotificationTemplates']] = relationship('NotificationTemplates', back_populates='guest_notifications')
