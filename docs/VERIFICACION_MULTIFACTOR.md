# Verificación del motor multifactor y de SARA

> **Fecha original:** 22/10/2026
> **Última actualización:** 28/10/2026 (Resolución del incidente de producción y verificación con datos reales).
> **Propósito:** Documento técnico de verificación. Registra la evidencia de que el sistema opera con 4 vectores y documenta el incidente crítico del 28/10/2026.
> **Estado actual:** El sistema está operativo y validado en producción. La app en Vercel lee correctamente desde Google Drive (`origen: GOOGLE_DRIVE_ACTUALIZADO`). El semáforo refleja los datos reales.

---

## 1. El incidente del 28/10/2026 (La tormenta perfecta)

El 28 de octubre de 2026, la aplicación dejó de entregar datos a los operadores. `/api/sara` devolvía `RESPUESTA_EN_VIVO` y un semáforo vacío, mientras que el runner de GitHub Actions reportaba "publicación exitosa".

La causa raíz no fue un solo bug, sino **tres fallos encadenados**:

1. **Falló la conexión a Drive:** La variable `GOOGLE_SCRIPT_URL` en Vercel contenía una URL de redirección (`script.googleusercontent.com`) en lugar de la URL canónica (`script.google.com/macros/s/.../exec`). Las peticiones fallaban silenciosamente.
2. **Falló la escritura del runner:** El runner generaba el paquete ligero con `evaluaciones: null` en días sin alertas N3/N4.
3. **Falló la validación Zod:** El esquema `EstadoDiocesanoBlobSchema` exigía `.min(1)` en `evaluaciones`, por lo que rechazaba el `[]` que venía de Drive.

**Síntoma visible:** `/api/sara` caía al fallback (`RESPUESTA_EN_VIVO`), inventaba una bitácora falsa, llamaba a Groq sin contexto (gastando cuota) y ocultaba que Drive estaba respondiendo.

---

## 2. Resolución aplicada

| # | Fix aplicado | Commit / Evidencia |
|---|---|---|
| 1 | Corrección de `GOOGLE_SCRIPT_URL` en Vercel y redeploy sin caché. | Configuración manual en Vercel |
| 2 | `api/sara.js` y `scripts/ejecutar_sara_autonomo.mjs` aceptan días tranquilos (envían `[]` en lugar de `null`). | Commit `2a3e3e8` |
| 3 | `src/schemas/estadoDiocesanoSchema.js` se modificó para aceptar arreglos vacíos (se eliminó `.min(1)`). | Commit `3053e29` |

**Resultado:** La app pasó de `RESPUESTA_EN_VIVO` a `GOOGLE_DRIVE_ACTUALIZADO`.

---

## 3. Evidencia de recuperación (28/10/2026)

Verificación empírica directa desde PowerShell contra producción:

- `origen:` `GOOGLE_DRIVE_ACTUALIZADO`
- `semaforo:` `N4=0 N3=0 N2=262 N1=143` (405 localidades evaluadas)
- `dictamen.titulo:` `"Vigilancia por Vientos Fuertes"` (generado por SARA a partir del motor)
- `hora_local_mexico:` (Presente, refleja la hora del runner)

El sistema está procesando la física real de los 4 vectores (hidrológico, viento, térmico, convectivo).

---

## 4. Confirmación multifactor

| Afirmación | Veredicto (28/10/2026) |
|---|---|
| "El runner evalúa cuatro vectores" | **Verdadero.** Produce 405 evaluaciones. |
| "El runner consensúa las 8 variables de Etapa 4" | **Verdadero.** Usa `consensusEngine.js`. |
| "La aplicación es multifactor" | **Verdadero.** Hoy hay 262 localidades en N2, principalmente por el vector de viento, no solo por lluvia. |
| "SARA es multifactorial" | **Verdadero.** El dictamen dice "Vigilancia por Vientos Fuertes" y recibe `tipo_amenaza` y `acciones_operativas`. |

---

## 5. Deuda pendiente derivada del incidente

El incidente expuso fallos arquitectónicos que deben resolverse para evitar que vuelva a ocurrir:

- **H-DRIVE-01:** `escribirJSONBlob` no propaga errores (silencia fallos).
- **H-DRIVE-02:** Zod no distingue `null` de `[]` ni de error.
- **H-DRIVE-03:** `leerJSONBlob` no distingue "archivo no existe" de "error de red".
- **H-DRIVE-04:** No se valida el formato de la URL en `googleDrive.js`.
- **H-DRIVE-05:** Vercel recibe HTTP 401 al intentar escribir en Drive (por redirección de Apps Script).
- **H-SARA-01..07:** El fallback de `sara.js` miente, poluciona la bitácora y consume Groq.

*(Ver detalle en `06_PENDIENTES.md`).*

---

## 6. Conclusión

SatRC V2.0 ha demostrado ser multifactorial en producción. El incidente del 28/10/2026 no fue un fallo del motor físico, sino una cadena de fallos de infraestructura y validación de datos. Con la resolución aplicada, la app lee correctamente desde Drive y entrega el estado real a los operadores, respetando el principio de precisión (DEC-011).