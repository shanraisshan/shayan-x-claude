"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/admin";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const supabase = createSupabaseBrowserClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
    });
    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <h1 className="mb-6 text-2xl font-semibold">Admin sign in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Email</span>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Password</span>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2"
          />
        </label>
        {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-neutral-900 px-4 py-2 text-white disabled:bg-neutral-400"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
