from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator

class LoginInput(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=256)

class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=100)
    price: float = Field(ge=0)
    image: str = Field(default="", max_length=1000)

class ProductUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(min_length=1, max_length=100)
    price: float = Field(ge=0)
    image: str | None = Field(default=None, max_length=1000)

class ProductOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category: str
    price: float
    stock: int
    image: str
    status: str

class TransactionCreate(BaseModel):
    product_id: str
    type: str
    quantity: int = Field(ge=0)
    price: float = Field(ge=0)

    @field_validator("type")
    @classmethod
    def valid_type(cls, value):
        if value not in {"In", "Out", "Adjustment"}:
            raise ValueError("Type must be In, Out, or Adjustment")
        return value

    @field_validator("quantity")
    @classmethod
    def valid_quantity(cls, value, info):
        tx_type = info.data.get("type")
        if tx_type in {"In", "Out"} and value < 1:
            raise ValueError("Quantity must be at least 1 for stock in/out")
        return value

class TransactionOut(BaseModel):
    id: str
    product_id: str
    product: str
    category: str
    type: str
    quantity: int
    price: float
    change: int
    stockStatus: str
    status: str
    date: datetime
