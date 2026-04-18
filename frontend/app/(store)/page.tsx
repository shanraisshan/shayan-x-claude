import { listProducts } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";

export default async function HomePage() {
  const { items } = await listProducts({ limit: 24 });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>
      {items.length === 0 ? (
        <p className="text-neutral-500">No products yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
