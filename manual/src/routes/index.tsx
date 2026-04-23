import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Link } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div style={{ textAlign: "center", margin: "4rem 0" }}>
        <h1 class="premium-gradient">Bienvenido al Manual Operativo</h1>
        <p style={{ fontSize: "1.25rem", maxWidth: "600px", margin: "0 auto" }}>
          Aquí encontrarás toda la documentación detallada sobre los procesos diarios,
          asegurando la máxima eficiencia y evitando malentendidos en la operación.
        </p>
      </div>

      <div class="grid grid-cols-3" style={{ marginTop: "3rem" }}>
        <Link href="/recepcion/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <h3>Recepcionistas</h3>
          <p>Gestión de turnos, check-in de huéspedes, ventas de mostrador y cobros.</p>
          <span class="badge">Esencial</span>
        </Link>
        <Link href="/cocheros/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <h3>Cocheros</h3>
          <p>Recepción de vehículos (OCR), atención de servicios extra, y manejo de habitaciones.</p>
          <span class="badge">Operativo</span>
        </Link>
        <Link href="/camaristas/" class="card" style={{ display: "block", textDecoration: "none" }}>
          <h3>Camaristas</h3>
          <p>Mantenimiento, limpieza de habitaciones, evidencias fotográficas y reportes.</p>
          <span class="badge">Servicios</span>
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
