# Admin Product Management — Tasks

## Shipped
- [x] Admin products list table (includes inactive rows)
- [x] Create / Edit unified `ProductForm` component
- [x] Partial PATCH (unchanged fields skipped)
- [x] Hide-from-storefront via the **Active** checkbox on the edit form
- [x] Multipart image upload through FastAPI → Supabase Storage
- [x] Upload guard: content-type allowlist, 5 MB cap, random key
- [x] Admin JWT attached to every admin API call via `useAdminToken`

## Explicitly out of scope
- **Delete** endpoint / button — products feed historical orders via `order_items.product_id`. Removing a product would break order history or require cascading deletes we don't want. Use **Active: off** to hide it instead.

## Next up
- [ ] Dedicated `GET /api/admin/products/{id}` (edit page currently lists-and-filters; fine for MVP, inefficient at scale)
- [ ] Inline validation for slug uniqueness (backend 409 already catches it)
- [ ] Image preview with remove button + reupload
- [ ] Drag-and-drop image upload

## Nice to have
- [ ] Bulk actions (activate / deactivate multiple)
- [ ] CSV import to bulk-seed products
- [ ] Product variants (size/color) — requires schema changes
- [ ] Inventory audit log (who changed stock from what to what)
