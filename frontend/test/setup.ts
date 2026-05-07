import "@testing-library/jest-dom/vitest";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:8000";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
