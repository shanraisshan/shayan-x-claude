from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

OrderStatus = Literal["pending", "paid", "shipped", "cancelled"]


class ShippingAddress(BaseModel):
    line1: str
    line2: str | None = None
    city: str
    region: str | None = None
    postal_code: str
    country: str = "US"


class CheckoutItem(BaseModel):
    product_id: UUID
    quantity: int = Field(ge=1, le=999)


class CheckoutRequest(BaseModel):
    email: EmailStr
    shipping_name: str = Field(min_length=1, max_length=200)
    shipping_address: ShippingAddress
    items: list[CheckoutItem] = Field(min_length=1)


class CheckoutResponse(BaseModel):
    order_id: UUID
    total_cents: int
    status: OrderStatus


class OrderItem(BaseModel):
    id: UUID
    product_id: UUID
    quantity: int
    unit_price_cents: int


class Order(BaseModel):
    id: UUID
    email: str
    shipping_name: str
    shipping_address: dict
    subtotal_cents: int
    total_cents: int
    status: OrderStatus
    created_at: datetime
    updated_at: datetime


class OrderWithItems(Order):
    items: list[OrderItem]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus
