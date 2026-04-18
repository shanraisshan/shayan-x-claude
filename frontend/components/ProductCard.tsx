import Link from "next/link";
import { formatMoney, type Product } from "@/lib/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block overflow-hidden rounded-lg border border-neutral-200 transition hover:shadow-md"
    >
      <div className="aspect-square w-full overflow-hidden bg-neutral-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            No image
          </div>
        )}
      </div>
      <div className="flex items-center justify-between p-3">
        <span className="font-medium">{product.name}</span>
        <span className="text-sm text-neutral-600">
          {formatMoney(product.price_cents, product.currency)}
        </span>
      </div>
    </Link>
  );
}
