import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";

export default component$(() => {
  return (
    <>
      <div class="animate-in stagger-1" style={{ marginBottom: "3rem" }}>
        <h1 class="premium-gradient">Procedimiento Operativo Estándar (SOP): Recepcionistas</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Este documento constituye la guía definitiva y obligatoria para la operación en Recepción.
          Cada movimiento, clic y validación está descrito a un nivel microscópico para garantizar
          el cero margen de error en auditorías. El seguimiento estricto es de carácter obligatorio.
        </p>
      </div>

      <div class="grid animate-in stagger-2" style={{ gridTemplateColumns: "1fr", gap: "2.5rem" }}>
        
        {/* FLUJO 1: INICIO DE TURNO */}
        <div class="card">
          <h3>SECCIÓN 1: Protocolo de Inicio de Turno y Apertura de Caja</h3>
          <p>La apertura de caja es el evento que vincula legalmente todas las transacciones financieras a tu usuario de sistema. Omitir este paso resultará en descuadres críticos.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 1.1: Verificación de Sesión</h4>
            <div class="step-card">
              <span class="step-number">1.1.1</span>
              <strong>Validación del Hardware:</strong> Verifica que la terminal de punto de venta, la impresora térmica y el escáner de código de barras estén encendidos y conectados.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.2</span>
              <strong>Acceso a la URL:</strong> Abre el navegador Google Chrome. Haz clic en la barra de direcciones y navega al portal interno del sistema.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.3</span>
              <strong>Verificación de Usuario Previo:</strong> Si ves la sesión abierta de tu compañero del turno anterior, ubica tu cursor en la esquina superior derecha, haz clic en su nombre o avatar, y selecciona "Cerrar Sesión" de manera inmediata.
            </div>
            <div class="step-card">
              <span class="step-number">1.1.4</span>
              <strong>Autenticación:</strong> Ingresa tu correo electrónico institucional en el primer campo. Presiona la tecla 'Tab' para pasar al campo de contraseña. Ingresa tu contraseña y presiona 'Enter' o haz clic en 'Iniciar Sesión'.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 1.2: Apertura Financiera</h4>
            <div class="step-card">
              <span class="step-number">1.2.1</span>
              <strong>Navegación al Módulo:</strong> Mueve el cursor hacia la barra lateral izquierda. Localiza la sección "Auditoría" o "Turnos". Haz clic izquierdo en ella.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.2</span>
              <strong>Auditoría Visual de Turnos Previos:</strong> En la tabla principal, asegúrate de que no haya ningún turno marcado con el estado "En Progreso" (color verde o azul) del turno anterior. Si lo hay, el gerente debe forzar el cierre.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.3</span>
              <strong>Conteo Físico Inicial (A Ciegas):</strong> Abre el cajón de dinero con la llave física. Saca todos los billetes y monedas. Cuenta el efectivo tres veces para asegurar exactitud. Este será tu "Fondo de Caja".
            </div>
            <div class="step-card">
              <span class="step-number">1.2.4</span>
              <strong>Registro en Sistema:</strong> Haz clic en el botón primario que dice "Abrir Turno". Aparecerá una ventana modal en el centro de la pantalla.
            </div>
            <div class="step-card">
              <span class="step-number">1.2.5</span>
              <strong>Captura de Datos:</strong> Haz clic dentro del campo de texto "Fondo de Caja Inicial". Usando el teclado numérico, escribe la cantidad exacta que acabas de contar. Usa el punto decimal si hay centavos (ej. 1500.50).
            </div>
            <div class="step-card">
              <span class="step-number">1.2.6</span>
              <strong>Confirmación Final:</strong> Haz clic en el botón de confirmación "Abrir Turno". Espera a que el sistema muestre la alerta verde de éxito en la esquina superior derecha.
            </div>
            <div class="step-card">
              <span class="step-number">!</span>
              <strong style={{color:"var(--destructive)"}}>Consecuencia de Omisión:</strong> Si procesas cobros sin haber completado el paso 1.2.6, el dinero ingresará al sistema como "huérfano" o se sumará al turno del día anterior, causando faltantes reportables a Recursos Humanos.
            </div>
          </div>
        </div>

        {/* FLUJO INTERACCIÓN: RUEDA SELECTORA */}
        <div class="card">
          <h3>SECCIÓN 2: Interacción con Habitaciones (La Rueda Selectora)</h3>
          <p>Toda interacción con una habitación en el Dashboard se realiza a través de la Rueda Selectora Interactiva (Action Wheel). Esta interfaz circular adapta sus botones según el estado de la habitación.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 2.1: Navegación de Estados</h4>
            <div class="step-card">
              <span class="step-number">2.1.1</span>
              <strong>Estado LIBRE (Azul):</strong> Al hacer clic en una habitación Libre, la rueda mostrará opciones como "Rápida" (Entrada), "Mantenimiento" (Bloqueo) o "Sucia" (Enviar a limpieza).
            </div>
            <div class="step-card">
              <span class="step-number">2.1.2</span>
              <strong>Estado OCUPADA (Rojo):</strong> Al hacer clic en una habitación Ocupada, la rueda mostrará todas las herramientas operativas: "Salida", "Cobrar" (Consumos y extras), "Detalles", "Portal", "Cambiar", "Personas", "Gestionar" (Horas extras), y opciones de "Autorizar/Rechazar" salidas de cochero.
            </div>
            <div class="step-card">
              <span class="step-number">2.1.3</span>
              <strong>Estado SUCIA (Morado):</strong> Si está Sucia, la rueda permite marcarla como "Limpiar" (Pasa a Libre) o "Mantenimiento".
            </div>
            <div class="step-card">
              <span class="step-number">2.1.4</span>
              <strong>Estado BLOQUEADA (Verde):</strong> Si está en mantenimiento, la rueda permite "Liberar" la habitación o mandarla a "Sucia".
            </div>
          </div>
        </div>

        {/* FLUJO 3: CHECK-IN */}
        <div class="card">
          <h3>SECCIÓN 3: Protocolo de Check-in (Inicio de Estancia)</h3>
          <p>El proceso de ingreso de un cliente, utilizando el modal "Iniciar Estancia". El sistema automatiza los tiempos de cobro basados en reglas estrictas de negocio.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 3.1: Captura de Estancia</h4>
            <div class="step-card">
              <span class="step-number">3.1.1</span>
              <strong>Activación:</strong> Haz clic en una habitación LIBRE y selecciona "Rápida" en la rueda selectora.
            </div>
            <div class="step-card">
              <span class="step-number">3.1.2</span>
              <strong>Ocupación y Noches:</strong> En el modal, usa los botones `+` y `-` debajo de "Ocupación" para definir cuántas personas entran. Si la habitación es de Hotel, usa los botones `+` y `-` bajo "Duración de estancia" para fijar las Noches. El sistema calculará automáticamente si hay cobro de persona extra.
            </div>
            <div class="step-card">
              <span class="step-number">3.1.3</span>
              <strong>Cálculo Automático de Salida:</strong> Observa en la esquina superior derecha la "Salida Estimada". NO intentes seleccionar un tipo de tarifa. El sistema fijará automáticamente las horas basándose en reglas (8 horas en fin de semana, 12 horas entre semana para Moteles, o 12:00 PM del día siguiente para Hoteles).
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 3.2: Captura de Identidad Vehicular</h4>
            <div class="step-card">
              <span class="step-number">3.2.1</span>
              <strong>Placa (Ingreso Manual):</strong> Pregunta al cliente por su placa y tecleala manualmente en el campo "Placas", sin guiones.
            </div>
            <div class="step-card">
              <span class="step-number">3.2.2</span>
              <strong>Búsqueda de Modelo (Autocompletado):</strong> Haz clic en el campo "Buscar Modelo". Teclea al menos 2 letras de la marca o modelo (ej. "Corolla"). Selecciona el resultado de la lista desplegable; el sistema autocompletará los campos Marca y Modelo.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 3.3: Multipago</h4>
            <div class="step-card">
              <span class="step-number">3.3.1</span>
              <strong>Selección de Método:</strong> En la sección de pagos, elige si el cobro será en "Efectivo" o "Tarjeta".
            </div>
            <div class="step-card">
              <span class="step-number">3.3.2</span>
              <strong>Si es Tarjeta (Submenú):</strong> Si seleccionas Tarjeta, el sistema revelará detalles extra. Es OBLIGATORIO seleccionar la Terminal física usada ("BBVA" - Azul, o "GETNET" - Rojo), el tipo ("Crédito" o "Débito") y teclear los últimos 4 dígitos.
            </div>
            <div class="step-card">
              <span class="step-number">3.3.3</span>
              <strong>Ejecución Final:</strong> Asegúrate de que el indicador muestre que está "Pagado" (Color esmeralda). Haz clic en "Iniciar Estancia". La habitación cambiará a estado Ocupada (Rojo).
            </div>
          </div>
        </div>

        {/* FLUJO 4: ROOM SERVICE */}
        <div class="card">
          <h3>SECCIÓN 4: Protocolo de Venta de Consumos (Room Service)</h3>
          <p>Flujo súper rápido para agregar consumos utilizando el sistema de Lector Automático y el atajo F2.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 4.1: Escaneo y Stock</h4>
            <div class="step-card">
              <span class="step-number">4.1.1</span>
              <strong>Apertura del Modal:</strong> Haz clic en la habitación Ocupada. En la rueda selectora, elige el icono de la bolsa de compras "Cobrar" y ve a la sección de añadir consumos.
            </div>
            <div class="step-card">
              <span class="step-number">4.1.2</span>
              <strong>Escaneo Automático (Lector de Barras):</strong> NO necesitas hacer clic en nada ni presionar Enter. Simplemente toma el producto físico, pásalo por el lector de código de barras. El sistema detectará la velocidad de tecleo e ingresará el producto automáticamente al carrito reproduciendo un sonido de éxito.
            </div>
            <div class="step-card">
              <span class="step-number">4.1.3</span>
              <strong>Búsqueda Manual:</strong> Alternativamente, escribe el SKU o nombre en la barra y presiona 'Enter'.
            </div>
            <div class="step-card">
              <span class="step-number">4.1.4</span>
              <strong>Validación de Inventario:</strong> El sistema verificará instantáneamente si hay existencias. Si ves un error de "Stock Insuficiente", NO puedes entregar el producto. Notifica inmediatamente al administrador.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 4.2: Confirmación y Paquetes</h4>
            <div class="step-card">
              <span class="step-number">4.2.1</span>
              <strong>Modales de Paquetes:</strong> Si escaneas una "Botella", el sistema abrirá automáticamente un modal de "Paquete de Bebidas" para que selecciones los mezcladores gratuitos (cortesía) según las reglas de negocio configuradas.
            </div>
            <div class="step-card">
              <span class="step-number">4.2.2</span>
              <strong>Registro Inmediato (Atajo F2):</strong> Una vez que la lista en el carrito esté correcta, presiona la tecla **F2** en tu teclado. Esto procesa el pago inmediatamente al cuarto y generará una instrucción de impresión.
            </div>
            <div class="step-card">
              <span class="step-number">4.2.3</span>
              <strong>Ticket Térmico:</strong> Arranca el ticket impreso por la impresora térmica y entrégaselo al cochero junto con los productos para que los lleve a la habitación.
            </div>
          </div>
        </div>

        {/* FLUJO 5: CHECK-OUT */}
        <div class="card">
          <h3>SECCIÓN 5: Protocolo de Salida (Check-out)</h3>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 5.1: Liquidación y Liberación</h4>
            <div class="step-card">
              <span class="step-number">5.1.1</span>
              <strong>Rueda Selectora:</strong> Haz clic en la habitación y selecciona "Salida" (Puerta Abierta) en la rueda.
            </div>
            <div class="step-card">
              <span class="step-number">5.1.2</span>
              <strong>Liquidación:</strong> Si el sistema arroja una alerta de "Cobro Pendiente", cobra el efectivo o usa la terminal (BBVA/GETNET) usando el mismo flujo de Multipago de la Sección 3.
            </div>
            <div class="step-card">
              <span class="step-number">5.1.3</span>
              <strong>Liberación de Cuarto:</strong> Haz clic en "Finalizar Estancia". La habitación pasará a estado SUCIA, listo para la Camarista.
            </div>
          </div>
        </div>

        {/* FLUJO 6: CORTE DE CAJA */}
        <div class="card">
          <h3>SECCIÓN 6: Protocolo de Cierre (Corte de Caja)</h3>
          <p>El proceso crítico final. Determina la exactitud financiera de toda tu jornada laboral tomando en cuenta las terminales separadas y los gastos del turno.</p>
          
          <div style={{ marginLeft: "1rem", marginTop: "1rem" }}>
            <h4 style={{ color: "var(--primary)", marginBottom: "0.5rem" }}>Fase 6.1: Lectura del Panel de Datos</h4>
            <div class="step-card">
              <span class="step-number">6.1.1</span>
              <strong>Inspección de Tarjetas Superiores:</strong> Al ir a "Turnos" y hacer clic en cerrar turno, el modal muestra tres tarjetas con bordes coloreados. Lee los números:
              <br/>- <strong style={{color:"hsl(160, 60%, 45%)"}}>Efectivo (Verde):</strong> Dinero total captado en cash.
              <br/>- <strong style={{color:"hsl(220, 70%, 50%)"}}>BBVA (Azul):</strong> Dinero exacto operado por la terminal BBVA.
              <br/>- <strong style={{color:"hsl(340, 75%, 55%)"}}>GETNET (Rojo):</strong> Dinero exacto operado por la terminal Santander/Getnet.
            </div>
            <div class="step-card">
              <span class="step-number">6.1.2</span>
              <strong>Fórmula del Efectivo Neto:</strong> Observa la caja central derecha de "Gastos". Debajo de ella, verás la tarjeta crítica de "Efectivo Neto". El sistema calcula esto dinámicamente así: <code>Efectivo Bruto - Gastos Realizados</code>. <strong>Esta cantidad debe coincidir exactamente con los billetes y monedas en tu cajón</strong>.
            </div>

            <h4 style={{ color: "var(--primary)", marginTop: "1.5rem", marginBottom: "0.5rem" }}>Fase 6.2: Ejecución Final</h4>
            <div class="step-card">
              <span class="step-number">6.2.1</span>
              <strong>Impresión del Pre-Corte:</strong> Haz clic izquierdo en el botón "Pre-Corte". La impresora térmica escupirá un ticket con el desglose. Arranca el ticket y engrápalo a los cierres de lote de las terminales.
            </div>
            <div class="step-card">
              <span class="step-number">6.2.2</span>
              <strong>El Clic de No Retorno:</strong> Posiciona el cursor sobre el botón verde que dice "Cerrar Turno". <strong>ADVERTENCIA:</strong> Al hacer clic en este botón, toda tu información se encriptará de forma inmutable. Haz clic firme una sola vez.
            </div>
          </div>
        </div>

      </div>
    </>
  );
});

export const head: DocumentHead = {
  title: "Procedimiento Operativo - Recepcionistas",
};
