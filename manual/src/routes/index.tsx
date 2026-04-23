import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div class="animate-in stagger-1" style={{ textAlign: "center", margin: "5rem 0 4rem" }}>
        <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0.5rem 1.25rem", borderRadius: "9999px", backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: "600", fontSize: "0.85rem", marginBottom: "2rem", border: "1px solid var(--border)" }}>
          ✨ Versión 2.0 Premium
        </div>
        <h1 class="premium-gradient" style={{ fontSize: "4rem", lineHeight: "1.1", marginBottom: "1.5rem" }}>Bienvenido al<br/>Manual Operativo</h1>
        <p style={{ fontSize: "1.25rem", maxWidth: "650px", margin: "0 auto", lineHeight: "1.7" }}>
          Aquí encontrarás toda la documentación detallada sobre los procesos diarios,
          asegurando la máxima eficiencia y evitando malentendidos en la operación.
        </p>
      </div>

      <div class="grid grid-cols-3 animate-in stagger-2" style={{ marginTop: "3rem" }}>
        <Link href="/recepcion/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ marginTop: 0 }}>Recepcionistas</h3>
            <span class="badge">Esencial</span>
          </div>
          <p style={{ margin: "1rem 0 0" }}>Gestión de turnos, check-in de huéspedes, ventas de mostrador y cobros.</p>
        </Link>
        <Link href="/cocheros/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ marginTop: 0 }}>Cocheros</h3>
            <span class="badge" style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}>Operativo</span>
          </div>
          <p style={{ margin: "1rem 0 0" }}>Recepción de vehículos (OCR), atención de servicios extra, y manejo de habitaciones.</p>
        </Link>
        <Link href="/camaristas/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <h3 style={{ marginTop: 0 }}>Camaristas</h3>
            <span class="badge">Servicios</span>
          </div>
          <p style={{ margin: "1rem 0 0" }}>Mantenimiento, limpieza de habitaciones, evidencias fotográficas y reportes.</p>
        </Link>
      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Manual Operativo - Inicio",
  meta: [
    {
      name: "description",
      content: "Manual de procesos operativos para el hotel.",
    },
  ],
};
