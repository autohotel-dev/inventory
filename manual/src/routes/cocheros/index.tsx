import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div style={{ marginBottom: "2rem" }}>
        <h1 class="premium-gradient">Procedimiento Operativo Estándar (SOP): Cocheros (Valet)</h1>
        <p>
          Esta guía describe con exactitud atómica las pestañas, botones y validaciones físicas de la Aplicación Móvil.
          Como Cochero, tú eres el lubricante de la operación; si olvidas tocar la pantalla para cerrar un servicio,
          el flujo del hotel entero se atascará provocando sobrecargas en Recepción.
        </p>
      </div>

      <div class="grid" style={{ gridTemplateColumns: "1fr" }}>
        
        {/* FLUJO 1: OCR */}
        <div class="card">
          <h3>SECCIÓN 1: Pestaña "Vehículos/Recepción" y Validación con Inteligencia Artificial (OCR)</h3>
          <p>El registro de ingreso mediante captura fotográfica inteligente.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 1.1: Preparación y Enfoque Fotográfico</h4>
            <div class="step-card">
              <span class="step-number">1.1.1</span>
              <strong>Intercepción del Cliente:</strong> Cuando el vehículo pase el portón principal, acércate educadamente por el lado del piloto. Mientras les das la bienvenida, observa si la placa trasera o delantera está más limpia e iluminada.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.2</span>
              <strong>Apertura de Módulo:</strong> Desbloquea tu celular de trabajo. Observa la barra de navegación inferior (Bottom Tabs) de la aplicación. Confirma que estás en el primer ícono a la izquierda, que dice <em>"Vehículos/Recepción"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.3</span>
              <strong>Activación de Cámara:</strong> Localiza el botón flotante principal, normalmente ubicado en la parte inferior derecha, que contiene el ícono de una cámara fotográfica. Presiónalo una vez firmemente.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.4</span>
              <strong>Enfoque Perpendicular:</strong> El visor de la cámara nativa se abrirá. Posiciónate de tal forma que la cámara quede exactamente frente a la placa (perpendicular, sin ángulos pronunciados). Evita los reflejos del sol intensos o destellos del flash.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.5</span>
              <strong>Captura Óptima:</strong> Toca el botón redondo de disparo en tu pantalla. Cuando la foto se muestre congelada, si es borrosa, toca 'Reintentar'. Si las letras son perfectamente legibles para un humano, toca 'Usar Foto' o el símbolo de la palomita.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 1.2: Procesamiento y Extracción de Datos</h4>
            <div class="step-card">
              <span class="step-number">1.2.1</span>
              <strong>El Salto a la Nube (API de Gemini):</strong> Verás un indicador de carga en pantalla (spinner circular) acompañado del texto <em>"Procesando..."</em>. La aplicación está comprimiendo la imagen, empujándola a los servidores de Google Gemini 2.5 Flash, e instruyendo a la IA para recortar la imagen, corregir la rotación y leer solo la placa vehicular ignorando el texto del marco. Esto tomará entre 1 y 3 segundos.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.2</span>
              <strong>Relleno Automático:</strong> El texto extraído aparecerá violentamente escrito dentro del campo de texto de placa en tu pantalla, en letras mayúsculas.
            </div>
            <div class="step-card">
              <span class="step-number">!</span>
              <strong style={{color:"var(--destructive)"}}>Filtro de Validacion Humana (OBLIGATORIO):</strong> Debes despegar tus ojos de la pantalla, mirar la placa física real, y compararla carácter por carácter con lo escrito en la pantalla. Las IAs suelen confundir: '0' numéricos con la letra 'O', números '1' con la letra 'I', y la letra 'B' con el número '8'.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.3</span>
              <strong>Corrección Manual:</strong> Si detectaste un error (ej. PXY-01A se leyó como PXY-O1A), toca el campo de texto con un dedo, usa el teclado del sistema para borrar la 'O' y escribir un '0'.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.4</span>
              <strong>Asignación de Categoría:</strong> Debajo del campo de texto, verás un conjunto de botones selector para el tipo de vehículo (Sedán, Camioneta/SUV, Motocicleta, etc). Toca el que aplique para este cliente.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.5</span>
              <strong>Registro en el Pipeline Operativo:</strong> Localiza el botón verde primario llamado <em>"Registrar Llegada"</em>. Tócalo una vez. Si la red es estable, aparecerá un mensaje de éxito rápido. Inmediatamente comunica a Recepción vía radio: "Recepción, placa registrada en sistema, avanzan peatonalmente/en vehículo."
            </div>
          </div>
        </div>

        {/* FLUJO 2: SERVICIOS */}
        <div class="card">
          <h3>SECCIÓN 2: Pestaña "Servicios Pendientes" (La Máquina Antibloqueos)</h3>
          <p>Esta pestaña es el puente logístico entre Recepción y el huésped encerrado.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 2.1: Intercepción de la Tarea</h4>
            <div class="step-card">
              <span class="step-number">2.1.1</span>
              <strong>Vibración y Alerta Sonora:</strong> Escucharás la alerta estándar de notificación de la aplicación y el celular vibrará largo y tendido. La barra de estatus mostrará un mensaje empuje como: "Nuevo servicio solicitado - Hab. 12".
            </div>
            <div class="step-card">
              <span class="step-number">2.1.2</span>
              <strong>Navegación al Módulo Central:</strong> Toca en el menú inferior la segunda pestaña con ícono de portapapeles/checklist llamada <em>"Servicios Pendientes"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.3</span>
              <strong>Localización Visual:</strong> Busca una tarjeta en estado rojo/naranja o con etiqueta 'Pendiente' en la lista, indicando que acaba de ser inyectada por la base de datos central. Contendrá el detalle (ej. "2 Cervezas y Cobro $50").
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 2.2: Ciclo de Posesión y Logística de Suministro</h4>
            <div class="step-card">
              <span class="step-number">2.2.1</span>
              <strong>Toma de Posesión (Clic de Acuse):</strong> Este paso es crítico. ANTES de dar un paso físico hacia la bodega, DEBES tocar el botón amarillo fuerte que dice <em>"Aceptar Tarea"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.2</span>
              <strong>Confirmación Backend:</strong> Al tocar el botón, el estado en Supabase mutará de "PENDING" a "IN_PROGRESS". En las pantallas de Recepción aparecerá una banderita azul o amarilla junto a la petición indicando que el servicio fue reconocido por ti. Esto evita dobles despachos y gritos innecesarios en la radio.
            </div>
            <div class="step-card">
              <span class="step-number">2.2.3</span>
              <strong>Movimiento Logístico Real:</strong> Camina al refrigerador o almacén, cuenta las cervezas correctas (2), toma las bebidas, confirma si la orden requiere terminal de cobro bancario o monedero, y trasládate a pie a la puerta de la habitación requerida (12).
            </div>
            <div class="step-card">
              <span class="step-number">2.2.4</span>
              <strong>Interacción Cliente-Empleado:</strong> Toca suavemente a la puerta principal o la ventanilla del cancel (según el tipo de habitación). Entrega los productos. Efectúa la cobranza mediante terminal (si es BBVA/GETNET) o el efectivo, devolviendo el cambio si es el caso. Agradece, da las buenas tardes y cierra o acordonan la zona.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 2.3: La Destrucción de la Tarea</h4>
            <div class="step-card">
              <span class="step-number">!</span>
              <strong style={{color:"var(--destructive)"}}>Pecado Logístico Cardenal:</strong> Guardarse el dispositivo móvil en el bolsillo sin presionar el botón verde final. Hacer esto implica mantener el "Fantasma de la Tarea" viva en el sistema, degradando drásticamente el reporte de 'Tiempo de Resolución' (Resolution Time) que lee la gerencia al final de mes.
            </div>
            <div class="step-card">
              <span class="step-number">2.3.1</span>
              <strong>Extracción y Visibilidad:</strong> Nada más separarte 2 metros de la puerta del cliente, saca de nuevo el celular, ve a la pestaña de "Servicios".
            </div>
            <div class="step-card">
              <span class="step-number">2.3.2</span>
              <strong>El Clic de Exterminio:</strong> Localiza tu tarea (ahora en color amarillo o marcada 'En Progreso'). Toca con fuerza el botón verde llamado <em>"Completar Tarea"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">2.3.3</span>
              <strong>Remoción Visual Cero:</strong> Observa la tarjeta de servicio derretirse visualmente y desaparecer del listado de pendientes. El estado interno del sistema pasa a "RESOLVED", el cronómetro de la base de datos se congela, y el gerente sonríe ante la analítica de rendimiento verde en su pantalla.
            </div>
          </div>
        </div>

        {/* FLUJO 3: CHECK OUT */}
        <div class="card">
          <h3>SECCIÓN 3: Pestaña "Habitaciones en Salida" (El Filtro Aduanero Final)</h3>
          <p>Tú eres la muralla entre la pérdida económica del hotel y el auto de escape del huésped.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 3.1: Escudo de Protección Físico</h4>
            <div class="step-card">
              <span class="step-number">3.1.1</span>
              <strong>Alarma de Abandono:</strong> La radio avisa: "Salida Habitación 8". O recibes un push en la app. Toca la tercera pestaña en el menú inferior llamada <em>"Habitaciones en Salida"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">3.1.2</span>
              <strong>Presencia Física Inmediata:</strong> Párate frente al vehículo, acércate a la puerta principal o al portón del garage para evitar que el conductor abandone el predio furtivamente. Haz una seña visual cortés indicando un par de segundos de espera.
            </div>
            <div class="step-card">
              <span class="step-number">3.1.3</span>
              <strong>Inspección Flash de Cabina:</strong> Asómate a la habitación de reojo si el cliente dejó la puerta abierta, o realiza el protocolo de seguridad veloz: Verifica la existencia del Control Remoto de TV sobre la mesita, y la no evidencia flagrante de desastre sangriento o humo excesivo. Tiempo máximo sugerido: 4 segundos.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 3.2: Dictamen Paramétrico en Sistema</h4>
            <div class="step-card">
              <span class="step-number">3.2.1</span>
              <strong>Luz Verde (Aprobación Rápida):</strong> El control está allí, no hay fugas ni caos. Localiza la habitación 8 en tu lista de la app. Toca fuertemente el botón rectangular color verde pálido que dice <em>"Autorizar Salida (Todo en Orden)"</em>. El portón magnético de la cochera está listo para abrir y Recepción genera el ticket sin objeciones.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.2</span>
              <strong>Bandera Roja (Detección de Daño Inminente):</strong> ¡Alto! El control de la TV de $450 MXN ha desaparecido. No toques el botón verde.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.3</span>
              <strong>Interacción de Bloqueo Tecnológico:</strong> Toca rápidamente el botón opuesto, el botón Rojo de Alerta con símbolo de admiración que dice <em>"Reportar Faltante/Daño"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.4</span>
              <strong>Expedición Documental Rápida:</strong> Se abrirá un menú. Toca la opción predefinida "Falta Control Remoto" o escribe brevemente en "Otro". Si el control "simplemente no está", ignora la foto. Si el televisor está perforado por un bate de béisbol, toca el ícono de la cámara agresivamente, toma la evidencia y presiona Guardar.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.5</span>
              <strong>Bloqueo Administrativo Total:</strong> Esta acción bloquea instantáneamente la pantalla de Recepción, impidiendo el Check-out de la Habitación 8 e informándoles con luces rojas de tu reporte. Recepción detiene su cobro estándar, llama a gerencia, e instruye por intercomunicador al cliente sobre el cargo extra al tiempo que tú le niegas el paso al vehículo. 
            </div>
          </div>
        </div>

        {/* FLUJO 4: CONTROLES TV */}
        <div class="card" style={{ marginTop: "2rem" }}>
          <h3>SECCIÓN 4: Pestaña "Controles" (Verificación de TV)</h3>
          <p>Tú eres el responsable de asegurar que el huésped entre a la habitación con la televisión ya encendida y el control en su lugar.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 4.1: Recepción de Tarea de TV</h4>
            <div class="step-card">
              <span class="step-number">4.1.1</span>
              <strong>Alerta Visual:</strong> Al entrar un nuevo cliente, Recepción te asignará la tarea de encender la TV de la habitación. Verás un número de notificación rojo sobre el ícono de la pestaña <em>"Controles"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">4.1.2</span>
              <strong>Filtro "Mis Asignaciones":</strong> En la pestaña Controles, la lista te mostrará las tarjetas de las habitaciones que tienes asignadas con el estado en naranja "Pendiente".
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 4.2: Ejecución Física</h4>
            <div class="step-card">
              <span class="step-number">4.2.1</span>
              <strong>Traslado a la Habitación:</strong> Dirígete a la habitación indicada ANTES o durante el ingreso del cliente (si es posible).
            </div>
            <div class="step-card">
              <span class="step-number">4.2.2</span>
              <strong>Verificación Física:</strong> Localiza el control remoto (que NUNCA sale de la habitación). Presiona el botón de encendido y asegúrate de que la televisión prenda y muestre señal correctamente. Déjalo en un lugar visible (sobre la mesa o la cama).
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 4.3: Confirmación en Sistema</h4>
            <div class="step-card">
              <span class="step-number">4.3.1</span>
              <strong>Cierre de Tarea:</strong> Toma tu celular, busca la tarjeta de la habitación en la pestaña "Controles" y presiona el botón amarillo fuerte que dice <em>"Confirmar"</em>.
            </div>
            <div class="step-card">
              <span class="step-number">4.3.2</span>
              <strong>Feedback Visual:</strong> La tarjeta desaparecerá de tus tareas pendientes y el sistema cambiará el estatus a "TV Encendida" en el tablero general de Recepción.
            </div>
          </div>
        </div>

      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "SOP Producción - Cocheros",
};
