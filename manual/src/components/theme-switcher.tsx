import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";

export const ThemeSwitcher = component$(() => {
  const theme = useSignal<"light" | "dark" | "system">("system");
  const isMenuOpen = useSignal(false);

  // Load theme on mount
  useVisibleTask$(() => {
    const localTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (localTheme) {
      theme.value = localTheme;
    }
  });

  const setTheme = $((newTheme: "light" | "dark" | "system") => {
    theme.value = newTheme;
    localStorage.setItem("theme", newTheme);
    if (newTheme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    } else {
      document.documentElement.setAttribute("data-theme", newTheme);
    }
    isMenuOpen.value = false;
  });

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick$={() => (isMenuOpen.value = !isMenuOpen.value)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "8px",
          backgroundColor: "transparent",
          color: "var(--muted-foreground)",
          cursor: "pointer",
        }}
        aria-label="Toggle theme"
      >
        {theme.value === "light" && (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
        )}
        {theme.value === "dark" && (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        )}
        {theme.value === "system" && (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
        )}
      </button>

      {isMenuOpen.value && (
        <div
          style={{
            position: "absolute",
            top: "40px",
            right: "0",
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
            zIndex: 50,
            minWidth: "120px",
          }}
        >
          <button
            onClick$={() => setTheme("light")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px",
              textAlign: "left",
              borderRadius: "4px",
              color: theme.value === "light" ? "var(--foreground)" : "var(--muted-foreground)",
              backgroundColor: theme.value === "light" ? "var(--accent)" : "transparent",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
            Light
          </button>
          <button
            onClick$={() => setTheme("dark")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px",
              textAlign: "left",
              borderRadius: "4px",
              color: theme.value === "dark" ? "var(--foreground)" : "var(--muted-foreground)",
              backgroundColor: theme.value === "dark" ? "var(--accent)" : "transparent",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            Dark
          </button>
          <button
            onClick$={() => setTheme("system")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "8px",
              textAlign: "left",
              borderRadius: "4px",
              color: theme.value === "system" ? "var(--foreground)" : "var(--muted-foreground)",
              backgroundColor: theme.value === "system" ? "var(--accent)" : "transparent",
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
            System
          </button>
        </div>
      )}
    </div>
  );
});
