# SatRC V2.0 — Leer primero

> **Propósito de este archivo:** punto de entrada para cualquier persona o chat de IA que retome el proyecto. Resume el estado actual y dice en qué orden leer el resto de la documentación.
> **Última actualización:** 29/10/2026 (Auditoría empírica P0–P12, reformulación de H-MOTOR-05/H-DIAG-04, corrección del baseline, apertura de PEND-06/07/08).
> **HEAD al 29/10/2026:** `1281d43` (`docs: registra el cierre de H-SARA-01/03/04 en historial y pendientes`). **La sesión del 29/10/2026 no generó commits de producción.** Solo documentación de auditoría.

---

## 1. Qué es SatRC

Sistema de alerta temprana y riesgos climáticos para la Cáritas Pastoral Social de la Arquidiócesis de Tulancingo. Consensúa pronósticos de modelos meteorológicos abiertos y avisos oficiales para clasificar 405 localidades en un semáforo de cuatro niveles. Es una herramienta de apoyo: no emite avisos oficiales ni ordena evacuaciones.

**Principio rector vigente (DEC-011, 28/10/2026): precisión sobre cobertura.** Una alerta debe corresponder a un evento real. Los falsos positivos erosionan la confianza de las comunidades y hacen que ignoren las alertas verdaderas. Este principio reemplaza al anterior de "preferencia por el falso positivo" (DEC-002, histórico).

Detalle completo en `01_CONTEXTO.md`. Decisiones de arquitectura en `08_DECISIONES.md` (ADR-009 para Drive, DEC-011 para precisión).

---

## 2. Estado actual (resumen)

| Etapa / Hito | Estado | Documento de referencia |
|---|---|---|
| Etapa 3: deuda técnica, tests, validación de contratos | Cerrada | `04_HISTORIAL.md` |
| Etapa 4: motor multiamenaza (4 evaluadores + orquestador) | Cerrada a nivel funcional | `03_MOTOR_RIESGO.md`, `04_HISTORIAL.md` |
| Etapa 5: integración multivectorial (UI, bitácora, prompts) | Cerrada | `04_HISTORIAL.md` |
| Correcciones post-Etapa 5 (H-MULTI, H-PROMPT, H-TERM, H-BITACORA) | Cerradas | `04_HISTORIAL.md` |
| Correcciones de seguridad (R-01, R-02, R-04) y migración a Drive | Cerradas (27/10/2026) | `04_HISTORIAL.md`, `08_DECISIONES.md` (ADR-009) |
| Sesión 28/10/2026: rescate de producción (`RESPUESTA_EN_VIVO`) + fix de Zod | Cerrada (commits `2a3e3e8`, `3053e29`, `b25d7c5`) | `04_HISTORIAL.md` §6 |
| **Sesión 29/10/2026: auditoría empírica P0–P12** | **Diagnóstico cerrado. Sin cambios de código. 3 documentos actualizados (06, 04, 08) + este archivo.** | `04_HISTORIAL.md` §7 |
| Versión 3.0 (autenticación real, nuevos vectores, percentiles) | Planeada, no iniciada | `06_PENDIENTES.md` §4 |

**Baseline verificado el 29/10/2026** (HEAD `1281d43`, `node v22.23.3`, `npm 10.9.9`):

| Comando | Resultado real |
|---|---|
| `npm test` | **165 pass + 2 rojos conocidos** en 17 archivos. Los rojos son `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []" y `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones". Ambos obsoletos por el cambio de schema `3053e29` (H-DRIVE-02). |
| `npm run lint` | **55 advertencias, 0 errores.** |
| `npm run build` | Verde. 853.44 kB / 201.79 kB gzip. Warning benigno de chunk > 500 kB. |

**Nota:** las cifras "167 pruebas en verde" y "51 advertencias" que aparecían en versiones anteriores eran inexactas. Ver **H-DOC-BASELINE-01** y **H-DOC-BASELINE-02** en `06_PENDIENTES.md` §2.9. La corrección de `07_GUIA_OPERACION.md` §5 y de este mismo §2 se hará al cierre del próximo hito.

**Infraestructura:**

- **Producción:** operativa en Vercel con ejecución autónoma en GitHub Actions.
- **Base de datos:** Google Drive (vía Google Apps Script). La lógica vive en `src/lib/compartido/googleDrive.js` y se configura con `GOOGLE_SCRIPT_URL`. Ver ADR-009.
- **PWA:** la app incluye `manifest.json` y `sw.js` en `public/`. **El Service Worker es Network-Only puro: no cachea.** La PWA **no funciona offline**, contra lo que decía la versión anterior de este archivo. Ver **H-DOC-PWA-01** en `06_PENDIENTES.md` §2.9.

---

## 3. Lo más urgente

Antes de cualquier cambio, revisar `06_PENDIENTES.md` §2 (deuda técnica activa) y §6 (decisiones pendientes que bloquean fixes). El resumen que sigue es un mapa de navegación, no la fuente de verdad.

### 3.1 La familia de deudas #1 bajo DEC-011: la niebla que dispara N2 crónico

**Confirmado empíricamente el 29/10/2026 (P9–P12).**

La corrida del 28/10/2026 19:03 MX publicó **N2=227, N3=0, N4=0 sobre 405 localidades**. De esas 227 N2:

- **217 (95.6 %) son "Vigilancia por Niebla Densa"**.
- Tienen `lluvia = 0`, `saturación < 30 mm`, `visibilidad ≤ 0.36 km`.
- Concentración geográfica: **CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH al 100 %** de sus localidades. ACT, APN, PMS, TIZ al 0 %.
- **Precisión estimada de N2: ~4.4 %** (10 legítimas de 227).

Es exactamente el "efecto del niño que gritó lobo" que DEC-011 se propuso eliminar.

**Causa raíz desagregada** (todas confirmadas por pruebas empíricas):

| ID | Causa raíz | Severidad |
|---|---|---|
| **N-MOTOR-13** | La Regla 6 usa `Math.min(ventana 24h)` sin persistencia. Un solo valor bajo en cualquier hora dispara N2 para todo el día. Confirmado con P12: niebla 00:00–01:00 en Xicotepec, resto del día > 6 km, y el sistema sigue en N2 a las 19:00. | 🔴 |
| **N-MOTOR-11** | La visibilidad no se consensúa porque **ICON y GEM no la proveen** (240 null cada uno). Solo GFS la da. Contra ADR-002. | 🟠 |
| **N-MOTOR-14** | El motor no distingue evento pasado de futuro. La alerta de niebla pierde sentido operativo cuando ocurrió hace 19 h. | 🟠 |
| **N-MOTOR-15** | La Regla 6 usa OR sin contexto agravante (a diferencia de las reglas 2–5, que exigen combinación). | 🟠 |
| **H-MOTOR-05** | Síntoma original: sobreestimación de N2 en zonas húmedas (XIC, HUA, ZAC). Reformulada con causa raíz. | 🔴 |
| **H-DIAG-04** | Misma causa raíz que H-MOTOR-05. | 🔴 |
| **N-MOTOR-05-bis** | SPP y HYC también sobre-clasificadas. Ausentes de la lista original. | 🔴 |

**Hipótesis refutada:** N-MOTOR-12 (el umbral de 2 km es alto). Los datos de P12 muestran niebla real de 0.2 km, no cercana al umbral. El problema es el criterio de agregación (`min(24h)`), no el umbral.

**Bloqueador del fix:** **PEND-06** en `08_DECISIONES.md` Parte C. La decisión sobre qué criterio operativo debe disparar N2 por niebla (persistencia, ventana próxima, contexto agravante, etc.) **no es técnica**. Es de coordinación técnica + pastoral. Hasta que se resuelva, no se puede diseñar el fix sin adivinar.

### 3.2 La deuda #2: el reporte diario nunca se ha entregado

**Confirmada empíricamente el 29/10/2026 (P5).**

En 23 horas de bitácora (27/10 20:45 → 28/10 19:03) se ejecutaron **22 corridas CRON** y **0 reportes diarios**. Al menos 11 de esas corridas ocurrieron después de las 6:00 MX. Ninguna generó el reporte automático.

- **H-REPORTE-02:** `reporteDiario.mjs` usa `@vercel/blob` sin `BLOB_READ_WRITE_TOKEN` inyectado. Falla silenciosamente. El `catch` del runner lo absorbe. La corrida queda en verde.
- **H-REPORTE-03:** `debeGenerarReporteDiario` reintenta cada corrida post-6:00 porque no ve la entrada de bitácora (el diario falla antes de registrarla). Son ~8-11 intentos fallidos por día, invisibles.
- **Agravante:** cuando se arregle H-REPORTE-02, el diario saldría con el prompt sin la regla 17 (H-PROMPT-06). Hay que corregir ambos en el mismo lote.

### 3.3 La deuda #3: el doble disparador del runner

**Confirmada empíricamente el 29/10/2026 (P7).**

- `on.schedule: '21 */3 * * *'` interno del `sara_cron.yml`. Corre con jitter masivo (~3.4/día en lugar de 8). Timestamps irregulares.
- Planificador externo `cron-job.org` disparando `/api/disparar-workflow`. Estable (~8.6/día, timestamps exactos).
- **Total efectivo: ~11-12 corridas/día en vez de 8.** El `on.schedule` interno **no está documentado como activo** en `00_METODOLOGIA.md` Fase 4 ni en `07_GUIA_OPERACION.md` §1.2.

**Impacto bajo DEC-011:** más corridas = más estados publicados = más falsos positivos potenciales. Agrava H-MOTOR-05.

**Bloqueador del fix:** **PEND-07** en `08_DECISIONES.md` Parte C. Decisión técnica sobre si el `on.schedule` interno se mantiene como respaldo documentado o se elimina.

### 3.4 Críticas independientes (no bloqueadas por PEND)

- **H-PROMPT-06:** el `systemPrompt` del diario no tiene la regla 17 (control de emergencias). Confirmado por grep (P3). Agrava H-REPORTE-02.
- **H-PROMPT-09:** el `systemPrompt` del on-demand no tiene la regla 12.bis (coherencia Sección 0 ↔ Sección II). Riesgo de reintroducir el bug N29.
- **H-DRIVE-01:** `escribirJSONBlob` devuelve `null` en fallo sin propagar. **Reformulada como riesgo latente** por P4: la lectura y escritura de Drive funcionaron correctamente el 29/10/2026. El `return null` silencioso sigue en el código, pero no se manifestó. Riesgo futuro, no bug activo.
- **H-DRIVE-05:** Vercel recibe HTTP 401 al escribir en Drive por `Content-Type: application/json` + redirect de Apps Script. Latente, no manifestado el 29/10/2026.
- **H-ONDEMAND-01:** `tokenConsolaValido` con `if (!esperado) return true`. Si `SARA_ONDEMAND_TOKEN` se configura, rompe todos los on-demand.
- **H-ONDEMAND-03:** `guardadoEnBlob = true` se asigna siempre, aunque Drive falle.
- **H-ONDEMAND-05:** `TIMEOUT_GROQ_MS = 8000` + 2 reads + 1 Groq + 2 writes > timeout de 10 s de Vercel Hobby.

### 3.5 Altas nuevas detectadas en la auditoría del 29/10/2026

- **N-MOTOR-09:** acoplamiento hidro-térmico contado dos veces (`0.15 + 0.10` sobre el mismo producto). Confirmado con P2: sobreestima `+0.37` en escenarios medios, `+0.9` en altos. **Bloqueado por PEND-08** (decisión sobre cómo resolver la duplicación).
- **N-CRON-05 + N-CRON-06:** doble disparador redundante (§3.3). **Bloqueado por PEND-07.**
- **H-PKG-01:** `ejecutar_sara_autonomo.mjs` usa `validacion.error.errors`, eliminado en Zod 4. Confirmado con P1: el log imprime `undefined` cuando Zod rechaza. El workflow falla en rojo (no es silencioso), pero el diagnóstico es inútil. Reclasificada de 🔴 a 🟠.
- **N-UI-01:** el Monitor Público no muestra el semáforo N1–N4 al público en días tranquilos (cuando `evaluaciones: []`). El ciudadano ve solo el texto hardcodeado sin semáforo real.
- **N-OPS-01:** `SatRCOperativo.jsx` refresca `/api/sara` cada 5 min × 3 reads = **36 requests/hora por operador**. Escalabilidad de Apps Script no documentada.
- **N-OPS-02:** `construirResumenAtmosferico` duplicada con contratos divergentes entre `SatRCOperativo.jsx` y `reportesRegionales.js`.
- **H-REPORTE-03:** reintento silencioso 8×/día.

### 3.6 Riesgos latentes confirmados como tal (no activos hoy)

- **H-DRIVE-01** (silencia errores): lectura y escritura funcionaron el 29/10/2026. Riesgo futuro.
- **H-DRIVE-05** (401 en Vercel): no manifestado hoy.
- **H-BITACORA-02** (concurrencia): la cadena SHA-256 está íntegra 23/23 eslabones (P6). No se ha manifestado.
- **H-ONDEMAND-09** (sin rollback): P5b evaluó y refutó la manifestación para el caso del 28/10. `SARA_LOG_20` existe y coincide con el reporte vigente.

### 3.7 Deudas cerradas o refutadas por la auditoría del 29/10/2026

- **N-MOTOR-10:** cerrada como duplicada de N-MOTOR-13.
- **N-MOTOR-12:** **refutada**. El umbral de 2 km no es alto; el problema es `min(24h)`.
- **H-ONDEMAND-09 (para el caso 28/10):** refutada como bug activo. Riesgo latente.
- **H-VIENTO-01:** el cierre anterior en `04_HISTORIAL.md` §6.1 afirmaba erróneamente que el código no implementa factor de rugosidad. **Corrección registrada** en `04_HISTORIAL.md` §7.15 y en `06_PENDIENTES.md` §2.9 (**H-DOC-HVIENTO-01**). El factor de rugosidad **sí está implementado**.

### 3.8 Decisiones pendientes que bloquean fixes

| ID | Pregunta | Bloquea |
|---|---|---|
| **PEND-06** | ¿Qué criterio operativo debe disparar N2 por niebla? (persistencia, ventana próxima, contexto agravante, etc.) | Fix de H-MOTOR-05 + N-MOTOR-13 |
| **PEND-07** | ¿El `on.schedule` interno de `sara_cron.yml` se mantiene como respaldo o se elimina? | Fix de N-CRON-05 + N-CRON-06 |
| **PEND-08** | ¿Cómo resolver N-MOTOR-09 (acoplamiento duplicado)? Un término, dos términos reinterpretados, o coeficiente fusionado calibrado. | Fix de N-MOTOR-09 |
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? | Requerido para PEND-08 (opción D) |
| PEND-04 | ¿Se migrará el runner a un modelo de ejecución que no dependa de GitHub Actions? | V3.0 |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad que cierra DEC-011? | Monitoreo operativo |

**PEND-06 y PEND-08 están acopladas:** resolver la niebla reduce el 95 % del ruido N2 actual; resolver el acoplamiento previene sobreestimación en otras combinaciones. Ambas son necesarias bajo DEC-011.

### 3.9 Riesgos activos de seguridad

- **R-03:** `GET /api/sara` devuelve la bitácora completa y las evaluaciones N3/N4 sin autenticación. **Confirmado por lectura de producción el 29/10/2026.** Pendiente de mitigar.

### 3.10 Discrepancias documentales pendientes de corrección al cierre del próximo hito

- **H-DOC-BASELINE-01:** `07_GUIA_OPERACION.md` §5 y este archivo decían "167 pruebas en verde". La cifra real es "165 pass + 2 rojos obsoletos". **Ya corregida en este archivo; pendiente en `07_GUIA_OPERACION.md` §5.**
- **H-DOC-BASELINE-02:** `07_GUIA_OPERACION.md` §5 decía "51 advertencias". La cifra real es "55 advertencias, 0 errores".
- **H-DOC-HVIENTO-01:** `03_MOTOR_RIESGO.md` §5.1 y `04_HISTORIAL.md` §6.1 afirman que el código no implementa factor de rugosidad. **Falso.** `windEvaluator.js` líneas 43-45 lo implementan. La corrección en `04_HISTORIAL.md` §6.1 ya está en esta versión; la corrección en `03_MOTOR_RIESGO.md` §5.1 queda pendiente.
- **H-DOC-PWA-01:** este archivo decía "cache offline parcial". El `sw.js` es Network-Only puro. **Corregido en este archivo en §2.**

---

## 4. Orden de lectura recomendado

1. `00_METODOLOGIA.md`: cómo se trabaja en este proyecto. Obligatorio antes de tocar código o documentación. Fase 2.5 (protocolo de 5 puntos) y Fase 6 (protocolo de rescate de 4 niveles).
2. `01_CONTEXTO.md`: qué resuelve el sistema, para quién, con qué límites. Principio de precisión (DEC-011).
3. `06_PENDIENTES.md`: qué falta y qué riesgos hay abiertos. **§2 contiene las deudas activas confirmadas por la auditoría P0–P12 del 29/10/2026. §6 contiene PEND-06/07/08 que bloquean los fixes de mayor prioridad. §7 contiene el registro completo de las 13 pruebas empíricas.**
4. `04_HISTORIAL.md`: qué se ha corregido y por qué. **§7 contiene la auditoría empírica P0–P12 del 29/10/2026.**
5. `08_DECISIONES.md`: **ADR y DEC vigentes, con notas correctivas del 29/10/2026.** **Parte C contiene PEND-06/07/08.**
6. `02_ARQUITECTURA.md`: componentes, contratos de datos y flujo entre capas. Incluye §5 (Fallback en vivo) y §8 (Contratos Zod).
7. `03_MOTOR_RIESGO.md`: reglas de evaluación y evaluadores de Etapa 4. **Pendiente de corrección de H-VIENTO-01 §5.1.**
8. `05_PROMPT_SARA.md`: si la tarea involucra los reportes redactados por IA. Incluye §11 con referencia a `docs/archivo/FIXES_PROMPTS_2026-10-28.md`.
9. `07_GUIA_OPERACION.md`: si la tarea involucra despliegue, fallos o verificación en producción. **Pendiente de corrección de cifras de baseline en §5.**
10. `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md`: mapa completo del repositorio y ruta de aprendizaje para nuevos desarrolladores.
11. `VERIFICACION_MULTIFACTOR.md`: evidencia histórica de qué vectores operan en producción.
12. `docs/archivo/FIXES_PROMPTS_2026-10-28.md`: propuestas de implementación de los fixes de prompts (H-PROMPT-05..10). **Es fuente de verdad activa**, aunque esté en `archivo/`.

---

## 5. Reglas para quien edita esta documentación

- No incluir claves, tokens, contraseñas ni valores de variables de entorno. Usa nombres de variable y placeholders (`<CLAVE>`).
- No incluir nombres personales de terceros. Usa roles (por ejemplo, "Coordinación pastoral").
- No incluir rutas locales con nombres de usuario.
- Cada afirmación técnica debe poder verificarse en el código o en un commit.
- Al cerrar un hito, actualizar en el mismo cambio: `06_PENDIENTES.md`, `04_HISTORIAL.md` y este archivo.
- **Nuevo (29/10/2026, H-TEST-16):** toda cifra de baseline ("N pruebas en verde", "M advertencias") debe incluir fecha, comando y HEAD en que se verificó. Cuando cambia el código sin actualizar la cifra, la documentación miente.

---

## 6. Contacto

Los datos de contacto de las personas responsables se consultan por el canal interno de coordinación, no en este repositorio.

---

*Si este archivo contradice a otro documento, prevalece el código y después la fecha de actualización más reciente. Reporta la contradicción en `06_PENDIENTES.md`.*