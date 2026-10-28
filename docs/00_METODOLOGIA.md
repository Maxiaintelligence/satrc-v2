# SatRC V2.0 — Metodología de trabajo

> Este documento define cómo se trabaja DURANTE EL DESARROLLO DE SatRC. Aplica por igual a personas y a asistentes de IA. Ningún cambio de código o documentación debe saltarse estos pasos.

## Principio rector

> Ningún cambio se escribe sin entender qué problema resuelve, qué archivos toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción y lo usan personas reales.
>
> **Principio de precisión (DEC-011, 28/10/2026):** una alerta debe corresponder a un evento real. Los falsos positivos erosionan la confianza de las comunidades y hacen que ignoren las alertas verdaderas. La metodología prioriza la verificación empírica sobre la suposición, y la comprobación del efecto real sobre la confianza en el código de salida.

---

## Fase 1: Antes de tocar nada

1. **Estado del repositorio:** ejecutar `git status` y confirmar que el árbol de trabajo está limpio.
2. **Estado de producción:** revisar la última corrida de GitHub Actions, el estado del despliegue en Vercel y **el timestamp real de los archivos en Google Drive** (`estado_ligero.json`, `estado_diocesano.json`). Una corrida en verde no garantiza que Drive se haya actualizado: el runner puede imprimir `✅ Publicación exitosa` aunque `escribirJSONBlob` haya devuelto `null` (ver H-DRIVE-01).
3. **Diagnóstico:** SIEMPRE ATACAR LA CAUSA RAÍZ, NO ASUMIR NADA, NO EL SÍNTOMA. Usar PowerShell y pruebas en la terminal. El entorno local está configurado con `.env.local` para pruebas profundas contra los servicios reales, pero la verificación del efecto final se debe hacer en producción (Drive, Vercel, GitHub Actions) para no confundir el comportamiento del entorno local con el de la nube.
4. **Preguntar antes de asumir:** si el alcance o el diseño son ambiguos, consultarlo con la persona que coordina el proyecto antes de escribir una sola línea.

---

## Fase 2: Diseño

1. **Pruebas primero en lógica crítica:** si el cambio toca el motor de riesgo o los contratos de datos, las pruebas se escriben antes que el código.
2. **Un commit por causa:** cada commit debe poder revertirse con `git revert <hash>` sin afectar lo demás. Los hitos grandes se dividen en commits atómicos (por ejemplo, H8.1, H8.2, H8.3).

---

## Fase 2.5: Protocolo estricto de modificación de código

> **Regla de oro (aplicable a humanos y a asistentes de IA):** El código de este repositorio está en producción. Una instrucción ambigua o un "reemplaza todo el archivo" es una falla grave de metodología. Toda instrucción de cambio debe ser atómica, verificable y sin márgenes de error.

Cuando se solicite un cambio de código (fix, feature o refactor), la propuesta debe incluir **obligatoriamente** los siguientes 5 puntos:

### 1. Archivo exacto a modificar
Se debe indicar la ruta completa y exacta desde la raíz del proyecto.

*Ejemplo:* `api/reporte-ondemand.js`

### 2. Ubicación precisa (referencia)
Se debe indicar el nombre de la función, variable o bloque lógico que se va a modificar, y una estimación de la línea para encontrarlo rápido.

*Ejemplo:* "Dentro de la función `handler`, busca la variable `const systemPrompt = ...` (alrededor de la línea 130)."

### 3. Bloque de código de reemplazo (con inicio y fin)
**Queda estrictamente prohibido decir "reemplaza todo el archivo"** (a menos que el archivo sea nuevo o tenga demasiadas ediciones; en ese caso, el usuario proporcionará la última versión del código para hacer las ediciones sobre ella).
Se debe escribir el bloque exacto a reemplazar, indicando explícitamente con comentarios dónde inicia y dónde termina la edición, y garantizando que las llaves de cierre (`}`, `);`) queden intactas.

*Ejemplo:*

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
const nuevaVariable = "valor";
// --- FIN DE LA MODIFICACIÓN ---
```

### 4. Prueba empírica en PowerShell
Ningún cambio se da por bueno sin una prueba local. Se debe incluir el comando exacto para validar que el cambio se aplicó correctamente y que no rompió la sintaxis.

*Ejemplo:* `node --check api/archivo.js` o `npm run build`. Se debe indicar la salida esperada (ej. "No debe devolver ningún texto").

### 5. Commit atómico
Cada propuesta debe terminar con el comando exacto de Git para subir el cambio, garantizando que solo se agreguen los archivos afectados.

*Ejemplo:* `git add api/archivo.js && git commit -m "fix(api): corrige variable X" && git push origin main`

---

## Fase 3: Verificación local (antes del commit)

| Tipo | Qué hacer | Obligatorio |
|---|---|---|
| Sintaxis | `node --check <archivo>` en `api/` (.js) y `scripts/` (.mjs). | Sí, si se tocó backend |
| Build | `npm run build` para el frontend. | Sí, si se tocó `src/` |
| Lint | `npm run lint` (oxlint). Se toleran advertencias, no errores. | Sí |
| Pruebas | `npm test` debe quedar en verde. Si el cambio agrega una función, agrega su prueba. | Sí |
| Imports | Si cambias un import, verifica en tiempo de ejecución que el módulo carga. | Sí |
| Contratos | Si cambias el esquema de datos, verifica que los esquemas Zod sigan validando (`npm test`). | Sí, si se tocó `src/schemas/` |

**Referencia verificada el 27/10/2026** con pruebas empíricas (P1, P2, P3): `npm test` → 167 pruebas en 17 archivos, todas en verde. `npm run build` → verde (solo warning benigno de chunks > 500 kB). `npm run lint` → 51 advertencias, 0 errores. Reverificar estas cifras al cierre de cada hito con `npm test`, `npm run build` y `npm run lint`. Si difieren, actualizar esta línea antes de dar el hito por cerrado.

> `npm test` no valida `api/`, `scripts/*.mjs` ni el build de React. Por eso `node --check` es obligatorio para backend, y `npm run build` para el frontend.

---

## Fase 4: Commit, despliegue y verificación en producción

**Formato de commit:** `tipo(área): descripción corta`. Ejemplo: `fix(api): aumenta max_completion_tokens en Groq`.

**Despliegue:** tras el push, confirmar en Vercel que el despliegue está en estado `Ready`.

**CI:** confirmar que el workflow `tests.yml` pasa en verde.

**Si el cambio toca el runner (`scripts/`):**
- Disparar manualmente `sara_cron.yml`.
- Verificar que el log indique cobertura completa (14/14 zonas) y sin errores de validación.
- Verificar el efecto real en Google Drive: consultar el timestamp de `estado_ligero.json` y `estado_diocesano.json`. El timestamp debe ser posterior al disparo. Si el log dice "Publicación exitosa" pero el timestamp no cambió, el fix falló silenciosamente.
- Consultar `/api/sara` y confirmar que devuelve `origen: GOOGLE_DRIVE_ACTUALIZADO` (no `RESPUESTA_EN_VIVO`) en días con y sin emergencias.

**Si el cambio toca el almacenamiento (`googleDrive.js`, `bitacora.js`, `sara.js`, `reporte-ondemand.js`):**
- Leer el archivo real desde Drive con una llamada directa a `leerJSONBlob` desde PowerShell o desde un script de prueba.
- Confirmar que la estructura es la esperada (no `null`, no HTML de login de Apps Script, no error).
- Si el cambio toca la bitácora, verificar que el `prev_hash` del último registro nuevo coincida con el `hash_completo` del registro anterior.

**Si el cambio afecta un endpoint público:** probarlo en la interfaz o con una petición HTTP antes de dar el hito por cerrado.

---

## Fase 5: Documentación (obligatoria en cada cierre)

Cada cierre de hito actualiza, en el mismo cambio:

- **`06_PENDIENTES.md`:** se quita el ítem cerrado o se marca su estado. Si el fix reveló deuda nueva, se agrega con su identificador y severidad.
- **`04_HISTORIAL.md`:** se agrega el fix con síntoma, causa, solución, verificación y commit.
- **`08_DECISIONES.md`:** se registra el ADR si el cambio altera la arquitectura o los proveedores de servicios.
- **`LEEME_PRIMERO.md`:** se actualiza el estado general si cambió.

Un ítem no puede estar en dos documentos a la vez. Si está en el historial, sale del backlog.

### Reglas de seguridad documental

- Nunca escribir en la documentación claves, tokens, contraseñas ni sus valores de ejemplo. Usa el nombre de la variable de entorno y un placeholder (`<CLAVE>`).
- Nunca incluir nombres personales de terceros. Usa el rol (por ejemplo, "Coordinación pastoral").
- Nunca incluir rutas locales con nombres de usuario.
- Si una credencial aparece en un commit, se considera comprometida: se rota aunque después se elimine del código.

### Reglas de calidad documental

- Sin placeholders en commits. Si falta un hash, escribir "pendiente de registrar" y completarlo después.
- Sin cifras sin fuente. Un conteo (tests, localidades, hitos) incluye la fecha y el comando que lo produjo.
- Sin números de línea en la documentación: cambian con cualquier edición. Referenciar el archivo y la función.
- Un solo lugar por dato. Si un dato se repite en dos documentos, uno de ellos debe enlazar al otro en vez de copiarlo.

---

## Las reglas de oro

1. Nunca asumir el estado. Verificar con comandos: `git status`, logs de Vercel, `npm test`, timestamp en Drive.
2. Atacar la causa raíz, no el síntoma.
3. Preguntar antes que asumir.
4. Un commit por causa.
5. La suite de pruebas es obligatoria. Si `npm test` falla, no se hace push.
6. Verificar lo que se afirma. Si un documento dice algo, debe poder comprobarse en el código.
7. Verificar en producción. Que compile en local no basta.
8. Probar con datos reales cuando el cambio depende de una API externa.
9. Documentar decisiones y bugs en `04_HISTORIAL.md` y `08_DECISIONES.md`.
10. Pausar antes de acumular cambios. Cerrar un hito antes de empezar el siguiente.
11. Ningún secreto en el repositorio.
12. Prohibido reemplazar archivos enteros si tienen más de 50 líneas. Los cambios se hacen por bloques quirúrgicos con referencias de inicio y fin.
13. Prueba de sintaxis obligatoria. Antes de cualquier `git commit`, ejecutar `node --check` en los archivos de backend modificados.
14. Verificar el efecto real, no solo el código de salida. Un proceso que termina en 0 puede haber fallado silenciosamente. Los logs de "publicación exitosa" no sustituyen la verificación del archivo en Drive.
15. Si el fix toca el almacenamiento o la bitácora, incluir una prueba de lectura real desde Drive antes de dar el cambio por cerrado.
---

## Fase 6: Protocolo de rescate de producción y pruebas en 4 niveles

> **Contexto:** Tras el incidente del 28/10/2026, se estableció este protocolo obligatorio para diagnosticar y resolver fallos en producción. El método empírico demostró que la intuición falla; solo los datos y la verificación en capas revelan la causa raíz.

Cuando la aplicación falle en producción (por ejemplo, `/api/sara` devuelve `RESPUESTA_EN_VIVO`, el semáforo está vacío o hay errores 500), es **obligatorio** seguir este orden:

1. **Nivel 1: Prueba de Endpoints (Frontend → Vercel)**
   - Hacer peticiones HTTP directas con `Invoke-RestMethod` a `/api/sara`, `/api/smn`, etc.
   - Comparar el `origen` y los datos devueltos con lo esperado.

2. **Nivel 2: Prueba de Almacenamiento (Vercel/GitHub → Drive)**
   - Probar el `GOOGLE_SCRIPT_URL` directamente desde PowerShell local con `?action=leer&file=...`.
   - Si funciona local pero falla en Vercel, el problema es de red, IP bloqueada o variable de entorno mal configurada.

3. **Nivel 3: Prueba del Runner (GitHub Actions)**
   - Revisar el log del último run. Verificar que las 14 zonas se evaluaron.
   - Confirmar que el archivo en Drive tiene el `actualizado_iso` reciente.

4. **Nivel 4: Prueba de Contratos (Zod)**
   - Revisar los logs de Vercel (función `api/sara`).
   - Si Zod falla, inspeccionar el JSON crudo desde Drive y compararlo con el esquema.

**Regla de oro del rescate:** Documentar el diagnóstico (síntomas, causa raíz, fix) antes de aplicar código. El commit debe incluir la prueba empírica de que el problema se resolvió.

---