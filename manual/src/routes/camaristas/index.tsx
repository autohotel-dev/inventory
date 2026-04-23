import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div style={{ marginBottom: "2rem" }}>
        <h1 class="premium-gradient">Procedimiento Operativo Estándar (SOP): Camaristas</h1>
        <p>
          Este documento constituye la guía definitiva para la operación en piso utilizando
          la Aplicación Móvil (Expo). Cada toque en la pantalla ("tap"), validación de color
          y acción offline está descrita a nivel microscópico. La fidelidad de los datos que
          insertas es lo que permite que el hotel se comercialice.
        </p>
      </div>

      <div class="grid" style={{ gridTemplateColumns: "1fr" }}>
        
        {/* FLUJO 1: LECTURA DEL DASHBOARD */}
        <div class="card">
          <h3>SECCIÓN 1: Lectura y Comprensión del Dashboard Móvil</h3>
          <p>Tu pantalla principal es un mapa de calor en tiempo real de todo el establecimiento.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 1.1: Autenticación Inicial</h4>
            <div class="step-card">
              <span class="step-number">1.1.1</span>
              <strong>Desbloqueo de Terminal:</strong> Saca el dispositivo móvil asignado de tu bolsillo o funda protectora. Desbloquea la pantalla.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.2</span>
              <strong>Apertura de la App:</strong> Localiza el ícono de la aplicación de Inventario en la pantalla de inicio y tócalo con un dedo.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.3</span>
              <strong>Login con PIN:</strong> Si la sesión caducó, el sistema mostrará la pantalla de autenticación. Usa el teclado numérico virtual para ingresar tu PIN de empleado de 4 o 6 dígitos, o tus credenciales si así está configurado. Toca "Ingresar".
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 1.2: Interpretación del Código Semántico (Colores Reales)</h4>
            <div class="step-card">
              <span class="step-number">1.2.1</span>
              <strong>Revisión General:</strong> Observarás una cuadrícula (Grid) en la que cada celda cuadrada grande representa una habitación. Tienen un número al centro y un color de fondo.
            </div>
            <div class="step-card">
              <span class="step-number" style={{backgroundColor:"#f97316"}}>S</span>
              <strong>Tarjetas Naranja Oscuro (#f97316) - SUCIA:</strong> Esta es tu prioridad máxima. Significa que el huésped ya salió, Recepción cobró, y la habitación está sucia. Tienen el ícono de unas gotas (Droplets).
            </div>
            <div class="step-card">
              <span class="step-number" style={{backgroundColor:"#06b6d4"}}>P</span>
              <strong>Tarjetas Cyan Brillante (#06b6d4) - LIMPIANDO:</strong> Significa que TÚ u otro compañero están actualmente dentro de esa habitación limpiándola. El reloj está corriendo. Tienen el ícono de unos destellos (Sparkles).
            </div>
            <div class="step-card">
              <span class="step-number" style={{backgroundColor:"#10b981"}}>L</span>
              <strong>Tarjetas Verde Esmeralda (#10b981) - LIBRE:</strong> Significa que la habitación huele a limpio, tiene sábanas nuevas y está lista para que un nuevo cliente la ocupe. Tienen el ícono de viento (Wind).
            </div>
            <div class="step-card">
              <span class="step-number" style={{backgroundColor:"#3b82f6"}}>O</span>
              <strong>Tarjetas Azul Fuerte (#3b82f6) - OCUPADA:</strong> Significa que hay gente adentro con la puerta cerrada. Tienen el ícono de una cama doble (BedDouble). <strong style={{color:"var(--destructive)"}}>Prohibición:</strong> Si intentas tocar esta tarjeta, la aplicación mostrará una advertencia de bloqueo. El sistema no te permitirá hacer cambios hasta que Recepción realice el Check-out.
            </div>
            <div class="step-card">
              <span class="step-number" style={{backgroundColor:"#71717a"}}>M</span>
              <strong>Tarjetas Gris Obscuro (#71717a) - BLOQUEADA / MANTENIMIENTO:</strong> Significa que la habitación está inservible temporalmente (ej. taza rota, pintura fresca). Tienen un ícono de prohibición (Ban).
            </div>
          </div>
        </div>

        {/* FLUJO 2: LIMPIEZA */}
        <div class="card">
          <h3>SECCIÓN 2: Protocolo Estricto de Limpieza Dinámica</h3>
          <p>El sistema mide tu rendimiento y tiempos basándose en la exactitud de cuándo tocas los botones.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 2.1: Inicialización del Reloj (De Sucia a Progreso)</h4>
            <div class="step-card">
              <span class="step-number">2.1.1</span>
              <strong>Desplazamiento Físico:</strong> Toma tu carrito de servicio con insumos de limpieza y empújalo hasta estar físicamente de pie frente a la puerta de una habitación Naranja (Sucia).
            </div>
            <div class="step-card">
              <span class="step-number">2.1.2</span>
              <strong>Apertura de Modal:</strong> Saca tu celular. En el dashboard de la app móvil, ubica el cuadro Naranja correspondiente al número de la habitación frente a ti y toca firmemente la tarjeta con el dedo.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.3</span>
              <strong>Deslizamiento de Acciones:</strong> Observa cómo una ventana modal se desliza desde la parte inferior de tu pantalla. Esta ventana tiene un "Handle bar" (línea gris) en la parte superior, y muestra los detalles de la habitación.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.4</span>
              <strong>El Clic de Inicio:</strong> Localiza el botón de color <strong>Cyan (#06b6d4)</strong> que dice <em>"Iniciar Limpieza"</em>, acompañado de un ícono de "Play". Toca este botón una sola vez.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.5</span>
              <strong>Verificación Háptica y Visual:</strong> Sentirás una vibración fuerte en el celular (Haptic Feedback) indicando éxito. El modal se cerrará solo. Mira el dashboard: el cuadro pasó mágicamente de Naranja a <strong>Cyan</strong>.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.6</span>
              <strong>Ejecución Física:</strong> Abre la puerta. Entra. Realiza los tendidos de cama, lavado de baños, sanitización de superficies y acomodo de botellas/jabones.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 2.2: Conclusión y Liberación (De Progreso a Libre)</h4>
            <div class="step-card">
              <span class="step-number">2.2.1</span>
              <strong>Inspección Visual Física:</strong> Párate en el marco de la puerta desde adentro. Mira hacia la habitación y confirma mentalmente que no olvidaste tu franela o envases vacíos.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.2</span>
              <strong>Salida de la Habitación:</strong> Sal de la habitación y cierra la puerta físicamente detrás de ti asegurando el pasador automático.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.3</span>
              <strong>Apertura de Modal:</strong> Inmediatamente saca tu celular. Localiza la tarjeta <strong>Cyan</strong> con el número de habitación que acabas de limpiar. Tócala.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.4</span>
              <strong>El Clic de Cierre:</strong> En el modal inferior, localiza el botón verde <strong>Esmeralda (#10b981)</strong> que dice <em>"Finalizar Limpieza"</em>, con un ícono de marca de verificación (Palomita). Tócalo firmemente.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.5</span>
              <strong>Notificación al Sistema Central:</strong> Sentirás otra vibración intensa. El modal bajará. La tarjeta cambiará de Cyan a <strong>Verde Esmeralda</strong>. En ese nanosegundo, el cronómetro de la nube se detiene, calculando tus minutos de eficiencia, y Recepción ya ve en sus monitores que esa habitación está a la venta.
            </div>
          </div>
        </div>

        {/* FLUJO 3: MANTENIMIENTO Y EVIDENCIA FOTOGRÁFICA */}
        <div class="card">
          <h3>SECCIÓN 3: Protocolo de Levantamiento de Incidencias (Mantenimiento)</h3>
          <p>Protección a la propiedad. El no reportar daños hará que la empresa te responsabilice por ellos.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 3.1: Detección y Detención</h4>
            <div class="step-card">
              <span class="step-number">3.1.1</span>
              <strong>Identificación Física del Daño:</strong> Estás limpiando la habitación 15 y te das cuenta que el dispensador de jabón en la regadera fue arrancado de la pared y está roto.
            </div>
            <div class="step-card">
              <span class="step-number">3.1.2</span>
              <strong>Suspensión de Limpieza:</strong> Detén inmediatamente tus labores. Seca tus manos. Saca el celular.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 3.2: Evidencia en Sistema</h4>
            <div class="step-card">
              <span class="step-number">3.2.1</span>
              <strong>Acceso a la Función:</strong> Toca la tarjeta Cyan de la habitación. Localiza el botón <strong>Gris oscuro (#71717a)</strong> que dice <em>"Reportar Mantenimiento"</em> con un ícono de una llave inglesa. Tócalo.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.2</span>
              <strong>Captura de Texto:</strong> El contenido de la ventana cambiará. Toca el cuadro de texto gris que dice "Ej. Fuga de agua, Pintura...". Usando el teclado del celular, escribe con buena ortografía: "Dispensador de jabón de regadera arrancado y quebrado". Toca "Intro" o cierra el teclado.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.3</span>
              <strong>Activación de Cámara:</strong> Abajo del cuadro de texto, verás un área punteada que dice <em>"Tomar Foto"</em> acompañada del ícono de una cámara. Toca el centro de esa área punteada.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.4</span>
              <strong>Toma Fotográfica Hábil:</strong> La interfaz de cámara nativa se abrirá (te pedirá permisos la primera vez, acéptalos). Encuadra perfectamente el dispensador roto en la pared. Asegúrate que la foto no esté borrosa. Toca el botón de obturador para capturar. Si la foto es buena, toca "Aceptar" o "Usar Foto".
            </div>
            <div class="step-card">
              <span class="step-number">3.2.5</span>
              <strong>Revisión Visual:</strong> Verás una vista previa miniatura de la foto en la app móvil. Si te equivocaste, puedes tocar el botecito de basura blanco translúcido en la esquina superior derecha de la foto para borrarla e intentarlo de nuevo.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 3.3: Ejecución de Bloqueo</h4>
            <div class="step-card">
              <span class="step-number">3.3.1</span>
              <strong>Bloqueo Activo vs Pasivo:</strong> Si consideras que el daño impide rentar la habitación (ej. inodoro rebalsando), marca la opción de bloquear.
            </div>
            <div class="step-card">
              <span class="step-number">3.3.2</span>
              <strong>Transmisión Segura (Supabase Storage):</strong> Toca el botón inferior que dice <em>"Actualizar"</em> o <em>"Guardar"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">3.3.3</span>
              <strong>El Proceso Interno:</strong> El botón dirá "Guardando..." momentáneamente. La aplicación está empaquetando la imagen en Base64, enviándola al 'bucket' de Supabase llamado 'maintenance_reports', obteniendo una URL pública, e insertando esa URL y tu nota de texto en la base de datos de Recepción. Todo de manera invisible.
            </div>
            <div class="step-card">
              <span class="step-number">3.3.4</span>
              <strong>Confirmación del Bloqueo:</strong> El modal baja. La tarjeta ahora se volvió Gris Oscuro. El equipo de mantenimiento principal acaba de recibir la alerta. Continúa con tu siguiente habitación en Naranja.
            </div>
          </div>
        </div>

        {/* FLUJO 4: MODO OFFLINE */}
        <div class="card">
          <h3>SECCIÓN 4: Protocolo de Supervivencia sin Internet (Modo Offline)</h3>
          <p>La conectividad no es una excusa. El sistema fue programado con un sistema de colas en memoria. Debes conocerlo a la perfección.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 4.1: Detección y Comportamiento</h4>
            <div class="step-card">
              <span class="step-number">4.1.1</span>
              <strong>Falla de Señal Física:</strong> Caminas hacia el fondo del pasillo donde los muros bloquean el Wi-Fi. 
            </div>
            <div class="step-card">
              <span class="step-number">4.1.2</span>
              <strong>Identificador Visual (El Cintillo Rojo):</strong> La aplicación móvil detectará la pérdida en milisegundos. Aparecerá instantáneamente una barra de color rojo quemado intenso (<strong style={{color:"#ef4444"}}>#ef4444</strong>) en la parte superior de la interfaz, debajo del header. Tendrá el ícono de "WifiOff" cruzado por una línea y el texto literal: <em>"Modo Sin Conexión - Cambios en cola"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">!</span>
              <strong style={{color:"var(--destructive)"}}>Mandato Estricto:</strong> NO CIERRES LA APP. NO ENTRES EN PÁNICO. Tu orden estricta es continuar operando y tocando botones como si tuvieras internet.
            </div>
            <div class="step-card">
              <span class="step-number">4.1.3</span>
              <strong>Ejecución Fantasma:</strong> Terminas de limpiar y tocas el botón Verde de "Finalizar Limpieza". La tarjeta cambiará visualmente a Verde Esmeralda en tu celular al instante. Sin embargo, Recepción aún no lo ve. La acción (payload) se encapsuló en un archivo temporal cifrado dentro del disco duro de tu teléfono.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 4.2: Purga y Sincronización Automática</h4>
            <div class="step-card">
              <span class="step-number">4.2.1</span>
              <strong>Recuperación de Señal:</strong> Al terminar esa habitación bloqueada, caminas hacia la recepción donde hay Wi-Fi.
            </div>
            <div class="step-card">
              <span class="step-number">4.2.2</span>
              <strong>La Magia del Polling:</strong> En cuanto el sistema operativo iOS o Android detecte un paquete de datos exitoso hacia los servidores, la librería NetInfo disparará un evento en la app.
            </div>
            <div class="step-card">
              <span class="step-number">4.2.3</span>
              <strong>Desaparición del Cintillo:</strong> La barra roja desaparecerá automáticamente de tu pantalla sin que toques nada.
            </div>
            <div class="step-card">
              <span class="step-number">4.2.4</span>
              <strong>Purga de Cola:</strong> La aplicación abrirá su bóveda temporal y empujará agresivamente (Flush) todas las acciones guardadas hacia el servidor en el orden cronológico exacto en el que ocurrieron. Recepción verá los paneles actualizarse casi como en cámara rápida, restableciendo la sincronía total del hotel en menos de 2 segundos.
            </div>
          </div>
        </div>

      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "SOP Producción - Camaristas",
};
