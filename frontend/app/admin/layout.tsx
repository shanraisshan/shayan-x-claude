import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/admin/SignOutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware redirects unauthenticated users away from /admin/** except /admin/login.
  // If we see no user here, we're on /admin/login — render the page bare, no admin chrome.
  if (!user) return <>{children}</>;

  const role = (user.app_metadata as { role?: string } | null)?.role;
  if (role !== "admin") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-neutral-600">
          This account does not have admin access.
        </p>
        <div className="mt-4">
          <SignOutButton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-neutral-200 bg-neutral-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-semibold">
              Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-neutral-700">
              <Link href="/admin/products" className="hover:underline">
                Products
              </Link>
              <Link href="/admin/orders" className="hover:underline">
                Orders
              </Link>
              <Link href="/" className="hover:underline">
                View store →
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-500">{user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
