# SatRC V2.0 — Leer primero

> **Propósito de este archivo:** punto de entrada para cualquier persona o chat de IA que retome el proyecto. Resume el estado actual y dice en qué orden leer el resto de la documentación.
> **Última actualización:** 27/10/2026 (Migración a Google Drive, cierre de riesgos de seguridad y correcciones post-Etapa 5).

---

## 1. Qué es SatRC

Sistema de alerta temprana y riesgos climáticos para la Cáritas Pastoral Social de la Arquidiócesis de Tulancingo. Consensúa pronósticos de modelos meteorológicos abiertos y avisos oficiales para clasificar 405 localidades en un semáforo de cuatro niveles. Es una herramienta de apoyo: no emite avisos oficiales ni ordena evacuaciones.

Detalle completo en `01_CONTEXTO.md`.

## 2. Estado actual (resumen)

| Etapa / Hito | Estado | Documento de referencia |
|---|---|---|
| Etapa 3: deuda técnica, tests, validación de contratos | Cerrada | `04_HISTORIAL.md` |
| Etapa 4: motor multiamenaza (4 evaluadores + orquestador) | Cerrada a nivel funcional | `03_MOTOR_RIESGO.md`, `04_HISTORIAL.md` |
| Etapa 5: integración multivectorial (UI, bitácora, prompts) | Cerrada | `04_HISTORIAL.md` |
| Correcciones post-Etapa 5 (H-MULTI, H-PROMPT, H-TERM, H-BITACORA) | Cerradas | `04_HISTORIAL.md` |
| Correcciones de Seguridad (R-01, R-02, R-04) y Migración de BD | Cerradas | `04_HISTORIAL.md`, `08_DECISIONES.md` (ADR-009) |
| Versión 3.0 (autenticación real, nuevos vectores, percentiles) | Planeada, no iniciada | `06_PENDIENTES.md` |

**Verificado el 27/10/2026 en el HEAD `d248fdb`:** 167 pruebas en 17 archivos, todas en verde; `npm run build` verde; lint con 0 errores y 51 advertencias (coinciden con DEU-24 y DEU-25). 

**Infraestructura:** 
- **Producción:** operativa en Vercel con ejecución autónoma cada 3 horas en GitHub Actions.
- **Base de datos (Crítico):** Debido a la suspensión de Vercel Blob por límites del plan Hobby, todo el almacenamiento (estado, bitácora y reportes) fue migrado a **Google Drive (vía Google Apps Script)**. La lógica de conexión vive en `src/lib/compartido/googleDrive.js` y se configura con `GOOGLE_SCRIPT_URL`. Ver ADR-009 en `08_DECISIONES.md`.

## 3. Lo más urgente

Antes de cualquier cambio, revisa `06_PENDIENTES.md`, sección "Riesgos activos".

- **R-03:** El endpoint `GET /api/sara` todavía devuelve la bitácora completa sin autenticación (pendiente de mitigar en V3.0 o con un refactor).

**Riesgos y problemas recién resueltos (para contexto histórico):**
- **H-VERCEL-01 (Resuelto):** El Timeout y la suspensión de Vercel Blob ya no afectan al sistema tras la migración a Google Drive.
- **R-01, R-02, R-04 (Resueltos):** Las claves ya no están en el código. Se movieron a variables de entorno (`SATRC_OPERADORES_JSON` y `CLAVE_SALA_OPERATIVA`).
- **H-BITACORA-01 (Resuelto):** La colisión de escritura en la bitácora se solucionó centralizando la creación de hashes en `bitacora.js`.

**Deuda técnica inminente:**
- **H-RUNNER-01:** El script autónomo (`scripts/ejecutar_sara_autonomo.mjs`) aún intenta usar Vercel Blob. Debe migrarse al adaptador de Google Drive para que el cron vuelva a publicar el estado. Esta es la máxima prioridad de desarrollo actual.

## 4. Orden de lectura recomendado

1. `00_METODOLOGIA.md`: cómo se trabaja en este proyecto. Es obligatorio antes de tocar código o documentación.
2. `01_CONTEXTO.md`: qué resuelve el sistema, para quién, con qué límites.
3. `06_PENDIENTES.md`: qué falta y qué riesgos hay abiertos.
4. `04_HISTORIAL.md`: qué se ha corregido y por qué. Lee solo las secciones relevantes para tu tarea.
5. `02_ARQUITECTURA.md`: componentes, contratos de datos y flujo entre capas.
6. `03_MOTOR_RIESGO.md`: reglas de evaluación y evaluadores de Etapa 4.
7. `05_PROMPT_SARA.md`: si la tarea involucra los reportes redactados por IA.
8. `07_GUIA_OPERACION.md`: si la tarea involucra despliegue, fallos o verificación en producción.
9. `08_DECISIONES.md`: si necesitas saber por qué algo está diseñado como está.
10. `VERIFICACION_MULTIFACTOR.md`: evidencia de qué vectores operan en producción.

## 5. Reglas para quien edita esta documentación

- No incluir claves, tokens, contraseñas ni valores de variables de entorno. Usa nombres de variable y placeholders (`<CLAVE>`).
- No incluir nombres personales de terceros. Usa roles (por ejemplo, "Coordinación pastoral").
- No incluir rutas locales con nombres de usuario.
- Cada afirmación técnica debe poder verificarse en el código o en un commit.
- Al cerrar un hito, actualizar en el mismo cambio: `06_PENDIENTES.md`, `04_HISTORIAL.md` y este archivo.

## 6. Contacto

Los datos de contacto de las personas responsables se consultan por el canal interno de coordinación, no en este repositorio.

---

*Si este archivo contradice a otro documento, prevalece el código y después la fecha de actualización más reciente. Reporta la contradicción en `06_PENDIENTES.md`.*