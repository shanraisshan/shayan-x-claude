import { CartProvider } from "@/components/CartProvider";
import { Header } from "@/components/Header";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </CartProvider>
  );
}
