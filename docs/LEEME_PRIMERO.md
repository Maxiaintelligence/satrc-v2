# SatRC V2.0 — Leer primero

> **Propósito de este archivo:** punto de entrada para cualquier persona o chat de IA que retome el proyecto. Resume el estado actual y dice en qué orden leer el resto de la documentación.
> **Última actualización:** 24/10/2026 (cierre de H-TERM-01 y sincronización con el estado real del código).

---

## 1. Qué es SatRC

Sistema de alerta temprana y riesgos climáticos para la Cáritas Pastoral Social de la Arquidiócesis de Tulancingo. Consensúa pronósticos de modelos meteorológicos abiertos y avisos oficiales para clasificar 405 localidades en un semáforo de cuatro niveles. Es una herramienta de apoyo: no emite avisos oficiales ni ordena evacuaciones.

Detalle completo en `01_CONTEXTO.md`.

## 2. Estado actual (resumen)

| Etapa | Estado | Documento de referencia |
|---|---|---|
| Etapa 3: deuda técnica, tests, validación de contratos | Cerrada | `04_HISTORIAL.md` |
| Etapa 4: motor multiamenaza (4 evaluadores + orquestador) | Cerrada a nivel funcional | `03_MOTOR_RIESGO.md`, `04_HISTORIAL.md` |
| Etapa 5: integración multivectorial (UI, bitácora, prompts) | Cerrada | `04_HISTORIAL.md` |
| Correcciones post-Etapa 5 | H-MULTI-01..05, H-PROMPT-01/02, H6.6, H-TERM-01 cerrados | `04_HISTORIAL.md` |
| Versión 3.0 (autenticación real, nuevos vectores, percentiles) | Planeada, no iniciada | `06_PENDIENTES.md` |

**Verificado el 24/10/2026 en el HEAD `9288793`:** 159 pruebas en 17 archivos, todas en verde; `npm run build` verde; lint con 0 errores y 51 advertencias (coinciden con DEU-24 y DEU-25). El consenso del proceso autónomo ya incluye las variables de Etapa 4 (H-MULTI-01 cerrado). Detalle en `VERIFICACION_MULTIFACTOR.md`.

**Producción:** operativa en Vercel con ejecución autónoma cada 3 horas en GitHub Actions. Última corrida verificada: `40045053119` (24/10/2026).

## 3. Lo más urgente

Antes de cualquier cambio, revisa `06_PENDIENTES.md`, sección "Riesgos activos". Los riesgos R-01 a R-04 están abiertos y requieren rotación de claves y cambios de código:

- Las claves de operador están en el código público y deben rotarse. Se trasladan a variables de entorno.
- El token de la consola de reportes se expone en el frontend mediante una variable `VITE_`. Debe retirarse del cliente.
- El endpoint `GET /api/sara` devuelve la bitácora completa sin autenticación.
- La clave de acceso a la Sala Operativa está en el código del frontend.

Además, hay dos riesgos de integridad de datos recién confirmados en producción (no estaban en la lista anterior):

- **H-BITACORA-01:** la cadena SHA-256 de la bitácora está rota en el registro `SARA_LOG_132` (de 264). Causa probable: colisión de escritura entre `reporteDiario.mjs` y `ejecutar_sara_autonomo.mjs`.
- **H-REPORTE-01:** `reporteDiario.mjs` puede sobrescribir `reporte_diocesano_vigente.json` con un reporte parcial, violando `02_ARQUITECTURA.md` §7.

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