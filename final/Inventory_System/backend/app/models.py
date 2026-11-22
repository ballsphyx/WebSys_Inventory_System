from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

class Product(Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_product_price_nonnegative"), CheckConstraint("stock >= 0", name="ck_product_stock_nonnegative"))
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str] = mapped_column(String(100), index=True)
    price: Mapped[float] = mapped_column(Float)
    stock: Mapped[int] = mapped_column(Integer, default=0)
    image: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="product", passive_deletes=True)

class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_transaction_quantity_positive"), CheckConstraint("price >= 0", name="ck_transaction_price_nonnegative"), Index("ix_transaction_date_type", "date", "type"))
    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="RESTRICT"), index=True)
    product: Mapped[Product] = relationship(back_populates="transactions")
    product_name: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(100))
    type: Mapped[str] = mapped_column(String(20), index=True)  # In, Out, Adjustment
    quantity: Mapped[int] = mapped_column(Integer)
    price: Mapped[float] = mapped_column(Float)
    stock_change: Mapped[int] = mapped_column(Integer)
    stock_after: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="Completed")
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
