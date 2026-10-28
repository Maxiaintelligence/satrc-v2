# SatRC V2.0 — Arquitectura

> **Versión del documento:** 2.5 (27/10/2026)
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

**Principio:** el frontend no calcula riesgo en condiciones normales. Su única fuente de verdad es el estado publicado en Google Drive. El cálculo en el navegador existe solo como respaldo cuando el almacenamiento no está disponible (ver §5).

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
│ 6. Publicación en Google Drive + bitácora encadenada │            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           │
          Google Drive: estado_diocesano.json                       │
                        │  bitacora_sara.json                       │
                        │  reporte_diocesano_vigente.json           │
                        ▼                                           │
┌──────────────────────────────────────────────────────┐            │
│ /api/sara: lee, repara codificación, valida con Zod  │            │
└───────────────────────┬──────────────────────────────┘            │
                        ▼                                           ▼
     Interfaz (MonitorPublico, SatRCOperativo)  ◄──── /api/latest-gif
```

Si `/api/sara` no puede validar los datos de Drive, la interfaz cae al cálculo en vivo (ver §5). El operador debe ver siempre un dato, aunque no sea el publicado.

---

### 3.1 Vistas

| Archivo | Función | Acceso |
|---|---|---|
| `MonitorPublico.jsx` | Monitor Climático: selector zona → municipio → localidad, pronóstico y gráficas | Abierto |
| `SatRCOperativo.jsx` | Sala Operativa: semáforo de 4 niveles, generación de reportes, auditoría | Clave de operador (vía endpoint backend) |
| `App.jsx` | Enrutamiento entre vistas y pantalla de acceso | — |

**Estado actual de la interfaz respecto al motor:**
- El Monitor Climático ya muestra el semáforo N1 a N4 y el desglose por vector (H6.6, H-UI-01 y H-UI-03 cerrados). Sin embargo, su texto de diagnóstico sigue usando `if/else` en lugar del motor (H-UI-02).
- La Sala Operativa muestra el desglose por vector (barras de `VectorBar.jsx`) y las acciones operativas, desde Etapa 5.

*(Sección 3.2 Componentes sin cambios).*

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
| `bitacora.js` | Resumen multivector de la bitácora y cálculo de nuevos hashes | API y Runner |
| `promptsMultivector.js` | Reglas `REGLAS_MULTIVECTOR` para los prompts de SARA | Reportes (Etapa 5) |
| `googleDrive.js` | `leerJSONBlob`, `escribirJSONBlob` (Adaptador de Google Apps Script) | API y Runner |

> **Nota:** la constante de tamaño de lote (`TAMANO_LOTE = 4`) aparece declarada en tres lugares: el runner, `reportesRegionales.js` y `SatRCOperativo.jsx`. Es una violación del principio DRY. Ver DEU-22 en `06_PENDIENTES.md`.

---

## 6. Endpoints

| Endpoint | Método | Autenticación | Función |
|---|---|---|---|
| `/api/sara` | GET | Pública | Estado vigente, bitácora y evaluaciones. Con `?forzar=true` requiere token de administración. |
| `/api/smn` | GET | Pública | Aviso oficial vigente del SMN (scraping del recuadro de alerta). |
| `/api/latest-gif` | GET | Pública | Resuelve la animación más reciente de GOES-19. |
| `/api/reporte-ondemand` | POST | Encabezado `x-user-key` | Genera un reporte bajo demanda con el LLM. |
| `/api/disparar-workflow` | POST | Encabezado `x-cron-secret` | Dispara el runner en GitHub Actions. Lo invoca el planificador externo. |
| `/api/auth-operativo` | POST | Pública (valida clave) | Verifica la clave de acceso a la Sala Operativa contra `CLAVE_SALA_OPERATIVA`. |

**Riesgos abiertos de este diagrama** (detalle en `06_PENDIENTES.md`, sección "Riesgos activos"):
- `/api/sara` devuelve la bitácora y las evaluaciones completas en la consulta sin `forzar`. Es información operativa accesible sin autenticación (R-03).

*(Los riesgos R-01, R-02 y R-04 ya fueron mitigados en la sesión del 27/10/2026).*

---

## 7. Almacenamiento (Google Drive)

Los archivos se guardan en una carpeta de Google Drive llamada `SatRC_Datos`, accesible mediante Google Apps Script. El adaptador `googleDrive.js` hace las peticiones HTTP para leer y escribir.

| Archivo | Contenido | Quién escribe | Quién lee |
|---|---|---|---|
| `estado_diocesano.json` | Paquete maestro: semáforo y evaluación de 405 localidades | Runner | `/api/sara` |
| `bitacora_sara.json` | Registro encadenado con SHA-256 de cada corrida y reporte | Runner, `/api/reporte-ondemand` y `/api/sara` | `/api/sara` |
| `reporte_diocesano_vigente.json` | Último reporte oficial (diario o bajo demanda con 14/14 zonas) | Runner y `/api/reporte-ondemand` | `/api/sara` |

**Regla:** un reporte en modo emergencia (zonas incompletas) no reemplaza al vigente.

---

## 10. Deuda de arquitectura

| ID | Deuda | Referencia |
|---|---|---|
| H-RUNNER-01 | El runner (`ejecutar_sara_autonomo.mjs`) sigue intentando usar Vercel Blob en lugar del adaptador de Google Drive. | `06_PENDIENTES.md` |
| H-ARCH-01 | Agregar un quinto evaluador exige tocar siete archivos. Propuesta: registro declarativo de evaluadores. | `06_PENDIENTES.md` |
| H-MOTOR-01 | El gemelo del motor hidrológico sigue separado del canónico. Unificación prevista para V3.0. | `06_PENDIENTES.md` |
| H6.6 | La interfaz pública no consume el desglose multiamenaza. | `06_PENDIENTES.md` |
| DEU-22 | Constante `TAMANO_LOTE` duplicada en tres archivos. | `06_PENDIENTES.md` |
| H-INFRA-01 | No existe `vercel.json`; el despliegue depende de la detección automática. | `06_PENDIENTES.md` |

