import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div class="animate-in stagger-1" style={{ marginBottom: "3rem" }}>
        <h1 class="premium-gradient">Procedimiento Operativo Estándar (SOP): Recepción</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Este manual detallado y exhaustivo dicta la manera exacta y sin excepciones en la que se debe operar el sistema de recepción. Sigue los pasos de cada imagen al pie de la letra.
        </p>
      </div>

      <div class="grid animate-in stagger-2" style={{ gridTemplateColumns: "1fr", gap: "3rem" }}>
        
        {/* SECCIÓN 1: AUTH */}
        <div class="card">
          <h3>SECCIÓN 1: Autenticación e Inicio (001-Auth)</h3>
          <p style={{marginBottom: "1rem"}}>Flujo estricto para el inicio de tu jornada laboral.</p>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/001-landing-page.png" alt="001 Landing Page" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Portal de Acceso</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Asegúrate de estar usando Google Chrome.</li>
                  <li>Teclea la URL oficial del sistema de gestión.</li>
                  <li>Espera a que cargue completamente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/002-login.png" alt="002 Login" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Autenticación</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en el campo Correo Electrónico.</li>
                  <li>Ingresa tus credenciales oficiales.</li>
                  <li>Haz clic en Iniciar Sesión.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/003-dashboard-recepcion.png" alt="003 Dashboard Sin Turno" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Dashboard (Sin Turno)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Vista inicial si no hay turno abierto.</li>
                  <li>El sistema bloqueará operaciones hasta abrir caja.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/004-inicio-de-turno.png" alt="004 Inicio de turno" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Apertura de Caja</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Cuenta tu dinero físico y teclealo en el sistema.</li>
                  <li>Obligatorio para que los cobros no sean huérfanos.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/005-dashboard-turno-iniciado.png" alt="005 Dashboard Operativo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Dashboard Operativo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El tablero completo y habilitado para ventas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/001-Auth/006-dashboard-turno-iniciado-funciones-extra.png" alt="006 Funciones extra" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Funciones Extra del Tablero</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Utiliza los botones superiores para filtrar y buscar.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: ENTRADAS */}
        <div class="card">
          <h3>SECCIÓN 2: Protocolo de Entradas (002-Entradas)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/001-tablero-habitaciones-pos.png" alt="001 Tablero POS" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Tablero POS Principal</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Monitorea las habitaciones Libres (Azules).</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/002-rueda-selectora-habitacion-limpia.png" alt="002 Rueda Limpia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Selección de Habitación</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la rueda y selecciona el Relámpago (Entrada).</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/003-modal-desde-rueda-entrada.png" alt="003 Modal Entrada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Parámetros de Estancia</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Ajusta ocupantes y tiempo en el modal. Confirma entrada.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/004-notificacion-entrada-registrada.png" alt="004 Entrada Registrada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Entrada Inmediata Registrada</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema avisa que el registro inicial se completó.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/005-1-pendiente-de-cobro.png" alt="005-1 Pendiente Cobro" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5-1. Badge: Pendiente de Cobro</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si la habitación ingresa sin pagar, aparecerá esta alerta permanente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/005-2-esperando-registro-auto-cochero.png" alt="005-2 Esperando Auto" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5-2. Sincronización OCR</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Espera a que el cochero escanee la placa desde su móvil.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/006-notificacion-cochero-registra-entrada.png" alt="006 Cochero registra" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Notificación Cochero Inicia</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Alerta de que el portón ha sido abierto y el cochero interviene.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/007-visualizacion-habitacion-ingresada-pendiente-cobro.png" alt="007 Visualizacion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7. Ocupación con Deuda</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La habitación está en rojo (temporizador corriendo) pero debe el pago.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/008-rueda-selectora-pago-pendiente.png" alt="008 Rueda pago pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>8. Restricción Operativa</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La rueda oculta otros botones y obliga a cobrar la deuda inicial.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/009-modal-cobro-habitacion-y-corroborar.png" alt="009 Modal Cobro" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>9. Pasarela de Pagos</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre el modal para liquidar. Selecciona efectivo o tarjeta.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/010-corroborar-pago.png" alt="010 Corroborar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>10. Corroborar Montos</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Verifica la cantidad antes de dar clic en Confirmar.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/011-utilizar-datos-de-pago.png" alt="011 Datos Pago" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>11. Captura de Terminal</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si usas tarjeta, es obligatorio marcar la terminal correcta (BBVA o Santander).</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/012-notificacion-pago-realizado.png" alt="012 Pago realizado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>12. Confirmación de Recepción Monetaria</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema avisa que tu caja cuadró con este nuevo cobro.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/002-Entradas/013-habitacion-ocupada.png" alt="013 Ocupada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>13. Estancia Limpia y Pagada</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El cuarto luce sin alertas. Ya puedes dejar correr su ciclo normal.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3.1: SERVICIOS Y CONSUMOS */}
        <div class="card">
          <h3>SECCIÓN 3: Servicios o Consumos (003-1-Servicios o Consumos)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/001-registro-consumo.png" alt="001 Registro Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Modal de Tienda</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Revisa los productos dentro del carrito actual.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/002-adicion-productos-consumo.png" alt="002 Adicion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Lector OCR / Láser</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Dispara el láser al producto. Se agregará solo sin hacer clics.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/003-notificacion-consumo-registrado.png" alt="003 Notif Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Notificación de Ticket Generado</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema avisa que la orden de compra fue procesada en base de datos.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/004-habitacion-servicio-pendiente.png" alt="004 Servicio Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Indicador de Logística</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Habitación morada indicando a la camarista/cochero el trabajo en progreso.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/005-paso-1-servicio.png" alt="005 Paso 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Flujo Operativo - Paso 1</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Llamada de recepción de pedido del huésped.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/006-paso-2-consumo.png" alt="006 Paso 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Flujo Operativo - Paso 2</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Captura de los items solicitados en la caja registradora.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/007-paso-3-consumo.png" alt="007 Paso 3" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7. Flujo Operativo - Paso 3</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Despacho desde el frigorífico o vitrina.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/008-paso-4-consumo.png" alt="008 Paso 4" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>8. Flujo Operativo - Paso 4</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Impresión de la orden en máquina térmica.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/009-paso-5-consumo.png" alt="009 Paso 5" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>9. Flujo Operativo - Paso 5</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Viaje y entrega por parte del Cochero y confirmación por App Móvil.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/010-cobro-consumo-servicio.png" alt="010 Cobro Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>10. Proceso de Liquidación (Atajo F2)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Oprime F2 para llamar directamente al modal de pago.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/011-cobro-consumo-2.png" alt="011 Cobro 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>11. Pagos Mixtos (Cuenta Dividida)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Procesa pagos divididos entre efectivo y tarjeta para un mismo consumo.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/012-cobro-consumo-corroborar.png" alt="012 Corroborar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>12. Validación Previa</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Corrobora todo y no presiones confirmar hasta estar 100% seguro de la terminal.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/013-cobro-consumo-utilizar-datos-pago.png" alt="013 Reutilizar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>13. Reutilización de Plástico</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Usa el botón para cargar la tarjeta que el huésped dio en el check-in.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-1-Servicios%20o%20Consumos/014-notificacion-pago-registrado.png" alt="014 Pago Registrado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>14. Recibo Exitoso</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La transacción de consumo es final y quedó anotada en auditoría.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3.2: ESTADOS DE HABITACIONES */}
        <div class="card">
          <h3>SECCIÓN 4: Estados Críticos de Habitaciones (003-2-Estados de Habitaciones)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/001-modal-habitacion-pasar-bloqueo-o-mant.png" alt="001 Pasar a Mant" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Forzar a Mantenimiento</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Usa este modal si detectas una falla insuperable. Desactiva la habitación del inventario rentable.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/002-estado-habitacion-bloqueada-o-mant.png" alt="002 Estado Mant" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Cuarto en Mantenimiento Físico</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Color verde. El ingeniero tiene el control del cuarto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/003-modal-pasar-habitacion-a-sucia.png" alt="003 Pasar Sucia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Transición a Limpieza</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Confirma este modal para notificarle a las camaristas mediante la aplicación que limpien.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/004-habitacion-sucia.png" alt="004 Sucia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Cuarto Sucio (Morado)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Habitación esperando turno de aseo por la camarista en turno.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/005-rueda-selectora-habitacion-bloqueada-o-mant.png" alt="005 Rueda Mant" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Opciones en Mantenimiento</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Solo gerencia puede presionar la liberación para que pase a estado Sucio y luego Libre.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/006-habitacion-libre.png" alt="006 Libre" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Estado Final (Libre/Azul)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La camarista terminó y el cuarto está perfumado y listo para generar ingresos.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/003-2-Estados%20de%20Habitaciones/bloqueo-salida-pago-pendiente.png" alt="Bloqueo Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7. Excepción: Salida Bloqueada</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Pantalla roja letal. El cuarto tiene una deuda y el portón de salida denegará la apertura automática.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 5: CAMBIO DE HABITACION */}
        <div class="card">
          <h3>SECCIÓN 5: Cambio de Habitación (004-Cambio de Habitacion)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/004-Cambio%20de%20Habitacion/001-modal-cambio-habitacion.png" alt="001 Cambio 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Modal de Cambio</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Inicia el proceso para mover a un huésped de cuarto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/004-Cambio%20de%20Habitacion/002-1-modal-cambio-habitacion-2.png" alt="002-1 Cambio 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Selección de Destino</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Asegúrate de escoger una habitación Libre y del mismo tipo de paquete.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/004-Cambio%20de%20Habitacion/002-2-modal-cambio-habitacion-reiniciar-tiempo.png" alt="002-2 Cambio Reiniciar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Parámetro de Cronómetro</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Habilita "Reiniciar Tiempos" solo si es cortesía por quejas operativas.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 6: GESTIONAR HORAS */}
        <div class="card">
          <h3>SECCIÓN 6: Gestión de Horas (005-Gestionar Horas)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/005-Gestionar%20Horas/001-modal-getion-horas-1.png" alt="001 Horas" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Modal Principal de Horas</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El panel central para cualquier ajuste en el reloj del cliente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/005-Gestionar%20Horas/002-modal-gestion-horas-personalizadas.png" alt="002 Custom Horas" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Ajuste Manual (Custom)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Suma o resta minutos directamente con justificación estricta.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/005-Gestionar%20Horas/003-modal-gestion-horas-renovacion.png" alt="003 Renovacion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Renovación Integral</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Úsalo si el cliente decide re-contratar un turno entero adicional.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/005-Gestionar%20Horas/004-modal-gestion-horas-promo.png" alt="004 Promos" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Aplicación de Promociones</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Selecciona descuentos o promociones activas (Jueves, Día del Padre, etc).</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 7: GESTIONAR PERSONAS */}
        <div class="card">
          <h3>SECCIÓN 7: Gestión de Personas Extra (006-Gestionar Personas)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/006-Gestionar%20Personas/001-modal-gestion-personas.png" alt="001 Personas" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Lista de Ocupantes</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Lista oficial de visitantes vinculados y asegurados a este cuarto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/006-Gestionar%20Personas/002-modal-gestion-persona-extra.png" alt="002 Cobro Persona" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Cobro de Penalidad de Ingreso</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Inmediatamente se te exigirá cobrar el excedente tarifario en caja.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/006-Gestionar%20Personas/003-modal-gestion-personas-extra-nueva.png" alt="003 Nueva Persona" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Añadir Nuevo Individuo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Agrega el registro al sistema para no tener auditorías negativas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/006-Gestionar%20Personas/004-modal-gestion-persona-sale.png" alt="004 Persona Sale" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Retiro Parcial (Salida Individual)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si una persona extra sale pero el titular se queda, registra el egreso para protección civil.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 8: DAÑOS */}
        <div class="card">
          <h3>SECCIÓN 8: Registro de Multas y Daños (007-Registro de Daño)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/007-Registro%20de%20Da%C3%B1o/001-modal-registro-da%C3%B1o.png" alt="001 Daños" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Multas Sancionatorias</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Levanta la multa basándote en la inspección visual o del cochero.</li>
                  <li>Bloquea automáticamente la salida hasta que se reciba la compensación.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 9: CANCELACIONES */}
        <div class="card">
          <h3>SECCIÓN 9: Autorizaciones de Aborto (008-Cancelacion)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/008-Cancelacion/001-autorizacion-cancelar.png" alt="001 Cancelar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Cancelación / Autorización (Cocheros)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Pantalla del móvil del cochero donde él avala el check-out o rechaza y cancela un flujo problemático.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 10: SALIDAS */}
        <div class="card">
          <h3>SECCIÓN 10: Protocolo Estricto de Salidas (009-Salidas)</h3>
          
          <div class="grid grid-cols-3" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/001-modal-solicitud-salida.png" alt="001 Modal Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Modal Inicial</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Se dispara cuando el cliente llama para irse o abres la puerta en la rueda selectora.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/002-notificacion-solicitud-salida.png" alt="002 Solicitud Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Notificación en Tiempo Real</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema lanza el "Push" a todos los empleados de piso notificando la salida en proceso.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/003-notificacion-salida-aprobada.png" alt="003 Salida Aprobada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Aprobación Terrestre</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Cochero u operario confirma físicamente la integridad del cuarto en su App.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/004-habitacion-icono-verde-lista-salida.png" alt="004 Icono Verde" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Indicador de Semáforo Verde</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Alerta visual indicando que la habitación está liberada por el staff.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/005-modal-confirmar-salida.png" alt="005 Confirmar Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Confirmación Recepcionista</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Última barrera. Haces clic en "Finalizar Estancia".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/009-Salidas/006-notificacion-salida-completada.png" alt="006 Salida Completa" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Ejecución del Portón</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El auto abandona el motel y el sistema sella los registros y pasa a Sucio.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 11: CORTES */}
        <div class="card">
          <h3>SECCIÓN 11: Auditoría y Cortes de Caja (010-Cortes)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/001-confirmacion-cierre-turno.png" alt="001 Confirmacion Cierre" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. El Clic Definitivo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Asegúrate de que todo cuadra. Este paso cerrará tu sesión inmutablemente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/002-modal-corte-de-caja.png" alt="002 Modal Corte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Panel Auditor Visual</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Cruce de terminales vs efectivo físico capturado. Revisa renglón por renglón.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/003-detalle-final-corte.png" alt="003 Detalle Final" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Pantalla de Éxito de Arqueo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Mensaje del sistema confirmando el almacenamiento exitoso del turno en BBDD.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/004-impresion-corte-detallado.png" alt="004 Impresion Detalle" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Ticket Térmico de Entrega</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Saca este papel y grápalo a tu dinero en efectivo y vouchers.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/005-pantalla-ticket-corte-detallado.png" alt="005 Ticket Pantalla" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Desglose Electrónico Exhaustivo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema detalla hora por hora cómo entró cada peso para resolver problemas de auditoría.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/010-Cortes/006-ticket-final-corte.png" alt="006 Ticket Final" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Ticket Resumen Digital</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Vista general del ticket condensado enviado a gerencia.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 12: ELEMENTOS ESENCIALES */}
        <div class="card">
          <h3>SECCIÓN 12: Elementos Esenciales y Controles (011-Elementos escenciales)</h3>
          
          <div class="grid grid-cols-3" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/001-boton-actualizar-habitaciones.png" alt="001 Boton Refresh" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Botón Actualizar Servidor</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fuerza la descarga de la última versión del estado de cuartos desde la BBDD.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/002-reloj-digital.png" alt="002 Reloj" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Reloj Crítico de Servidor</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Reloj inamovible que dicta el vencimiento de tarifas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/003-resumen-habitaciones.png" alt="003 Resumen" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Ocupación Rápida</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Estadística vital de cuántos cuartos restan por vender.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/004-nomenclatura-estados-habitaciones.png" alt="004 Nomenclatura" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Guía Cromática</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Significado universal de cada color corporativo.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/005-seccion-perfil-notificaciones.png" alt="005 Perfil Notif" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Historial de Alarmas</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Panel lateral para recuperar notificaciones cerradas por error.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/006-menu-rapido-perfil.png" alt="006 Menu Perfil" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Control de Sesión</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Donde debes apretar "Cerrar sesión" cada vez que abandonas la silla.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/007-1-detalles-de-habitacion-desde-boton-azul.png" alt="007-1 Detalles Boton" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7-1. Botón "i" Detalles</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Acceso primario al expediente del huésped.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/007-2-modal-mas-detalles-2.png" alt="007-2 Mas Detalles 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7-2. Visión Expandida (Vehículo)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Validación extendida de fotos de la placa y características del auto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/007-3-modal-mas-detalles.png" alt="007-3 Mas Detalles 3" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7-3. Visión Expandida General</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El panel completo flotante cubriendo la pantalla para auditoría profunda.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/008-1-detalles-habitacion-ocupada.png" alt="008-1 Ficha Ocupada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>8-1. Ficha Rápida Ocupada</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Resumen del ticket con el saldo vivo actual del cliente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/008-2-detalles-2-habitacion-ocupada.png" alt="008-2 Ficha 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>8-2. Cronograma de Acción</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Línea de tiempo de todo lo que le ha pasado al cuarto en esta visita.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <div style={{padding:"1rem", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center"}}>
                <strong>8-3. Asignación de Encendido de TV</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>En el modal de detalles de la habitación, ubica la sección "Activos de Habitación".</li>
                  <li>Presiona "Asignar Cochero para Encender TV" y selecciona al cochero en turno.</li>
                  <li>Esto enviará una notificación a la app móvil del cochero para que acuda a la habitación a encender la pantalla.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/009-informacion-vehiculo.png" alt="009 Info Vehiculo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>9. Base de Datos Vehicular</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Donde la OCR y Gemini Flash inyectan los datos crudos del carro.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/010-boton-cancelar-habitacion.png" alt="010 Cancelar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>10. Botón de Destrucción de Flujo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--destructive)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si abriste el cuarto mal, este botón borra la historia (Requiere NIP gerencial).</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/011-indicador-habitacion-consumo-pendiente.png" alt="011 Consumo Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>11. Badge Amarillo de Tensión</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El huésped está enojado esperando su coca cola. Apura al cochero si ves esto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/011-Elementos%20escenciales/012-modal-portal-desde-rueda-selectora.png" alt="012 Portal Cliente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>12. Portal del Cliente</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El huésped puede acceder a este portal escaneando el código QR.</li>
                  <li>Le permite recibir notificaciones de su cuenta, estatus de servicios y ofertas especiales.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 13: ADICIONALES */}
        <div class="card">
          <h3>SECCIÓN 13: Módulos Adicionales Operativos (012-Secciones Adicionales)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/001-ordenes-de-compra.png" alt="001 Ordenes" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Log de Órdenes (Comandas)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Pantalla administrativa que lista todo lo escaneado y surtido de tienda.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/002-movimientos.png" alt="002 Movimientos" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Auditoría Interna (Logs)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Control antifraude. Ve aquí si sospechas que un compañero descontó algo.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/003-stock.png" alt="003 Stock" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Visor de Inventario Crítico</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Bloqueador nativo de ventas sin existencias físicas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/004-precorte-de-caja.png" alt="004 Precorte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Herramienta de Pre-Corte</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Ticket simulado antes de encriptar el turno final.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/005-historial-de-cortes.png" alt="005 Historial" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Historial Corporativo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Turnos antiguos salvaguardados en el servidor remoto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/006-academia.png" alt="006 Academia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Centro de Capacitación (Academia)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Plataforma de estudio para nuevos empleados. Revisa los videos si se te olvida cómo usar la pasarela Getnet.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/012-Secciones%20Adicionales/007-edicion-perfil.png" alt="007 Edicion Perfil" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7. Configuración de Cuenta de Empleado</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Mantén tus datos actualizados para que Recursos Humanos y el contador te localicen.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 14: CHAT */}
        <div class="card">
          <h3>SECCIÓN 14: Ecosistema de Comunicación (013-Chat)</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/013-Chat/001-boton-de-chat.png" alt="001 Boton Chat" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Icono Persistente</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Botón flotante anclado en la barra de navegación. Siempre visible sin importar en qué cuarto estés.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/013-Chat/002-ventana-principal-chat.png" alt="002 Ventana Chat" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Área de Redacción y Lectura</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema cuenta con un chat estilo WhatsApp para comunicación encriptada interna.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/013-Chat/003-chat-global.png" alt="003 Chat Global" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Transmisiones (Broadcast)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Sección "General" para mensajes que todo el staff del hotel (Camaristas, Gerente, Cocheros) deba leer inmediatamente.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "SOP Visual Ordenado por Capítulos - Recepción",
};
