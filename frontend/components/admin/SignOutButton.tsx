"use client";

import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.signOut();
        router.replace("/admin/login");
        router.refresh();
      }}
      className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
    >
      Sign out
    </button>
  );
}
