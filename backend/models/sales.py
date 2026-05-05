from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class Customers(Base):
    __tablename__ = 'customers'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='customers_pkey'),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    tax_id: Mapped[Optional[str]] = mapped_column(Text)
    email: Mapped[Optional[str]] = mapped_column(Text)
    phone: Mapped[Optional[str]] = mapped_column(Text)
    address: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    sales_orders: Mapped[list['SalesOrders']] = relationship('SalesOrders', back_populates='customer')


class PaymentTerminals(Base):
    __tablename__ = 'payment_terminals'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='payment_terminals_pkey'),
        UniqueConstraint('code', name='payment_terminals_code_key'),
        {'comment': 'Terminales de pago disponibles para cobros con tarjeta'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    payments: Mapped[list['Payments']] = relationship('Payments', back_populates='terminal')


class PricingConfig(Base):
    __tablename__ = 'pricing_config'
    __table_args__ = (
        CheckConstraint('price >= 0::numeric', name='pricing_config_price_check'),
        CheckConstraint("promo_type = ANY (ARRAY['4H_PROMO'::text, 'WEEKEND'::text, 'MONTHLY'::text, 'CUSTOM'::text])", name='pricing_config_promo_type_check'),
        ForeignKeyConstraint(['created_by'], ['auth.users.id'], name='pricing_config_created_by_fkey'),
        PrimaryKeyConstraint('id', name='pricing_config_pkey'),
        UniqueConstraint('room_type_name', 'promo_type', name='pricing_config_room_type_name_promo_type_key'),
        Index('idx_pricing_config_active', 'room_type_name', 'promo_type', postgresql_where='(is_active = true)'),
        {'comment': 'Dynamic pricing configuration for room promotions'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('extensions.uuid_generate_v4()'))
    room_type_name: Mapped[str] = mapped_column(Text, nullable=False, comment='Must match room_types.name exactly')
    promo_type: Mapped[str] = mapped_column(Text, nullable=False, comment='Type of promotion: 4H_PROMO, WEEKEND, MONTHLY, CUSTOM')
    price: Mapped[decimal.Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    users: Mapped[Optional['Users']] = relationship('Users', back_populates='pricing_config')


class ProductPromotions(Base):
    __tablename__ = 'product_promotions'
    __table_args__ = (
        CheckConstraint("promo_type = ANY (ARRAY['NxM'::text, 'PERCENT_DISCOUNT'::text, 'FIXED_PRICE'::text])", name='product_promotions_promo_type_check'),
        ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE', name='product_promotions_category_id_fkey'),
        ForeignKeyConstraint(['created_by'], ['auth.users.id'], name='product_promotions_created_by_fkey'),
        ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE', name='product_promotions_product_id_fkey'),
        ForeignKeyConstraint(['subcategory_id'], ['subcategories.id'], ondelete='CASCADE', name='product_promotions_subcategory_id_fkey'),
        PrimaryKeyConstraint('id', name='product_promotions_pkey'),
        Index('idx_product_promotions_active', 'is_active', postgresql_where='(is_active = true)'),
        Index('idx_product_promotions_category', 'category_id', postgresql_where='(category_id IS NOT NULL)'),
        Index('idx_product_promotions_product', 'product_id', postgresql_where='(product_id IS NOT NULL)')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    promo_type: Mapped[str] = mapped_column(Text, nullable=False)
    buy_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    pay_quantity: Mapped[Optional[int]] = mapped_column(Integer)
    discount_percent: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    fixed_price: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric)
    product_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    subcategory_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    start_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    end_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    conditions: Mapped[Optional[dict]] = mapped_column(JSONB, server_default=text("'{}'::jsonb"))

    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='product_promotions')
    users: Mapped[Optional['Users']] = relationship('Users', back_populates='product_promotions')
    product: Mapped[Optional['Products']] = relationship('Products', back_populates='product_promotions')
    subcategory: Mapped[Optional['Subcategories']] = relationship('Subcategories', back_populates='product_promotions')


class SalesOrders(Base):
    __tablename__ = 'sales_orders'
    __table_args__ = (
        CheckConstraint("payment_method = ANY (ARRAY['EFECTIVO'::text, 'TARJETA'::text, 'TRANSFERENCIA'::text, NULL::text])", name='sales_orders_payment_method_check'),
        ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='SET NULL', name='sales_orders_customer_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], name='sales_orders_shift_session_id_fkey'),
        ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT', name='sales_orders_warehouse_id_fkey'),
        PrimaryKeyConstraint('id', name='sales_orders_pkey'),
        UniqueConstraint('order_number', name='sales_orders_order_number_key'),
        Index('idx_sales_orders_shift', 'shift_session_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    warehouse_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'OPEN'::text"))
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'MXN'::text"))
    customer_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    subtotal: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    tax: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    order_number: Mapped[Optional[str]] = mapped_column(String)
    order_date: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    remaining_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text("'0'::numeric"))
    paid_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text("'0'::numeric"))
    payment_method: Mapped[Optional[str]] = mapped_column(Text, comment='Método de pago: EFECTIVO, TARJETA o TRANSFERENCIA')
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Shift session active when the order was created')

    customer: Mapped[Optional['Customers']] = relationship('Customers', back_populates='sales_orders')
    shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', back_populates='sales_orders')
    warehouse: Mapped['Warehouses'] = relationship('Warehouses', back_populates='sales_orders')
    payments: Mapped[list['Payments']] = relationship('Payments', back_populates='sales_order')
    room_stays: Mapped[list['RoomStays']] = relationship('RoomStays', back_populates='sales_order')
    sales_order_items: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', back_populates='sales_order')
    operation_flows: Mapped[list['OperationFlows']] = relationship('OperationFlows', back_populates='sales_order')
    shift_closing_details: Mapped[list['ShiftClosingDetails']] = relationship('ShiftClosingDetails', back_populates='sales_order')


class Payments(Base):
    __tablename__ = 'payments'
    __table_args__ = (
        CheckConstraint('amount > 0::numeric', name='payments_amount_check'),
        CheckConstraint("payment_method = ANY (ARRAY['EFECTIVO'::text, 'TARJETA'::text, 'TRANSFERENCIA'::text, 'PENDIENTE'::text])", name='payments_payment_method_check'),
        CheckConstraint("payment_type = ANY (ARRAY['PARCIAL'::text, 'COMPLETO'::text])", name='payments_payment_type_check'),
        CheckConstraint("status = ANY (ARRAY['PENDIENTE'::text, 'COBRADO_POR_VALET'::text, 'CORROBORADO_RECEPCION'::text, 'PAGADO'::text, 'CANCELADO'::text])", name='payments_status_check'),
        ForeignKeyConstraint(['collected_by'], ['employees.id'], name='payments_collected_by_fkey'),
        ForeignKeyConstraint(['confirmed_by'], ['employees.id'], name='payments_confirmed_by_fkey'),
        ForeignKeyConstraint(['created_by'], ['auth.users.id'], name='payments_created_by_fkey'),
        ForeignKeyConstraint(['employee_id'], ['employees.id'], name='payments_employee_id_fkey'),
        ForeignKeyConstraint(['parent_payment_id'], ['payments.id'], ondelete='CASCADE', name='payments_parent_payment_id_fkey'),
        ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ondelete='CASCADE', name='payments_sales_order_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], name='payments_shift_session_id_fkey'),
        ForeignKeyConstraint(['terminal_id'], ['payment_terminals.id'], name='payments_terminal_id_fkey'),
        PrimaryKeyConstraint('id', name='payments_pkey'),
        Index('idx_payments_card_last_4', 'card_last_4', postgresql_where='(card_last_4 IS NOT NULL)'),
        Index('idx_payments_collected_by', 'collected_by', postgresql_where='(collected_by IS NOT NULL)'),
        Index('idx_payments_concept', 'concept'),
        Index('idx_payments_confirmed_by', 'confirmed_by', postgresql_where='(confirmed_by IS NOT NULL)'),
        Index('idx_payments_created_at', 'created_at'),
        Index('idx_payments_employee', 'employee_id'),
        Index('idx_payments_parent_id', 'parent_payment_id'),
        Index('idx_payments_payment_method', 'payment_method'),
        Index('idx_payments_payment_number', 'payment_number'),
        Index('idx_payments_sales_order_id', 'sales_order_id'),
        Index('idx_payments_shift', 'shift_session_id'),
        Index('idx_payments_status', 'status'),
        Index('idx_payments_status_valet', 'status', postgresql_where="(status = 'COBRADO_POR_VALET'::text)"),
        Index('idx_payments_terminal', 'terminal_id'),
        Index('idx_payments_terminal_code', 'terminal_code'),
        {'comment': 'Tabla de pagos que permite múltiples pagos por orden con '
                'diferentes métodos'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    sales_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    amount: Mapped[decimal.Decimal] = mapped_column(Numeric(12, 2), nullable=False, comment='Monto del pago')
    payment_method: Mapped[str] = mapped_column(Text, nullable=False, comment='Método de pago: EFECTIVO, TARJETA o TRANSFERENCIA')
    reference: Mapped[Optional[str]] = mapped_column(Text, comment='Referencia opcional del pago (últimos 4 dígitos, número de transferencia, etc.)')
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    concept: Mapped[Optional[str]] = mapped_column(Text, comment='Concepto del pago: ESTANCIA, HORA_EXTRA, PERSONA_EXTRA, CONSUMO, CHECKOUT, etc.')
    payment_number: Mapped[Optional[str]] = mapped_column(Text, comment='Identificador legible del pago (P001, P002, etc.) único por orden')
    status: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'PAGADO'::text"), comment='Estado del pago: PAGADO, PENDIENTE, CANCELADO')
    payment_type: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'PARCIAL'::text"), comment='Tipo de pago: PARCIAL o COMPLETO')
    parent_payment_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    terminal_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Terminal usada cuando el pago es con tarjeta (referencia UUID)')
    terminal_code: Mapped[Optional[str]] = mapped_column(String(20), comment='Código de terminal: BBVA o GETNET')
    employee_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Empleado que procesó el pago')
    card_last_4: Mapped[Optional[str]] = mapped_column(String(4), comment='Últimos 4 dígitos de la tarjeta (solo para pagos con tarjeta)')
    card_type: Mapped[Optional[str]] = mapped_column(String(10), comment='Tipo de tarjeta: CREDITO o DEBITO (solo para pagos con tarjeta)')
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Shift session active when the payment was processed')
    collected_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Empleado (cochero) que cobró al cliente')
    collected_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp cuando cochero registró el cobro')
    confirmed_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Empleado (recepcionista) que confirmó recepción del dinero')
    confirmed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp cuando recepción confirmó el pago')
    tip_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric(10, 2), server_default=text('0'), comment='Monto de propina incluido en el pago')

    employees: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[collected_by], back_populates='payments_collected_by')
    employees_: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[confirmed_by], back_populates='payments_confirmed_by')
    users: Mapped[Optional['Users']] = relationship('Users', back_populates='payments')
    employee: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[employee_id], back_populates='payments_employee')
    parent_payment: Mapped[Optional['Payments']] = relationship('Payments', remote_side=[id], back_populates='parent_payment_reverse')
    parent_payment_reverse: Mapped[list['Payments']] = relationship('Payments', remote_side=[parent_payment_id], back_populates='parent_payment')
    sales_order: Mapped['SalesOrders'] = relationship('SalesOrders', back_populates='payments')
    shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', back_populates='payments')
    terminal: Mapped[Optional['PaymentTerminals']] = relationship('PaymentTerminals', back_populates='payments')
    shift_closing_details: Mapped[list['ShiftClosingDetails']] = relationship('ShiftClosingDetails', back_populates='payment')


class SalesOrderItems(Base):
    __tablename__ = 'sales_order_items'
    __table_args__ = (
        CheckConstraint("(tip_method = ANY (ARRAY['EFECTIVO'::text, 'TARJETA'::text])) OR tip_method IS NULL", name='sales_order_items_tip_method_check'),
        CheckConstraint("concept_type = ANY (ARRAY['ROOM_BASE'::text, 'EXTRA_HOUR'::text, 'EXTRA_PERSON'::text, 'CONSUMPTION'::text, 'PRODUCT'::text, 'RENEWAL'::text, 'PROMO_4H'::text, 'TOLERANCE_EXPIRED'::text, 'DAMAGE_CHARGE'::text, 'ROOM_CHANGE_ADJUSTMENT'::text])", name='sales_order_items_concept_type_check'),
        CheckConstraint("delivery_status = ANY (ARRAY['PENDING_VALET'::text, 'ACCEPTED'::text, 'IN_TRANSIT'::text, 'DELIVERED'::text, 'COMPLETED'::text, 'ISSUE'::text, 'CANCELLED'::text])", name='sales_order_items_delivery_status_check'),
        CheckConstraint("payment_method = ANY (ARRAY['EFECTIVO'::text, 'TARJETA'::text, 'TRANSFERENCIA'::text, NULL::text])", name='sales_order_items_payment_method_check'),
        ForeignKeyConstraint(['delivery_accepted_by'], ['employees.id'], name='sales_order_items_delivery_accepted_by_fkey'),
        ForeignKeyConstraint(['delivery_picked_up_by'], ['employees.id'], name='sales_order_items_delivery_picked_up_by_fkey'),
        ForeignKeyConstraint(['payment_received_by'], ['employees.id'], name='sales_order_items_payment_received_by_fkey'),
        ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT', name='sales_order_items_product_id_fkey'),
        ForeignKeyConstraint(['sales_order_id'], ['sales_orders.id'], ondelete='CASCADE', name='sales_order_items_sales_order_id_fkey'),
        ForeignKeyConstraint(['shift_session_id'], ['shift_sessions.id'], ondelete='SET NULL', name='sales_order_items_shift_session_id_fkey'),
        PrimaryKeyConstraint('id', name='sales_order_items_pkey'),
        Index('idx_sales_order_items_concept_type', 'concept_type'),
        Index('idx_sales_order_items_delivery_status', 'delivery_status', postgresql_where="(concept_type = 'CONSUMPTION'::text)"),
        Index('idx_sales_order_items_is_paid', 'is_paid'),
        Index('idx_sales_order_items_pending_delivery', 'delivery_accepted_by', postgresql_where="((concept_type = 'CONSUMPTION'::text) AND (delivery_accepted_by IS NULL))"),
        Index('idx_sales_order_items_shift_session', 'shift_session_id'),
        Index('idx_sales_order_items_valet_pending', 'delivery_accepted_by', 'delivery_status', postgresql_where="((concept_type = 'CONSUMPTION'::text) AND (delivery_status = ANY (ARRAY['ACCEPTED'::text, 'IN_TRANSIT'::text])))")
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    sales_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    qty: Mapped[decimal.Decimal] = mapped_column(Numeric, nullable=False)
    unit_price: Mapped[decimal.Decimal] = mapped_column(Numeric, nullable=False)
    discount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    tax: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, Computed('((qty * (unit_price - discount)) + tax)', persisted=True))
    payment_method: Mapped[Optional[str]] = mapped_column(Text, comment='Método de pago para este producto: EFECTIVO, TARJETA o TRANSFERENCIA')
    is_paid: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'), comment='Indica si este concepto ya fue pagado')
    paid_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Fecha y hora en que se pagó este concepto')
    concept_type: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'PRODUCT'::text"), comment='Tipo de concepto: ROOM_BASE, EXTRA_HOUR, EXTRA_PERSON, CONSUMPTION, PRODUCT, OTHER')
    is_courtesy: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'), comment='Indica si este ítem es una cortesía (precio 0)')
    courtesy_reason: Mapped[Optional[str]] = mapped_column(Text, comment='Razón por la cual se otorgó la cortesía')
    delivery_accepted_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='ID del empleado (cochero) que aceptó entregar este consumo a la habitación')
    delivery_accepted_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp de cuando el cochero aceptó la entrega del consumo')
    delivery_completed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp de cuando se completó la entrega del consumo (opcional)')
    delivery_status: Mapped[Optional[str]] = mapped_column(Text, server_default=text("'PENDING_VALET'::text"))
    delivery_picked_up_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp cuando recepción confirma que el cochero recogió los productos')
    delivery_picked_up_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='ID del empleado de recepción que confirmó la recogida')
    payment_received_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), comment='Timestamp cuando recepción confirma que el cochero trajo el dinero')
    payment_received_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='ID del empleado de recepción que confirmó la recepción del dinero')
    payment_amount_received: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, comment='Monto real recibido (puede diferir del total si hubo problema)')
    tip_amount: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'), comment='Monto de propina que el cliente dio al cochero')
    tip_method: Mapped[Optional[str]] = mapped_column(Text, comment='Método de pago de la propina: EFECTIVO o TARJETA')
    delivery_notes: Mapped[Optional[str]] = mapped_column(Text, comment='Notas generales sobre la entrega')
    cancellation_reason: Mapped[Optional[str]] = mapped_column(Text, comment='Motivo de cancelación si el estado es CANCELLED')
    issue_description: Mapped[Optional[str]] = mapped_column(Text, comment='Descripción del problema si el estado es ISSUE')
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    shift_session_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='The shift session active when this specific item was created or registered.')
    is_cancelled: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('false'))
    cancelled_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True))
    cancelled_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)

    employees: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[delivery_accepted_by], back_populates='sales_order_items_delivery_accepted_by')
    employees_: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[delivery_picked_up_by], back_populates='sales_order_items_delivery_picked_up_by')
    employees1: Mapped[Optional['Employees']] = relationship('Employees', foreign_keys=[payment_received_by], back_populates='sales_order_items_payment_received_by')
    product: Mapped['Products'] = relationship('Products', back_populates='sales_order_items')
    sales_order: Mapped['SalesOrders'] = relationship('SalesOrders', back_populates='sales_order_items')
    shift_session: Mapped[Optional['ShiftSessions']] = relationship('ShiftSessions', back_populates='sales_order_items')
