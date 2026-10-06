# Shadow Studio Growth Command Center

Dashboard web estático construido con HTML, CSS y JavaScript nativo. No necesita backend ni proceso de compilación.

## Uso local

Abre `index.html` directamente en el navegador.

## Filtros y exportación

- El filtro **Periodo o mes** incluye periodos predefinidos, meses individuales y la opción **Personalizado** para elegir una fecha inicial y final.
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

## Nota sobre churn

La fuga incluida es provisional y corresponde al cruce entre las fotografías del 30 de septiembre y el 3 de octubre de 2026. Para churn mensual real se necesita un historial de vencimientos, renovaciones y cancelaciones con una ventana de gracia definida.

## Customer lifecycle

El lifecycle se calcula por cliente-mes y responde a los filtros del tablero:

- **Nuevo:** primera compra observada del cliente.
- **Continuo:** vuelve a comprar en un máximo de 90 días desde su compra anterior.
- **Reactivado:** vuelve a comprar después de más de 90 días.

Enero de 2025 es la primera observación disponible y debe interpretarse como línea base, no como adquisición confirmada. Este análisis es independiente del churn: una reactivación se determina por el intervalo entre compras, mientras que la fuga requiere vencimiento y ausencia de renovación dentro de una ventana de gracia.
