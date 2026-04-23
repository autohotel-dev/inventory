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
        
        {/* SECCIÓN 1: ACCESO Y APERTURA */}
        <div class="card">
          <h3>SECCIÓN 1: Acceso, Inicio de Turno y Dashboard</h3>
          <p style={{marginBottom: "1rem"}}>Flujo estricto para el inicio de tu jornada laboral. El descuadre de caja nace si este paso se hace de forma incorrecta.</p>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/landing-page.png" alt="Landing Page" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Portal de Acceso</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Asegúrate de estar usando una ventana de Google Chrome.</li>
                  <li>Teclea la URL oficial del sistema de gestión en la barra superior.</li>
                  <li>Espera a que cargue completamente la interfaz gráfica.</li>
                  <li>Verifica que tu conexión a internet sea estable.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/login.png" alt="Login" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Autenticación</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en el campo "Correo Electrónico".</li>
                  <li>Ingresa tu correo institucional sin espacios al final.</li>
                  <li>Presiona la tecla "Tab" de tu teclado para bajar al campo de contraseña.</li>
                  <li>Teclea tu contraseña respetando mayúsculas y haz clic en Iniciar Sesión.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/inicio-de-turno.png" alt="Apertura de turno" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Apertura de Caja (Obligatorio)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Localiza el módulo de "Turnos" en el menú lateral.</li>
                  <li>Abre físicamente tu cajón y cuenta los billetes y monedas tres veces.</li>
                  <li>Haz clic en "Abrir Turno".</li>
                  <li>Teclea exactamente el efectivo contado en el campo "Fondo Inicial" y confirma.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/dashboard-recepcion.png" alt="Dashboard" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Dashboard (Sin Turno)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si intentas operar en este estado, el sistema te bloqueará los cobros.</li>
                  <li>Los botones de la rueda selectora relacionados a finanzas estarán desactivados.</li>
                  <li>Debes regresar al paso anterior inmediatamente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/dashboard-turno-iniciado.png" alt="Dashboard Turno Iniciado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Dashboard Operativo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Una vez abierto el turno, la vista principal se habilitará.</li>
                  <li>El sistema comenzará a registrar toda tu actividad bajo tu nombre.</li>
                  <li>Todas las habitaciones mostrarán sus temporizadores en tiempo real.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/dashboard-turno-iniciado-funciones-extra.png" alt="Dashboard Funciones" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Funciones Extra del Tablero</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Utiliza la barra de búsqueda para encontrar una habitación por número.</li>
                  <li>Usa los filtros de estado (ej. "Solo Sucias") para agilizar tu vista.</li>
                  <li>Si experimentas lentitud, usa el botón de refrescar.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: INTERFAZ GENERAL Y PERFIL */}
        <div class="card">
          <h3>SECCIÓN 2: Interfaz Global y Herramientas</h3>
          
          <div class="grid grid-cols-2" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/reloj-digital.png" alt="Reloj" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Reloj del Sistema</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Revisa la hora mostrada en la esquina del sistema.</li>
                  <li>Esta hora rige el vencimiento de los tiempos de los cuartos.</li>
                  <li>Si ves una discrepancia, notifica al gerente de inmediato.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/boton-de-chat.png" alt="Botón Chat" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Botón de Chat Interno</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El icono circular de chat en la barra superior.</li>
                  <li>Muestra un globo rojo si tienes mensajes sin leer del equipo.</li>
                  <li>Haz clic izquierdo para desplegar la ventana de conversación.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/chat-global.png" alt="Chat Global" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Ventana de Conversaciones</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Selecciona el canal general o un empleado específico.</li>
                  <li>Evita el uso de lenguaje no profesional, el chat es monitoreado.</li>
                  <li>Úsalo para requerir insumos a mantenimiento.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/menu-rapido-perfil.png" alt="Menú Perfil" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Menú Desplegable del Perfil</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en tu foto/avatar en la esquina superior derecha.</li>
                  <li>Usa este menú para cerrar sesión SIEMPRE al ir al baño.</li>
                  <li>Selecciona "Mi Perfil" para cambiar configuraciones.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/edicion-perfil.png" alt="Editar Perfil" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Edición de Datos Personales</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Actualiza tu número telefónico o cambia tu contraseña.</li>
                  <li>Guarda los cambios haciendo clic en el botón de confirmación.</li>
                  <li>Tu correo de acceso no puede ser modificado aquí.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/seccion-perfil-notificaciones.png" alt="Perfil Notif" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Centro de Notificaciones Históricas</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en la pestaña de notificaciones dentro de tu perfil.</li>
                  <li>Aquí verás un log de alertas antiguas (si se cerró un portón o se pagó algo).</li>
                  <li>Útil si borraste una notificación verde por error y necesitas leerla.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/nomenclatura-estados-habitaciones.png" alt="Nomenclatura" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Guía de Nomenclatura (Lectura Visual)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li><strong>Azul:</strong> Habitación libre y lista para venderse.</li>
                  <li><strong>Rojo:</strong> Ocupada, generando tiempo e ingresos.</li>
                  <li><strong>Morado:</strong> El huésped se fue, la camarista debe asearla.</li>
                  <li><strong>Verde:</strong> Mantenimiento, no se puede rentar.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/resumen-habitaciones.png" alt="Resumen Habitaciones" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Panel de Resumen Rápido</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Localizado en la parte superior del tablero de habitaciones.</li>
                  <li>Lee las métricas de cuántas habitaciones hay disponibles de un vistazo.</li>
                  <li>Usa esta info cuando un cliente llame para preguntar disponibilidad.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: ESTADOS DE LA HABITACIÓN */}
        <div class="card">
          <h3>SECCIÓN 3: Manejo de la Rueda Selectora Interactiva</h3>
          <p style={{marginBottom: "1rem"}}>La Rueda Selectora es la herramienta principal. Debes memorizar sus botones según cada estado.</p>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/habitacion-libre.png" alt="Libre" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Reconocimiento: Cuarto Libre</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fondo azul sólido, indicando disponibilidad.</li>
                  <li>Haz clic izquierdo sobre el cuadro azul para abrir la rueda selectora.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/rueda-selectora-habitacion-limpia.png" alt="Rueda Limpia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Acciones en Cuarto Libre</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en el icono "Relámpago" (Entrada Rápida) para iniciar Check-in.</li>
                  <li>Haz clic en "Limpieza" si la inspección física indica polvo.</li>
                  <li>Haz clic en "Mantenimiento" si reportaron una falla.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/habitacion-ocupada.png" alt="Ocupada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Reconocimiento: Cuarto Ocupado</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fondo rojo, temporizador retrocediendo o marcando exceso.</li>
                  <li>Haz clic para abrir el menú de operaciones avanzadas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/visualizacion-habitacion-ingresada-pendiente-cobro.png" alt="Ocupada Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Alerta: Ingreso sin Cobro Efectuado</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Aparece si el cochero reporta un auto que ingresó pero tú no has cobrado.</li>
                  <li>Debes interceptar al cliente, realizar el cobro en el sistema y regularizarlo.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/rueda-selectora-pago-pendiente.png" alt="Rueda Pago Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Acción Forzada: Pago Pendiente</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Al hacer clic, el sistema restringirá los botones normales.</li>
                  <li>Solo te permitirá usar el icono de "Cobrar" (bolsa de dinero).</li>
                  <li>Haz clic en cobrar y liquida la cuenta en el modal de multipago.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/pendiente-de-cobro.png" alt="Alerta Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Insignia Visual (Badge)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Presta atención al badge amarillo en la esquina del cuadro de la habitación.</li>
                  <li>Significa "Deuda Activa". Jamás abras el portón de un cliente con este badge.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/habitacion-sucia.png" alt="Sucia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Reconocimiento: Cuarto Sucio</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fondo morado. Indica que la habitación necesita limpieza urgente.</li>
                  <li>Este estado se refleja inmediatamente en el móvil de la Camarista.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/habitacion-servicio-pendiente.png" alt="Servicio Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Alerta: Camarista Trabajando</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Aparece un icono de escoba sobre el estado morado.</li>
                  <li>Significa que la camarista ya asignó el cuarto y lo está limpiando.</li>
                  <li>No intervengas, el sistema lo cambiará a Libre automáticamente al terminar.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/estado-habitacion-bloqueada-o-mant.png" alt="Mantenimiento" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Reconocimiento: Mantenimiento</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fondo verde profundo. Habitación inoperable por daños mayores.</li>
                  <li>No intentes vender esta habitación bajo ninguna circunstancia.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/rueda-selectora-habitacion-bloqueada-o-mant.png" alt="Rueda Bloqueo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Acción: Liberar Mantenimiento</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en la rueda selectora del cuarto verde.</li>
                  <li>Haz clic en el botón de desbloqueo solo si el ingeniero de mantenimiento lo autoriza.</li>
                  <li>El cuarto pasará a estado Sucio para que las camaristas lo preparen.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 4: CHECK-IN Y VEHÍCULOS */}
        <div class="card">
          <h3>SECCIÓN 4: Protocolo de Check-in y Registro OCR Vehicular</h3>
          <p style={{marginBottom: "1rem"}}>Flujo estricto para dar ingreso, registrando personas y placas vehiculares.</p>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/modal-desde-rueda-entrada.png" alt="Modal Checkin" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Configuración de Estancia (Modal)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Usa los botones de "+" y "-" para definir cuántas personas ingresan.</li>
                  <li>Observa cómo el precio se ajusta automáticamente si hay personas extra.</li>
                  <li>Revisa la hora de salida estimada (ej. 12 horas después o al mediodía).</li>
                  <li>Haz clic en el botón principal para confirmar la apertura.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/esperando-registro-auto-cochero.png" alt="Esperando auto" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Fase de Sincronización Cochero-Recepción</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Una vez confirmado, el cuarto mostrará un indicador circular girando.</li>
                  <li>Indícale al cochero por radio o interfón que pase el auto.</li>
                  <li>Espera a que el cochero use su celular para escanear la placa. No toques nada.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/informacion-vehiculo.png" alt="Info vehiculo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Revisión de Datos de la IA</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre el panel de Detalles del Cuarto (Icono 'i').</li>
                  <li>Verifica que la Inteligencia Artificial haya leído correctamente la Marca, Modelo y Placa.</li>
                  <li>Si la placa es ilegible (ej. sin placas o tapada), edita el campo manualmente como "SIN PLACAS".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-coche-registrado.png" alt="Coche registrado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Confirmación del Sistema: Placas Exitosas</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Aparecerá un "toast" (notificación verde) en la esquina superior derecha.</li>
                  <li>Esto confirma que la imagen subió al servidor y la OCR la extrajo.</li>
                  <li>Si no aparece después de 1 minuto, solicita al cochero que reintente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-cochero-registra-entrada.png" alt="Cochero registra" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Alerta de Movimiento Físico</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Esta alerta indica que el cochero acaba de abrir el portón físico del garaje.</li>
                  <li>El cliente está introduciendo el auto en este momento.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-entrada-registrada.png" alt="Entrada Registrada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Confirmación de Cierre y Ocupación Total</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Alerta crítica que confirma que el portón cerró y el cliente está instalado.</li>
                  <li>A partir de este momento, cualquier requerimiento se considera "Room Service".</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 5: GESTIÓN AVANZADA DE ESTANCIA */}
        <div class="card">
          <h3>SECCIÓN 5: Gestión Avanzada y Resoluciones Específicas</h3>
          
          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/modal-cambio-habitacion.png" alt="Cambio 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Cambio de Habitación: Paso 1</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la rueda de la habitación actual y selecciona el icono de "Intercambio".</li>
                  <li>Selecciona de la lista la nueva habitación (debe estar en estado Libre).</li>
                  <li>Asegúrate de que la nueva habitación sea del mismo tipo (ej. Torre a Torre).</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-cambio-habitacion-2.png" alt="Cambio 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Cambio de Habitación: Paso 2 (Transferencia)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema te mostrará un resumen de los consumos a transferir.</li>
                  <li>Si el cliente ya consumió cosas, se irán al nuevo folio.</li>
                  <li>La habitación anterior pasará automáticamente a estado "Sucia".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-cambio-habitacion-reiniciar-tiempo.png" alt="Cambio Reiniciar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Cambio de Habitación: Opción de Tiempo</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Casilla "Reiniciar Tiempos": Actívala solo si el cambio fue por culpa del hotel (falla de A/C, ruido).</li>
                  <li>Déjala desmarcada si es un cambio normal, para que conserve su hora de salida original.</li>
                  <li>Haz clic en "Ejecutar Cambio" para finalizar.</li>
                </ul>
              </div>
            </div>
            
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-personas.png" alt="Personas Extra" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Panel Principal de Personas Extra</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la rueda en cuarto Ocupado y selecciona el icono "Personas".</li>
                  <li>Visualiza la lista de personas actualmente vinculadas al cuarto.</li>
                  <li>Si el cochero reporta un ingreso sorpresa a pie o en auto, procesalo aquí.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-personas-extra-nueva.png" alt="Nueva Persona" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Añadir Visitante o Persona Extra</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en "+ Añadir Persona" en el modal anterior.</li>
                  <li>El sistema detectará si excede el límite y generará un recargo automáticamente.</li>
                  <li>Haz clic en guardar. La habitación parpadeará con el badge de pago pendiente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-persona-extra.png" alt="Cobro Persona" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Ejecución del Cobro de Ingreso Extra</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre el panel de cobros. Verás el "Cargo por Persona Extra" en la lista de items.</li>
                  <li>Procesa el pago (Efectivo/Tarjeta) antes de permitir que la persona camine hacia la habitación.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-persona-sale.png" alt="Persona Sale" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Registro de Retiro Parcial (Salida de Visitante)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si una de las personas abandona el recinto pero el titular se queda.</li>
                  <li>Vuelve al modal de personas y haz clic en el botón "Marcar Salida" junto al nombre.</li>
                  <li>Esto ayuda a control de incendios y auditoría de ocupación real.</li>
                </ul>
              </div>
            </div>
            
            <div class="screenshot-container">
              <img src="/flujo/modal-getion-horas-1.png" alt="Horas 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Menú: Gestión de Horas y Tiempos</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Desde la rueda selectora, elige el icono del "Reloj de Arena".</li>
                  <li>Usa este menú exclusivamente si el cliente llama solicitando más tiempo o si detectas una anomalía.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-horas-renovacion.png" alt="Renovacion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Extensión: Renovación de Estancia Corta</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en "Renovar". El sistema agregará otro bloque tarifario completo (ej. +12 hrs).</li>
                  <li>El sistema generará el cargo a cuenta automáticamente.</li>
                  <li>Realiza el cobro en el modal de multipago.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-horas-personalizadas.png" alt="Horas Personales" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Ajuste Crítico: Horas Personalizadas</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Pestaña "Custom". Úsala solo en casos excepcionales (ej. compensación de 30 minutos).</li>
                  <li>Agrega o resta minutos manualmente usando el pad numérico.</li>
                  <li>Escribe en el campo de "Motivo" la razón obligatoria (ej. "Autorizado por Gte. Carlos").</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-gestion-horas-promo.png" alt="Promo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Ajuste Crítico: Aplicar Promociones</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Pestaña "Promos". Selecciona la promoción vigente del menú desplegable (ej. Tarjeta Inapam, Promo Jueves).</li>
                  <li>El sistema recalculará los tiempos y el saldo restante.</li>
                  <li>No apliques promos sin haber recibido el código o la prueba del cliente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-registro-daño.png" alt="Daños" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Operación Sancionatoria: Multas por Daños</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si la camarista reporta controles faltantes, humo, o sábanas quemadas antes de que el cliente salga.</li>
                  <li>Abre el icono de Multas (Martillo) en la rueda.</li>
                  <li>Selecciona el tipo de daño y genera el cargo. El portón quedará bloqueado hasta que el cliente pague.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 6: CONSUMOS Y ROOM SERVICE */}
        <div class="card">
          <h3>SECCIÓN 6: Flujo Completo de Room Service y Tienda</h3>
          <p style={{marginBottom: "1rem"}}>Cómo capturar alimentos, bebidas, condones, etc., utilizando el lector de código de barras.</p>

          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/adicion-productos-consumo.png" alt="Adicion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Modo de Carga Rápida: Lector Láser</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la sección "Cobrar" > Pestaña "Consumos".</li>
                  <li>NO tienes que hacer clic en ningún lado. Agarra el producto físico y dispárale con el láser al código de barras.</li>
                  <li>El producto saltará instantáneamente a la lista de "Cuenta Actual".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/stock.png" alt="Stock" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Alerta de Prevención: Stock Agotado</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si escaneas un código y escuchas un tono de error, mira la pantalla.</li>
                  <li>Si ves "Stock Insuficiente (0)", no puedes vender el producto bajo ninguna excusa.</li>
                  <li>Retira el producto del cliente y notifica posible robo interno/descuadre a gerencia.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/registro-consumo.png" alt="Registro Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Verificación del Carrito (Lista de Compras)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Revisa la lista a la derecha. Asegúrate que las cantidades coincidan.</li>
                  <li>Usa el bote de basura rojo si te equivocaste y escaneaste doble.</li>
                  <li>Pregúntale al cliente el total: "Serían $350 pesos, ¿Mando el pedido?".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/cobro-consumo-servicio.png" alt="Cobro Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Ejecución del Flujo de Venta (Atajo F2)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Para mayor velocidad, NO uses el ratón.</li>
                  <li>Si ya tienes la lista completa, presiona la tecla **F2** en tu teclado.</li>
                  <li>Se abrirá la pasarela de pagos automáticamente. Procede con el multipago.</li>
                </ul>
              </div>
            </div>
          </div>

          <h4 style={{ color: "var(--primary)", marginTop: "2rem" }}>Línea de Tiempo Operativa: Room Service de Principio a Fin</h4>
          <div class="grid grid-cols-3" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/paso-1-servicio.png" alt="Paso 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 1: Llamada del Huésped</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El teléfono suena. Contestas con cortesía.</li>
                  <li>El cliente te solicita (ej. "Mándame 2 cervezas y unas papas").</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/paso-2-consumo.png" alt="Paso 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 2: Captura Láser</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Vas al frigobar/tienda de recepción. Sacas los 3 productos físicos.</li>
                  <li>Los escaneas rápidamente y verificas el subtotal.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/paso-3-consumo.png" alt="Paso 3" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 3: Cobro o Cuenta</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Realizas el cobro (si manda a pagar con el cochero) o lo dejas en estado "Pendiente" si tiene crédito autorizado.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/paso-4-consumo.png" alt="Paso 4" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 4: Comanda Térmica</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La impresora térmica saca un ticket de "Orden de Servicio".</li>
                  <li>Engrapas el ticket a la bolsa con los productos y llamas al cochero.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/paso-5-consumo.png" alt="Paso 5" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 5: Viaje y Entrega</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El cochero corre al cuarto. Mientras va, la habitación muestra el icono de consumo en proceso.</li>
                  <li>El cochero entrega y toca su app móvil.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/indicador-habitacion-consumo-pendiente.png" alt="Consumo Pendiente" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Indicador de Espera</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Fíjate en este icono (el platito amarillo). Mientras lo veas, significa que el cochero NO ha vuelto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-consumo-registrado.png" alt="Notificacion Consumo" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Confirmación Electrónica</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Alerta visual verde en tu pantalla. El cochero ha confirmado la entrega satisfactoria en su celular. El icono amarillo desaparece.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/ordenes-de-compra.png" alt="Ordenes" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Revisión de Órdenes (Historial)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si un cliente reclama que no pidió algo, ve a "Detalles" > "Órdenes".</li>
                  <li>Allí verás la hora exacta, el empleado que lo vendió y quién lo entregó. Úsalo para controversias.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 7: MULTIPAGOS */}
        <div class="card">
          <h3>SECCIÓN 7: Pasarela Estricta de Multipagos</h3>
          <p style={{marginBottom: "1rem"}}>La forma en que el dinero entra a tu caja. Sin excepción, toda venta debe registrar el tipo de valor (Efectivo o Tarjetas específicas).</p>

          <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/modal-cobro-habitacion-y-corroborar.png" alt="Modal Cobro" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Modal Principal de Cobro</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Sección izquierda: Opciones de "Efectivo" y "Tarjeta".</li>
                  <li>Sección derecha: Resumen total de la deuda.</li>
                  <li>Si el cliente paga en Cash, teclea el monto recibido y haz clic en Pagar.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/utilizar-datos-de-pago.png" alt="Datos Pago" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Protocolo de Tarjeta (Muy Importante)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si eliges Tarjeta, DEBES marcar con qué terminal física le cobraste (BBVA o Getnet Santander).</li>
                  <li>Si marcas BBVA pero cobraste en Getnet, tu corte de caja final saldrá negativo/descuadrado.</li>
                  <li>Teclea los últimos 4 dígitos del plástico por seguridad anti-fraudes.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/cobro-consumo-2.png" alt="Cobro Consumo 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Estrategia de Cuenta Dividida (Split)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si un consumo cuesta $500 y el cliente da $200 en efectivo y el resto en tarjeta.</li>
                  <li>Teclea "$200" en la sección de efectivo y da clic en "Añadir Pago".</li>
                  <li>El sistema dirá "Restan $300". Ve a tarjeta y cobra el resto.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/cobro-consumo-corroborar.png" alt="Corroborar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso Previo Final: Corroborar</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Antes de hacer clic en el botón principal, lee el texto descriptivo.</li>
                  <li>Confirma que las cantidades sean exactas y la terminal seleccionada coincida con la que tienes en la mano.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/cobro-consumo-utilizar-datos-pago.png" alt="Utilizar Datos" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Atajo: Reutilizar Tarjeta Archivada</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si el cliente pide un room service y ya había pagado la entrada con tarjeta BBVA (***1234).</li>
                  <li>El sistema te mostrará un botón "Utilizar datos de pago anteriores". Haz clic ahí para no tener que teclearlos de nuevo.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/corroborar-pago.png" alt="Corroborar final" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Verificación Sensorial del Sistema</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>No dejes ir al cliente ni consideres la venta cerrada hasta ver la barra verde con letras "PAGADO" o el ticket impreso.</li>
                </ul>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-3" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/bloqueo-salida-pago-pendiente.png" alt="Bloqueo Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Restricción Absoluta de Salida</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si intentas procesar la salida (Check-out) de un cliente con saldo pendiente, verás esta pantalla roja.</li>
                  <li>El sistema no abrirá el portón eléctrico jamás hasta que liquides el monto en pantalla.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-pago-realizado.png" alt="Pago Realizado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Señal de Transferencia Exitosa</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Notificación verde indicando que el saldo a favor en la cuenta de la habitación fue cubierto exitosamente.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-pago-registrado.png" alt="Pago Registrado" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Señal de Ingreso a Caja</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Notificación verde indicando que el dinero (Efectivo o Voucher) está formalmente indexado a tu turno actual. Asegúrate de guardar tu voucher físico.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 8: SALIDA Y DETALLES */}
        <div class="card">
          <h3>SECCIÓN 8: Check-out, Inspección y Liberación</h3>
          <p style={{marginBottom: "1rem"}}>Flujo riguroso para auditar habitaciones ocupadas y proceder con la salida final de los huéspedes sin pérdida de inventario.</p>
          
          <div class="grid grid-cols-2" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/detalles-de-habitacion-desde-boton-azul.png" alt="Detalles 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Acceso al Expediente de Habitación</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la rueda selectora y localiza el icono azul "i" (Información).</li>
                  <li>Haz clic para abrir el sumario o ficha principal de la estancia actual.</li>
                  <li>Es tu herramienta principal de auditoría si el cliente tiene quejas o dudas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/detalles-habitacion-ocupada.png" alt="Detalles Ocupada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Lectura de la Ficha Principal</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Lee la sección "Ocupantes": Te dirá si hay personas extra no reportadas.</li>
                  <li>Lee la sección "Saldo": Mostrará deuda total ($0 significa pagado).</li>
                  <li>Mira el icono del auto: Muestra en pequeño las placas registradas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/detalles-2-habitacion-ocupada.png" alt="Detalles 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Cronograma (Historial de Eventos)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Revisa la lista secuencial: Hora de entrada, hora en la que se le subió la cerveza, hora en la que pagó, etc.</li>
                  <li>Útil para desmentir alegatos de "llevo menos tiempo aquí".</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-mas-detalles.png" alt="Modal Más Detalles" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Vista Ampliada del Expediente (Modal Completo)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en "Más Detalles" en la ficha rápida para abrir la vista completa.</li>
                  <li>Aquí tendrás paneles separados para Pagos, Consumos y Movimientos.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-mas-detalles-2.png" alt="Modal Más Detalles 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Auditoría Vehicular Profunda</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Desplázate hacia abajo en el panel ampliado hasta "Vehículos Asociados".</li>
                  <li>Verifica la foto frontal tomada por el sistema OCR si tienes dudas de qué auto debe salir.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/movimientos.png" alt="Movimientos" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Pestaña Movimientos (Auditoría Anti-Robo)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Revisa el log inmutable. Te dirá qué empleado de recepción hizo qué acción (ej. "Recepción 2 aplicó un descuento del 10%").</li>
                  <li>No se puede borrar. Los administradores revisan esta pantalla diariamente.</li>
                </ul>
              </div>
            </div>
          </div>

          <h4 style={{ color: "var(--primary)", marginTop: "2rem" }}>Flujo Crítico Operativo: Ciclo de Check-out</h4>
          <div class="grid grid-cols-3" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/habitacion-icono-verde-lista-salida.png" alt="Icono Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>1. Iniciador: Solicitud del Huésped</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El huésped marca a recepción y dice "Voy a salir, ya abrame".</li>
                  <li>El sistema puede poner la habitación en verde parpadeante si se venció el tiempo y el cliente llamó.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-solicitud-salida.png" alt="Solicitud Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>2. Acción: Disparar Proceso de Salida</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Abre la rueda selectora y haz clic en "Salida" (Icono de puerta abierta con flecha).</li>
                  <li>Si hay deuda pendiente, el sistema te forzará a la pasarela de pagos primero. Si todo está en ceros, continuará.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-solicitud-salida.png" alt="Notif Solicitud" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>3. Notificación a Personal Terrestre</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Aparece esta alerta en tu pantalla. Al mismo tiempo, el celular del cochero suena.</li>
                  <li>El cochero acude físicamente al cuarto, abre la puerta, e inspecciona visualmente que no se hayan robado toallas, TV o roto nada.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/autorizacion-cancelar.png" alt="Autorizacion Cancelar" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>4. Autorización Electrónica</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El cochero usa su aplicación para dar la "Aprobación de Integridad".</li>
                  <li>Si reporta daños, aborta el proceso, cobra la multa y reinicia el flujo de salida.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-confirmar-salida.png" alt="Confirmar Salida" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>5. Ejecución Definitiva</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Una vez aprobado, el sistema te presenta la pantalla final con el botón rojo "Finalizar Estancia".</li>
                  <li>Haz clic firme. El portón eléctrico del estacionamiento se abrirá de forma automatizada por la red interna.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-salida-aprobada.png" alt="Notif Aprobada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>6. Confirmación de Cierre Físico</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Notificación verde indicando que el portón bajó de nuevo y el auto del cliente abandonó el edificio con éxito.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/notificacion-salida-completada.png" alt="Notif Completada" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>7. Sello Final de Sistema</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>La habitación y sus folios han sido empaquetados en la base de datos de tu turno. El cliente ya no figura en la lista activa.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-portal-desde-rueda-selectora.png" alt="Portal" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Portal del Cliente</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El huésped puede acceder a este portal escaneando el código QR.</li>
                  <li>Le permite recibir notificaciones de su cuenta, estatus de servicios y ofertas especiales.</li>
                  <li>Promueve este portal para mejorar la experiencia digital del huésped.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/modal-pasar-habitacion-a-sucia.png" alt="Sucia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>8. Transferencia a Departamento de Limpieza</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Inmediatamente después de salir, el cuarto se torna color morado (Sucio).</li>
                  <li>El sistema avisa a las camaristas en sus tablets que tienen un nuevo cuarto disponible para hacerle el aseo. Tú ya no tocas el cuarto.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* SECCIÓN 9: CORTE DE CAJA Y AUDITORÍA */}
        <div class="card">
          <h3>SECCIÓN 9: Auditoría Financiera y Corte de Caja (Cierre de Turno)</h3>
          <p style={{marginBottom: "1rem"}}>Este es tu único respaldo legal al terminar la jornada laboral. No cerrar el turno implicará descuentos nominales en caso de descuadre.</p>
          
          <div class="grid grid-cols-2" style={{ marginTop: "1rem", gap: "1.5rem" }}>
            <div class="screenshot-container">
              <img src="/flujo/modal-corte-de-caja.png" alt="Modal Corte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 1: Auditoría Visual en Pantalla</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Ve al menú lateral y haz clic en "Turnos" y luego "Cerrar Turno".</li>
                  <li>Lee la tarjeta de "Efectivo Neto". Saca tu cajón y cuenta los billetes.</li>
                  <li>La cantidad física DEBE SER EXACTAMENTE LA MISMA que la pantalla. Si sobra, te equivocaste; si falta, debes reponerlo de tu cartera.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/precorte-de-caja.png" alt="Precorte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 2: Emisión del Pre-Corte</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Haz clic en el botón azul de "Pre-Corte". Esto enviará una orden a la impresora térmica.</li>
                  <li>Imprimirá un listado con tu dinero sin encriptarlo aún. Úsalo como hoja de ayuda mientras juntas tus monedas y acomodas los billetes en la bolsa de valores.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/corte-de-caja.png" alt="Corte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 3: Cruce de Vouchers (Terminales)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Asegúrate de revisar las tarjetas de BBVA (Azul) y GETNET (Roja).</li>
                  <li>Imprime el cierre de lote de las terminales físicas (las maquinitas).</li>
                  <li>Suma los vouchers de BBVA, el total debe ser idéntico a la cantidad azul en pantalla. Repite para GETNET.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/confirmacion-cierre-turno.png" alt="Confirmacion" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Paso 4: El Clic de No Retorno (Firma Digital)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si y solo si, todas las cifras (Efectivo, BBVA, GETNET) cuadran perfecto con tu físico.</li>
                  <li>Haz clic en el botón verde grande "Cerrar Turno". Aparecerá una advertencia final.</li>
                  <li>Haz clic en "Sí, Cerrar". El sistema guardará tus números de forma encriptada e inmutable, y cerrará tu sesión operativa.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/detalle-final-corte.png" alt="Detalle Corte" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Pantalla de Éxito: Resumen del Turno</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>El sistema te redireccionará a esta pantalla. Felicidades, tu turno terminó limpiamente.</li>
                  <li>Muestra en un círculo grande y verde la cantidad de Efectivo Neto final auditada.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/ticket-final-corte.png" alt="Ticket 1" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Interpretación del Ticket Electrónico General</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Este ticket virtual lo ve Gerencia desde el panel Administrativo.</li>
                  <li>Muestra ingresos totales, luego deduce tus gastos pagados (si le pagaste a un proveedor de cocacolas), y arroja el subtotal final que metiste a la tómbola de valores.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/pantalla-ticket-corte-detallado.png" alt="Ticket 2" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Lectura del Ticket Detallado (Investigación)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Panel que desglosa renglón por renglón de dónde salió cada peso.</li>
                  <li>Ejemplo: "10:35 AM | Habitación 402 | $650 | Visa BBVA". Ideal si perdiste un voucher y necesitas saber el folio exacto para hacer una reimpresión en la terminal bancaria.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/impresion-corte-detallado.png" alt="Ticket Impreso" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Impresión del Cierre Legal</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Obligatorio: Imprime este ticket final térmico.</li>
                  <li>Usa una grapadora y adjunta los cierres de lote de las terminales, y mételos en la bolsa de valores blindada junto con tu efectivo.</li>
                  <li>Firma la parte trasera del ticket de pre-corte con pluma de tinta azul.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/historial-de-cortes.png" alt="Historial" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Módulo de Historial</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Ve a "Turnos" > "Historial". Aquí se listan todos los días trabajados.</li>
                  <li>Si auditoría te contacta un martes sobre un cobro del viernes pasado, usa este panel para abrir tu turno viejo y descargar los tickets detallados en PDF para mandar pruebas.</li>
                </ul>
              </div>
            </div>
            <div class="screenshot-container">
              <img src="/flujo/academia.png" alt="Academia" class="screenshot-premium" loading="lazy" />
              <div style={{padding:"1rem"}}>
                <strong>Academia Interactiva (Ayuda en Vivo)</strong>
                <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                  <li>Si olvidaste cómo aplicar un descuento u operar una tarjeta, abre el módulo "Academia" (birrete universitario en la barra superior).</li>
                  <li>El sistema te mostrará videos o guías emergentes sin cerrar tu sesión actual.</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div style={{marginTop: "3rem", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border)", background: "rgba(255, 255, 255, 0.02)"}}>
            <h4 style={{ color: "var(--primary)", marginBottom: "1.5rem" }}>Acciones Críticas Administrativas de Excepción</h4>
            <div class="grid grid-cols-2" style={{ gap: "1.5rem" }}>
              <div class="screenshot-container">
                <img src="/flujo/boton-actualizar-habitaciones.png" alt="Boton Actualizar" class="screenshot-premium" loading="lazy" />
                <div style={{padding:"1rem"}}>
                  <strong>Botón: Forzar Sincronización Server-Side</strong>
                  <ul style={{fontSize:"0.85rem", color:"var(--muted-foreground)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                    <li>Ubicación: Arriba del tablero principal.</li>
                    <li>Uso: Si la red Wi-Fi de recepción sufre microcortes y el tablero se queda "congelado" o un cliente pagó pero la habitación no se puso verde. Haz clic aquí para conectarte directamente al servidor base y forzar la recarga de variables.</li>
                  </ul>
                </div>
              </div>
              <div class="screenshot-container">
                <img src="/flujo/boton-cancelar-habitacion.png" alt="Boton Cancelar" class="screenshot-premium" loading="lazy" />
                <div style={{padding:"1rem"}}>
                  <strong>Botón: Aborto General de Operación (Cancelar Habitación)</strong>
                  <ul style={{fontSize:"0.85rem", color:"var(--destructive)", marginTop:"0.5rem", paddingLeft:"1.2rem"}}>
                    <li>Ubicación: Dentro de los modales de cobro/salida o menús de administración de cuartos en conflicto.</li>
                    <li>Uso: Extremadamente peligroso. Cancela TODO el registro de una habitación como si jamás hubiera existido. Elimina folios, cobros y limpia la pantalla.</li>
                    <li>Requisito: Pedirá un NIP de Gerente. Usar solo si hubo un error crítico de captura (ej. meter a un huésped a la habitación incorrecta).</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "SOP Visual y Detallado - Recepción",
};
