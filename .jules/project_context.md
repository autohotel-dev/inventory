# Auto Hotel Luxor - Project Context & History

This document serves as the long-term memory for the project. AI agents and developers should read this to understand the established business rules and the history of major implementations.

## Business Workflows

### 1. TV Control Workflow (Implemented April 2026)
- **Problem:** TV remotes were historically kept at reception.
- **Solution:** Remotes are now permanently kept inside the rooms (`status = 'EN_HABITACION'`). When a guest checks in, the receptionist uses the web dashboard to assign a "cochero" (valet) to turn on the TV.
- **App Behavior:** The cochero receives the task in their mobile app under a dedicated "TV/Controls" tab. The system guides them to the room and requires explicit verification to confirm the TV was turned on for the guest.

### 2. Printing & Reports
- **Dual-Printer Workflow:** The system supports both EPSON ESC/POS thermal printing (for fast tickets) and HP full-page printing (for shift closing reports).
- **Shift Closing:** Automated simultaneous printing occurs when a shift closes. Users can select between silent, automated HP printing or browser-based preview/printing.
- **Implementation Detail:** Backend data is sent to a local Express server (`print-server/index.js`) which communicates with the hardware.

### 3. Inventory & Product Catalog
- **Catalog Sharing:** The product catalog supports public access via shared links. This is achieved by specific Supabase Row Level Security (RLS) policies and a secure RPC-based data fetching mechanism to toggle between authenticated and public data modes.

### 4. App Notification System
- **Staff Alerts:** A personalized staff notification feature exists. Administrators can send announcements, urgent alerts, and instructions to employees via the mobile app.
- **Implementation Detail:** Leverages Web Push and Supabase Realtime architecture to deliver messages instantly, respecting role-based access control (RBAC).

### 5. Mobile Checkout Stability
- **UX Protections:** The mobile app checkout and check-in flows implement a global `ProcessingOverlay`. This enforces robust loading states across all modal actions to eliminate race conditions, double-tap submissions, and double-billing vulnerabilities.

## Common Pitfalls & Lessons
- **Supabase Auth Bypasses:** (See `sentinel.md`) Never use `SUPABASE_SERVICE_ROLE_KEY` without custom, rigorous permission checks. Service role keys bypass all RLS.
- **React Rendering Performance:** (See `bolt.md`) When rendering large lists with frequent state updates (like text search filters), ensure array transformations (`.sort()`, `.filter()`) are wrapped in `useMemo` to prevent UI freezing.

*This file should be updated whenever a new major workflow or core business rule is established.*
