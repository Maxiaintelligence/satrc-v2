# SatRC V2.0 — Leer primero

> **Propósito de este archivo:** punto de entrada para cualquier persona o chat de IA que retome el proyecto. Resume el estado actual y dice en qué orden leer el resto de la documentación.
> **Última actualización:** 28/10/2026 (Correcciones documentales de la sesión, DEC-011, H-REPORTE-02, registro de deudas nuevas).
> **HEAD al 28/10/2026 en `main`:** el working tree tiene 8 documentos reescritos pendientes de commit (ver §2).

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
| **Sesión 28/10/2026:** reescritura de 8 documentos (00, 01, 02, 03, 05, 07, 08, 09) + DEC-011 + registro de 26 deudas activas | **Aplicada en working tree, pendiente de commit** | `06_PENDIENTES.md` §6 |
| Versión 3.0 (autenticación real, nuevos vectores, percentiles) | Planeada, no iniciada | `06_PENDIENTES.md` |

**Verificado el 28/10/2026:** lint con 0 errores y **47 advertencias** (coinciden con DEU-24 y DEU-25); `npm run build` verde. **Última corrida completa de tests (27/10/2026):** 167 pruebas en 17 archivos, todas en verde.

**Infraestructura:**

- **Producción:** operativa en Vercel con ejecución autónoma cada 3 horas en GitHub Actions.
- **Base de datos:** Google Drive (vía Google Apps Script). La lógica vive en `src/lib/compartido/googleDrive.js` y se configura con `GOOGLE_SCRIPT_URL`. Ver ADR-009.
- **PWA:** la app incluye `manifest.json` y `sw.js` en `public/`. Soporta instalación y cache offline parcial.

---

## 3. Lo más urgente

Antes de cualquier cambio, revisa `06_PENDIENTES.md` §6 (registro completo de deudas de la sesión 28/10/2026).

### 🔴 Críticas (10) — bloquean operación o violan DEC-011

- **H-REPORTE-02 (prioridad #1):** `scripts/reportes/reporteDiario.mjs` usa `@vercel/blob` sin que `BLOB_READ_WRITE_TOKEN` esté inyectado en `sara_cron.yml`. El reporte diario de las 6:00 AM **no se guarda**. El try/catch del runner lo absorbe, la corrida queda en verde, y el operador nunca ve el reporte automático. **Mientras no se resuelva, el operador depende 100% del reporte on-demand manual.** Migrar a `googleDrive.js`.
- **H-DRIVE-01:** `googleDrive.escribirJSONBlob` devuelve `null` en fallo sin propagar el error. El runner imprime "✅ Publicación exitosa" aunque Drive no haya recibido los datos. La verificación de producción debe hacerse consultando el timestamp real del archivo, no el exit code del runner.
- **H-SARA-01:** el fallback de `api/sara.js` produce `"SITUACION_NORMAL"` cuando `req.body` está vacío (siempre, porque es GET). Si el archivo de Drive falla en un día con emergencia real, el sistema diría "Calma". Viola DEC-011.
- **H-SARA-02:** `estado_ligero.json` con `evaluaciones: null` dispara el fallback **todos los días tranquilos**. El endpoint devuelve `RESPUESTA_EN_VIVO` la mayor parte del tiempo, no solo cuando falla Zod.
- **H-SARA-03:** el fallback de `sara.js` **escribe la bitácora en cada lectura** con `origen_evento: "PROGRAMADO_CRON"` (falso). Cada usuario que refresca el monitor poluciona la bitácora con entradas falsas.
- **H-SARA-04:** el fallback **llama a Groq en cada lectura**. Cada usuario × cada refresco consume cuota. Explica los 429 y los timeouts documentados en `05_PROMPT_SARA.md` §7.
- **H-ONDEMAND-03:** `escribirJSONBlob('reporte_diocesano_vigente.json')` no verifica el retorno. `guardadoEnBlob = true` se asigna siempre, incluso si Drive falló.
- **H-ONDEMAND-05:** `TIMEOUT_GROQ_MS = 8000` en el on-demand, con 2 reads + 1 Groq + 2 writes a Drive, supera fácilmente el timeout de 10s de Vercel Hobby.
- **H-MOTOR-05** y **H-DIAG-04:** sobreclasificación de N2 en zonas húmedas (XIC, HUA, ZAC). Reclasificadas a 🔴 bajo DEC-011. Requieren re-auditoría de calibración de 90 días.

### 🟠 Altas (8) — fallan silenciosamente

- **H-DRIVE-02:** `estado_ligero.json` sin validación Zod propia. Puede contener `evaluaciones: null`. Debe agregarse `EstadoDiocesanoLigeroSchema`.
- **H-SARA-05:** `bitacoraLeida = true` en el `else` de `sara.js` sobrescribe la cadena con historial vacío si falla la lectura transitoriamente. Rompe el `prev_hash` de toda la cadena posterior.
- **H-ONDEMAND-04:** `escribirJSONBlob('bitacora_sara.json')` sin verificar retorno. Devuelve `bitacora_actualizada` como si hubiera guardado.
- **H-ONDEMAND-06:** `max_completion_tokens: 2500` en el on-demand (vs. 4096 en el diario) puede cortar el JSON en reportes complejos.
- **H-ONDEMAND-07:** `esParcialReal` se calcula del payload del cliente. Un cliente malicioso puede guardar un parcial como completo.
- **H-ONDEMAND-08:** fallo de lectura de bitácora reinicia la cadena SHA-256 (`hashUltimo = BLOQUE_GENESIS`).
- **H-ONDEMAND-09:** si escribe el reporte OK pero falla la bitácora, hay reporte vigente sin entrada de auditoría. No hay rollback.
- **H-DOC-H6.6:** `04_HISTORIAL.md` L188 y L403 dicen H6.6 "abierto", pero está cerrado en código y en `06_PENDIENTES.md`. Inconsistencia cruzada de docs.

### 🟡 Medias (3) — deuda técnica latente

- **H-ONDEMAND-01 (latente):** `tokenConsolaValido()` en `api/reporte-ondemand.js` tiene lógica defensiva (`if (!esperado) return true`) que **hoy no causa problema porque `SARA_ONDEMAND_TOKEN` no está configurada en Vercel**. El riesgo es latente: si alguien la configura pensando que refuerza seguridad, **rompe todos los reportes on-demand**. La deuda es eliminar la lógica defensiva en v2.0. **No configurar `SARA_ONDEMAND_TOKEN` bajo ninguna circunstancia.**
- **H-DRY-01:** `generarHashSHA256` + `siguienteIdBitacora` reimplementados en 3 archivos (`api/sara.js`, `api/reporte-ondemand.js`, `scripts/ejecutar_sara_autonomo.mjs`) en lugar de importar `calcularNuevaEntradaBitacora` de `src/lib/compartido/bitacora.js`. Viola ADR-004.
- **H-UI-02 (parcialmente cerrado):** el bloque "Síntesis de Situación Comunitaria" de `MonitorPublico.jsx` (L457-477) sigue usando `if/else` con `lluviaTotalDia >= 20`. **El semáforo principal y el desglose por vector ya consumen el motor.** Lo que queda es un texto secundario.

### 🟢 Bajas (5) — documentales o V3.0

- **H-VIENTO-02:** inconsistencia de contrato entre evaluadores (`diagnostico.tipoAmenaza` camelCase vs `vector_dominante` snake_case). El orquestador maneja ambos casos. V3.0.
- **H-DOC-HVIENTO-01:** falta el registro formal del cierre de H-VIENTO-01 en `04_HISTORIAL.md`. Está cerrado en `03` y `06`, pero no en `04`.
- **H-DOC-REF-02:** referencia rota desde `03_MOTOR_RIESGO.md` L352. Ya resuelta en los bloques 2.6 (`02`) y 2.7 (`03`). Verificar en `03` aplicado.
- **H-DOC-MOJI-02:** posible mojibake en `02_ARQUITECTURA.md` y `03_MOTOR_RIESGO.md`. **Probablemente es un falso positivo de la consola de PowerShell** (UTF-8 mal decodificado al imprimir). Verificar con `[System.IO.File]::ReadAllText` o abriendo en VS Code con UTF-8.
- **H-CRON-01 (reformulado):** `sara_cron.yml` no tiene pre-check de `GROQ_API_KEY` y `GOOGLE_SCRIPT_URL` antes de ejecutar el runner. **`BLOB_READ_WRITE_TOKEN` ya no aplica** — el runner migró a Drive y el token solo lo consume `reporteDiario.mjs` (ver H-REPORTE-02).

### Deudas cerradas o renombradas (no activas)

- **H6.6:** cerrado en código. El Monitor Público ya consume `niveles_por_vector` y `acciones_operativas` del orquestador.
- **H-RUNNER-01:** renombrado a **H-REPORTE-02**. El runner (`ejecutar_sara_autonomo.mjs`) ya usa Drive; el que falla es `reporteDiario.mjs`.
- **H-VERCEL-01:** cerrado el 27/10/2026 (migración a Drive). No aplica.

### Riesgos activos

- **R-03:** `GET /api/sara` devuelve la bitácora completa sin autenticación. Pendiente de mitigar en V3.0 o con refactor.

### Deudas pendientes de integración

Los documentos `04_HISTORIAL.md` y `06_PENDIENTES.md` **todavía tienen el anexo §6/§Anexo como bloque de "pendiente de integración"**. La integración en las secciones formales es parte del cierre de la sesión 28/10/2026. Ver `00_METODOLOGIA.md` Fase 5.

---

## 4. Orden de lectura recomendado

1. `00_METODOLOGIA.md`: cómo se trabaja en este proyecto. Obligatorio antes de tocar código o documentación. Fase 2.5 (protocolo de 5 puntos).
2. `01_CONTEXTO.md`: qué resuelve el sistema, para quién, con qué límites. Principio de precisión (DEC-011).
3. `06_PENDIENTES.md`: qué falta y qué riesgos hay abiertos. **§6 contiene el registro completo de deudas de la sesión 28/10/2026.**
4. `04_HISTORIAL.md`: qué se ha corregido y por qué. Lee solo las secciones relevantes para tu tarea.
5. `02_ARQUITECTURA.md`: componentes, contratos de datos y flujo entre capas. Incluye §5 (Fallback en vivo) y §8 (Contratos Zod).
6. `03_MOTOR_RIESGO.md`: reglas de evaluación y evaluadores de Etapa 4.
7. `05_PROMPT_SARA.md`: si la tarea involucra los reportes redactados por IA. Incluye §11 con referencia a `docs/archivo/FIXES_PROMPTS_2026-10-28.md`.
8. `07_GUIA_OPERACION.md`: si la tarea involucra despliegue, fallos o verificación en producción.
9. `08_DECISIONES.md`: si necesitas saber por qué algo está diseñado como está. Incluye DEC-011.
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

---

## 6. Contacto

Los datos de contacto de las personas responsables se consultan por el canal interno de coordinación, no en este repositorio.

---

*Si este archivo contradice a otro documento, prevalece el código y después la fecha de actualización más reciente. Reporta la contradicción en `06_PENDIENTES.md`.*