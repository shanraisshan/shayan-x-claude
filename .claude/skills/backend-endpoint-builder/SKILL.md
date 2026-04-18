---
name: backend-endpoint-builder
description: Build FastAPI endpoints in the layered router → service → Supabase pattern, with Pydantic v2 schemas, JWT/admin gating, and consistent HTTPException-based domain errors. Use when adding/modifying any endpoint under backend/.
argument-hint: "[resource-name]"
---

# Endpoint Builder Skill

> **Version:** 1.0 | **Working Directory:** `backend/`

Build FastAPI endpoints for **$ARGUMENTS** following the layered architecture used in this repo.

## Overview

Three layers, one responsibility each:
- **Schema** (`app/schemas/`) — Pydantic v2 validation for request bodies, query objects, and response shapes
- **Service** (`app/services/`) — ALL business logic; talks to Supabase via `get_supabase()`
- **Router** (`app/routers/`) — HTTP wiring: validate, dep-inject auth, call ONE service function, return its result

Routers are split by audience:
- `routers/public.py` — public reads (`/api/products`, `/api/products/{slug}`)
- `routers/orders.py` — guest checkout (`POST /api/orders`)
- `routers/admin.py` — everything admin, gated at the router level by `dependencies=[Depends(require_admin)]`

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Thin routers, fat services** — router validates, calls one service fn, returns; logic lives in `services/` | Testable, single source of business rules |
| 2 | **One service call per endpoint** | Single responsibility; if you need two, write a wrapper service fn |
| 3 | **Admin endpoints depend on `require_admin`** — already wired at the router level in `admin.py`; new admin routes inherit it | Backend is the security boundary |
| 4 | **Pydantic v2 schemas validate every body and shape every response** — `response_model=` set on every data-returning endpoint | Fail fast at the boundary; honest OpenAPI |
| 5 | **Domain errors via `HTTPException(status, "snake_case_code")`** raised from the service — matches existing `services/products.py` pattern | The frontend reads `detail` and renders it; codes are stable |
| 6 | **No business logic in schemas or routers** | Logic in services means tests don't need a TestClient |
| 7 | **Service-role Supabase client only via `get_supabase()`** from `app.supabase_client` | Single configured client; no inline secrets |
| 8 | **No `print()` debugging; no service-role key in logs** | Hygiene + security |
| 9 | **Match existing sync-vs-async style** — current routes are sync; only go async when there's real `await` work (e.g., a multipart stream) | Consistency over premature async |
| 10 | **Register new routers in `app/main.py::create_app()`** | Otherwise they don't load |

## When to Use

- Creating a new endpoint (GET/POST/PATCH/DELETE)
- Adding validation to an existing endpoint
- Splitting an over-grown service function
- Wiring a new router file

## File Order (always Schema → Service → Router → Register)

1. **Schema** — `backend/app/schemas/<resource>.py`
2. **Service** — `backend/app/services/<resource>.py`
3. **Router** — append to `routers/public.py` / `orders.py` / `admin.py`, OR new file + register in `app/main.py`
4. **Register** — only when adding a new router file

## Quick Start

### Schema (Pydantic v2)
```python
# backend/app/schemas/product.py
from pydantic import BaseModel, Field

class ProductCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    price_cents: int = Field(ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    image_url: str | None = None
    stock: int = Field(default=0, ge=0)
    is_active: bool = True

class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price_cents: int | None = Field(default=None, ge=0)
    image_url: str | None = None
    stock: int | None = Field(default=None, ge=0)
    is_active: bool | None = None
```

### Service (Supabase access + domain errors)
```python
# backend/app/services/products.py
from uuid import UUID
from fastapi import HTTPException, status
from app.schemas.product import ProductCreate, ProductUpdate
from app.supabase_client import get_supabase

def get_product(product_id: UUID) -> dict:
    sb = get_supabase()
    resp = sb.table("products").select("*").eq("id", str(product_id)).limit(1).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "product_not_found")
    return resp.data[0]

def create_product(data: ProductCreate) -> dict:
    sb = get_supabase()
    resp = sb.table("products").insert(data.model_dump()).execute()
    return resp.data[0]
```

### Router (thin)
```python
# backend/app/routers/admin.py  (excerpt)
from fastapi import APIRouter, Depends, status
from uuid import UUID
from app.auth import require_admin
from app.schemas.product import Product, ProductCreate
from app.services import products as products_svc

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)

@router.post("/products", response_model=Product, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate):
    return products_svc.create_product(data)
```

### Register (only for a new router file)
```python
# backend/app/main.py
from app.routers import admin, orders, public, reports  # NEW import

app.include_router(reports.router)  # NEW
```

## Patterns by Use Case

### Public read endpoint
```python
# routers/public.py
@router.get("/products", response_model=ProductListResponse)
def list_products(
    q: str | None = None,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    items, total = products_svc.list_products(q, limit, offset)  # public reads filter is_active=true
    return {"items": items, "total": total}
```

### Guest checkout (atomic via RPC)
```python
# services/orders.py
def create_order(payload: CheckoutRequest) -> dict:
    sb = get_supabase()
    resp = sb.rpc("create_order", {
        "p_email": payload.email,
        "p_shipping_name": payload.shipping_name,
        "p_shipping_address": payload.shipping_address.model_dump(),
        "p_items": [item.model_dump() for item in payload.items],
    }).execute()
    if not resp.data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "checkout_failed")
    return resp.data
```
Multi-row writes (stock decrement + order insert + items insert + status flip) MUST go through the SQL RPC. Don't replicate the transaction in Python.

### Admin endpoint
The admin router already injects `require_admin`. To get the user inside an endpoint:
```python
from typing import Annotated
from app.auth import AuthedUser, require_admin
AdminDep = Annotated[AuthedUser, Depends(require_admin)]

@router.patch("/products/{product_id}", response_model=Product)
def update_product(product_id: UUID, data: ProductUpdate, _admin: AdminDep):
    return products_svc.update_product(product_id, data)
```

### Multipart upload
```python
@router.post("/products/upload-image")
def upload_image(_admin: AdminDep, file: UploadFile = File(...)):
    url = storage_svc.upload_product_image(file)
    return {"url": url}
```
The service uses the service-role Supabase Storage client.

## Errors — Standard Codes

Raise `HTTPException(status_code, detail)` from the service. Suggested codes:

| Status | `detail` | When |
|--------|----------|------|
| 400 | `"checkout_failed"` | RPC returned no data / business rule failed |
| 401 | `"missing_bearer_token"`, `"token_expired"`, `"invalid_token"` | Already raised by `current_user` |
| 403 | `"admin_only"` | Already raised by `require_admin` |
| 404 | `"product_not_found"`, `"order_not_found"` | Lookup miss |
| 409 | `"slug_already_exists"` | Unique-constraint conflict caught and re-raised |
| 422 | (FastAPI default) | Pydantic validation — don't override |

Stick to `snake_case` codes. The frontend reads `detail` and shows it.

## Testing

- Unit-test services first; mock at the import site:
  ```python
  monkeypatch.setattr("app.services.products.get_supabase", lambda: fake_sb)
  ```
- Use `TestClient(app)` for router-level smoke; override auth with `app.dependency_overrides[require_admin] = lambda: AuthedUser("u1", "a@a", "admin")`
- Cover both happy path and the `HTTPException` branches

## Common Tasks

### Add a CRUD endpoint
1. Schema (`Create` / `Update` / `Response`)
2. Service function with `get_supabase()` and proper `HTTPException`s
3. Router endpoint (right file, `response_model=`, `status_code=` for POST)
4. (If new file) include in `app/main.py`

### Add validation
- Use `Field(...)` constraints on the schema; for cross-field rules add a `@model_validator`
- Business-rule validation (e.g., "stock can't go below pending orders") belongs in the service

### Add an admin-only filter to an existing public list
- Add `include_inactive: bool = False` parameter to the service fn
- Public router calls it default; admin router passes `True`

## Additional Resources

- For Supabase / migration / Storage details, see [../backend-database-ops/SKILL.md](../backend-database-ops/SKILL.md)

## Exemplar Files

- `backend/app/routers/admin.py` — thin routers + group-level `require_admin`
- `backend/app/routers/public.py` — public reads
- `backend/app/services/products.py` — Supabase via `get_supabase()`, `HTTPException` codes
- `backend/app/services/orders.py` — RPC-based checkout
- `backend/app/schemas/product.py` — Pydantic v2 schema
- `backend/app/auth.py` — `current_user`, `require_admin`
- `backend/app/main.py` — router registration
