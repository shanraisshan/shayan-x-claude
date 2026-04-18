# Features

Each folder below slices the MVP into one feature. Every feature has:

- **`plan.md`** — design: purpose, user flows, files, endpoints, DB, dependencies, verification.
- **`task.md`** — tracked checklist: what's shipped and what remains.

Read [`../../CLAUDE.md`](../../CLAUDE.md) first for the overall architecture.

| Feature | Plan | Tasks |
| --- | --- | --- |
| Product catalog | [plan](./product-catalog/plan.md) | [tasks](./product-catalog/task.md) |
| Cart and checkout | [plan](./cart-and-checkout/plan.md) | [tasks](./cart-and-checkout/task.md) |
| Admin auth | [plan](./admin-auth/plan.md) | [tasks](./admin-auth/task.md) |
| Admin product management | [plan](./admin-product-management/plan.md) | [tasks](./admin-product-management/task.md) |
| Admin order management | [plan](./admin-order-management/plan.md) | [tasks](./admin-order-management/task.md) |
| Database and seed | [plan](./database-and-seed/plan.md) | [tasks](./database-and-seed/task.md) |

## Dependency graph

```
database-and-seed  ──►  product-catalog  ──►  cart-and-checkout
                   │
                   └──►  admin-auth  ──►  admin-product-management
                                     └──►  admin-order-management
```
