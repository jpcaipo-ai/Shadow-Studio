# Shadow Studio Growth Command Center

Dashboard web estático construido con HTML, CSS y JavaScript nativo. No necesita backend ni proceso de compilación.

## Uso local

Sirve la carpeta con un servidor HTTP local (por ejemplo, `python -m http.server 8765`) y abre `http://127.0.0.1:8765/`.

## Filtros y exportación

- El filtro **Periodo o mes** comienza en el mes más reciente disponible y ordena los meses hacia atrás. Después muestra periodos predefinidos y la opción **Personalizado** para elegir una fecha inicial y final.
- **Exportar resumen** descarga los KPI y alertas principales de la selección actual.
- El bloque principal separa la facturación de nuevos, clientes nuevos y ticket de nuevos; todos se comparan contra el mismo periodo del año anterior.
- **Exportar transacciones** descarga las transacciones que cumplen todos los filtros activos.
- Los filtros de disciplina y profesor modifican realmente los KPI, gráficas y tablas; no son controles decorativos.
- La versión web pública no incluye nombres ni DNI. Cada cliente utiliza un código anónimo para conservar los cálculos de pagadores únicos, recurrencia y lifecycle.

## Publicación en GitHub Pages

1. Sube esta carpeta a un repositorio.
2. En GitHub abre **Settings → Pages**.
3. Selecciona la rama y la carpeta raíz que contiene `index.html`.
4. Guarda la configuración.

## Actualización de datos

El archivo `data.js` contiene el modelo analítico anonimizado utilizado por el dashboard. El corte publicado actualmente incluye **ventas al 16 de octubre de 2026** y **asistencias/adquisición al 15 de octubre de 2026**. El export más reciente reemplaza únicamente el tramo de octubre que se superpone con la base histórica, evitando duplicar transacciones.

## Estructura

- `index.html`: estructura del dashboard.
- `styles.css`: diseño responsive.
- `app.js`: filtros, cálculos, gráficas SVG y exportación CSV.
- `data.js`: datos agregados del análisis.

## Embudo y renovación

El tablero cruza ventas, clases de prueba y asistencias sin exponer datos personales. La conversión de prueba se define como la compra de un paquete dentro de los 30 días posteriores. Las cohortes con menos de 30 días se muestran como inmaduras.

El volumen de clases de prueba agrupa Free Pass y 2×1, con desglose mensual por fecha de venta. El análisis de uso de ambas clases se mantiene separado y aplica únicamente al 2×1.

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
