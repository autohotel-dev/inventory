from typing import Optional
import datetime
import decimal
import uuid

from sqlalchemy import ARRAY, BigInteger, Boolean, CheckConstraint, Column, Computed, Date, DateTime, ForeignKeyConstraint, Index, Integer, Numeric, PrimaryKeyConstraint, String, Table, Text, Time, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base



class Categories(Base):
    __tablename__ = 'categories'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='categories_pkey'),
        UniqueConstraint('name', name='categories_name_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    subcategories: Mapped[list['Subcategories']] = relationship('Subcategories', back_populates='category')
    bottle_package_rules: Mapped[list['BottlePackageRules']] = relationship('BottlePackageRules', back_populates='included_category')
    products: Mapped[list['Products']] = relationship('Products', back_populates='category')
    product_promotions: Mapped[list['ProductPromotions']] = relationship('ProductPromotions', back_populates='category')


class MovementReasons(Base):
    __tablename__ = 'movement_reasons'
    __table_args__ = (
        CheckConstraint("movement_type = ANY (ARRAY['IN'::text, 'OUT'::text, 'ADJUSTMENT'::text])", name='movement_reasons_movement_type_check'),
        PrimaryKeyConstraint('id', name='movement_reasons_pkey'),
        UniqueConstraint('code', name='movement_reasons_code_key')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    movement_type: Mapped[Optional[str]] = mapped_column(Text)
    name: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    inventory_movements: Mapped[list['InventoryMovements']] = relationship('InventoryMovements', back_populates='reason_')


class Suppliers(Base):
    __tablename__ = 'suppliers'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='suppliers_pkey'),
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

    purchase_orders: Mapped[list['PurchaseOrders']] = relationship('PurchaseOrders', back_populates='supplier')
    products: Mapped[list['Products']] = relationship('Products', back_populates='supplier')


class Warehouses(Base):
    __tablename__ = 'warehouses'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='warehouses_pkey'),
        UniqueConstraint('code', name='warehouses_code_key')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    address: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    purchase_orders: Mapped[list['PurchaseOrders']] = relationship('PurchaseOrders', back_populates='warehouse')
    inventory_movements: Mapped[list['InventoryMovements']] = relationship('InventoryMovements', back_populates='warehouse')
    stock: Mapped[list['Stock']] = relationship('Stock', back_populates='warehouse')
    sales_orders: Mapped[list['SalesOrders']] = relationship('SalesOrders', back_populates='warehouse')


class PurchaseOrders(Base):
    __tablename__ = 'purchase_orders'
    __table_args__ = (
        ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='RESTRICT', name='purchase_orders_supplier_id_fkey'),
        ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='RESTRICT', name='purchase_orders_warehouse_id_fkey'),
        PrimaryKeyConstraint('id', name='purchase_orders_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    supplier_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'OPEN'::text"))
    currency: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'MXN'::text"))
    subtotal: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    tax: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    supplier: Mapped['Suppliers'] = relationship('Suppliers', back_populates='purchase_orders')
    warehouse: Mapped['Warehouses'] = relationship('Warehouses', back_populates='purchase_orders')
    purchase_order_items: Mapped[list['PurchaseOrderItems']] = relationship('PurchaseOrderItems', back_populates='purchase_order')


class Subcategories(Base):
    __tablename__ = 'subcategories'
    __table_args__ = (
        ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='CASCADE', name='subcategories_category_id_fkey'),
        PrimaryKeyConstraint('id', name='subcategories_pkey'),
        UniqueConstraint('category_id', 'name', name='subcategories_category_id_name_key'),
        Index('idx_subcategories_active', 'is_active'),
        Index('idx_subcategories_category', 'category_id'),
        {'comment': 'Subcategorías de productos, relacionadas con categorías '
                'principales'}
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, comment='Categoría padre a la que pertenece esta subcategoría')
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    category: Mapped['Categories'] = relationship('Categories', back_populates='subcategories')
    bottle_package_rules: Mapped[list['BottlePackageRules']] = relationship('BottlePackageRules', back_populates='subcategory')
    products: Mapped[list['Products']] = relationship('Products', back_populates='subcategory')
    product_promotions: Mapped[list['ProductPromotions']] = relationship('ProductPromotions', back_populates='subcategory')


class BottlePackageRules(Base):
    __tablename__ = 'bottle_package_rules'
    __table_args__ = (
        ForeignKeyConstraint(['included_category_id'], ['categories.id'], name='bottle_package_rules_included_category_id_fkey'),
        ForeignKeyConstraint(['subcategory_id'], ['subcategories.id'], ondelete='CASCADE', name='bottle_package_rules_subcategory_id_fkey'),
        PrimaryKeyConstraint('id', name='bottle_package_rules_pkey'),
        UniqueConstraint('unit_type', 'subcategory_id', name='bottle_package_rules_unit_type_subcategory_id_key'),
        Index('idx_bottle_package_rules_active', 'is_active', postgresql_where='(is_active = true)'),
        Index('idx_bottle_package_rules_subcategory', 'subcategory_id'),
        Index('idx_bottle_package_rules_unit', 'unit_type')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    unit_type: Mapped[str] = mapped_column(Text, nullable=False)
    included_category_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text('0'))
    subcategory_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))

    included_category: Mapped['Categories'] = relationship('Categories', back_populates='bottle_package_rules')
    subcategory: Mapped[Optional['Subcategories']] = relationship('Subcategories', back_populates='bottle_package_rules')


class Products(Base):
    __tablename__ = 'products'
    __table_args__ = (
        ForeignKeyConstraint(['category_id'], ['categories.id'], ondelete='SET NULL', name='products_category_id_fkey'),
        ForeignKeyConstraint(['subcategory_id'], ['subcategories.id'], ondelete='SET NULL', name='products_subcategory_id_fkey'),
        ForeignKeyConstraint(['supplier_id'], ['suppliers.id'], ondelete='SET NULL', name='products_supplier_id_fkey'),
        PrimaryKeyConstraint('id', name='products_pkey'),
        UniqueConstraint('sku', name='products_sku_key'),
        Index('idx_products_subcategory', 'subcategory_id')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    sku: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    unit: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'EA'::text"))
    barcode: Mapped[Optional[str]] = mapped_column(Text)
    description: Mapped[Optional[str]] = mapped_column(Text)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    cost: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    price: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, server_default=text('true'))
    min_stock: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    updated_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    supplier_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    subcategory_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, comment='Subcategoría opcional del producto')

    category: Mapped[Optional['Categories']] = relationship('Categories', back_populates='products')
    subcategory: Mapped[Optional['Subcategories']] = relationship('Subcategories', back_populates='products')
    supplier: Mapped[Optional['Suppliers']] = relationship('Suppliers', back_populates='products')
    inventory_movements: Mapped[list['InventoryMovements']] = relationship('InventoryMovements', back_populates='product')
    product_promotions: Mapped[list['ProductPromotions']] = relationship('ProductPromotions', back_populates='product')
    purchase_order_items: Mapped[list['PurchaseOrderItems']] = relationship('PurchaseOrderItems', back_populates='product')
    stock: Mapped[list['Stock']] = relationship('Stock', back_populates='product')
    sales_order_items: Mapped[list['SalesOrderItems']] = relationship('SalesOrderItems', back_populates='product')


class InventoryMovements(Base):
    __tablename__ = 'inventory_movements'
    __table_args__ = (
        CheckConstraint("movement_type = ANY (ARRAY['IN'::text, 'OUT'::text, 'ADJUSTMENT'::text])", name='inventory_movements_movement_type_check'),
        CheckConstraint('quantity > 0', name='inventory_movements_quantity_check'),
        ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE', name='inventory_movements_product_id_fkey'),
        ForeignKeyConstraint(['reason_id'], ['movement_reasons.id'], ondelete='RESTRICT', name='inventory_movements_reason_id_fkey'),
        ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE', name='inventory_movements_warehouse_id_fkey'),
        PrimaryKeyConstraint('id', name='inventory_movements_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    reason_id: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_table: Mapped[Optional[str]] = mapped_column(Text)
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    note: Mapped[Optional[str]] = mapped_column(Text)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid)
    created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(True), server_default=text('now()'))
    movement_type: Mapped[Optional[str]] = mapped_column(Text)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)

    product: Mapped['Products'] = relationship('Products', back_populates='inventory_movements')
    reason_: Mapped['MovementReasons'] = relationship('MovementReasons', back_populates='inventory_movements')
    warehouse: Mapped['Warehouses'] = relationship('Warehouses', back_populates='inventory_movements')


class PurchaseOrderItems(Base):
    __tablename__ = 'purchase_order_items'
    __table_args__ = (
        ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='RESTRICT', name='purchase_order_items_product_id_fkey'),
        ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='CASCADE', name='purchase_order_items_purchase_order_id_fkey'),
        PrimaryKeyConstraint('id', name='purchase_order_items_pkey')
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, server_default=text('gen_random_uuid()'))
    purchase_order_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    qty: Mapped[decimal.Decimal] = mapped_column(Numeric, nullable=False)
    unit_cost: Mapped[decimal.Decimal] = mapped_column(Numeric, nullable=False)
    tax: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))
    total: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, Computed('((qty * unit_cost) + tax)', persisted=True))

    product: Mapped['Products'] = relationship('Products', back_populates='purchase_order_items')
    purchase_order: Mapped['PurchaseOrders'] = relationship('PurchaseOrders', back_populates='purchase_order_items')


class Stock(Base):
    __tablename__ = 'stock'
    __table_args__ = (
        ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE', name='stock_product_id_fkey'),
        ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE', name='stock_warehouse_id_fkey'),
        PrimaryKeyConstraint('product_id', 'warehouse_id', name='stock_pkey')
    )

    product_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    warehouse_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True)
    qty: Mapped[Optional[decimal.Decimal]] = mapped_column(Numeric, server_default=text('0'))

    product: Mapped['Products'] = relationship('Products', back_populates='stock')
    warehouse: Mapped['Warehouses'] = relationship('Warehouses', back_populates='stock')


t_products_view = Table(
    'products_view', Base.metadata,
    Column('id', Uuid),
    Column('name', Text),
    Column('sku', Text),
    Column('description', Text),
    Column('price', Numeric),
    Column('cost', Numeric),
    Column('min_stock', Numeric),
    Column('unit', Text),
    Column('barcode', Text),
    Column('category_id', Uuid),
    Column('category_name', Text),
    Column('subcategory_id', Uuid),
    Column('subcategory_name', String(100)),
    Column('supplier_id', Uuid),
    Column('supplier_name', Text),
    Column('is_active', Boolean),
    Column('created_at', DateTime(True)),
    Column('updated_at', DateTime(True)),
    Column('total_stock', Numeric),
    Column('inventory_value', Numeric),
    Column('stock_status', Text),
    comment='Vista de productos con información de categorías, subcategorías, proveedores y stock'
)
