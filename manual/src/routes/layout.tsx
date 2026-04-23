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
      <header class="header glass">
        <div class="container">
          <div class="nav" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", marginRight: "auto" }}>
              <img src="/luxor_manual_icon.png" alt="Autohotel Luxor" style={{ height: "45px", width: "auto", marginRight: "1rem", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))", borderRadius: "10px" }} />
              <h2 style={{ margin: 0, fontSize: "1.5rem" }} class="premium-gradient">Manual Operativo</h2>
            </div>
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
      <main class="container animate-in" style={{ padding: "3rem 2rem", minHeight: "80vh" }}>
        <Slot />
      </main>
      <footer style={{ borderTop: "1px solid var(--border)", padding: "3rem 0", textAlign: "center", color: "var(--muted-foreground)" }}>
        <div class="container">
          <p style={{ margin: 0, fontSize: "0.9rem" }}>© 2026 Autohotel Inventory. Todos los derechos reservados.</p>
        </div>
      </footer>
    </>
  );
});
