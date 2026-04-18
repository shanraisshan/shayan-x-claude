# Admin Auth — Tasks

## Shipped
- [x] Supabase Auth email+password sign-in page
- [x] `middleware.ts` gate for `/admin/**` (skips `/admin/login`)
- [x] Admin layout bare-render for login path, role check for others
- [x] `require_admin` FastAPI dep with JWKS verification (ES256)
- [x] JWKS client cached (1h lifespan)
- [x] `create_admin.sql` bootstrap (idempotent; sets bcrypt password, confirms email, grants role)
- [x] Pytest uses `dependency_overrides` for admin routes (no test JWT keypair needed)
- [x] Sign-out button hooked to `supabase.auth.signOut()` + router refresh

## Next up
- [ ] Rate-limit `/admin/login` POSTs (brute-force resistance)
- [ ] Password reset flow (`supabase.auth.resetPasswordForEmail` + `/admin/reset` page)
- [ ] "Forgot password?" link on login
- [ ] Audit log table: who did what when (admin id, action, target, timestamp)

## Hardening
- [ ] Rotate PAT + service-role key procedure documented
- [ ] Per-environment Supabase projects (dev/staging/prod)
- [ ] Session timeout UX (warn near expiry, offer refresh)
- [ ] MFA / TOTP for admins (Supabase MFA)
