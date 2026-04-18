from fastapi import APIRouter, Query

from app.schemas.product import Product, ProductListResponse
from app.services import products as products_svc

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=ProductListResponse)
def list_products(
    q: str | None = None,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    items, total = products_svc.list_products(q, limit, offset)
    return {"items": items, "total": total}


@router.get("/{slug}", response_model=Product)
def get_product(slug: str):
    return products_svc.get_product_by_slug(slug)
