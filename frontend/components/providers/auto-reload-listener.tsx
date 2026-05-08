"use client";

import { useAutoReload } from "@/hooks/use-auto-reload";

/**
 * Invisible component that listens for deploy broadcasts and auto-reloads.
 * Place in the root layout to cover all pages.
 */
export function AutoReloadListener() {
    useAutoReload();
    return null;
}
