# SatRC V2.0 — Leer primero

> **Propósito de este archivo:** punto de entrada para cualquier persona o chat de IA que retome el proyecto. Resume el estado actual y dice en qué orden leer el resto de la documentación.
> **Última actualización:** 29/10/2026 (Sesión de cierre: fixes de motor, infraestructura y Groq).
> **Estado de la sesión:** Se aplicaron 7 commits de blindaje. Baseline en verde. Disparadores asegurados con Watchdog.

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
| Sesión 28/10/2026: rescate de producción (RESPUESTA_EN_VIVO) + fix de Zod | Cerrada | `04_HISTORIAL.md` §6 |
| Auditoría empírica P0–P12 (29/10/2026) | Cerrada | `04_HISTORIAL.md` §7 |
| **Sesión de Cierre 29/10/2026** | **Cerrada.** Fixes de motor, infraestructura y resiliencia. | `04_HISTORIAL.md` §7.22 |
| **Consolidación del contrato del motor (29/10/2026)** | **Cerrada.** 7 commits, 8 IDs reales cerrados, 3 IDs formalizados. Baseline 194 pass. | `04_HISTORIAL.md` §7.23 |
| Versión 3.0 (autenticación real, nuevos vectores, percentiles) | Planeada, no iniciada | `06_PENDIENTES.md` §4 |

**Baseline verificado el 29/10/2026 (Cierre):**

| Comando | Resultado real |
|---|---|
| `npm test` | **194 pass + 0 rojos** en 18 archivos (179 previos + 6 googleDrive.test.js + 3 divergencias gemelo + 1 CAPE nulls GEM + 1 umbralFisicoDeslaveMm + 4 proximidad_umbral_n4). Los tests obsoletos de Zod se actualizaron en el commit `f6f4281`. |
| `npm run lint` | **57 advertencias, 0 errores.** |
| `npm run build` | Verde. 858.42 kB / 203.42 kB gzip. / 201.79 kB gzip. |

**Infraestructura:**
- **Producción:** operativa en Vercel con ejecución autónoma en GitHub Actions.
- **Disparadores (ADR-010 y ADR-012):** Arquitectura de 3 capas. 1) GitHub `on.schedule`. 2) `cron-job.org` (reparado el 29/10). 3) Watchdog en GitHub Actions que corre a las 6:30 AM y dispara el reporte si no existe.
- **Base de datos:** Google Drive (vía Google Apps Script). Ver ADR-009.
- **PWA:** Service worker registrado en `index.html`. Estrategia real en `public/sw.js` pendiente de verificar (H-DOC-PWA-01, N-PWA-03).

---

## 3. Lo más urgente

Antes de cualquier cambio, revisar `06_PENDIENTES.md` §2 (deuda técnica activa) y §6 (decisiones pendientes).

### 3.1 La victoria de la niebla (H-MOTOR-05 / H-DIAG-04)
**Cerrado el 29/10/2026 (DEC-012).** La niebla dejó de disparar N2. En la corrida del 28/10 teníamos **N2=227**. En la corrida del 29/10, tras el fix, **N2=18**. La precisión subió de ~4.4% a >85%. El "niño que gritó lobo" ha sido silenciado. Las causas raíz (N-MOTOR-11, 13, 14, 15) están documentadas y cerradas.

### 3.2 Resiliencia de Groq y el Reporte Diario
**Cerrado el 29/10/2026 (N-RESILIENCIA-429, commit `a274db4`).** Se descubrió que el diario fallaba por no ejecutarse el cron (401 en cron-job.org) y por límites de tokens en Groq (429/413). Se reparó la infraestructura, se redujo el `max_tokens` del diario a 3000 y del dictamen a 800, y se agregó retry con backoff.

### 3.3 Motor Matemático Blindado
**Cerrado el 29/10/2026.**
- **ADR-011:** Se eliminó el acoplamiento hidro-térmico duplicado (N-MOTOR-09).
- **N-MOTOR-06:** Se filtraron los `null` en humedad y nivel de congelación del convectivo.
- **N-MOTOR-36:** El diagnóstico de viento ahora es coherente (muestra ráfaga real y equivalente).
- **N-FETCH-01:** Se blindó la alineación de medianoche con Open-Meteo.

### 3.4 Críticas independientes que siguen abiertas
- **H-PROMPT-09:** El prompt de on-demand no tiene la regla 12.bis (coherencia).
- **N-UI-01:** El Monitor Público no muestra el semáforo en días tranquilos.
- **R-03:** `/api/sara` devuelve la bitácora sin autenticación.
- **PEND-09:** Decisión sobre escritura transaccional de bitácora (bloquea H-ONDEMAND-09 y N-ONDEMAND-04).
- **PEND-10:** Decisión sobre alineación de subtipos de `tipo_amenaza` (bloquea N-MOTOR-29, N-MOTOR-05, N-RUNNER-VECTOR-CONTRACT).

### 3.5 Decisiones pendientes
| ID | Pregunta | Bloquea |
|---|---|---|
| **PEND-06** | ¿Qué criterio operativo debe disparar N2 por niebla? (Aunque el fix de DEC-012 ya está aplicado, falta formalizar la métrica). | Monitoreo |
| PEND-03 | ¿Los coeficientes de acoplamiento se recalibran con eventos reales? | V3.0 |
| PEND-04 | ¿Se migrará el runner a Vercel Cron? | V3.0 |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad? | Monitoreo |
| **PEND-09** | Escritura transaccional de bitácora | H-ONDEMAND-09 |
| **PEND-10** | Alineación de subtipos de `tipo_amenaza` | N-MOTOR-29, N-MOTOR-05, N-RUNNER-VECTOR-CONTRACT |

---

## 4. Orden de lectura recomendado

1. `00_METODOLOGIA.md`: cómo se trabaja. Fase 2.5 (protocolo de 5 puntos) y la nueva regla de edición documental vía PowerShell.
2. `01_CONTEXTO.md`: qué resuelve el sistema y el principio DEC-011.
3. `06_PENDIENTES.md`: deudas activas y decisiones pendientes.
4. `04_HISTORIAL.md`: qué se ha corregido (ver §7.22 para la sesión de cierre).
5. `08_DECISIONES.md`: ADRs y DECs vigentes.
6. `02_ARQUITECTURA.md`: componentes y flujos.
7. `03_MOTOR_RIESGO.md`: reglas del motor.
8. `05_PROMPT_SARA.md`: si se tocan los reportes de IA.
9. `07_GUIA_OPERACION.md`: despliegue y fallos.
10. `09_ARBOL_Y_RUTA_DE_APRENDIZAJE.md`: mapa del repositorio.

---

## 5. Reglas para quien edita esta documentación

- No incluir claves, tokens, contraseñas ni valores de variables de entorno. Usa nombres de variable y placeholders (`<CLAVE>`).
- No incluir nombres personales de terceros. Usa roles.
- No incluir rutas locales con nombres de usuario.
- Cada afirmación técnica debe poder verificarse en el código o en un commit.
- Al cerrar un hito, actualizar en el mismo cambio: `06_PENDIENTES.md`, `04_HISTORIAL.md` y este archivo.
- **Toda cifra de baseline debe incluir fecha, comando y HEAD en que se verificó.**

---

## 6. Contacto

Los datos de contacto de las personas responsables se consultan por el canal interno de coordinación, no en este repositorio.

---

*Si este archivo contradice a otro documento, prevalece el código y después la fecha de actualización más reciente. Reporta la contradicción en `06_PENDIENTES.md`.*