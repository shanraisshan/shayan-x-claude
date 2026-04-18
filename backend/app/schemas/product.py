from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class Product(BaseModel):
    id: UUID
    slug: str
    name: str
    description: str
    price_cents: int
    currency: str
    image_url: str | None
    stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ProductCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=200)
    description: str = ""
    price_cents: int = Field(ge=0)
    currency: str = "USD"
    image_url: str | None = None
    stock: int = Field(ge=0, default=0)
    is_active: bool = True


class ProductUpdate(BaseModel):
    slug: str | None = Field(default=None, min_length=1, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    currency: str | None = None
    image_url: str | None = None
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None


class ProductListResponse(BaseModel):
    items: list[Product]
    total: int
