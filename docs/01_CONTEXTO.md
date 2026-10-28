# SatRC V2.0 — Registro de decisiones

> **Versión del documento:** 2.6 (28/10/2026)
> **Propósito:** explicar por qué el sistema está diseñado como está. Cada decisión tiene contexto, decisión, consecuencias y estado.
> **Regla:** una decisión nueva se agrega al final con el siguiente número. Una decisión se reemplaza con otra nueva; no se edita la original para cambiar su sentido.

---

## Parte A. Decisiones de arquitectura

### ADR-001: Catorce nodos regionales de referencia

- **Estado:** vigente.
- **Contexto:** en la primera versión, las 405 localidades se evaluaban con el pronóstico de un solo nodo (Huauchinango). Eso produjo falsas alarmas en el Altiplano por lluvias que solo caían en la Sierra.
- **Decisión:** dividir el territorio en 14 zonas de resguardo. Cada zona usa su localidad más poblada como nodo.
- **Evidencia:** auditoría del motor de octubre de 2026, con simulación de nodos y el caso de Pachuca (anexo D de la auditoría archivada en `docs/archivo/`). Eliminó el 86 % de las falsas emergencias N4 de la simulación.
- **Consecuencias:** cada zona depende de un solo nodo. Si el nodo no tiene datos, la zona completa queda sin evaluar, por eso existe el reintento por lotes (ver `02_ARQUITECTURA.md`).

### ADR-002: Consenso determinista de modelos (GFS, ICON y GEM)

- **Estado:** vigente.
- **Decisión:** calcular la mediana hora por hora entre los tres modelos, con filtro de ceros espurios en la lluvia. En Etapa 4 se agregaron ocho variables con estrategias propias: mediana para las de superficie, máximo para CAPE y viento en 700 hPa, y GFS preferente para la altura de congelación (GEM la devuelve nula).
- **Consecuencias:** el resultado es reproducible para las mismas entradas. El proceso autónomo ya utiliza el consenso compartido (H-MULTI-01 cerrado el 22/10/2026).

### ADR-003: Bitácora con encadenamiento criptográfico

- **Estado:** vigente.
- **Decisión:** cada registro incluye el hash del registro anterior y su propio hash SHA-256. El primer registro encadena con un bloque génesis de ceros.
- **Consecuencias:** cualquier alteración de un registro anterior se detecta, porque cambia todos los hashes posteriores. La cadena **no impide** la alteración; solo la hace visible. La bitácora ahora se almacena en Google Drive (vía Apps Script), un servicio externo. La integridad depende de que quien revisa recalcule la cadena.

### ADR-004: Módulos compartidos (DRY)

- **Estado:** vigente, con una excepción pendiente.
- **Decisión:** la lógica común entre frontend y backend vive en `src/lib/compartido/`, con una sola fuente.
- **Excepción:** la constante de tamaño de lote aparece en tres archivos (DEU-22) y el parser del SMN está duplicado (DEU-29). Ambas son deuda abierta.

### ADR-005: Orquestador multiamenaza con acoplamiento no lineal

- **Estado:** vigente, con calibración pendiente bajo DEC-011.
- **Contexto:** un criterio de máximo (`Math.max` entre vectores) subestima las combinaciones. Dos amenazas moderadas simultáneas (por ejemplo, suelo saturado y viento) producen un efecto mayor que cada una por separado.
- **Decisión:** el riesgo global es el máximo de los cuatro vectores más un término de acoplamiento por pares, con la forma `γ · (r_i − 1) · (r_j − 1)`.
- **Coeficientes vigentes:** los definidos en el código (`crossThreatOrchestrator.js`): hidrológico–viento 0.20, hidrológico–térmico 0.15, convectivo–viento 0.30, térmico–hidrológico 0.10 y viento–térmico 0.05.
- **Consecuencias:** los coeficientes son una decisión de diseño sin validación empírica todavía. **Bajo el principio de precisión (DEC-011), el acoplamiento aditivo es una fuente potencial de sobreestimación** que debe validarse contra eventos reales. Revisarlos cuando exista un registro de eventos reales (PEND-03).

### ADR-006: Adaptador de forma en el proceso autónomo

- **Estado:** vigente.
- **Contexto:** el orquestador entrega `nivel_alerta_global`, pero el esquema de validación y la interfaz esperan `nivel_alerta`.
- **Decisión:** el proceso autónomo copia el valor global en `nivel_alerta` y conserva los campos nuevos como opcionales. Si el orquestador falla para una localidad, se usa el motor hidrológico anterior para esa localidad.
- **Consecuencias:** un fallo del orquestador en una localidad no detiene la publicación, pero **no queda registrado** como degradación.

### ADR-007: Umbral de viento según altitud

- **Estado:** vigente.
- **Contexto:** en la auditoría H6.4, 47 localidades de Pachuca aparecían en N2 sin justificación. El viento basal de la sierra es más fuerte que el de los valles.
- **Decisión:** por encima de 2 200 msnm, los umbrales de viento suben 5 km/h. El cálculo también normaliza la ráfaga a densidad de nivel del mar.
- **Consecuencias:** coexisten dos mecanismos (densidad y altitud). Bajo DEC-011, la coexistencia debe revisarse si produce falsos positivos en zonas de altura.

### ADR-008: Nivel continuo con topes por nivel discreto

- **Estado:** vigente.
- **Contexto:** los evaluadores emiten un valor continuo que el orquestador compara entre vectores. Un valor continuo fuera del rango de su nivel discreto produjo falsos positivos (H-ORQ-02 y H-ORQ-03).
- **Decisión:** cada evaluador devuelve un valor continuo dentro de `[nivel, nivel + 0.99]`, y el mapeo a nivel global usa umbrales de 2.0, 3.0 y 4.0.
- **Consecuencias:** esta regla se ha verificado en todos los evaluadores, incluido el térmico (H-TERM-01 cerrado el 24/10/2026).

### ADR-009: Migración del almacenamiento a Google Drive

- **Estado:** vigente (27/10/2026).
- **Contexto:** Vercel Blob en el plan Hobby suspendió la tienda de datos por superar el límite de "Advanced Operations" (2,000/mes). Esto provocó errores 500 (FUNCTION_INVOCATION_FAILED) en la API y bloqueó el sistema en producción.
- **Decisión:** migrar todo el almacenamiento (estado diocesano, bitácora y reporte vigente) a Google Drive, utilizando Google Apps Script como puente (API Web). Se creó el adaptador `src/lib/compartido/googleDrive.js`.
- **Consecuencias:**
  - La aplicación ya no depende de Vercel Blob, eliminando el límite de operaciones y el riesgo de suspensión.
  - El almacenamiento es 100 % gratuito y persistente.
  - Se agregó una nueva variable de entorno crítica: `GOOGLE_SCRIPT_URL`.
  - El runner (`ejecutar_sara_autonomo.mjs`) fue migrado a Drive. Sin embargo, `reporteDiario.mjs` aún usa `@vercel/blob` (H-REPORTE-02, ver `06_PENDIENTES.md`).
  - El adaptador `escribirJSONBlob` devuelve `null` en caso de fallo sin propagar el error. El runner no verifica el valor devuelto (H-DRIVE-01).

---

## Parte B. Decisiones de alcance y proceso

### DEC-001: Presupuesto cero

- **Estado:** vigente.
- **Decisión:** el sistema opera solo con servicios gratuitos o de dominio público. No hay servidores de pago, licencias comerciales ni suscripciones.
- **Consecuencias:** dependencia de los límites de planes gratuitos (DEU-19). La migración a Google Drive (ADR-009) es una consecuencia directa de esta decisión.

### DEC-002: Preferencia por el falso positivo

- **Estado:** reemplazada por DEC-011 (28/10/2026).
- **Decisión (histórica):** ante la duda, el sistema alerta. Una alerta innecesaria tiene un costo bajo; una alerta omitida puede costar una vida.
- **Consecuencias (históricas):** el semáforo puede sobreestimar. Las decisiones de calibración debían mantener este criterio.
- **Nota de reemplazo:** el criterio se sustituye por DEC-011. El texto original se conserva por trazabilidad histórica; el principio vigente es la precisión sobre la cobertura.

### DEC-003: Subordinación a las autoridades

- **Estado:** vigente.
- **Decisión:** el sistema traduce avisos oficiales y recomienda acciones; no emite avisos ni ordena evacuaciones. Las determinaciones de Protección Civil y de CONAGUA prevalecen.
- **Consecuencias:** el texto de los reportes y el aviso de disclaimer deben mantener este deslinde.

### DEC-004: Verificación en producción, no solo en local

- **Estado:** vigente.
- **Decisión:** la verificación funcional se hace en GitHub Actions y Vercel, porque el entorno local no tiene almacenamiento ni acceso al modelo de redacción.
- **Consecuencias:** cada cambio que afecte al proceso autónomo se valida con una corrida manual y con verificación del timestamp del archivo en Google Drive (ver `00_METODOLOGIA.md` Fase 4).

### DEC-005: Un commit por causa y pruebas antes de publicar

- **Estado:** vigente.
- **Decisión:** cada commit atiende una sola causa, y `npm test` debe pasar antes del push. Los hitos grandes se dividen en commits atómicos.
- **Consecuencias:** historial más largo, pero reversible por partes.

### DEC-006: Verificar la API antes de codificar contra ella

- **Estado:** vigente.
- **Decisión:** antes de usar una variable o un endpoint externo, se comprueba con una llamada real. Esta regla nació del hallazgo de H-E4-01 y se reforzó durante la migración a Google Drive.
- **Consecuencias:** cada nueva integración externa incluye una verificación empírica documentada.

### DEC-007: Etapa 3 es deuda técnica, no Versión 3.0

- **Estado:** vigente.
- **Decisión:** la Etapa 3 se dedicó a cerrar deuda, pruebas y documentación, sin funciones nuevas. Las funciones nuevas (autenticación real, nuevos vectores, percentiles históricos) quedan para la Versión 3.0.
- **Consecuencias:** los identificadores de etapa deben escribirse con su prefijo para evitar confusión (`E3-H5` frente a `E5-H5.0`).

### DEC-008: Repositorio público mientras se ejecute con cuentas gratuitas

- **Estado:** vigente, con condiciones.
- **Decisión (22/10/2026):** el repositorio permanece público. Motivos: el presupuesto es cero, y las corridas automáticas y el despliegue funcionan igual con repositorio privado. El plan gratuito de GitHub cubre 2 000 minutos al mes para repositorios privados.
- **Condiciones actualizadas (27/10/2026):**
  1. Las claves expuestas en el código ya fueron rotadas y movidas a variables de entorno (R-01, R-02, R-04 cerrados).
  2. Confirmar que las corridas de `sara_cron.yml` se mantienen dentro del límite mensual.
- **Revisión:** cuando cambie cualquiera de las condiciones.

### DEC-009: Documentación en español, con numeración fija

- **Estado:** vigente.
- **Decisión:** la documentación se mantiene en español. La numeración de `00` a `09` se conserva; `08` es el registro de decisiones.
- **Consecuencias:** los documentos archivados quedan en `docs/archivo/` y no se citan como vigentes.

### DEC-010: Documentación para quien retoma el proyecto con ayuda de IA

- **Estado:** vigente.
- **Decisión:** existe un punto de entrada (`LEEME_PRIMERO.md`) que resume el estado y define el orden de lectura. Cada documento declara su fuente de verdad (el código).
- **Consecuencias:** cuando un documento y el código no coinciden, prevalece el código, y la diferencia se registra en `06_PENDIENTES.md`.

### DEC-011: Precisión sobre cobertura

- **Estado:** vigente (28/10/2026). Reemplaza a DEC-002.
- **Contexto:** en versiones anteriores se emitían alertas de Nivel 3 cuando en las localidades no estaba ocurriendo ningún evento meteorológico relevante. La política anterior ("preferencia por el falso positivo") priorizaba la cobertura sobre la precisión. El resultado fue ruido: las comunidades aprendieron a desconfiar de las alertas porque muchas no se materializaban. Un sistema que alerta en exceso pierde eficacia real cuando el evento grave sí ocurre ("efecto del niño que gritó lobo").
- **Decisión:** el principio rector del sistema es la precisión sobre la cobertura. **Una alerta debe corresponder a un evento real.** Ante la duda, el sistema prioriza la verificación empírica antes que la emisión preventiva. La confiabilidad de la PWA se mide por cuántas alertas emitidas se materializan, no por cuántas alertas se emiten.
- **Consecuencias:**
  1. **Calibración de umbrales.** Los umbrales del motor deben revisarse para eliminar falsos positivos conocidos: H-MOTOR-05 (sobreclasificación N2 en XIC, HUA, ZAC) y H-DIAG-04 (motor no calibrado para esas zonas) pasan de 🟡 media a 🔴 crítica.
  2. **Acoplamiento del orquestador (ADR-005).** Los coeficientes γ del orquestador son aditivos y por lo tanto sobreestiman. Bajo DEC-011, deben validarse contra eventos reales antes de considerarse cerrados (PEND-03 se vuelve prioritario).
  3. **Trade-off aceptado.** Se acepta un aumento controlado de falsos negativos como costo de reducir falsos positivos. Este trade-off se evalúa empíricamente, no por intuición.
  4. **Verificación empírica.** Todo cambio en el motor debe acompañarse de un caso de prueba que demuestre que la alerta emitida corresponde a un evento real (documentado en `00_METODOLOGIA.md` Fase 3 y en `03_MOTOR_RIESGO.md`).
  5. **Métrica de confiabilidad.** Se propone medir, en cada corrida, la proporción de localidades N3/N4 que efectivamente registraron un evento meteorológico en las 24 horas siguientes. Esta métrica se vuelve parte del monitoreo operativo.

---

## Parte C. Decisiones pendientes

| ID | Pregunta | Quién decide |
|---|---|---|
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? Bajo DEC-011 esta calibración es prioritaria. | Coordinación técnica y pastoral |
| PEND-04 | ¿Se migrará el runner a un modelo de ejecución que no dependa de GitHub Actions (por ejemplo, Vercel Cron)? | Coordinación técnica |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad (porcentaje de alertas que se materializan) que cierra DEC-011? | Coordinación técnica y pastoral |

---

# SatRC V2.0 — Contexto, principios y glosario

> **Versión del documento:** 2.6 (28/10/2026)
> **Audiencia:** personas que coordinan, operan o mantienen el sistema, y asistentes de IA que retoman el proyecto.

---

## 1. Qué es SatRC

SatRC (Sistema de Alerta Temprana y Riesgos Climáticos) es una aplicación web progresiva diseñada para la Cáritas Pastoral Social de la Arquidiócesis de Tulancingo. Su propósito es apoyar la protección de la vida y del patrimonio de comunidades rurales frente a amenazas meteorológicas: lluvias intensas, deslaves, inundaciones, vientos fuertes, temperaturas extremas y tormentas convectivas.

**En una frase:** consensúa datos de modelos meteorológicos abiertos y avisos oficiales en un semáforo diocesano de cuatro niveles, con reportes redactados con apoyo de IA y una bitácora con encadenamiento criptográfico.

---

## 2. Principios

- **Subordinación institucional.** SatRC no sustituye a Protección Civil ni a CONAGUA. Traduce y orienta; las determinaciones oficiales prevalecen siempre.
- **Precisión sobre cobertura (DEC-011, 28/10/2026).** Una alerta debe corresponder a un evento real. Los falsos positivos erosionan la confianza de las comunidades y hacen que ignoren las alertas verdaderas. El sistema prefiere no alertar antes que alertar sin fundamento verificable. La precisión es la condición para que la PWA sea confiable. Este principio reemplaza al anterior de "preferencia por el falso positivo" (DEC-002, histórico).
- **Trazabilidad.** Cada acción del sistema (corrida automática, reporte bajo demanda, reporte diario) deja un registro en la bitácora, encadenado con SHA-256.
- **Transparencia.** Las decisiones de diseño y sus límites están documentados en `08_DECISIONES.md`.

---

## 3. Usuarios

1. **Operadores diocesanos.** Coordinadores de Cáritas con acceso a la Sala Operativa, protegida por clave personal. Generan reportes, consultan el semáforo y la bitácora.
2. **Público general.** Párrocos, brigadistas y personas de las comunidades. Consultan el Monitor Climático para conocer la situación de su localidad.
3. **Sistema autónomo.** Un proceso automatizado que se ejecuta cada 3 horas, sin intervención humana, y publica el estado diocesano.

---

## 4. Alcance geográfico

- **405 localidades** en Hidalgo, la Sierra Norte de Puebla y laderas limítrofes de Veracruz. Fueron seleccionadas históricamente con el criterio de población mayor a 1,000 habitantes al generar el catálogo (`localidades_crudo.csv`); el JSON de producción (`src/data/localidades.json`) no conserva ese campo por localidad. La población se usa al construir los 14 nodos regionales.
- **14 zonas de resguardo**, cada una con un nodo meteorológico de referencia: la localidad más poblada de la zona (ver ADR-001 en `08_DECISIONES.md`).

| Grupo | Zonas |
|---|---|
| Altiplano (5) | ACT, APN, PMN, PMS, TIZ |
| Sierra (9) | ATG, CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH |

---

## 5. Amenazas evaluadas

El sistema evalúa cuatro vectores de riesgo, cada uno en su propio módulo:

| Vector | Qué evalúa | Módulo |
|---|---|---|
| Hidrológico | Lluvia acumulada, saturación del suelo, pendiente, cauces, aislamiento vial, niebla (visibilidad) | `riskEvaluator.js` e `hydroAdapter.js` |
| Viento | Ráfagas normalizadas a densidad de nivel del mar, con umbral por altitud | `windEvaluator.js` |
| Térmico | Heladas, frío extremo, nevadas, calor extremo | `thermalEvaluator.js` |
| Convectivo | Granizo, downbursts, supercélulas | `convectiveEvaluator.js` |

Un orquestador combina los cuatro vectores con un término de acoplamiento: dos amenazas moderadas simultáneas pueden elevar el nivel más de lo que lo haría cada una por separado. Detalle en `03_MOTOR_RIESGO.md`. **Bajo el principio de precisión (DEC-011), los coeficientes de acoplamiento son una fuente potencial de sobreestimación y están pendientes de validación empírica** (ADR-005, PEND-03 en `08_DECISIONES.md`).

---

## 6. Límites del sistema

- **No emite avisos oficiales.** Traduce los avisos de CONAGUA y de Protección Civil.
- **No ordena evacuaciones.** Recomienda acciones.
- **No predice el clima.** Consensúa salidas de modelos existentes.
- **No reemplaza a las autoridades** de Protección Civil ni de CONAGUA.
- **Prefiere no alertar antes que alertar sin fundamento.** Ver principio de precisión en §2 y DEC-011 en `08_DECISIONES.md`. Un falso positivo tiene un costo real: erosión de la confianza comunitaria. El sistema acepta un aumento controlado de falsos negativos como trade-off.

---

## 7. Restricciones de diseño

- **Presupuesto cero.** El proyecto es una iniciativa sin financiamiento recurrente. Todo el sistema opera con planes gratuitos o servicios de dominio público. Un cambio en los límites de esos planes puede afectar la operación; ver DEU-19 en `06_PENDIENTES.md`. La suspensión de Vercel Blob (H-VERCEL-01, 27/10/2026, ya cerrado) fue un ejemplo real de este riesgo y se resolvió con la migración a Google Drive (ADR-009).
- **Sin servidores propios.** El despliegue usa servicios administrados.
- **Entorno local validado.** El proyecto cuenta con un archivo `.env.local` (protegido por `.gitignore`) que permite ejecutar pruebas profundas de los endpoints, adaptadores y lógica del motor con credenciales reales. La verificación funcional final se sigue haciendo en GitHub Actions y en Vercel para confirmar el comportamiento en el ecosistema real.

---

## 8. Arquitectura en una vista

````text
┌──────────────────────────────────────────────────────────────┐
│ Interfaz web (React 19 + Vite 8 + Tailwind 3)                │
│ Monitor Climático (público) · Sala Operativa (operadores)    │
│ Hosting: Vercel                                              │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Funciones serverless (Node 22) en api/                       │
│ sara · smn · latest-gif · reporte-ondemand · disparar-workflow│
│ Validación de contratos con Zod                              │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Proceso autónomo (GitHub Actions, cada 3 horas)              │
│ scripts/ejecutar_sara_autonomo.mjs                           │
│ Disparado por cron-job.org a través de /api/disparar-workflow│
│ Reporte diario automático (06:00, hora de México)            │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Almacenamiento (Google Drive vía Apps Script)                │
│ estado_diocesano.json · estado_ligero.json ·                 │
│ bitacora_sara.json · reporte_diocesano_vigente.json          │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Datos externos                                               │
│ Open-Meteo (modelos GFS, ICON, GEM) · Groq (IA) ·            │
│ SMN/CONAGUA (avisos) · NOAA GOES-19 (imágenes satelitales)   │
└──────────────────────────────────────────────────────────────┘
````

Detalle de componentes y contratos en `02_ARQUITECTURA.md`.

---

## 9. Glosario

| Término | Significado |
|---|---|
| SatRC | Nombre del sistema. |
| Monitor Climático | Vista pública de la aplicación. Archivo: `MonitorPublico.jsx`. |
| Sala Operativa | Vista protegida para operadores diocesanos. Archivo: `SatRCOperativo.jsx`. |
| Zona de resguardo | Agrupación de localidades que comparten un nodo meteorológico de referencia. Son 14. |
| Nodo | Localidad más poblada de una zona, cuyo pronóstico representa a la zona. |
| Semáforo / nivel de alerta | Clasificación de 1 a 4: 1 Normal, 2 Vigilancia, 3 Alerta temprana, 4 Emergencia. |
| Vector | Tipo de amenaza evaluada: hidrológico, viento, térmico o convectivo. |
| Acoplamiento | Efecto combinado de dos vectores simultáneos, calculado por el orquestador. Coeficientes pendientes de validación empírica (ADR-005, PEND-03). |
| Precisión sobre cobertura | Principio rector vigente (DEC-011, 28/10/2026). Una alerta debe corresponder a un evento real. Reemplaza a "preferencia por el falso positivo" (DEC-002, histórico). |
| SARA | Agente de redacción de reportes con IA (modelo gpt-oss-120b en Groq). Sus siglas significan "Sistema de Alerta y Respuesta Automatizada". |
| Bitácora | Registro de cada corrida y reporte, encadenado con hashes SHA-256. |
| Google Drive (Adaptador) | Almacenamiento de archivos (.json) vía Google Apps Script. Reemplazó a Vercel Blob por límites del plan gratuito (ADR-009, 27/10/2026). |
| Etapa | Fase de trabajo del proyecto. Etapas 3 (deuda técnica), 4 (multiamenaza) y 5 (integración multivectorial) están cerradas (22/10/2026). |
| Hito (H) | Subtarea dentro de una etapa, por ejemplo H6.4a. Un identificador de hito solo tiene sentido con su etapa: H5 de Etapa 3 y H5.0 de Etapa 5 son trabajos distintos. |
| Versión 3.0 | Salto futuro de la aplicación: autenticación real, nuevos vectores, percentiles históricos. No es lo mismo que Etapa 3. Ver `06_PENDIENTES.md` §4. |
| satrc-v2 | Nombre del repositorio en GitHub. |
| satrc-v3 | Nombre histórico de la carpeta local de trabajo. No indica versión del sistema. |
| V2.0 | Versión actual de la aplicación. |
| Protección Civil / CONAGUA / SMN | Autoridades cuyas determinaciones prevalecen. SMN es el Servicio Meteorológico Nacional, parte de CONAGUA. |

---

## 10. Documentos relacionados

- `docs/LEEME_PRIMERO.md`: punto de entrada y estado actual.
- `docs/00_METODOLOGIA.md`: reglas de trabajo.
- `docs/06_PENDIENTES.md`: deuda técnica y riesgos abiertos.
- `docs/08_DECISIONES.md`: decisiones de arquitectura y su justificación.