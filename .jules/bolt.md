## 2024-05-18 - [Optimizing Frequent Array Methods in React]
**Learning:** React components containing both search terms (`onChange` state variables triggered every keystroke) and large array renders (like sorting and filtering list items) often re-run `.sort()` and `.filter()` operations on every state update, which can block the main thread and feel sluggish on large data sets (e.g., employee lists). Adding `useMemo` avoids redundant sorts and filters unless the core data or specific filter criteria actually change.
**Action:** When identifying performance bottlenecks where large arrays are filtered/sorted *and* local state changes rapidly (like text input fields), prioritize wrapping these array transformations in `useMemo`.

## 2025-02-18 - [Avoid Chained Array Filtering for Aggregate Metrics]
**Learning:** Performing multiple `array.filter(condition).length` operations in React components to calculate status or category counts (like "High", "Medium", and "Low" performance tiers) unnecessarily recreates arrays and re-traverses the data structure O(N) times per category on every render.
**Action:** When calculating multiple aggregate metrics from a single array, consolidate the logic into a single loop block (e.g., `for...of` or `.reduce()`) within a `useMemo` hook to compute all metrics in one pass.
