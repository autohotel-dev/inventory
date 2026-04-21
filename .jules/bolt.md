## 2024-05-18 - [Optimizing Frequent Array Methods in React]
**Learning:** React components containing both search terms (`onChange` state variables triggered every keystroke) and large array renders (like sorting and filtering list items) often re-run `.sort()` and `.filter()` operations on every state update, which can block the main thread and feel sluggish on large data sets (e.g., employee lists). Adding `useMemo` avoids redundant sorts and filters unless the core data or specific filter criteria actually change.
**Action:** When identifying performance bottlenecks where large arrays are filtered/sorted *and* local state changes rapidly (like text input fields), prioritize wrapping these array transformations in `useMemo`.

## 2026-04-21 - [Extract Render Loops to useMemo]
**Learning:** Computing complex derived data for arrays (like finding, filtering, mapping nested structures) inside a JSX `.map()` is a performance anti-pattern. React will unnecessarily execute all this synchronous code on every single render pass.
**Action:** Always extract complex array item derivations in list components into a `useMemo` hook, iterating over the array beforehand and returning a clean structure for the JSX to consume.
