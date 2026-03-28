# 🧪 Add tests for getCustomer function

## 🎯 What
This PR adds test coverage for the functions inside `lib/functions/customer.ts`, particularly focusing on the `getCustomer` method as requested, along with `getCustomers` and `getCustomerSales`. The Supabase client is correctly mocked to simulate actual query behavior.

## 📊 Coverage
- `getCustomer(id: string)`:
  - Tests retrieving customer correctly when API call succeeds.
  - Tests handling errors when fetching the customer.
  - Tests `null` responses effectively (when `maybeSingle` resolves without data).
- `getCustomers()`:
  - Tests retrieving array of customers.
  - Tests graceful handling of empty arrays on error.
- `getCustomerSales(customerId: string)`:
  - Tests querying relationally correct customer sales.
  - Tests graceful handling of empty arrays on error.

## ✨ Result
A comprehensive suite was created under `tests/lib/functions/customer.test.ts`. All functions inside the module now have explicit happy path and error cases, reducing regressions in customer-related logic.
