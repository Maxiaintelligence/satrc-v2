# SatRC V2.0 — Arquitectura

> **Versión del documento:** 2.4 (22/10/2026)
> **Alcance:** componentes, flujo de datos, endpoints, almacenamiento y contratos. El detalle de las reglas de riesgo está en `03_MOTOR_RIESGO.md`. Las decisiones que originaron esta arquitectura están en `08_DECISIONES.md`.

---

## 1. Capas y responsabilidades

| Capa | Responsabilidad | Dónde vive |
|---|---|---|
| Runner autónomo | Consulta modelos y avisos, evalúa las 405 localidades y publica el estado | `scripts/ejecutar_sara_autonomo.mjs` (GitHub Actions, cada 3 h) |
| Funciones serverless | Entregan el estado, generan reportes bajo demanda y reciben disparos externos | `api/` (Vercel Functions, Node 22) |
| Almacenamiento | Guarda el estado vigente, la bitácora y el último reporte | Vercel Blob |
| Interfaz | Muestra el semáforo, los reportes y los mapas | `src/` (React 19, Vite 8, Tailwind 3) |
| Módulos compartidos | Lógica común entre frontend y backend, sin duplicados | `src/lib/compartido/` |

**Principio:** el frontend no calcula riesgo en condiciones normales. Su única fuente de verdad es el estado publicado en el Blob. El cálculo en el navegador existe solo como respaldo cuando el Blob no está disponible (ver §5).

---

## 2. Flujo de datos

```text
Open-Meteo (GFS, ICON, GEM)     SMN / CONAGUA (avisos)     NOAA GOES-19 (imágenes)
            │                            │                          │
            ▼                            ▼                          │
┌──────────────────────────────────────────────────────┐            │
│ Runner (GitHub Actions, cada 3 h)                    │            │
│ 1. Aviso SMN                                         │            │
│ 2. Series por zona (14 nodos, lotes de 4)            │            │
│ 3. Consenso determinista compartido (GFS, ICON, GEM) │            │
│ 4. Evaluación multiamenaza (405 localidades)         │            │
│ 5. Validación Zod del paquete                        │            │
│ 6. Publicación en Blob + bitácora encadenada         │            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           │
          Vercel Blob: estado_diocesano.json                        │
                        │  bitacora_sara.json                       │
                        │  reporte_diocesano_vigente.json           │
                        ▼                                           │
┌──────────────────────────────────────────────────────┐            │
│ /api/sara: lee, repara codificación, valida con Zod  │            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           ▼
     Interfaz (MonitorPublico, SatRCOperativo)  ◄──── /api/latest-gif
```

Si `/api/sara` no puede validar el Blob, la interfaz cae al cálculo en vivo (ver §5). El operador debe ver siempre un dato, aunque no sea el publicado.

---

## 3. Interfaz

### 3.1 Vistas

| Archivo | Función | Acceso |
|---|---|---|
| `MonitorPublico.jsx` | Monitor Climático: selector zona → municipio → localidad, pronóstico y gráficas | Abierto |
| `SatRCOperativo.jsx` | Sala Operativa: semáforo de 4 niveles, generación de reportes, auditoría | Clave de operador |
| `App.jsx` | Enrutamiento entre vistas y pantalla de acceso | — |

**Estado actual de la interfaz respecto al motor:**
- El Monitor Climático muestra solo el pronóstico hidrológico. No muestra el semáforo N1 a N4 ni el desglose por vector. Pendiente en `06_PENDIENTES.md` (H-UI-01 a H-UI-03).
- La Sala Operativa muestra el desglose por vector (barras de `VectorBar.jsx`) y las acciones operativas, desde Etapa 5.

### 3.2 Componentes

| Archivo | Descripción |
|---|---|
| `components/ReporteCuerpo.jsx` | Renderiza las 7 secciones del reporte. Es la base de los dos modales. |
| `components/ReporteModalOperativo.jsx` | Modal de la Sala Operativa: incluye compartir, descargar e imprimir. |
| `components/ReporteModalPublico.jsx` | Modal del Monitor Climático: solo lectura. |
| `components/VectorBar.jsx` | Barras de riesgo por vector (Etapa 5). |
| `components/RiskMap.jsx` | Mapa Leaflet con las 405 localidades. |
| `components/SatelliteViewer.jsx` | Visor de animaciones GOES-19 con 5 canales. |
| `components/OfficialAlertBanner.jsx` | Banner superior con el aviso oficial del SMN. |
| `components/DisclaimerModal.jsx` | Aviso de subordinación a Protección Civil y CONAGUA. |
| `components/TextoEnriquecido` (en `lib/compartido/markdown.jsx`) | Viñetas y negritas en los textos de los reportes. |

---

## 4. Módulos compartidos (`src/lib/compartido/`)

Funciones que antes estaban duplicadas y que ahora tienen una sola fuente (ADR-004).

| Archivo | Exporta | Uso |
|---|---|---|
| `fechas.js` | `formatearTimestamp` | Interfaz y reportes |
| `markdown.jsx` | `TextoEnriquecido` | Interfaz |
| `nodos.js` | `seleccionarNodosRegionales` | Runner e interfaz |
| `mojibake.js` | `repararMojibake`, `repararObjeto` | API y reportes |
| `regionales.js` | `normalizarDatosRegionales`, `construirBloqueRegional` | Reportes |
| `noaa.js` | `parseNoaaStamp`, `compararNoaaStamps` | Visor satelital |
| `dictamen.js` | Tabla de 7 vectores para el banner dinámico | Interfaz (Etapa 5) |
| `bitacora.js` | Resumen multivector de la bitácora | Runner (Etapa 5) |
| `promptsMultivector.js` | Reglas `REGLAS_MULTIVECTOR` para los prompts de SARA | Reportes (Etapa 5) |

> **Nota:** la constante de tamaño de lote (`TAMANO_LOTE = 4`) aparece declarada en tres lugares: el runner, `reportesRegionales.js` y `SatRCOperativo.jsx`. Es una violación del principio DRY. Ver DEU-22 en `06_PENDIENTES.md`.

---

## 5. Motores

| Archivo | Rol | Detalle en |
|---|---|---|
| `engine/riskEvaluator.js` | Motor hidrológico canónico (6 reglas) | `03` §2 |
| `scripts/engine/riskEvaluatorRunner.mjs` | Gemelo del anterior para el runner | `03` §3 |
| `engine/hydroAdapter.js` | Añade el nivel continuo al motor hidrológico | `03` §8 |
| `engine/windEvaluator.js` | Viento con densidad del aire y umbral por altitud | `03` §5 |
| `engine/thermalEvaluator.js` | Frío, heladas, nevadas y calor | `03` §6 |
| `engine/convectiveEvaluator.js` | Granizo, downbursts y supercélulas | `03` §7 |
| `engine/crossThreatOrchestrator.js` | Combina los cuatro vectores con acoplamiento | `03` §9 |
| `engine/consensusEngine.js` | Consenso por variable entre modelos | `03` §4 |
| `engine/meteoFetcher.js` | Pide 15 variables horarias a Open-Meteo para 3 modelos | `03` §4 |
| `engine/reportesRegionales.js` | Construye los resúmenes de las 14 zonas con caché de 30 minutos | Este documento §6 |

**Regla de arquitectura:** `riskEvaluator.js` no se modifica desde Etapa 3. Los evaluadores nuevos lo envuelven a través de `hydroAdapter.js`.

### 5.1 Respaldo en vivo

Si el Blob no está disponible o no pasa la validación, la interfaz ejecuta `ejecutarEvaluacionRealEnVivo()`:

- Consulta los 14 nodos regionales con lotes de 4 peticiones.
- Evalúa con `evaluarLocalidad` (motor hidrológico).
- No usa el orquestador multiamenaza. Pendiente como H6.6 en `06_PENDIENTES.md`.
- Sus datos no pasan por Zod.

---

## 6. Endpoints

| Endpoint | Método | Autenticación | Función |
|---|---|---|---|
| `/api/sara` | GET | Pública | Estado vigente, bitácora y evaluaciones. Con `?forzar=true` requiere token de administración. |
| `/api/smn` | GET | Pública | Aviso oficial vigente del SMN (scraping del recuadro de alerta). |
| `/api/latest-gif` | GET | Pública | Resuelve la animación más reciente de GOES-19. |
| `/api/reporte-ondemand` | POST | Encabezados `x-admin-token` y `x-user-key` | Genera un reporte bajo demanda con el LLM. |
| `/api/disparar-workflow` | POST | Encabezado `x-cron-secret` | Dispara el runner en GitHub Actions. Lo invoca el planificador externo. |

**Riesgos abiertos de este diagrama** (detalle en `06_PENDIENTES.md`, sección "Riesgos activos"):
- `/api/sara` devuelve la bitácora y las evaluaciones completas en la consulta sin `forzar`. Es información operativa accesible sin autenticación.
- La interfaz lee el token de administración desde una variable `VITE_`, que se incluye en el código que descarga el navegador.

---

## 7. Almacenamiento (Vercel Blob)

| Archivo | Contenido | Quién escribe | Quién lee |
|---|---|---|---|
| `estado_diocesano.json` | Paquete maestro: semáforo y evaluación de 405 localidades | Runner | `/api/sara` |
| `bitacora_sara.json` | Registro encadenado con SHA-256 de cada corrida y reporte | Runner y `/api/reporte-ondemand` | `/api/sara` |
| `reporte_diocesano_vigente.json` | Último reporte oficial (diario o bajo demanda con 14/14 zonas) | Runner y `/api/reporte-ondemand` | `/api/sara` |

**Regla:** un reporte en modo emergencia (zonas incompletas) no reemplaza al vigente.

---

## 8. Contratos de datos (Zod)

**Archivo:** `src/schemas/estadoDiocesanoSchema.js`

| Esquema | Valida | Quién lo usa |
|---|---|---|
| `EstadoDiocesanoBlobSchema` | Paquete maestro antes de publicarlo | Runner |
| `EstadoDiocesanoResponseSchema` | Respuesta final de `/api/sara` | API |

Si la validación falla, el runner aborta la publicación y la API no entrega el Blob al frontend.

**Campos del orquestador** (opcionales, para compatibilidad con Blobs anteriores):

- `nivel_alerta_global`: entero de 1 a 4.
- `riesgo_continuo`: decimal de 1.0 a 4.0.
- `niveles_por_vector`: `{ hidrologico, viento, termico, convectivo }`.
- `acciones_operativas`: lista de textos.
- `diagnosticos_por_vector`: objeto libre.
- `datos_disponibles_por_vector`: `{ hidrologico, viento, termico, convectivo }` (booleanos).

**Adaptador de forma:** el orquestador devuelve `nivel_alerta_global`, pero el contrato anterior espera `nivel_alerta`. El runner copia el valor global en `nivel_alerta` y conserva los campos nuevos. Sin ese adaptador, Zod rechazaría el paquete (ADR-006).

---

## 9. Encodificación de texto

El runner guarda cadenas con codificación UTF-8 doble (por ejemplo, `ó` queda como `Ã³`). Como solución defensiva, `/api/sara` y `/api/reporte-ondemand` reparan el texto al leerlo, con `repararObjeto`, antes de enviarlo a la interfaz.

La causa en el runner no está resuelta. Pendiente como N22/N27 en `06_PENDIENTES.md`.

---

## 10. Deuda de arquitectura

| ID | Deuda | Referencia |
|---|---|---|
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. Propuesta: registro declarativo de evaluadores. | `06_PENDIENTES.md` |
| H-MOTOR-01 | El gemelo del motor hidrológico sigue separado del canónico. Unificación prevista para V3.0. | `06_PENDIENTES.md` |
| H6.6 | La interfaz pública no consume el desglose multiamenaza. | `06_PENDIENTES.md` |
| DEU-22 | Constante `TAMANO_LOTE` duplicada en tres archivos. | `06_PENDIENTES.md` |
| H-INFRA-01 | No existe `vercel.json`; el despliegue depende de la detección automática. | `06_PENDIENTES.md` |
