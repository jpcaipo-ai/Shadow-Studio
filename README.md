# Shadow Studio Growth Command Center

Dashboard web estático construido con HTML, CSS y JavaScript nativo. No necesita backend ni proceso de compilación.

## Uso local

Abre `index.html` directamente en el navegador.

## Filtros y exportación

- El filtro **Periodo o mes** comienza en el mes más reciente disponible y ordena los meses hacia atrás. Después muestra periodos predefinidos y la opción **Personalizado** para elegir una fecha inicial y final.
- **Exportar vista CSV** descarga el resumen mensual de la selección actual.
- **Exportar transacciones** descarga las transacciones que cumplen todos los filtros activos.
- La versión web pública no incluye nombres ni DNI. Cada cliente utiliza un código anónimo para conservar los cálculos de pagadores únicos, recurrencia y lifecycle.

## Publicación en GitHub Pages

1. Sube esta carpeta a un repositorio.
2. En GitHub abre **Settings → Pages**.
3. Selecciona la rama y la carpeta raíz que contiene `index.html`.
4. Guarda la configuración.

## Actualización de datos

El archivo `data.js` contiene los agregados utilizados por el dashboard. Sustitúyelo cuando se genere un nuevo corte de datos, conservando la misma estructura.

## Estructura

- `index.html`: estructura del dashboard.
- `styles.css`: diseño responsive.
- `app.js`: filtros, cálculos, gráficas SVG y exportación CSV.
- `data.js`: datos agregados del análisis.

## Embudo y renovación

El tablero cruza ventas, clases de prueba y asistencias sin exponer datos personales. La conversión de prueba se define como la compra de un paquete dentro de los 30 días posteriores. Las cohortes con menos de 30 días se muestran como inmaduras.

La probabilidad de renovación se calcula sobre vencimientos históricos maduros a 30 y 90 días. Los vencimientos próximos usan la fecha final real de cada membresía. El export de asistencias no contiene fecha de reserva, inasistencias ni aforo configurado; por eso la capacidad muestra carga observada y no ocupación o anticipación de agenda.

La valorización de renovaciones utiliza un ticket proyectado de S/400 por cliente. El tablero muestra tanto la cartera potencial si todos renuevan como la facturación esperada ajustada por la probabilidad histórica de renovación a 90 días.

## Customer lifecycle

El lifecycle se calcula por cliente-mes y responde a los filtros del tablero:

- **Nuevo:** primera compra observada del cliente.
- **Renovación continua:** compra hasta 90 días después del vencimiento de la membresía anterior.
- **Reactivación:** compra entre 91 días y un año después del vencimiento.
- **Resurrección:** compra más de un año después del vencimiento.

La frontera de 90 días captura aproximadamente 90% de los retornos observados; una ventana de 30 días dejaría fuera una parte material de las renovaciones tardías.
