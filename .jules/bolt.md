## 2026-04-24 - N+1 Query in Confirm Delivery
**Learning:** Sequential `.maybeSingle()` queries within `for...of` loops cause N+1 query problems in Supabase, leading to huge latency drops.
**Action:** Always pre-fetch matching entries using `.in()` before the loop, store them in a pool array, and then use `findIndex` and `splice` to map matches. Extract database updates to an `updates` array for `Promise.all()` execution and push new items to an `inserts` array for batch insertion.
