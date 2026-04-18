from uuid import UUID

from fastapi import HTTPException, status

from app.schemas.product import ProductCreate, ProductUpdate
from app.supabase_client import get_supabase


def list_products(q: str | None, limit: int, offset: int, include_inactive: bool = False):
    sb = get_supabase()
    query = sb.table("products").select("*", count="exact")
    if not include_inactive:
        query = query.eq("is_active", True)
    if q:
        query = query.ilike("name", f"%{q}%")
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    resp = query.execute()
    return resp.data or [], resp.count or 0


def get_product_by_slug(slug: str, include_inactive: bool = False):
    sb = get_supabase()
    query = sb.table("products").select("*").eq("slug", slug).limit(1)
    if not include_inactive:
        query = query.eq("is_active", True)
    resp = query.execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product_not_found")
    return resp.data[0]


def get_product(product_id: UUID):
    sb = get_supabase()
    resp = sb.table("products").select("*").eq("id", str(product_id)).limit(1).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product_not_found")
    return resp.data[0]


def create_product(data: ProductCreate) -> dict:
    sb = get_supabase()
    resp = sb.table("products").insert(data.model_dump()).execute()
    return resp.data[0]


def update_product(product_id: UUID, data: ProductUpdate) -> dict:
    payload = {k: v for k, v in data.model_dump().items() if v is not None}
    if not payload:
        return get_product(product_id)
    sb = get_supabase()
    resp = sb.table("products").update(payload).eq("id", str(product_id)).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product_not_found")
    return resp.data[0]
