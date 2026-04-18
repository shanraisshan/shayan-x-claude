from fastapi import APIRouter

from app.schemas.order import CheckoutRequest, CheckoutResponse
from app.services import orders as orders_svc

router = APIRouter(prefix="/api/orders", tags=["orders"])


@router.post("", response_model=CheckoutResponse)
def checkout(req: CheckoutRequest):
    return orders_svc.checkout(req)
