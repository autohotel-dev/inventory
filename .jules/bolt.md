## 2024-04-14 - [Consolidate array iterations for performance]
**Learning:** Found an anti-pattern where an array was being iterated multiple times (`reduce` + several `filter`s) inside a React component (`frontend/components/sales/advanced-sales-table.tsx`) to calculate stats, leading to O(k*n) operations.
**Action:** Consolidate multiple `filter().length` and `reduce` operations over the same dataset into a single `reduce` pass to reduce time complexity to O(n) and prevent redundant iterations. Apply this pattern to other dashboard and table components.
