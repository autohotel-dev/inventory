import { component$, Slot } from "@builder.io/qwik";
import { Link, useLocation } from "@builder.io/qwik-city";
import { ThemeSwitcher } from "../components/theme-switcher";

export default component$(() => {
  const loc = useLocation();

  const navItems = [
    { href: "/", label: "Inicio" },
    { href: "/recepcion/", label: "Recepcionistas" },
    { href: "/cocheros/", label: "Cocheros" },
    { href: "/camaristas/", label: "Camaristas" },
  ];

  return (
    <>
      <header class="header">
        <div class="container">
          <div class="nav" style={{ display: "flex", alignItems: "center" }}>
            <h2 style={{ margin: 0, marginRight: "auto" }} class="premium-gradient">Manual Operativo</h2>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                class={`nav-link ${loc.url.pathname === item.href ? "active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
            <div style={{ marginLeft: "1rem" }}>
              <ThemeSwitcher />
            </div>
          </div>
        </div>
      </header>
      <main class="container" style={{ padding: "2rem 2rem", minHeight: "80vh" }}>
        <Slot />
      </main>
      <footer style={{ borderTop: "1px solid var(--border)", padding: "2rem 0", textAlign: "center", color: "var(--muted-foreground)" }}>
        <div class="container">
          <p>© 2026 Autohotel Inventory. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
});
