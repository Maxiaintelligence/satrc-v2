# SatRC V2.0 — Arquitectura

> **Versión del documento:** 2.6 (28/10/2026)
> **Alcance:** componentes, flujo de datos, endpoints, almacenamiento y contratos. El detalle de las reglas de riesgo está en `03_MOTOR_RIESGO.md`. Las decisiones que originaron esta arquitectura están en `08_DECISIONES.md`.

---

## 1. Capas y responsabilidades

| Capa | Responsabilidad | Dónde vive |
|---|---|---|
| Runner autónomo | Consulta modelos y avisos, evalúa las 405 localidades y publica el estado | `scripts/ejecutar_sara_autonomo.mjs` (GitHub Actions, cada 3 h) |
| Funciones serverless | Entregan el estado, generan reportes bajo demanda y reciben disparos externos | `api/` (Vercel Functions, Node 22) |
| Almacenamiento | Guarda el estado vigente, la bitácora y el último reporte | Google Drive (vía Google Apps Script) |
| Interfaz | Muestra el semáforo, los reportes y los mapas | `src/` (React 19, Vite 8, Tailwind 3) |
| Módulos compartidos | Lógica común entre frontend y backend, sin duplicados | `src/lib/compartido/` |

**Principio:** el frontend no calcula riesgo en condiciones normales. Su única fuente de verdad es el estado publicado en Google Drive. El cálculo en el navegador existe solo como respaldo cuando el almacenamiento no está disponible (ver §5). Bajo el principio de precisión (DEC-011), cualquier cálculo en el navegador debe reflejar el mismo criterio que el runner, y su desalineación actual es deuda activa (H-MULTI-06).

---

## 2. Flujo de datos

````text
Open-Meteo (GFS, ICON, GEM)     SMN / CONAGUA (avisos)     NOAA GOES-19 (imágenes)
            │                            │                          │
            ▼                            ▼                          │
┌──────────────────────────────────────────────────────┐            │
│ Runner (GitHub Actions, cada 3 h)                    │            │
│ 1. Aviso SMN                                         │            │
│ 2. Series por zona (14 nodos, lotes de 4)            │            │
│ 3. Consenso determinista compartido (GFS, ICON, GEM) │            │
│ 4. Evaluación multiamenaza (405 localidades)         │            │
│ 5. Validación Zod del paquete maestro                │            │
│ 6. Publicación en Google Drive + bitácora encadenada │            │
│ 7. Reporte diario (06:00 MX) → @vercel/blob (roto)   │            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           │
          Google Drive: estado_diocesano.json                       │
                        │  estado_ligero.json (semáforo + N3/N4)    │
                        │  bitacora_sara.json                       │
                        │  reporte_diocesano_vigente.json           │
                        ▼                                           │
┌──────────────────────────────────────────────────────┐            │
│ /api/sara: lee estado_ligero.json, repara, valida Zod│            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           ▼
     Interfaz (MonitorPublico, SatRCOperativo)  ◄──── /api/latest-gif
````

**Nota sobre el paso 7:** el reporte diario (`scripts/reportes/reporteDiario.mjs`) aún intenta escribir en Vercel Blob con `@vercel/blob`. Como `BLOB_READ_WRITE_TOKEN` no está configurado en `sara_cron.yml`, el reporte falla silenciosamente al escribir y el try/catch del runner lo absorbe (H-REPORTE-02, ver `06_PENDIENTES.md`).

Si `/api/sara` no puede validar los datos de Drive, la interfaz cae al cálculo en vivo (ver §5). El operador debe ver siempre un dato, aunque no sea el publicado.

---

## 3. Interfaz

### 3.1 Vistas

| Archivo | Función | Acceso |
|---|---|---|
| `MonitorPublico.jsx` | Monitor Climático: selector zona → municipio → localidad, pronóstico y gráficas | Abierto |
| `SatRCOperativo.jsx` | Sala Operativa: semáforo de 4 niveles, generación de reportes, auditoría | Clave de operador (vía endpoint backend) |
| `App.jsx` | Enrutamiento entre vistas y pantalla de acceso | — |

**Estado actual de la interfaz respecto al motor:**

- **Monitor Climático:** el semáforo N1 a N4 y el desglose por vector ya consumen el motor (H6.6, H-UI-01 y H-UI-03 cerrados, verificado en `06_PENDIENTES.md`). Sin embargo, el bloque "Síntesis de Situación Comunitaria" (`MonitorPublico.jsx`, sección 2 del componente) sigue usando un `if/else` hardcodeado (`lluviaTotalDia >= 20`) en lugar del motor. H-UI-02 queda parcialmente cerrado.
- **Sala Operativa:** muestra el desglose por vector (barras de `VectorBar.jsx`), las acciones operativas del motor y la bitácora multivectorial, desde Etapa 5.

### 3.2 Componentes de presentación

| Componente | Rol |
|---|---|
| `RiskMap.jsx` | Mapa de localidades con color por nivel de alerta |
| `SatelliteViewer.jsx` | Visor satelital GOES-19 (`/api/latest-gif`) |
| `VectorBar.jsx` | Barra de nivel continuo por vector, en la Sala Operativa |
| `ReporteModalOperativo.jsx` | Modal de reporte bajo demanda con exportación |
| `ReporteModalPublico.jsx` | Modal de reporte vigente para el público |
| `DisclaimerModal.jsx` | Deslinde institucional (Protección Civil / CONAGUA) |
| `OfficialAlertBanner.jsx` | Cinta del aviso vigente del SMN |

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
| `dictamen.js` | `generarTituloDictamen` y tabla `NOMBRES_VECTOR` con 8 entradas (7 vectores de amenaza + `SIN_AMENAZA`) | Interfaz (Etapa 5) |
| `bitacora.js` | `calcularNuevaEntradaBitacora`, `generarResumenMultivector` | API y Runner |
| `promptsMultivector.js` | `REGLAS_MULTIVECTOR` para los prompts de SARA | Reportes (Etapa 5) |
| `googleDrive.js` | `leerJSONBlob`, `escribirJSONBlob` (adaptador de Google Apps Script) | API y Runner |

**Nota de deuda:** la constante `TAMANO_LOTE = 4` aparece declarada en tres lugares (`scripts/ejecutar_sara_autonomo.mjs`, `src/engine/reportesRegionales.js`, `src/views/SatRCOperativo.jsx`). Viola el principio DRY (ADR-004). Ver DEU-22 en `06_PENDIENTES.md`.

---

## 5. Fallback en vivo

Cuando `/api/sara` no puede entregar el estado validado de Drive (por un fallo de red, un error de Apps Script o un rechazo del esquema Zod), la interfaz cae a un cálculo en el navegador para no dejar al operador sin datos.

**Implementación actual:**

- **Monitor Climático:** no calcula riesgo directamente. Solo muestra `evaluacionLocal` que viene de `/api/sara`. Si `/api/sara` falla, el componente conserva el último `evaluacionLocal` que recibió y no recalcula.
- **Sala Operativa:** ejecuta `ejecutarEvaluacionRealEnVivo()` cuando `data.evaluaciones` está vacío o la petición falla. Este método consulta Open-Meteo directamente desde el navegador (14 zonas, lotes de 4) y aplica solo el motor hidrológico (`evaluarLocalidad`).

**Limitaciones conocidas:**

- El fallback de la Sala Operativa no ejecuta el orquestador multiamenaza. Ignora los vectores de viento, térmico y convectivo (H-MULTI-06, ver `06_PENDIENTES.md`).
- Bajo el principio de precisión (DEC-011), el fallback no debe sobreestimar. Si en el futuro se amplía al orquestador, debe respetar los mismos umbrales y el mismo contrato de nivel continuo.
- El fallback no valida con Zod el estado que construye. Si el motor cambia de contrato, el fallback podría devolver formas incompatibles con la interfaz sin que nadie lo detecte.

**Regla de operación:** el operador debe ver siempre un dato, aunque no sea el publicado. El indicador `origen: RESPUESTA_EN_VIVO` de `/api/sara` señala que se está mostrando el fallback y no el estado publicado.

---

## 6. Endpoints

| Endpoint | Método | Autenticación | Función |
|---|---|---|---|
| `/api/sara` | GET | Pública | Estado vigente, bitácora y evaluaciones. Con `?forzar=true` requiere token de administración (`x-admin-token`). |
| `/api/smn` | GET | Pública | Aviso oficial vigente del SMN (scraping del recuadro de alerta). |
| `/api/latest-gif` | GET | Pública | Resuelve la animación más reciente de GOES-19. |
| `/api/reporte-ondemand` | POST | Encabezado `x-user-key` | Genera un reporte bajo demanda con el LLM. |
| `/api/disparar-workflow` | POST | Encabezado `x-cron-secret` | Dispara el runner en GitHub Actions. Lo invoca el planificador externo. |
| `/api/auth-operativo` | POST | Pública (valida clave) | Verifica la clave de acceso a la Sala Operativa contra `CLAVE_SALA_OPERATIVA`. |

**Riesgos abiertos de este diagrama** (detalle en `06_PENDIENTES.md`, sección "Riesgos activos"):

- **R-03:** `/api/sara` devuelve la bitácora y las evaluaciones completas en la consulta sin forzar. Es información operativa accesible sin autenticación. Requiere restringir la respuesta o exigir autenticación.

(Los riesgos R-01, R-02 y R-04 ya fueron mitigados el 27/10/2026).

---

## 7. Almacenamiento (Google Drive)

Los archivos se guardan en una carpeta de Google Drive llamada `SatRC_Datos`, accesible mediante Google Apps Script. El adaptador `googleDrive.js` hace las peticiones HTTP para leer y escribir.

| Archivo | Contenido | Quién escribe | Quién lee |
|---|---|---|---|
| `estado_diocesano.json` | Paquete maestro completo: semáforo, dictamen y evaluación de las 405 localidades | Runner | Auditoría manual (no lo lee `/api/sara`) |
| `estado_ligero.json` | Paquete ligero: semáforo, dictamen, series por zona y solo localidades en N3/N4 (o `null` si no hay) | Runner | `/api/sara` |
| `bitacora_sara.json` | Registro encadenado con SHA-256 de cada corrida, reporte y reporte diario | Runner, `/api/reporte-ondemand` y `/api/sara` | `/api/sara` |
| `reporte_diocesano_vigente.json` | Último reporte oficial (diario o bajo demanda con 14/14 zonas) | Runner (aún en Vercel Blob por H-REPORTE-02) y `/api/reporte-ondemand` (Drive) | `/api/sara` |

**Regla:** un reporte en modo emergencia (zonas incompletas) no reemplaza al vigente. Esta regla se aplica en `api/reporte-ondemand.js` mediante la condición `if (!esParcialReal)` antes del `escribirJSONBlob` del reporte vigente.

**Notas de deuda sobre `estado_ligero.json`:**

- Cuando no hay localidades en N3/N4, el runner escribe `evaluaciones: null` (no `[]`). `/api/sara` interpreta `null` como "sin evaluaciones que mostrar" y cae al fallback en vivo en días tranquilos (H-SARA-02 / H-DRIVE-02, ver `06_PENDIENTES.md`).
- `estado_ligero.json` no se valida con un schema Zod propio antes de publicar. Solo se valida `estado_diocesano.json` (el maestro). Si el paquete ligero se corrompe, `/api/sara` lo detecta recién al validar la respuesta final, y para entonces ya cayó al fallback.

---

## 8. Contratos de datos (Zod)

Los contratos viven en `src/schemas/estadoDiocesanoSchema.js` y se usan en dos puntos de la cadena:

| Schema | Qué valida | Dónde se usa |
|---|---|---|
| `EstadoDiocesanoBlobSchema` | El paquete maestro que el runner escribe en `estado_diocesano.json`. Requiere `semaforo`, `hora_local_mexico` y `evaluaciones` (arreglo de al menos 1 o `null`). | Runner, antes de publicar en Drive. |
| `EstadoDiocesanoResponseSchema` | La respuesta final que `/api/sara` entrega al frontend. Extiende el schema del blob con `origen`, `bitacora`, `ultimo_reporte_ondemand` y `hora_servidor_mexico`. | `/api/sara`, antes de responder al cliente. |

**Sub-esquema `EvaluacionSchema`:** cada localidad incluye `localidad_id`, `nombre`, `municipio`, `estado`, `zona_id`, `nivel_alerta` (1-4), `color_alerta`, `estado_alerta`, `diagnostico`, `donde`, `geografia`, `tiempos`, `impactoSistemico`, y los campos opcionales del orquestador (`nivel_alerta_global`, `riesgo_continuo`, `niveles_por_vector`, `datos_disponibles_por_vector`, `acciones_operativas`, `diagnosticos_por_vector`). Usa `.passthrough()` para tolerar campos nuevos que el orquestador agregue en el futuro.

**Deudas del contrato:**

- **H-SCHEMA-02 / H-DRIVE-02:** no existe `EstadoDiocesanoLigeroSchema`. El paquete ligero que sirve `/api/sara` viaja sin validación previa al almacenamiento. Se detecta recién en la validación de `EstadoDiocesanoResponseSchema`, cuando la interfaz ya está en camino al fallback.
- **H-SCHEMA-01:** `EstadoDiocesanoBlobSchema` declara `schema_version` con `.default("2.1.0")`, pero el runner no emite ese campo. Cualquier migración futura basada en `schema_version` no funcionará.
- **H-TEST-11:** `datos_disponibles_por_vector` (arreglo booleano por vector) viaja en el contrato pero no tiene prueba de valor y rango en `estadoDiocesanoSchema.test.js`. Viola H-TEST-05.

---

## 9. Deuda de arquitectura

| ID | Deuda | Referencia |
|---|---|---|
| H-REPORTE-02 | `scripts/reportes/reporteDiario.mjs` sigue usando `@vercel/blob` para escribir el reporte diario. Como `BLOB_READ_WRITE_TOKEN` no está configurado en `sara_cron.yml`, el reporte falla silenciosamente al escribir. Debe migrarse al adaptador `googleDrive.js`. | `06_PENDIENTES.md` |
| H-DRIVE-01 | `googleDrive.escribirJSONBlob` devuelve `null` en caso de fallo sin propagar el error. El runner no verifica el valor devuelto y siempre imprime "✅ Publicación exitosa". Un fallo de Drive queda invisible. | `06_PENDIENTES.md` |
| H-DRIVE-02 / H-SCHEMA-02 | `estado_ligero.json` se escribe sin un schema Zod propio y puede contener `evaluaciones: null`, lo que dispara el fallback en días tranquilos. | `06_PENDIENTES.md` |
| H-MULTI-06 | El fallback en vivo de la Sala Operativa usa solo el motor hidrológico. Ignora viento, térmico y convectivo. | `06_PENDIENTES.md`, §5 |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos (`crossThreatOrchestrator.js`, `estadoDiocesanoSchema.js`, `bitacora.js`, `dictamen.js`, `promptsMultivector.js`, `MonitorPublico.jsx`, `SatRCOperativo.jsx`). Propuesta: registro declarativo de evaluadores. | `06_PENDIENTES.md` |
| H-MOTOR-01 | El gemelo del motor hidrológico (`scripts/engine/riskEvaluatorRunner.mjs`) sigue separado del canónico (`src/engine/riskEvaluator.js`). Unificación prevista para V3.0. | `06_PENDIENTES.md` |
| DEU-22 | Constante `TAMANO_LOTE = 4` duplicada en tres archivos. | `06_PENDIENTES.md` |
| H-INFRA-01 | No existe `vercel.json`; el despliegue depende de la detección automática. | `06_PENDIENTES.md` |

**Cerrado en esta versión:** H6.6 (Monitor Público ya consume el desglose multiamenaza) se retira de esta lista. H-UI-02 se reformula como parcialmente cerrado y se mantiene en `06_PENDIENTES.md` §2.3. H-RUNNER-01 se retira: el runner ya usa Drive. Su deuda real se registra como H-REPORTE-02 en esta tabla.