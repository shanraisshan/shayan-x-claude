from uuid import UUID

from fastapi import HTTPException, status

from app.schemas.order import CheckoutRequest, OrderStatus
from app.supabase_client import get_supabase


def checkout(req: CheckoutRequest) -> dict:
    sb = get_supabase()
    items_payload = [
        {"product_id": str(i.product_id), "quantity": i.quantity} for i in req.items
    ]
    try:
        resp = sb.rpc(
            "create_order",
            {
                "p_email": req.email,
                "p_shipping_name": req.shipping_name,
                "p_shipping_address": req.shipping_address.model_dump(),
                "p_items": items_payload,
            },
        ).execute()
    except Exception as exc:
        msg = str(exc)
        if "insufficient_stock" in msg:
            raise HTTPException(status.HTTP_409_CONFLICT, "insufficient_stock") from exc
        if "product_not_found" in msg:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "product_not_found") from exc
        if "empty_cart" in msg or "invalid_quantity" in msg or "invalid_email" in msg:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid_checkout") from exc
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "checkout_failed") from exc
    return resp.data


def list_orders(status_filter: OrderStatus | None, limit: int, offset: int):
    sb = get_supabase()
    query = sb.table("orders").select("*", count="exact")
    if status_filter:
        query = query.eq("status", status_filter)
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    resp = query.execute()
    return resp.data or [], resp.count or 0


def get_order_with_items(order_id: UUID) -> dict:
    sb = get_supabase()
    order_resp = sb.table("orders").select("*").eq("id", str(order_id)).limit(1).execute()
    if not order_resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order_not_found")
    items_resp = sb.table("order_items").select("*").eq("order_id", str(order_id)).execute()
    return {**order_resp.data[0], "items": items_resp.data or []}


def set_order_status(order_id: UUID, new_status: OrderStatus) -> dict:
    sb = get_supabase()
    resp = sb.table("orders").update({"status": new_status}).eq("id", str(order_id)).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "order_not_found")
    return resp.data[0]
