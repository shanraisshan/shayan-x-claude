# Product Catalog — Tasks

## Shipped
- [x] `products` table schema (see `database-and-seed`)
- [x] `GET /api/products` (list with `q`, `limit`, `offset`)
- [x] `GET /api/products/{slug}`
- [x] Home grid (Server Component, `cache: "no-store"`)
- [x] Product detail page with stock + out-of-stock state
- [x] Empty catalog state ("No products yet.")
- [x] Remote image support for `**.supabase.co` (already public CDN URLs work via plain `<img>`)

## Next up
- [ ] Search input on home wired to `?q=` (backend already accepts it)
- [ ] Pagination UI (Prev / Next) using `limit` + `offset`
- [ ] Sort by price / newest — add `sort` param to `/api/products`
- [ ] Skeleton loading state while SSR streams
- [ ] OpenGraph / `generateMetadata()` per product for link previews

## Nice to have
- [ ] Category taxonomy (`categories` table + join) + category filter
- [ ] Related products on detail page
- [ ] Structured data (`Product` JSON-LD) for SEO
