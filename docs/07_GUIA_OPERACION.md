# SatRC V2.0 — Guía de operación

> **Versión del documento:** 2.6 (28/10/2026)
> **Audiencia:** quien opera, despliega o recupera el sistema.
> **Alcance:** procedimientos. Los servicios externos, sus cuentas y sus variables de entorno están en la referencia de servicios (sección 8).
> **Regla:** este documento no contiene claves, tokens ni nombres de personas. Las claves se gestionan en Vercel y en GitHub Secrets. Los contactos se consultan por el canal interno de coordinación.
> **Principio rector (DEC-011):** el sistema prefiere no alertar antes que alertar sin fundamento. Un falso positivo tiene un costo real: erosión de la confianza comunitaria. Si algo falla, la aplicación sigue mostrando un semáforo de respaldo, pero debe verificarse el estado real antes de confiar en él.

---

## 1. Despliegue

### 1.1 Frontend y API (Vercel)

- **Despliegue automático:** cada `git push origin main` genera un despliegue en Vercel.
- **Configuración:** no existe `vercel.json`. Vercel detecta las funciones en `api/` y el frontend en `src/`.
- **Verificación:** en el panel de Vercel, el último despliegue debe aparecer como **Ready**.
- **Función serverless (Node 22):** 6 endpoints en `api/` (ver §4.1 para verificación).

### 1.2 Proceso autónomo (GitHub Actions)

- **Workflows:** `.github/workflows/sara_cron.yml` (proceso autónomo) y `.github/workflows/tests.yml` (pruebas).
- **Horario:** cada 3 horas (`21 */3 * * *`, en UTC) y ejecución manual.
- **Disparo externo:** el planificador cron-job.org llama a `/api/disparar-workflow` con el encabezado `x-cron-secret`.
- **Cambios:** el siguiente workflow usa el código nuevo; no hace falta desplegar nada más.

---

## 2. Reportes

### 2.1 Reporte diario automático

| Aspecto | Detalle |
|---|---|
| Quién lo genera | El runner (`scripts/ejecutar_sara_autonomo.mjs`) **invoca** a `scripts/reportes/reporteDiario.mjs`, que hace el trabajo |
| Cuándo | Primera corrida a partir de las 6:00 hora de México del día |
| Qué genera | Reporte con ventana de 72 horas (ayer, hoy y mañana) |
| Dónde se guarda | **Actualmente intenta escribir en `@vercel/blob` (no en Drive). Falla silenciosamente si `BLOB_READ_WRITE_TOKEN` no está en `sara_cron.yml`.** Ver H-REPORTE-02 en `06_PENDIENTES.md`. |
| **Estado real** | **🔴 El reporte diario no se está entregando al operador.** La causa es H-REPORTE-02. Mientras no se resuelva, el operador depende 100% del reporte on-demand manual. |

**Historia del bug:** en la migración del 27/10/2026, el runner pasó a usar Google Drive, pero `reporteDiario.mjs` quedó con la implementación de Blob. Como `BLOB_READ_WRITE_TOKEN` no se inyecta en `sara_cron.yml`, `put()` falla con `token: undefined` y el `catch` del runner absorbe el error. Cada corrida lo reintenta sin éxito.

### 2.2 Reporte bajo demanda

| Aspecto | Detalle |
|---|---|
| Quién lo solicita | Operador autorizado, desde la Sala Operativa |
| Qué genera | Reporte con ventana de 48 horas (ayer y hoy) |
| Dónde se guarda | `reporte_diocesano_vigente.json` en Google Drive, solo si las 14 zonas tienen datos |
| **Estado real** | ✅ **Es el único reporte que llega al operador hoy.** Funciona porque `api/reporte-ondemand.js` sí usa `escribirJSONBlob` de Drive. |

**Modo parcial:** si faltan zonas, el backend genera un reporte parcial. Un reporte parcial **no** se guarda en Google Drive, para no sustituir al vigente. La decisión la toma el backend (`esParcialReal`), no el navegador.

**Acceso de operadores:** cada operador tiene una clave personal, gestionada fuera del repositorio (`SATRC_OPERADORES_JSON`). Si una clave se pierde o se compromete, se rota y se actualiza en Vercel. Cada reporte queda registrado en la bitácora con el rol que lo generó.

---

## 3. Disparar el proceso manualmente

Requisitos: GitHub CLI instalado y sesión iniciada (`gh auth login`).

```powershell
gh workflow run sara_cron.yml --ref main --repo Maxiaintelligence/satrc-v2
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 1
gh run view <RUN_ID> --repo Maxiaintelligence/satrc-v2 --log
```

Alternativa: en GitHub, pestaña **Actions**, workflow **sara_cron**, botón **Run workflow**, rama `main`.

Para disparar desde PowerShell con el secreto del cron, obtener el valor en Vercel (Settings → Environment Variables) y no escribirlo en ningún archivo:

```powershell
$secret = Read-Host "Secreto del cron" -AsSecureString
$plano = [System.Net.NetworkCredential]::new("", $secret).Password
Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/disparar-workflow" `
  -Method POST -Headers @{ "x-cron-secret" = $plano }
Remove-Variable plano
```

---

## 4. Verificar producción

### 4.1 Endpoints públicos

| Endpoint | Método | Rol |
|---|---|---|
| `/api/sara` | GET | Estado vigente. Con `?forzar=true` requiere `x-admin-token` (`SARA_ADMIN_TOKEN`). |
| `/api/smn` | GET | Aviso oficial del SMN (scraping). |
| `/api/latest-gif` | GET | Animación más reciente de GOES-19. |
| `/api/reporte-ondemand` | POST | Genera reporte bajo demanda. Requiere `x-user-key`. |
| `/api/disparar-workflow` | POST | Dispara el runner. Requiere `x-cron-secret`. |
| `/api/auth-operativo` | POST | Valida la clave de la Sala Operativa. |

### 4.2 Interfaz y API

```powershell
curl.exe -s -o NUL -w "/: HTTP %{http_code}`n" "https://satrc-v2.vercel.app/"
```

### 4.3 Estado publicado

Verificación por endpoint (debe indicar `GOOGLE_DRIVE_ACTUALIZADO`):

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "origen: $($sara.origen)"
Write-Host "Semáforo: N4=$($sara.semaforo.totalNivel4), N3=$($sara.semaforo.totalNivel3)"
```

**Valores esperados de `origen`:**

| Valor | Significado | Acción |
|---|---|---|
| `GOOGLE_DRIVE_ACTUALIZADO` | Estado publicado válido. | ✅ Todo en orden |
| `RESPUESTA_EN_VIVO` | Fallback activo. Puede ser por: (a) Zod falló, (b) `estado_ligero.json` tiene `evaluaciones: null` (días tranquilos, H-SARA-02), (c) lectura de Drive falló (H-DRIVE-01). | Revisar el timestamp en Drive (§4.4) y los logs de Vercel. |

**Nota importante:** por H-SARA-02, `RESPUESTA_EN_VIVO` es el comportamiento esperado en días sin N3/N4, no una falla. Mientras H-SARA-02 no se resuelva, no alarmarse por `RESPUESTA_EN_VIVO` si el semáforo está en N1/N2 y los datos son coherentes.

### 4.4 Verificación del estado real en Google Drive

**Nuevo paso obligatorio** (según `00_METODOLOGIA.md` v2.6 §Fase 4). Verificar el timestamp de los archivos en Drive, no solo el exit code del runner.

| Archivo en Drive | Contenido | Quién lo lee | Cómo verificarlo |
|---|---|---|---|
| `estado_diocesano.json` | Paquete maestro completo (405 localidades) | Auditoría manual | Buscar `actualizado_iso` en el JSON. Debe ser posterior a la última corrida. |
| `estado_ligero.json` | Paquete ligero (semáforo + N3/N4) | `/api/sara` | Es el archivo que realmente sirve `/api/sara`. Si `/api/sara` responde con datos coherentes, este archivo está actualizado. |
| `bitacora_sara.json` | Registro encadenado SHA-256 | `/api/sara` | Verificar el `hash_completo` del último registro vs el `prev_hash` del siguiente (cadena). |
| `reporte_diocesano_vigente.json` | Último reporte vigente | `/api/sara` | Hoy solo lo escribe el on-demand (H-REPORTE-02). Si el operador nunca ha generado uno manualmente, este archivo no existe. |

Comando para verificar el estado publicado:

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "hora_servidor_mexico: $($sara.hora_servidor_mexico)"
Write-Host "origen: $($sara.origen)"
Write-Host "bitacora (últimos 3 registros):"
$sara.bitacora | Select-Object -Last 3 | ForEach-Object {
    Write-Host "  $($_.id) | $($_.timestamp_local) | $($_.titulo)"
}
```

Si el timestamp del último registro de bitácora tiene más de 4 horas y no hay emergencia: el runner no está corriendo. Dispararlo manualmente (§3).

### 4.5 Aviso del SMN

```powershell
$smn = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/smn" -Method GET
Write-Host "SMN: activo=$($smn.alerta.activo), nivel=$($smn.alerta.nivel)"
```

### 4.6 Última corrida del proceso autónomo

```powershell
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 3
```

Resultado esperado: corridas con éxito. En el log, la línea de zonas debe indicar **14 de 14**.

**Importante:** que la corrida esté en verde no garantiza que los datos se hayan publicado en Drive. Verificar siempre con §4.4.

---

## 5. Pruebas locales

Antes de cualquier `git push`:

```powershell
cd "<RUTA_DEL_PROYECTO>"
npm test
npm run lint
node --check api\sara.js
node --check api\reporte-ondemand.js
node --check api\auth-operativo.js
node --check api\disparar-workflow.js
node --check scripts\ejecutar_sara_autonomo.mjs
node --check scripts\reportes\reporteDiario.mjs
```

**Referencia verificada el 27/10/2026:** 167 pruebas en 17 archivos, todas en verde; el lint reporta 0 errores y 51 advertencias. Las advertencias están en `06_PENDIENTES.md` (DEU-24 y DEU-25).

`node --check` es obligatorio para `api/` y `scripts/`, porque `npm test` no los cubre.

### 5.1 Entorno local y credenciales

El proyecto admite pruebas profundas en local. Crea un archivo `.env.local` en la raíz (está en `.gitignore`, nunca se sube) y define las variables descritas en §8.1.

Para validar que las credenciales son correctas antes de correr pruebas, se recomienda usar el script de validación de 4 niveles que hace peticiones reales a Google Apps Script, Groq y Vercel.

---

## 6. Recuperación ante fallos

### 6.1 El proceso autónomo falla

Revisar el log: `gh run view <RUN_ID> --log`.

Identificar la causa:

| Mensaje | Causa probable | Acción |
|---|---|---|
| `Open-Meteo HTTP 503` | Servicio externo caído, transitorio | Esperar y disparar de nuevo |
| `BLOB_READ_WRITE_TOKEN` en el log del runner | `reporteDiario.mjs` no puede escribir porque falta el token. El diario falla silenciosamente pero la corrida queda en verde. | H-REPORTE-02 activo. Mientras no se resuelva: (a) configurar `BLOB_READ_WRITE_TOKEN` en `sara_cron.yml` para que el diario escriba en Blob, o (b) esperar al fix que migra `reporteDiario.mjs` a Drive. Los reportes on-demand funcionan independientemente. |
| `[ZOD] El paqueteMaestro no cumple el schema` | Error en el motor; la publicación se abortó a propósito | Leer el campo indicado en el log, corregir, subir y disparar |
| `Cannot find module` | Importación rota | Revisar el último commit |
| `✅ Publicación exitosa` seguido de un timestamp viejo en `/api/sara` | H-DRIVE-01 activo. `escribirJSONBlob` retorna `null` sin propagar. El log miente. | Verificar el timestamp real en Drive (§4.4) |

### 6.2 El archivo en Google Drive no se actualiza

1. Confirmar que la última corrida terminó bien (sección 4.6).
2. No confiar en "Publicación exitosa" del log. Verificar el timestamp real de `estado_ligero.json` en Drive (§4.4).
3. Si el timestamp es viejo pero el log dice éxito → H-DRIVE-01. Revisar los logs de Apps Script.
4. Si hay un error al publicar, revisar que `GOOGLE_SCRIPT_URL` esté configurada en Vercel y que la implementación en Google Apps Script siga activa.

### 6.3 `/api/sara` devuelve `RESPUESTA_EN_VIVO`

`origen: RESPUESTA_EN_VIVO` significa que el estado publicado no se sirvió. Puede ser por 3 causas:

| Causa | Verificación | Acción |
|---|---|---|
| Zod rechazó el estado de Drive | Log de Vercel: `[ZOD] El estado de Drive no cumple el schema` | Revisar el campo indicado. El estado publicado debe corregirse. |
| `evaluaciones: null` en `estado_ligero.json` (H-SARA-02) | Es el caso de días sin N3/N4. El semáforo está en N1/N2. | Comportamiento esperado hasta que H-SARA-02 se resuelva. No alarmarse. |
| Lectura de Drive falló (H-DRIVE-01) | Log de Vercel: error al leer `estado_ligero.json` | Revisar `GOOGLE_SCRIPT_URL` y el estado de Apps Script. |

El sistema sigue mostrando datos en todos los casos (por el fallback en vivo), pero debe verificarse si el dato es el publicado o el fallback.

### 6.4 Los datos están viejos

Revisar la hora del dictamen en `/api/sara` (`hora_servidor_mexico`) o el timestamp del último registro de la bitácora. Si tiene más de 4 horas:

- **Causa 1:** el cron no está corriendo (verificar `.github/workflows/sara_cron.yml` en la pestaña Actions).
- **Causa 2:** el fallback está sirviendo estado cacheado (H-SARA-02).
- **Causa 3:** `estado_ligero.json` no se actualizó (H-DRIVE-01, escritura silenciosa).

**Acción inmediata:** disparar manualmente (§3) y verificar §4.4.

### 6.5 Reversión

```powershell
git revert <HASH_DEL_COMMIT_DEFECTUOSO> --no-edit
git push origin main
```

Después de revertir, confirmar el despliegue en Vercel y una corrida del proceso autónomo.

### 6.6 Error 400 del modelo de redacción

Causa habitual: el texto del reporte se corta antes de cerrar el JSON. El límite de salida varía según el endpoint:

| Endpoint | `max_completion_tokens` | Notas |
|---|---|---|
| Reporte diario | 4096 | Configurado |
| Reporte on-demand | 2500 | Menor por el timeout de Vercel |
| Dictamen del runner | Ninguno (H-PROMPT-05) | Puede truncarse bajo latencia alta |

Si el error 400 ocurre en el dictamen del runner, el problema es H-PROMPT-05. Ver `06_PENDIENTES.md`.

### 6.7 Timeout de Vercel al generar On-Demand

Si el reporte on-demand tarda más de 10 segundos, Vercel corta la conexión y el frontend muestra "Error del servidor". H-ONDEMAND-05 activo: `TIMEOUT_GROQ_MS = 8000` en `api/reporte-ondemand.js`. Con 2 reads + 1 Groq (8s) + 2 writes a Drive, se supera el timeout de 10s de Vercel.

Acciones posibles mientras H-ONDEMAND-05 no se resuelva:

- Reducir el prompt (menos focos críticos en el request).
- Reintentar (a veces Groq responde más rápido).
- Si es recurrente, considerar dividir la operación en 2 requests (lectura primero, generación después).

### 6.8 Escritura silenciosa fallida en Drive (H-DRIVE-01)

**Síntoma:** el log del runner dice `✅ Publicación exitosa`, pero el timestamp de `estado_ligero.json` en Drive no cambió.

**Causa:** `escribirJSONBlob` devuelve `null` en caso de fallo y no propaga el error. El runner no verifica el valor devuelto.

**Verificación:**

```powershell
# Buscar el timestamp real de estado_ligero.json en Drive vía /api/sara
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "hora_local_mexico: $($sara.hora_local_mexico)"
# Si es mayor a 4 horas y no hay emergencia → H-DRIVE-01
```

**Acción:** revisar el estado de Apps Script. Si el script está bloqueado o la implementación se cayó, `escribirJSONBlob` retorna `null` silenciosamente.

### 6.9 El dictamen se trunca (H-PROMPT-05)

**Síntoma:** el campo `comentario_oficial` del dictamen se corta a mitad de una frase, o el JSON del dictamen está mal formado.

**Causa:** el dictamen del runner llama a Groq sin `max_completion_tokens`.

**Acción:** ver H-PROMPT-05 en `06_PENDIENTES.md`. Mientras no se resuelva, reducir la longitud del prompt del dictamen.

### 6.10 `RESPUESTA_EN_VIVO` en días tranquilos (H-SARA-02)

**Síntoma:** `/api/sara` devuelve `RESPUESTA_EN_VIVO` incluso cuando el semáforo está en N1/N2 y todo parece normal.

**Causa:** por H-SARA-02, `estado_ligero.json` tiene `evaluaciones: null` cuando no hay N3/N4. `/api/sara` interpreta `null` como "sin datos" y cae al fallback.

**Acción:** es el comportamiento esperado hasta que H-SARA-02 se resuelva. Bajo DEC-011, esto es un problema de precisión: el fallback miente con `SITUACION_NORMAL` cuando el semáforo está tranquilo. Ver H-SARA-01 y H-SARA-02 en `06_PENDIENTES.md`.

---

## 7. Controles de seguridad operativos

- Ninguna clave se escribe en la documentación, en los logs ni en los comandos. Los ejemplos usan `<CLAVE>` o lectura segura.
- Si una clave aparece en un commit, debe rotarse aunque se elimine después.
- Antes de compartir la salida de un comando, revisarla buscando claves, tokens y rutas personales.
- La rotación de claves de operador es responsabilidad de la coordinación técnica y debe comunicarse a quienes operan la Sala Operativa.

---

## 8. Referencia de servicios

| Servicio | Para qué | Dónde se guarda su credencial |
|---|---|---|
| Vercel | Hosting y funciones serverless | Variables de entorno del proyecto |
| GitHub | Código, pruebas y proceso autónomo | Secrets de Actions |
| Google Drive (Apps Script) | Almacenamiento de JSONs (estado, bitácora, reportes) | Variable `GOOGLE_SCRIPT_URL` |
| Groq | Redacción de reportes (modelo `openai/gpt-oss-120b`) | Variable `GROQ_API_KEY` |
| cron-job.org | Disparo cada 3 horas | Encabezado con el secreto del cron |
| Open-Meteo | Pronósticos (sin clave) | No aplica |
| SMN / CONAGUA | Avisos oficiales (consulta pública) | No aplica |
| NOAA GOES-19 | Imágenes satelitales (acceso público) | No aplica |

### 8.1 Variables de entorno

**Variables en uso** (verificadas contra el código):

| Variable | Uso | Obligatoria en producción |
|---|---|---|
| `SARA_ADMIN_TOKEN` | Token para `?forzar=true` en `/api/sara`. | Sí, si se usa el forzar |
| `GROQ_API_KEY` | Redacción de reportes y dictamen. | Sí |
| `GOOGLE_SCRIPT_URL` | Endpoint de Google Apps Script para leer/escribir Drive. | Sí |
| `SATRC_OPERADORES_JSON` | Mapa de claves de operador a roles. | Sí |
| `CLAVE_SALA_OPERATIVA` | Clave de acceso a la Sala Operativa. | Sí |
| `CRON_SECRET` | Autorizar el disparo externo (`x-cron-secret`). | Sí |
| `GITHUB_PAT` | Disparar el workflow desde la API. | Sí, para el disparo externo |
| `SARA_LLM_KILL_SWITCH` | Si vale `DISABLED`, desactiva el modelo. | No |

**Variables con estado especial:**

| Variable | Estado | Acción |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | Debe configurarse hasta que H-REPORTE-02 se resuelva. Sin ella, el reporte diario falla silenciosamente. | Configurarla en `sara_cron.yml` para que el diario escriba en Blob mientras se migra a Drive. |
| `SARA_ONDEMAND_TOKEN` | **NO debe configurarse. Actualmente NO está configurada en Vercel.** Si se configura, el endpoint `/api/reporte-ondemand` empieza a exigir el header `x-admin-token` que el frontend no envía. Esto **rompe todos los reportes on-demand**. Ver H-ONDEMAND-01. | Dejar sin configurar. La lógica defensiva del código (`if (!esperado) return true`) permite que el endpoint funcione mientras la variable esté ausente. |
| `VITE_SARA_ONDEMAND_TOKEN` | Eliminada del código (R-02, 27/10/2026). | No aplica. |

**Aclaración sobre `BLOB_READ_WRITE_TOKEN`:** versiones previas de este documento decían que era "obsoleta" tras la migración a Drive. Eso es incorrecto en el estado actual del código: `reporteDiario.mjs` todavía la usa. Mientras H-REPORTE-02 no se resuelva, configurarla es la única forma de que el diario se guarde (aunque sea en Blob). Cuando H-REPORTE-02 se cierre, la variable se podrá eliminar definitivamente.

**Aclaración sobre `SARA_ONDEMAND_TOKEN`:** el código tiene una lectura defensiva (`if (!esperado) return true`). Si se configura, activa una validación que el frontend no puede cumplir. Nunca configurarla. Ver H-ONDEMAND-01.

---

## 9. Contactos

Las personas responsables y sus datos de contacto se consultan por el canal interno de coordinación. No se publican en este repositorio.

| Rol | Responsabilidad |
|---|---|
| Desarrollo principal | Código, despliegue y claves técnicas |
| Coordinación pastoral | Decisiones operativas y uso de los reportes |
| Autoridad eclesiástica | Aprobación institucional |

Para emergencias operativas: comunicarse con la coordinación de Cáritas diocesana por el canal establecido.

---

## 10. Documentos relacionados

- `docs/00_METODOLOGIA.md`: reglas de trabajo, protocolo de modificación, verificación de efecto real.
- `docs/01_CONTEXTO.md`: qué es SatRC, principios, glosario. Principio de precisión (DEC-011).
- `docs/02_ARQUITECTURA.md`: capas, flujo de datos, endpoints, almacenamiento, contratos (Zod).
- `docs/03_MOTOR_RIESGO.md`: reglas del motor hidrológico, evaluadores, orquestador, consenso.
- `docs/04_HISTORIAL.md`: cronología de bugs resueltos, lecciones, commits.
- `docs/05_PROMPT_SARA.md`: prompts de SARA, reglas, estado de la adaptación multivectorial.
- `docs/06_PENDIENTES.md`: única lista vigente de deudas y riesgos. Consultar antes de tocar código.
- `docs/08_DECISIONES.md`: ADRs y decisiones de arquitectura (ADR-005, ADR-009, DEC-011).
- `docs/archivo/FIXES_PROMPTS_2026-10-28.md`: propuestas de implementación de los fixes de prompts (H-PROMPT-05..10).