# SatRC V2.0 — Arquitectura y Frontend (Nivel Ingeniería)

## 1. El Estado en el Frontend
El frontend **no calcula riesgo complejo en tiempo real**. Su única fuente de verdad es el Blob (`estado_diocesano.json`). Si el Blob falla, el frontend tiene un "fallback en vivo" que evalúa en el navegador.

## 2. Vistas Principales
- `MonitorPublico.jsx`: Vista pública. Selector de Zona -> Municipio -> Localidad. Usa Open-Meteo para gráficas. No tiene botones de exportación.
- `SatRCOperativo.jsx`: Sala de mando. Semáforo de 4 niveles. Botón de On-Demand.

## 3. El Motor de Reportes Regionales (`src/engine/reportesRegionales.js`)
Creado en Octubre 2026. No existía antes.
- `seleccionarNodosRegionales()`: Replica la lógica del runner.
- `construirResumenesRegionales()`: **Crítico**. Hace 14 fetches a Open-Meteo con límite de 4 lotes concurrentes (`TAMANO_LOTE = 4`). Si haces más de 4, el navegador colapsa por límite de conexiones.
- `invalidarCache()`: Borra la caché de 30 minutos. Se usa cuando el operador reintenta.

## 4. Modales (Refactor Octubre 2026)
Antes había un solo modal gigante en `SatRCOperativo.jsx`. Se dividió en 3:
1.  `ReporteCuerpo.jsx`: El HTML de las 7 secciones. 100% reutilizable.
2.  `ReporteModalOperativo.jsx`: Usa el cuerpo + Botones (WhatsApp, Descargar, Imprimir). Solo para operadores.
3.  `ReporteModalPublico.jsx`: Usa el cuerpo + Sin botones. Solo para el Monitor.

## 5. El Problema del Encoding UTF-8 (N27)
`@vercel/blob` en el runner guarda strings con doble encoding (ej. `ó` se guarda como `Ã³`).
El frontend **NO** tiene la culpa. El endpoint `/api/sara.js` lee el Blob y ejecuta `repararObjeto()` antes de enviarlo al frontend. Si modificas `/api/sara.js`, asegúrate de no romper esta función.