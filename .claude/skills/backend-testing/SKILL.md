---
name: backend-testing
description: pytest + httpx + TestClient patterns for the FastAPI backend. Dependency overrides for auth, FakeSupabase mocking, HTTPException assertions. Use when writing or reviewing backend/tests/test_*.py.
argument-hint: "[endpoint or service under test]"
---

# Backend Testing Skill

> **Version:** 1.0 | **Working Directory:** `backend/`

Write pytest tests for **$ARGUMENTS** following the conventions in this repo.

## Stack

- **pytest** with `asyncio_mode = "auto"` (from `pyproject.toml`)
- **httpx** + `fastapi.testclient.TestClient` — integration tests
- **monkeypatch** — swap `get_supabase()` for `FakeSupabase` at the service boundary

No SQLAlchemy, no testcontainers, no real Supabase in unit tests.

## Constitution (Non-Negotiable Rules)

| # | Rule | Why |
|---|------|-----|
| 1 | **Tests live in `backend/tests/test_*.py`** (pytest discovery) | Matches the existing `test_health.py` pattern |
| 2 | **Test services first** — they hold the logic; routers are thin | Router tests are integration sanity, not unit coverage |
| 3 | **Override auth deps via `app.dependency_overrides[current_user]`** — restore in a `finally` | Follows `test_health.py::test_admin_rejects_non_admin` |
| 4 | **Mock Supabase at `app.services.<module>.get_supabase`** — not globally | Narrow blast radius; other services keep their real client |
| 5 | **Assert snake_case `detail` strings** for domain errors: `assert r.json()["detail"] == "stock_exceeded"` | Matches `HTTPException` convention in `services/products.py` |
| 6 | **Never hit a real Supabase** from a test — `conftest.py` stubs env with fake credentials | Unit tests must not leak |
| 7 | **One behavior per test** — don't chain unrelated assertions | Clear failure messages |
| 8 | **Cover the happy path + every `HTTPException` branch** named in `plan.md::Error mapping` | Plan is the contract |

## Quick Start

### Service unit test
```python
# backend/tests/test_products_service.py
import pytest
from fastapi import HTTPException

from app.services import products as products_service
from tests.fakes import FakeSupabase


def test_list_products_returns_only_active(monkeypatch):
    fake = FakeSupabase(
        table_data={"products": [
            {"id": "p1", "slug": "a", "name": "A", "is_active": True,
             "price_cents": 100, "currency": "USD", "image_url": None, "stock": 1},
            {"id": "p2", "slug": "b", "name": "B", "is_active": False,
             "price_cents": 100, "currency": "USD", "image_url": None, "stock": 1},
        ]},
    )
    monkeypatch.setattr("app.services.products.get_supabase", lambda: fake)

    result = products_service.list_products(limit=10, offset=0)
    slugs = {p["slug"] for p in result["items"]}
    assert "a" in slugs
    assert "b" not in slugs


def test_get_product_raises_not_found(monkeypatch):
    fake = FakeSupabase(table_data={"products": []})
    monkeypatch.setattr("app.services.products.get_supabase", lambda: fake)

    with pytest.raises(HTTPException) as exc:
        products_service.get_product_by_slug("missing")
    assert exc.value.status_code == 404
    assert exc.value.detail == "product_not_found"
```

### Router integration test (auth override)
```python
# backend/tests/test_admin_products_router.py
from fastapi.testclient import TestClient

from app.auth import AuthedUser, current_user
from app.main import app


def test_admin_list_requires_bearer():
    client = TestClient(app)
    r = client.get("/api/admin/products")
    assert r.status_code == 401


def test_admin_list_as_admin(monkeypatch):
    app.dependency_overrides[current_user] = lambda: AuthedUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="admin@example.com",
        role="admin",
    )
    try:
        # also mock the service so we don't hit Supabase
        monkeypatch.setattr(
            "app.services.products.list_products_admin",
            lambda **_: {"items": [], "total": 0},
        )
        client = TestClient(app)
        r = client.get("/api/admin/products")
        assert r.status_code == 200
        assert r.json() == {"items": [], "total": 0}
    finally:
        app.dependency_overrides.clear()
```

### Checkout RPC test
```python
# backend/tests/test_orders_service.py
import pytest
from fastapi import HTTPException

from app.services import orders as orders_service
from tests.fakes import FakeSupabase


def test_create_order_calls_rpc_with_snapshot(monkeypatch):
    fake = FakeSupabase(
        rpc_response={"order_id": "o1", "total_cents": 1000, "status": "paid"},
    )
    monkeypatch.setattr("app.services.orders.get_supabase", lambda: fake)

    result = orders_service.checkout(
        email="a@b.com",
        shipping_name="A",
        shipping_address={"line1": "x", "city": "y", "postal_code": "1", "country": "US"},
        items=[{"product_id": "p1", "quantity": 1}],
    )

    assert result == {"order_id": "o1", "total_cents": 1000, "status": "paid"}
    assert fake.rpc_calls[0][0] == "create_order"


def test_create_order_maps_stock_error(monkeypatch):
    fake = FakeSupabase(rpc_error="stock_exceeded")
    monkeypatch.setattr("app.services.orders.get_supabase", lambda: fake)

    with pytest.raises(HTTPException) as exc:
        orders_service.checkout(
            email="a@b.com", shipping_name="A",
            shipping_address={"line1": "x", "city": "y", "postal_code": "1", "country": "US"},
            items=[{"product_id": "p1", "quantity": 99}],
        )
    assert exc.value.detail == "stock_exceeded"
```

## `FakeSupabase` (`backend/tests/fakes.py`)

A minimal chainable stub that covers the `.table(...).select(...).eq(...).execute()` and `.rpc(name, payload).execute()` shapes used by the services.

```python
# backend/tests/fakes.py
from typing import Any


class _Query:
    def __init__(self, data: list[dict[str, Any]]):
        self._data = data
        self._filters: list[tuple[str, str, Any]] = []

    def select(self, *_cols: str) -> "_Query": return self
    def eq(self, col: str, val: Any) -> "_Query":
        self._filters.append(("eq", col, val)); return self
    def ilike(self, col: str, pattern: str) -> "_Query":
        self._filters.append(("ilike", col, pattern)); return self
    def order(self, *_args: Any, **_kwargs: Any) -> "_Query": return self
    def range(self, *_args: Any, **_kwargs: Any) -> "_Query": return self
    def limit(self, *_args: Any, **_kwargs: Any) -> "_Query": return self
    def single(self) -> "_Query": return self

    def execute(self) -> Any:
        out = self._data
        for op, col, val in self._filters:
            if op == "eq":
                out = [row for row in out if row.get(col) == val]
        return type("R", (), {"data": out, "count": len(out)})()


class _Rpc:
    def __init__(self, response: Any, error: str | None):
        self._response = response
        self._error = error

    def execute(self) -> Any:
        if self._error:
            raise Exception(self._error)  # services catch and map to HTTPException
        return type("R", (), {"data": self._response})()


class FakeSupabase:
    def __init__(
        self,
        *,
        table_data: dict[str, list[dict[str, Any]]] | None = None,
        rpc_response: Any = None,
        rpc_error: str | None = None,
    ) -> None:
        self._tables = table_data or {}
        self._rpc_response = rpc_response
        self._rpc_error = rpc_error
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str) -> _Query:
        return _Query(self._tables.get(name, []))

    def rpc(self, name: str, payload: dict[str, Any]) -> _Rpc:
        self.rpc_calls.append((name, payload))
        return _Rpc(self._rpc_response, self._rpc_error)
```

Extend `_Query` only when a service needs a method that isn't here yet — don't speculate.

## Fixtures (add to `conftest.py` as needed)

```python
# backend/tests/conftest.py  (append to the existing env defaults)
import pytest
from fastapi.testclient import TestClient

from app.auth import AuthedUser, current_user
from app.main import app


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture
def authed_admin():
    app.dependency_overrides[current_user] = lambda: AuthedUser(
        user_id="00000000-0000-0000-0000-000000000001",
        email="admin@example.com",
        role="admin",
    )
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def authed_user():
    app.dependency_overrides[current_user] = lambda: AuthedUser(
        user_id="00000000-0000-0000-0000-000000000002",
        email="user@example.com",
        role="user",
    )
    yield
    app.dependency_overrides.clear()
```

## Running

```bash
cd backend
uv run pytest -q                        # all tests
uv run pytest tests/test_products_service.py::test_get_product_raises_not_found -vv
uv run pytest -k "admin" -vv            # by keyword
```

## Exemplar Files

- `backend/tests/test_health.py` — dependency override + TestClient pattern
- `backend/tests/conftest.py` — env defaults for test isolation
