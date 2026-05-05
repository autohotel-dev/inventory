from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class Users(Base):
    __tablename__ = 'users'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='users_pkey'),
        {'schema': 'auth'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    encrypted_password: Mapped[Optional[str]] = mapped_column(String(255))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))

    chat_subscriptions: Mapped[list['ChatSubscriptions']] = relationship('ChatSubscriptions', back_populates='user')
    conversation_participants: Mapped[list['ConversationParticipants']] = relationship('ConversationParticipants', back_populates='user')
    employees: Mapped[list['Employees']] = relationship('Employees', back_populates='auth_user')
    media_library: Mapped[list['MediaLibrary']] = relationship('MediaLibrary', back_populates='users')
    messages: Mapped[list['Messages']] = relationship('Messages', back_populates='user')
    pricing_config: Mapped[list['PricingConfig']] = relationship('PricingConfig', back_populates='users')
    push_tokens: Mapped[list['PushTokens']] = relationship('PushTokens', back_populates='user')
    system_config: Mapped[list['SystemConfig']] = relationship('SystemConfig', back_populates='users')
    system_telemetry: Mapped[list['SystemTelemetry']] = relationship('SystemTelemetry', back_populates='user')
    audit_logs: Mapped[list['AuditLogs']] = relationship('AuditLogs', back_populates='user')
    notifications: Mapped[list['Notifications']] = relationship('Notifications', back_populates='user')
    product_promotions: Mapped[list['ProductPromotions']] = relationship('ProductPromotions', back_populates='users')
    shift_expenses: Mapped[list['ShiftExpenses']] = relationship('ShiftExpenses', back_populates='users')
    payments: Mapped[list['Payments']] = relationship('Payments', back_populates='users')
    operation_flows: Mapped[list['OperationFlows']] = relationship('OperationFlows', back_populates='users')


class Roles(Base):
    __tablename__ = 'roles'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='roles_pkey'),
        UniqueConstraint('name', name='roles_name_key'),
        Index('idx_roles_active', 'is_active'),
        Index('idx_roles_name', 'name'),
        {'comment': 'Dynamic roles table for role-based access control'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(String(50), nullable=False, comment='Unique role identifier (lowercase, no spaces)')
    display_name: Mapped[str] = mapped_column(String(100), nullable=False, comment='Human-readable role name')
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_protected: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'), comment='Protected roles cannot be deleted (admin, manager)')
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'), comment='Inactive roles cannot be assigned to new employees')
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    employees: Mapped[list['Employees']] = relationship('Employees', back_populates='role_')
    role_permissions: Mapped[list['RolePermissions']] = relationship('RolePermissions', back_populates='role_')


class ChatSubscriptions(Base):
    __tablename__ = 'chat_subscriptions'
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='chat_subscriptions_user_id_fkey'),
        PrimaryKeyConstraint('id', name='chat_subscriptions_pkey'),
        UniqueConstraint('endpoint', name='chat_subscriptions_endpoint_key'),
        Index('idx_chat_subscriptions_user', 'user_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    endpoint: Mapped[str] = mapped_column(Text, nullable=False)
    p256dh: Mapped[str] = mapped_column(Text, nullable=False)
    auth: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text("timezone('utc'::text, now())"))
    user_agent: Mapped[Optional[str]] = mapped_column(Text)

    user: Mapped['Users'] = relationship('Users', back_populates='chat_subscriptions')


class PushTokens(Base):
    __tablename__ = 'push_tokens'
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['auth.users.id'], ondelete='CASCADE', name='push_tokens_user_id_fkey'),
        PrimaryKeyConstraint('id', name='push_tokens_pkey'),
        UniqueConstraint('user_id', 'token', name='push_tokens_user_id_token_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    token: Mapped[str] = mapped_column(Text, nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    device_type: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("timezone('utc'::text, now())"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("timezone('utc'::text, now())"))

    user: Mapped[Optional['Users']] = relationship('Users', back_populates='push_tokens')


class RolePermissions(Base):
    __tablename__ = 'role_permissions'
    __table_args__ = (
        CheckConstraint("permission_type::text = ANY (ARRAY['menu'::character varying::text, 'page'::character varying::text])", name='role_permissions_permission_type_check'),
        ForeignKeyConstraint(['role_id'], ['roles.id'], name='role_permissions_role_id_fkey'),
        PrimaryKeyConstraint('id', name='role_permissions_pkey'),
        UniqueConstraint('role_id', 'resource', name='unique_role_id_resource'),
        Index('idx_role_permissions_resource', 'resource'),
        Index('idx_role_permissions_role', 'role'),
        Index('idx_role_permissions_role_id', 'role_id'),
        Index('idx_role_permissions_role_id_resource', 'role_id', 'resource'),
        Index('idx_role_permissions_type', 'permission_type'),
        {'comment': 'Stores dynamic role-based permissions for menu and page access '
                'control'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    resource: Mapped[str] = mapped_column(String(100), nullable=False, comment='Resource identifier (e.g., menu.dashboard, page./products)')
    permission_type: Mapped[str] = mapped_column(String(50), nullable=False, comment='Type of permission: menu or page')
    role: Mapped[Optional[str]] = mapped_column(String(50), comment='Role name (auto-populated from role_id via trigger for backward compatibility)')
    allowed: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'), comment='Whether the role has access to this resource')
    metadata_: Mapped[Optional[dict]] = mapped_column('metadata', JSONB, server_default=text("'{}'::jsonb"), comment='Additional configuration in JSON format')
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    role_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Primary role identifier (UUID reference to roles table)')

    role_: Mapped[Optional['Roles']] = relationship('Roles', back_populates='role_permissions')


class PushSubscriptions(Base):
    __tablename__ = 'push_subscriptions'
    __table_args__ = (
        ForeignKeyConstraint(['employee_id'], ['employees.id'], ondelete='CASCADE', name='push_subscriptions_employee_id_fkey'),
        PrimaryKeyConstraint('id', name='push_subscriptions_pkey'),
        UniqueConstraint('endpoint', name='push_subscriptions_endpoint_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    subscription: Mapped[dict] = mapped_column(JSONB, nullable=False)
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("timezone('utc'::text, now())"))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text("timezone('utc'::text, now())"))
    endpoint: Mapped[Optional[str]] = mapped_column(Text)

    employee: Mapped[Optional['Employees']] = relationship('Employees', back_populates='push_subscriptions')
