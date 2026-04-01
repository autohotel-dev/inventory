## 2024-05-18 - [Optimizing Frequent Array Methods in React]
**Learning:** React components containing both search terms (`onChange` state variables triggered every keystroke) and large array renders (like sorting and filtering list items) often re-run `.sort()` and `.filter()` operations on every state update, which can block the main thread and feel sluggish on large data sets (e.g., employee lists). Adding `useMemo` avoids redundant sorts and filters unless the core data or specific filter criteria actually change.
**Action:** When identifying performance bottlenecks where large arrays are filtered/sorted *and* local state changes rapidly (like text input fields), prioritize wrapping these array transformations in `useMemo`.

## 2024-05-18 - [Memoizing Sorting and Consolidation of Filters]
**Learning:** In React components with potentially large datasets (like `productProfitability`), performing sorting and multiple `.filter()` operations directly in the render function can cause significant performance overhead on every re-render.
**Action:** Consolidate multiple array traversals into a single `for...of` loop within a `useMemo` hook, returning the sorted array and any calculated metrics simultaneously to avoid redundant iterations and re-evaluations.
