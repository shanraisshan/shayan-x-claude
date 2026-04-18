import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/products"
          className="rounded-lg border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <h2 className="font-medium">Products</h2>
          <p className="mt-1 text-sm text-neutral-600">Create, edit, and manage product listings.</p>
        </Link>
        <Link
          href="/admin/orders"
          className="rounded-lg border border-neutral-200 p-6 hover:bg-neutral-50"
        >
          <h2 className="font-medium">Orders</h2>
          <p className="mt-1 text-sm text-neutral-600">View orders and update fulfillment status.</p>
        </Link>
      </div>
    </div>
  );
}
