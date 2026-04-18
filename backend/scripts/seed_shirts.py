"""One-shot seeder: pulls real apparel data from DummyJSON and upserts it into
products via Supabase REST (service-role key), then writes a canonical
db/seed.sql so the seed is reproducible.

Usage:
    cd backend
    uv run python scripts/seed_shirts.py
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend"))

from app.config import get_settings  # noqa: E402
from app.supabase_client import get_supabase  # noqa: E402

CATEGORIES = ["mens-shirts", "tops"]
OLD_PICSUM_SLUGS = [
    "classic-tee", "canvas-tote", "ceramic-mug", "wool-beanie",
    "enamel-pin-set", "sticker-pack", "leather-notebook", "ballpoint-pen",
]


def fetch_category(cat: str) -> list[dict]:
    url = f"https://dummyjson.com/products/category/{cat}?limit=100"
    req = urllib.request.Request(url, headers={"User-Agent": "ecommerce-seeder/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())["products"]


def slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def to_row(p: dict) -> dict:
    image = p.get("thumbnail") or (p.get("images") or [None])[0]
    return {
        "slug": slugify(p["title"]),
        "name": p["title"],
        "description": p.get("description") or "",
        "price_cents": int(round(float(p["price"]) * 100)),
        "currency": "USD",
        "image_url": image,
        "stock": int(p.get("stock") or 0),
        "is_active": True,
    }


def sql_literal(value) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def write_seed_sql(rows: list[dict], path: Path) -> None:
    cols = [
        "slug", "name", "description", "price_cents",
        "currency", "image_url", "stock", "is_active",
    ]
    lines = [
        "-- Seed real apparel from DummyJSON. Idempotent: re-running refreshes existing slugs.",
        "-- Regenerate with: uv run python backend/scripts/seed_shirts.py",
        "",
        f"insert into public.products ({', '.join(cols)}) values",
    ]
    values = []
    for r in rows:
        values.append("  (" + ", ".join(sql_literal(r[c]) for c in cols) + ")")
    lines.append(",\n".join(values))
    lines.append("""on conflict (slug) do update set
  name        = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  currency    = excluded.currency,
  image_url   = excluded.image_url,
  stock       = excluded.stock,
  is_active   = excluded.is_active,
  updated_at  = now();""")
    path.write_text("\n".join(lines) + "\n")


def main() -> int:
    get_settings()  # validates env is loaded
    products: list[dict] = []
    for cat in CATEGORIES:
        items = fetch_category(cat)
        print(f"fetched {len(items):>3} items from {cat}")
        products.extend(items)

    rows = [to_row(p) for p in products]

    # Collapse slug collisions by appending -2, -3, … if any
    seen: dict[str, int] = {}
    for r in rows:
        base = r["slug"]
        seen[base] = seen.get(base, 0) + 1
        if seen[base] > 1:
            r["slug"] = f"{base}-{seen[base]}"

    sb = get_supabase()

    # Don't delete products if any orders reference them
    orders = sb.table("orders").select("id", count="exact").limit(1).execute()
    if (orders.count or 0) == 0:
        sb.table("products").delete().in_("slug", OLD_PICSUM_SLUGS).execute()
        print(f"removed up to {len(OLD_PICSUM_SLUGS)} old picsum products (orders empty)")
    else:
        print(f"orders exist ({orders.count}); keeping old products to preserve FK references")

    sb.table("products").upsert(rows, on_conflict="slug").execute()
    print(f"upserted {len(rows)} apparel products")

    seed_path = ROOT / "db" / "seed.sql"
    write_seed_sql(rows, seed_path)
    print(f"wrote canonical seed to {seed_path.relative_to(ROOT)}")

    # Quick sanity read
    resp = (
        sb.table("products")
        .select("slug,name,price_cents,stock,image_url")
        .order("name")
        .limit(5)
        .execute()
    )
    print("\nsample rows:")
    for r in resp.data:
        print(f"  {r['slug']:35} {r['name']:40} ${r['price_cents']/100:6.2f}  stock={r['stock']:4}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
