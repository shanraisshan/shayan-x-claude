import { notFound } from "next/navigation";
import { ApiError, getProduct } from "@/lib/api";
import { formatMoney } from "@/lib/types";
import { AddToCartButton } from "@/components/AddToCartButton";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let product;
  try {
    product = await getProduct(slug);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-neutral-100">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            No image
          </div>
        )}
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-lg text-neutral-700">
          {formatMoney(product.price_cents, product.currency)}
        </p>
        <p className="mt-4 whitespace-pre-line text-neutral-600">{product.description}</p>
        <p className="mt-2 text-sm text-neutral-500">
          {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </p>
        <div className="mt-6">
          <AddToCartButton product={product} />
        </div>
      </div>
    </div>
  );
}
