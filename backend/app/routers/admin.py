from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.auth import AuthedUser, require_admin
from app.schemas.order import Order, OrderStatus, OrderStatusUpdate, OrderWithItems
from app.schemas.product import (
    Product,
    ProductCreate,
    ProductListResponse,
    ProductUpdate,
)
from app.services import orders as orders_svc
from app.services import products as products_svc
from app.services import storage as storage_svc

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)

AdminDep = Annotated[AuthedUser, Depends(require_admin)]


# ---------- products ----------
@router.get("/products", response_model=ProductListResponse)
def list_products(
    _admin: AdminDep,
    q: str | None = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    items, total = products_svc.list_products(q, limit, offset, include_inactive=True)
    return {"items": items, "total": total}


@router.post("/products", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, _admin: AdminDep):
    return products_svc.create_product(data)


@router.patch("/products/{product_id}", response_model=Product)
def update_product(product_id: UUID, data: ProductUpdate, _admin: AdminDep):
    return products_svc.update_product(product_id, data)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: UUID, _admin: AdminDep):
    products_svc.soft_delete_product(product_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/products/upload-image")
def upload_image(
    _admin: AdminDep,
    file: UploadFile = File(...),
):
    url = storage_svc.upload_product_image(file)
    return {"url": url}


# ---------- orders ----------
@router.get("/orders")
def list_orders(
    _admin: AdminDep,
    status_filter: OrderStatus | None = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    items, total = orders_svc.list_orders(status_filter, limit, offset)
    return {"items": items, "total": total}


@router.get("/orders/{order_id}", response_model=OrderWithItems)
def get_order(order_id: UUID, _admin: AdminDep):
    return orders_svc.get_order_with_items(order_id)


@router.patch("/orders/{order_id}", response_model=Order)
def update_order_status(order_id: UUID, body: OrderStatusUpdate, _admin: AdminDep):
    return orders_svc.set_order_status(order_id, body.status)
