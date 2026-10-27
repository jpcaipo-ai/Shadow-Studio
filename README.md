# Shadow Studio Growth Command Center

Dashboard web estático construido con HTML, CSS y JavaScript nativo. No necesita backend ni proceso de compilación.

## Uso local

Sirve la carpeta con un servidor HTTP local (por ejemplo, `python -m http.server 8765`) y abre `http://127.0.0.1:8765/`.

## Filtros y exportación

- El filtro **Periodo o mes** comienza en el mes más reciente disponible y ordena los meses hacia atrás. Después muestra periodos predefinidos y la opción **Personalizado** para elegir una fecha inicial y final.
- **Exportar resumen** descarga los KPI y alertas principales de la selección actual.
- El bloque principal separa la facturación de nuevos, clientes nuevos y ticket de nuevos; todos se comparan contra el mismo periodo del año anterior.
- **Exportar transacciones** descarga las transacciones que cumplen todos los filtros activos.
- **Exportar auditoría** descarga la lectura anonimizada por conversación: origen, señal caliente, seguimiento, booking, venta y riesgos de fuga.
- **Exportar atribución** descarga cada clase de prueba con su fuente, headline o ruta, nivel de confianza, shows y compra posterior.
- El comparador configurable permite elegir cuatro widgets y enfrentar dos métricas contra el mes anterior o el mismo periodo del año anterior. La selección se conserva en el navegador.
- Los filtros de disciplina y profesor modifican realmente los KPI, gráficas y tablas; no son controles decorativos.
- La versión web pública no incluye nombres ni DNI. Cada cliente utiliza un código anónimo para conservar los cálculos de pagadores únicos, recurrencia y lifecycle.

## Publicación en GitHub Pages

1. Sube esta carpeta a un repositorio.
2. En GitHub abre **Settings → Pages**.
3. Selecciona la rama y la carpeta raíz que contiene `index.html`.
4. Guarda la configuración.

## Actualización de datos

El archivo `data.js` contiene el modelo analítico anonimizado utilizado por el dashboard. El corte publicado actualmente incluye **ventas, clientes, asistencias y adquisición al 26 de octubre de 2026**. La auditoría de conversaciones cubre del **17 de septiembre al 27 de octubre de 2026**. Los exports más recientes reemplazan únicamente el tramo que se superpone con la base histórica, evitando duplicar registros.

## Estructura

- `index.html`: estructura del dashboard.
- `styles.css`: diseño responsive.
- `app.js`: filtros, cálculos, gráficas SVG y exportación CSV.
- `command-center.css`: comparador, embudo operativo y vista de conversaciones.
- `command-center.js`: widgets configurables, filtros conversacionales, reglas de fuga y exportación de auditoría.
- `data.js`: datos agregados del análisis.

## Embudo y renovación

El tablero cruza ventas, clases de prueba y asistencias sin exponer datos personales. La conversión de prueba se define como la compra de un paquete dentro de los 30 días posteriores. Las cohortes con menos de 30 días se muestran como inmaduras.

El volumen de adquisición agrupa bookings de Free Pass, 2×1 y 1 clase, con desglose mensual por fecha de venta o emisión. Cada booking muestra primer show, segundo show, conversión observada y conversión madura a 30 días. Los bookings posteriores a una compra core quedan fuera de adquisición de nuevos.

Para el 2×1, el tablero añade las etapas Agenda 1, Show 1, Agenda 2, Show 2 y compra de paquete. Esta lectura usa el reporte de reservas para separar la caída de agendamiento de la inasistencia.

La atribución de clases de prueba usa el último contacto identificable de los 30 días previos y hasta el mismo día de emisión. Headline Ads e Instagram requieren una señal explícita en la conversación; WhatsApp / otro conserva los contactos cruzados sin etiqueta de origen. Los casos sin conversación vinculada permanecen como **Sin origen trazable** y no se reasignan por inferencia.

## Conversaciones

Un lead caliente requiere una señal posterior al mensaje precargado: agenda o disponibilidad, precio o pago, intención explícita, aceptación de un CTA o entrega de datos. Los clientes que ya tenían un paquete comercial antes de la señal quedan fuera de esta métrica de adquisición.

La respuesta inicial y el seguimiento manual son métricas distintas. El seguimiento exige un recontacto al menos ocho horas después del último mensaje del cliente y excluye los workflows. “Cliente sin respuesta” identifica conversaciones cuyo último mensaje sustantivo fue inbound y permaneció sin respuesta más de 24 horas. “Web sin seguimiento” identifica envíos de web, horarios, app o link de reserva sin respuesta posterior ni recontacto del equipo en 24 horas.

El estado “leído” proviene del mensaje exportado. Confirma que WhatsApp marcó el mensaje como leído, pero no demuestra que el cliente abrió la página enlazada.

Los nuevos core son clientes que compran por primera vez un paquete distinto de 1 clase y de Friends & Family. Se separan entre atribuidos a una oferta de entrada dentro de 30 días y adquisición directa.

La probabilidad de renovación se calcula sobre vencimientos históricos maduros. Los vencimientos próximos usan la fecha final real de cada membresía. El export de asistencias no contiene fecha de reserva, inasistencias ni aforo configurado; por eso la capacidad muestra carga observada y no ocupación o anticipación de agenda.

La valorización de renovaciones usa, cliente por cliente, el importe de su último paquete pagado. Cada cliente próximo a vencer se cuenta una sola vez. El tablero muestra la cartera potencial y la facturación esperada ajustada por la probabilidad histórica de renovación a 30 días.

La tabla de profundidad de renovación usa una **fecha efectiva de vencimiento**: la primera entre la fecha final contractual y el día en que el cliente agotó sus clases. El agotamiento se calcula únicamente cuando el cupo puede inferirse de forma confiable del nombre del plan; los planes ilimitados o sin cupo identificable conservan la fecha final. El corte actual permite identificar el cupo en 63.3% de los ciclos comerciales.

## Customer lifecycle

El lifecycle se calcula por cliente-mes y responde a los filtros del tablero:

- **Nuevo:** primera compra observada del cliente.
- **Renovación continua:** compra hasta 30 días después del vencimiento de la membresía anterior.
- **Reactivación:** compra entre 31 días y un año después del vencimiento.
- **Resurrección:** compra más de un año después del vencimiento.

La profundidad separa la renovación que le tocaba al cliente:

- **Primera renovación:** venció su primera membresía.
- **Segunda renovación:** ya había renovado una vez.
- **Tercera o más:** ya había renovado al menos dos veces.

El valor bruto de renovación suma el importe de la última membresía de cada cliente próximo a renovar. El valor esperado multiplica ese importe por la tasa histórica madura de su profundidad de renovación. El valor real suma el importe de la siguiente membresía efectivamente comprada dentro de 30 días del vencimiento efectivo. Si un cliente tiene más de un ciclo que vence en el mismo mes, se conserva solamente su última membresía para evitar duplicarlo.

La tabla de tiempo de retorno sigue la siguiente compra comercial después del vencimiento efectivo y la separa en anticipada, mismo mes, mes siguiente dentro de 30 días, reactivación entre 31 y 365 días, resurrección después de un año y sin retorno observado. Las cohortes recientes permanecen abiertas hasta completar la ventana correspondiente.

El tablero conserva además la tasa a 90 días como referencia diagnóstica, pero la clasificación operativa usa el umbral de 30 días solicitado.

## Comparaciones y metas

- Octubre 2026 se compara contra **los mismos días** de octubre 2025 para evitar sesgo por mes incompleto.
- La vista de Lifecycle compara cada ciclo contra el mismo periodo del año anterior: compras, facturación, variación monetaria y variación porcentual.
- El forecast mensual es lineal y se muestra como alerta temprana, no como presupuesto contable.
- Las metas de lifecycle se calibran con el desempeño reciente de julio a septiembre de 2026 y pueden refinarse cuando Shadow defina presupuesto y capacidad comercial.
