import { ProductForm } from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">New product</h1>
      <ProductForm mode={{ kind: "create" }} />
    </div>
  );
}
