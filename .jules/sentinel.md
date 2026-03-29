## 2024-03-26 - [CRITICAL] Fixed Auth Bypass in create-auth-user endpoint
**Vulnerability:** The `/api/employees/create-auth-user/route.ts` endpoint allowed any unauthenticated user to create system accounts if they knew an `employeeId`. It bypassed all authentication and authorization checks by directly using `SUPABASE_SERVICE_ROLE_KEY` to create users.
**Learning:** Endpoints that use service role keys must always have their own rigorous authentication and authorization checks, since the service role key bypasses all Row Level Security (RLS) policies and Auth validations.
**Prevention:** Always verify the caller's session (`supabase.auth.getUser()`) and their role/permissions before executing any operations using `SUPABASE_SERVICE_ROLE_KEY` or `supabaseAdmin`.
