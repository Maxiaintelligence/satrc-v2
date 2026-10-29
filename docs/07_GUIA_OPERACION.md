# SatRC V2.0 — Guía de operación

> **Versión del documento:** 2.7 (29/10/2026)
> **Audiencia:** quien opera, despliega o recupera el sistema.
> **Alcance:** procedimientos. Los servicios externos, sus cuentas y sus variables de entorno están en la referencia de servicios (sección 8).
> **Regla:** este documento no contiene claves, tokens ni nombres de personas. Las claves se gestionan en Vercel y en GitHub Secrets. Los contactos se consultan por el canal interno de coordinación.
> **Principio rector (DEC-011):** el sistema prefiere no alertar antes que alertar sin fundamento. Un falso positivo tiene un costo real: erosión de la confianza comunitaria. Si algo falla, la aplicación sigue mostrando un semáforo de respaldo, pero debe verificarse el estado real antes de confiar en él.
> **Cambios de esta versión (29/10/2026):**
> - **Baseline corregido** en §5: 165 pass + 2 rojos obsoletos; 55 advertencias, 0 errores. Las cifras anteriores (167 verdes, 51 advertencias) eran inexactas. Ver H-DOC-BASELINE-01/02 en `06_PENDIENTES.md` §2.9.
> - **§1.2 documenta el doble disparador** del runner (on.schedule interno + cron-job.org externo). Ver N-CRON-05/06 en `06_PENDIENTES.md` §2.4 y PEND-07 en `08_DECISIONES.md`.
> - **§2.1 cuantifica H-REPORTE-02:** 22 corridas CRON, 0 reportes diarios entregados en 23 h (evidencia P5). Nota sobre H-REPORTE-03 (reintento silencioso 8×/día).
> - **§4.3 reescrita:** ya no existe `RESPUESTA_EN_VIVO`. El endpoint devuelve `GOOGLE_DRIVE_ACTUALIZADO` (200) o `ERROR_DRIVE` (503). Ver H-SARA-01/03/04 cerrados con `b25d7c5`.
> - **§4.4 reforzada** con verificación de cadena SHA-256 (P6: 23/23 eslabones íntegros).
> - **§6.1 actualizada** con el estado real de H-REPORTE-02 y la nota sobre `BLOB_READ_WRITE_TOKEN` (única solución temporal mientras se migra `reporteDiario.mjs` a Drive).
> - **§6.2 reescrita** para reflejar H-DRIVE-01 como riesgo latente (P4: lectura/escritura correctas el 29/10/2026).
> - **§6.3 reescrita** para el nuevo modelo de errores (`ERROR_DRIVE` en lugar de `RESPUESTA_EN_VIVO`).
> - **§6.4 actualizada** con el doble disparador del runner.
> - **§6.10 reescrita:** ya no existe `RESPUESTA_EN_VIVO` en días tranquilos. H-SARA-02 cerrado con `2a3e3e8`.
> - **§8.1 actualizada:** `BLOB_READ_WRITE_TOKEN` documentada como "obligatoria hasta que H-REPORTE-02 se resuelva"; `SARA_LLM_KILL_SWITCH` marcada como "no implementada en código actual".
> - **Nota sobre PEND-06/07/08** donde aplique.

---

## 1. Despliegue

### 1.1 Frontend y API (Vercel)

- **Despliegue automático:** cada `git push origin main` genera un despliegue en Vercel.
- **Configuración:** no existe `vercel.json`. Vercel detecta las funciones en `api/` y el frontend en `src/`.
- **Verificación:** en el panel de Vercel, el último despliegue debe aparecer como **Ready**.
- **Función serverless (Node 22):** 6 endpoints en `api/` (ver §4.1 para verificación).

### 1.2 Proceso autónomo (GitHub Actions)

**El runner tiene dos disparadores activos simultáneamente. Es una decisión de diseño, no un descuido. ADR-010.**

| Disparador | Mecanismo | Frecuencia | Estabilidad |
|---|---|---|---|
| **Primario (externo)** | `cron-job.org` → `/api/disparar-workflow` | ~8.6 corridas/día | Timestamps exactos: 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 |
| **Respaldo (interno)** | `on.schedule: '21 */3 * * *'` en `sara_cron.yml` | ~3.4 corridas/día (jitter masivo) | Timestamps irregulares: 20:45, 23:56, 03:10, 06:35, 07:19, 11:00, 14:58, 17:21, 22:56 |

**Total efectivo:** ~11-12 corridas/día.

**Por qué dos disparadores:** resiliencia. Si `cron-job.org` falla o la URL externa se rompe, el `on.schedule` interno mantiene el sistema actualizado. Fue una capa de seguridad establecida en las primeras etapas del desarrollo.

**Trade-off:** consumo duplicado de minutos GitHub Actions y cuota de Apps Script. Bajo DEC-008, el margen es ~10 % del límite del plan gratuito. Si en el futuro el uso supera el 90 %, se puede reducir el `on.schedule` interno a 1×/día sin perder la capa de seguridad. Bajo DEC-011, más corridas = más estados publicados = más oportunidades de publicar falsos positivos. **Con H-MOTOR-05 cerrado (DEC-012, 29/10/2026), el riesgo de falsos positivos por frecuencia ya no aplica.**

**Verificación:** P7 del 29/10/2026. 60 corridas en 5 días. 17 `schedule` + 43 `workflow_dispatch`.

**Estado:** N-CRON-05 y N-CRON-06 **cerradas** como ADR-010. No requiere acción de código.

**Workflows:**

- `.github/workflows/sara_cron.yml` (proceso autónomo). `on.schedule` interno + `workflow_dispatch` manual + `workflow_dispatch` externo desde `/api/disparar-workflow`.
- `.github/workflows/tests.yml` (pruebas). Solo `npm test`. **No corre `node --check`, ni `npm run lint`, ni `npm run build`.** Ver N-CI-03 en `06_PENDIENTES.md` §2.5.

**Cambios en el workflow:** el siguiente workflow usa el código nuevo; no hace falta desplegar nada más.

---

## 2. Reportes

### 2.1 Reporte diario automático

| Aspecto | Detalle |
|---|---|
| Quién lo genera | El runner (`scripts/ejecutar_sara_autonomo.mjs`) **invoca** a `scripts/reportes/reporteDiario.mjs`, que hace el trabajo |
| Cuándo | Primera corrida a partir de las 6:00 hora de México del día |
| Qué genera | Reporte con ventana de 72 horas (ayer, hoy y mañana) |
| Dónde se guarda | **Actualmente intenta escribir en `@vercel/blob` (no en Drive). Falla silenciosamente si `BLOB_READ_WRITE_TOKEN` no está en `sara_cron.yml`.** Ver H-REPORTE-02 en `06_PENDIENTES.md`. |
| **Estado real (confirmado por P5, 29/10/2026)** | **🔴 El reporte diario NUNCA se ha entregado al operador.** En 23 h de bitácora (27/10 20:45 → 28/10 19:03) se ejecutaron **22 corridas CRON** y **0 reportes diarios**. Al menos 11 de esas corridas ocurrieron después de las 6:00 MX. El operador depende 100% del reporte on-demand manual. |

**Historia del bug:** en la migración del 27/10/2026, el runner pasó a usar Google Drive, pero `reporteDiario.mjs` quedó con la implementación de Blob. Como `BLOB_READ_WRITE_TOKEN` no se inyecta en `sara_cron.yml`, `put()` falla con `token: undefined` y el `catch` del runner absorbe el error. Cada corrida lo reintenta sin éxito.

**Deuda derivada (confirmada por P5):** **H-REPORTE-03.** `debeGenerarReporteDiario` reintenta cada corrida post-6:00 porque la bitácora nunca registra el intento (el diario falla antes de devolver el `registro_bitacora`). Son ~8-11 intentos fallidos por día, invisibles. La corrección de H-REPORTE-02 reduce el ruido, pero H-REPORTE-03 debe corregirse para evitar reintentos innecesarios.

**Agravante al arreglar H-REPORTE-02:** el `systemPrompt` del diario **no tiene la regla 17** (control de emergencias). Confirmado por P3 del 29/10/2026. Si se arregla solo H-REPORTE-02, el diario saldría sin control de emergencias. **H-PROMPT-06 debe corregirse en el mismo lote que H-REPORTE-02.**

### 2.2 Reporte bajo demanda

| Aspecto | Detalle |
|---|---|
| Quién lo solicita | Operador autorizado, desde la Sala Operativa |
| Qué genera | Reporte con ventana de 48 horas (ayer y hoy) |
| Dónde se guarda | `reporte_diocesano_vigente.json` en Google Drive, solo si las 14 zonas tienen datos |
| **Estado real** | ✅ **Es el único reporte que llega al operador hoy.** Funciona porque `api/reporte-ondemand.js` sí usa `escribirJSONBlob` de Drive. |

**Modo parcial:** si faltan zonas, el backend genera un reporte parcial. Un reporte parcial **no** se guarda en Google Drive, para no sustituir al vigente. La decisión la toma el backend (`esParcialReal`), no el navegador.

**Acceso de operadores:** cada operador tiene una clave personal, gestionada fuera del repositorio (`SATRC_OPERADORES_JSON`). Si una clave se pierde o se compromete, se rota y se actualiza en Vercel. Cada reporte queda registrado en la bitácora con el rol que lo generó.

**Verificación del estado real del reporte vigente (29/10/2026):** el `reporte_diocesano_vigente.json` en Drive tiene `origen: ON_DEMAND_OPERADOR`, `fecha_dia_mexico: 28 de octubre de 2026`, `timestamp_iso_utc: 2026-10-28T23:24:58.815Z`. La bitácora `SARA_LOG_20` coincide exactamente con ese timestamp y encadena bien. **H-ONDEMAND-09 refutada para el caso del 28/10.**

---

## 3. Disparar el proceso manualmente

Requisitos: GitHub CLI instalado y sesión iniciada (`gh auth login`).

```powershell
gh workflow run sara_cron.yml --ref main --repo Maxiaintelligence/satrc-v2
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 1
gh run view <RUN_ID> --repo Maxiaintelligence/satrc-v2 --log
```

Alternativa: en GitHub, pestaña Actions, workflow `sara_cron`, botón **Run workflow**, rama `main`.

Para disparar desde PowerShell con el secreto del cron, obtener el valor en Vercel (Settings → Environment Variables) y no escribirlo en ningún archivo:

```powershell
$secret = Read-Host "Secreto del cron" -AsSecureString
$plano = [System.Net.NetworkCredential]::new("", $secret).Password
Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/disparar-workflow" `
  -Method POST -Headers @{ "x-cron-secret" = $plano }
Remove-Variable plano
```

> **Nota:** un disparo manual agrega una corrida al cómputo diario. Si el doble disparador (N-CRON-05) sigue activo, el total puede superar 12 corridas/día en días con intervención manual. Bajo DEC-008, esto consume minutos de GitHub Actions de forma acelerada.

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

**Riesgo activo R-03 (confirmado por P5b, 29/10/2026):** `GET /api/sara` devuelve la bitácora completa y las evaluaciones N3/N4 sin autenticación. Pendiente de mitigar.

### 4.2 Interfaz y API

```powershell
curl.exe -s -o NUL -w "/: HTTP %{http_code}`n" "https://satrc-v2.vercel.app/"
```

### 4.3 Estado publicado

Verificación por endpoint:

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "origen: $($sara.origen)"
Write-Host "Semáforo: N4=$($sara.semaforo.totalNivel4), N3=$($sara.semaforo.totalNivel3)"
```

Valores esperados de `origen`:

| Valor | Significado | Acción |
|---|---|---|
| `GOOGLE_DRIVE_ACTUALIZADO` | Estado publicado válido. La API leyó Drive, validó con Zod y devuelve 200. | ✅ Todo en orden |
| `ERROR_DRIVE` | Estado publicado no disponible. 503 honesto. Puede ser por: (a) Drive no responde; (b) `estado_ligero.json` no existe o está corrupto; (c) Zod rechazó el payload. No hay fallback silencioso ni bitácora falsa. | Verificar logs de Vercel + timestamp real en Drive (§4.4) + estado de Apps Script |

**Nota importante (cambio de modelo de errores respecto a v2.6):** el origen `RESPUESTA_EN_VIVO` ya no existe. Fue eliminado el 28/10/2026 con el commit `b25d7c5` (cierre de H-SARA-01/03/04). La API actual devuelve `GOOGLE_DRIVE_ACTUALIZADO` o `ERROR_DRIVE`. La documentación anterior describía un fallback que ya no existe.

**Comportamiento del frontend cuando `origen === ERROR_DRIVE`:**

- **Monitor Público:** no recalcula. Conserva el último `evaluacionLocal` recibido y sigue mostrando el semáforo previo. Si nunca recibió estado válido, el bloque 2.bis (semáforo + desglose por vector) no se renderiza (N-UI-01). El ciudadano ve solo el texto hardcodeado de la "Síntesis Comunitaria".
- **Sala Operativa:** cae a `ejecutarEvaluacionRealEnVivo` (fallback solo hidrológico, sin orquestador). Ver H-MULTI-06.

### 4.4 Verificación del estado real en Google Drive

Paso obligatorio (según `00_METODOLOGIA.md` v2.6 §Fase 4). Verificar el timestamp de los archivos en Drive, no solo el exit code del runner.

| Archivo en Drive | Contenido | Quién lo lee | Cómo verificarlo |
|---|---|---|---|
| `estado_diocesano.json` | Paquete maestro completo (405 localidades) | Auditoría manual | Buscar `actualizado_iso` en el JSON. Debe ser posterior a la última corrida. |
| `estado_ligero.json` | Paquete ligero (semáforo + N3/N4) | `/api/sara` | Es el archivo que realmente sirve `/api/sara`. Si `/api/sara` responde con `origen: GOOGLE_DRIVE_ACTUALIZADO` y datos coherentes, este archivo está actualizado. |
| `bitacora_sara.json` | Registro encadenado SHA-256 | `/api/sara` | Verificar el `hash_completo` del último registro vs el `prev_hash` del siguiente (cadena). |
| `reporte_diocesano_vigente.json` | Último reporte vigente | `/api/sara` | Hoy solo lo escribe el on-demand (H-REPORTE-02). Si el operador nunca ha generado uno manualmente, este archivo no existe. |

**Comando para verificar el estado publicado:**

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "hora_servidor_mexico: $($sara.hora_servidor_mexico)"
Write-Host "origen: $($sara.origen)"
Write-Host "bitacora (últimos 3 registros):"
$sara.bitacora | Select-Object -Last 3 | ForEach-Object {
    Write-Host "  $($_.id) | $($_.timestamp_local) | $($_.titulo)"
}
```

**Verificación de la cadena SHA-256 (protocolo P6, 29/10/2026):**

```powershell
# Leer bitácora directo de Drive
$envContent = Get-Content .env.local -Raw
$googleUrlLine = ($envContent -split "`n" | Where-Object { $_ -match '^\s*GOOGLE_SCRIPT_URL\s*=' } | Select-Object -First 1)
$googleUrl = ($googleUrlLine -replace '^\s*GOOGLE_SCRIPT_URL\s*=\s*', '').Trim().Trim('"').Trim("'")
$bitacora = Invoke-RestMethod -Uri "$googleUrl`?action=leer&file=bitacora_sara.json" -Method GET -TimeoutSec 15

$entradas = $bitacora.bitacora
$rotas = 0
for ($i = 1; $i -lt $entradas.Count; $i++) {
  $prev_esperado = $entradas[$i-1].hash_completo
  $prev_real = $entradas[$i].prev_hash -replace '\.\.\.$',''
  if (-not $prev_real.StartsWith($prev_esperado.Substring(0,16))) {
    Write-Host "  Cadena rota en $($entradas[$i].id)" -ForegroundColor Red
    $rotas++
  }
}
if ($rotas -eq 0) { Write-Host "  Cadena íntegra ($($entradas.Count) entradas verificadas)" -ForegroundColor Green }
```

**Resultado verificado el 29/10/2026:** 23/23 eslabones íntegros. La mezcla de orígenes (`PROGRAMADO_CRON` + `ON_DEMAND_OPERADOR`) no rompió la cadena.

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

**Estado conocido (P7, 29/10/2026):** en 60 corridas de 5 días (24–28/10): 53 success + 7 failure. Los 7 failure son del 27/10 (troubleshooting del incidente de producción, ya resueltos). Los 5 días posteriores (28/10) no tienen fallos.

**Verificación del doble disparador (P7):**

```powershell
# Con GITHUB_PAT del .env.local
$envContent = Get-Content .env.local -Raw
$patLine = ($envContent -split "`n" | Where-Object { $_ -match '^\s*GITHUB_PAT\s*=' } | Select-Object -First 1)
$pat = ($patLine -replace '^\s*GITHUB_PAT\s*=\s*', '').Trim().Trim('"').Trim("'")
$headers = @{ "Authorization" = "Bearer $pat"; "Accept" = "application/vnd.github+json"; "User-Agent" = "SatRC-Verificacion" }
$runs = Invoke-RestMethod -Uri "https://api.github.com/repos/Maxiaintelligence/satrc-v2/actions/workflows/sara_cron.yml/runs?per_page=60" -Headers $headers
$runs.workflow_runs | Group-Object event | Select-Object Name, Count | Format-Table -AutoSize
```

**Interpretación esperada:** `schedule` ≈ 3-4/día + `workflow_dispatch` ≈ 8-9/día. Si el `on.schedule` se desactiva (por PEND-07), solo debe aparecer `workflow_dispatch`. Si el `workflow_dispatch` se desactiva (por PEND-07), solo `schedule`.

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
node --check api\smn.js
node --check api\latest-gif.js
node --check scripts\ejecutar_sara_autonomo.mjs
node --check scripts\reportes\reporteDiario.mjs
node --check scripts\engine\riskEvaluatorRunner.mjs
```

**Baseline verificado el 29/10/2026** (HEAD `1281d43`, node v22.23.3, npm 10.9.9):

| Comando | Resultado real |
|---|---|
| `npm test` | **165 pass + 2 rojos conocidos** en 17 archivos. Los rojos son `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []" y `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones". Ambos obsoletos por el cambio de schema `3053e29` (H-DRIVE-02). Pendiente actualizar los tests. |
| `npm run lint` | **55 advertencias, 0 errores.** Las advertencias están en `06_PENDIENTES.md` (DEU-24). Las adicionales respecto a la cifra anterior (51) corresponden a `react(set-state-in-effect)` y `react(purity)` en componentes React, no solo `no-unused-vars`. |
| `npm run build` | Verde. 853.44 kB / 201.79 kB gzip. Warning benigno de chunk > 500 kB. |

**Corrección documental:** las cifras "167 pruebas en verde" y "51 advertencias" que aparecían en la versión anterior de este documento eran inexactas. Ver H-DOC-BASELINE-01/02 en `06_PENDIENTES.md` §2.9. La corrección se registra aquí; `LEEME_PRIMERO.md` ya fue actualizado con las cifras correctas.

> **`node --check` es obligatorio para `api/` y `scripts/`**, porque `npm test` no los cubre. N-CI-03 (`06_PENDIENTES.md` §2.5) registra que `tests.yml` no corre `node --check` ni `npm run build`. Un error de sintaxis en `api/sara.js` o un import roto en `src/` puede llegar a `main` sin detección automática. Hasta que N-CI-03 se resuelva, la verificación manual de §5 es la única garantía.

### 5.1 Entorno local y credenciales

El proyecto admite pruebas profundas en local. Crea un archivo `.env.local` en la raíz (está en `.gitignore`, nunca se sube) y define las variables descritas en §8.1.

Para validar que las credenciales son correctas antes de correr pruebas, se recomienda usar el script de validación de 4 niveles que hace peticiones reales a Google Apps Script, Groq y Vercel.

**Estado del `.env.local` (verificado el 29/10/2026):** contiene las 8 variables esperadas: `GOOGLE_SCRIPT_URL`, `GROQ_API_KEY`, `SARA_ADMIN_TOKEN`, `CLAVE_SALA_OPERATIVA`, `CRON_SECRET`, `SATRC_OPERADORES_JSON`, `GITHUB_PAT`, `SARA_LLM_KILL_SWITCH`.

---

## 6. Recuperación ante fallos

### 6.1 El proceso autónomo falla

Revisar el log: `gh run view <RUN_ID> --log`.

Identificar la causa:

| Mensaje | Causa probable | Acción |
|---|---|---|
| `Open-Meteo HTTP 503` | Servicio externo caído, transitorio | Esperar y disparar de nuevo |
| `BLOB_READ_WRITE_TOKEN` en el log del runner | `reporteDiario.mjs` no puede escribir porque falta el token. El diario falla silenciosamente pero la corrida queda en verde. | H-REPORTE-02 activo. Mientras no se resuelva: (a) configurar `BLOB_READ_WRITE_TOKEN` en `sara_cron.yml` como solución temporal para que el diario escriba en Blob, o (b) esperar al fix que migra `reporteDiario.mjs` a Drive. Los reportes on-demand funcionan independientemente. |
| `[ZOD] El paqueteMaestro no cumple el schema: undefined` | Fallo de Zod. El log imprime `undefined` porque `ejecutar_sara_autonomo.mjs:635` usa `validacion.error.errors`, eliminado en Zod 4. H-PKG-01 activo. El workflow falla en rojo (`process.exit(1)` en la línea siguiente) pero el mensaje no dice qué campo falló. | Corregir el log del runner (`validacion.error.issues` en lugar de `.errors`) o investigar manualmente el payload del `paqueteMaestro`. Ver H-PKG-01 en `06_PENDIENTES.md` §2.4. |
| `Cannot find module` | Importación rota | Revisar el último commit |
| `✅ Publicación exitosa` seguido de un timestamp viejo en `/api/sara` | H-DRIVE-01 activo (riesgo latente). `escribirJSONBlob` retorna `null` sin propagar. El log miente. | Verificar el timestamp real en Drive (§4.4). Si el timestamp NO cambió pero el log dice "éxito", la escritura falló silenciosamente. |
| Ausencia de entrada `PROGRAMADO_REPORTE_DIARIO` en bitácora aunque haya corridas post-6:00 | H-REPORTE-02 + H-REPORTE-03 activos. El diario falla antes de registrar la entrada. | Ver §2.1. |

### 6.2 El archivo en Google Drive no se actualiza

1. Confirmar que la última corrida terminó bien (sección 4.6).
2. No confiar en "Publicación exitosa" del log. Verificar el timestamp real de `estado_ligero.json` en Drive (§4.4).
3. Si el timestamp es viejo pero el log dice éxito → H-DRIVE-01 (riesgo latente). Revisar los logs de Apps Script.
4. Si hay un error al publicar, revisar que `GOOGLE_SCRIPT_URL` esté configurada en Vercel y que la implementación en Google Apps Script siga activa.

**Estado empírico del 29/10/2026 (P4):** lectura y escritura de Drive funcionaron correctamente. `estado_ligero.json` y `estado_diocesano.json` tienen `actualizado_iso: 2026-10-29T01:03:45.451Z` (28/10 19:03 MX), coherente con la última corrida CRON (`SARA_LOG_23`). H-DRIVE-01 es un riesgo latente, no un bug activo hoy. Pero el `return null` silencioso sigue en el código; un fallo futuro de Apps Script pasaría invisible.

### 6.3 `/api/sara` devuelve `origen: ERROR_DRIVE`

`origen: ERROR_DRIVE` significa que el estado publicado no se sirvió. La API devuelve 503 con `SISTEMA_NO_DISPONIBLE` como `dictamen.estado_situacion`. Hay tres causas posibles:

| Causa | Verificación | Acción |
|---|---|---|
| Zod rechazó el estado de Drive | Log de Vercel: `[ZOD] El estado de Drive no cumple el schema` | Revisar el campo indicado. El estado publicado debe corregirse. |
| Drive no responde o `estado_ligero.json` no existe | Log de Vercel: error al leer `estado_ligero.json` desde Apps Script | Revisar `GOOGLE_SCRIPT_URL`, el estado de Apps Script y la cuota de ejecución. |
| `estado_ligero.json` no tiene `semaforo` | El archivo existe pero no tiene los 4 contadores | Regenerar el estado con una corrida manual del runner (§3). |

> **Importante (cambio respecto a v2.6):** el origen `RESPUESTA_EN_VIVO` ya no existe. Fue eliminado con `b25d7c5` el 28/10/2026. No hay fallback de backend. El frontend tiene su propio respaldo:
> - **Monitor Público:** conserva el último `evaluacionLocal` recibido. Si nunca recibió estado válido, no muestra semáforo.
> - **Sala Operativa:** cae a `ejecutarEvaluacionRealEnVivo` (solo motor hidrológico).

### 6.4 Los datos están viejos

Revisar la hora del dictamen en `/api/sara` (`hora_servidor_mexico`) o el timestamp del último registro de la bitácora. Si tiene más de 4 horas:

- **Causa 1: el cron no está corriendo.** Verificar que al menos uno de los dos disparadores (interno en `sara_cron.yml` o externo cron-job.org) esté activo. Nota: el `on.schedule` interno corre con jitter masivo (N-CRON-05); el externo es más confiable.
- **Causa 2: el estado publicado está viejo en Drive** (H-DRIVE-01 latente). Verificar §4.4.
- **Causa 3: `estado_ligero.json` no se actualizó.** Ver logs de Apps Script.

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
| Reporte on-demand | 2500 | Menor por el timeout de Vercel. Ver H-ONDEMAND-06 (deuda abierta). |
| Dictamen del runner | Ninguno | H-PROMPT-05 activo. Puede truncarse bajo latencia alta. |

Si el error 400 ocurre en el dictamen del runner, el problema es H-PROMPT-05. Ver `06_PENDIENTES.md`.

### 6.7 Timeout de Vercel al generar On-Demand

Si el reporte on-demand tarda más de 10 segundos, Vercel corta la conexión y el frontend muestra "Error del servidor". H-ONDEMAND-05 activo: `TIMEOUT_GROQ_MS = 8000` en `api/reporte-ondemand.js`. Con 2 reads + 1 Groq (8s) + 2 writes a Drive, se supera el timeout de 10s de Vercel Hobby.

Acciones posibles mientras H-ONDEMAND-05 no se resuelva:

- Reducir el prompt (menos focos críticos en el request).
- Reintentar (a veces Groq responde más rápido).
- Si es recurrente, considerar dividir la operación en 2 requests (lectura primero, generación después).

### 6.8 Escritura silenciosa fallida en Drive (H-DRIVE-01)

**Síntoma:** el log del runner dice `✅ Publicación exitosa`, pero el timestamp de `estado_ligero.json` en Drive no cambió.

**Causa:** `escribirJSONBlob` devuelve `null` en caso de fallo y no propaga el error. El runner no verifica el valor devuelto.

**Estado empírico del 29/10/2026 (P4):** no se ha manifestado. La lectura y escritura funcionaron correctamente. Es un riesgo latente.

**Verificación:**

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "hora_local_mexico: $($sara.hora_local_mexico)"
# Si es mayor a 4 horas y no hay emergencia → H-DRIVE-01 activo
```

**Acción:** revisar el estado de Apps Script. Si el script está bloqueado o la implementación se cayó, `escribirJSONBlob` retorna `null` silenciosamente.

### 6.9 El dictamen se trunca (H-PROMPT-05)

**Síntoma:** el campo `comentario_oficial` del dictamen se corta a mitad de una frase, o el JSON del dictamen está mal formado.

**Causa:** el dictamen del runner llama a Groq sin `max_completion_tokens`.

**Acción:** ver H-PROMPT-05 en `06_PENDIENTES.md`. Mientras no se resuelva, reducir la longitud del prompt del dictamen.

### 6.10 Días tranquilos y semáforo público (actualización del modelo de errores)

**Cambio respecto a v2.6:** ya no existe `RESPUESTA_EN_VIVO` en días tranquilos. H-SARA-02 se cerró con el commit `2a3e3e8` (28/10/2026). El runner ya no envía `evaluaciones: null`; envía `[]` en días sin N3/N4.

**Estado actual cuando no hay N3/N4:**

- El runner escribe `estado_ligero.json` con `evaluaciones: []` y `origen: GOOGLE_DRIVE_ACTUALIZADO`.
- `/api/sara` responde 200 con `origen: GOOGLE_DRIVE_ACTUALIZADO` y `evaluaciones: []`.
- **Monitor Público:** el bloque 2.bis (semáforo + desglose por vector) no se renderiza. El ciudadano ve solo el texto hardcodeado de la "Síntesis Comunitaria" sin semáforo real. Es N-UI-01 en `06_PENDIENTES.md` §2.3 (deuda nueva detectada el 29/10/2026). Bajo DEC-011, esto es "gris silencioso": el ciudadano no distingue "no hay N3/N4" de "no hay datos del motor".
- **Sala Operativa:** al recibir `evaluaciones: []`, cae a `ejecutarEvaluacionRealEnVivo` (fallback solo hidrológico). Muestra el semáforo calculado en vivo, sin N3/N4 en la mayoría de los casos. No es `ERROR_DRIVE`, es comportamiento esperado hasta que N-UI-01 se resuelva.

**Acción mientras N-UI-01 no se resuelva:** en Monitor Público, en días tranquilos, el bloque 2.bis puede no aparecer. Es el comportamiento actual; no es un fallo del sistema. El bloque de "Decisión Operativa del Día" (que consume el `reporte_vigente`) sigue apareciendo si hay reporte vigente.

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
| cron-job.org | Disparo externo cada 3 horas | Encabezado con el secreto del cron |
| Open-Meteo | Pronósticos (sin clave) | No aplica |
| SMN / CONAGUA | Avisos oficiales (consulta pública) | No aplica |
| NOAA GOES-19 | Imágenes satelitales (acceso público) | No aplica |

### 8.1 Variables de entorno

**Variables en uso (verificadas contra el código):**

| Variable | Uso | Obligatoria en producción |
|---|---|---|
| `SARA_ADMIN_TOKEN` | Token para `?forzar=true` en `/api/sara`. | Sí, si se usa el forzar |
| `GROQ_API_KEY` | Redacción de reportes y dictamen. | Sí |
| `GOOGLE_SCRIPT_URL` | Endpoint de Google Apps Script para leer/escribir Drive. | Sí |
| `SATRC_OPERADORES_JSON` | Mapa de claves de operador a roles. | Sí |
| `CLAVE_SALA_OPERATIVA` | Clave de acceso a la Sala Operativa. | Sí |
| `CRON_SECRET` | Autorizar el disparo externo (`x-cron-secret`). | Sí |
| `GITHUB_PAT` | Disparar el workflow desde la API. | Sí, para el disparo externo |

**Variables con estado especial:**

| Variable | Estado | Acción |
|---|---|---|
| `BLOB_READ_WRITE_TOKEN` | **Obligatoria hasta que H-REPORTE-02 se resuelva.** Sin ella, el reporte diario falla silenciosamente. Confirmado por P5 el 29/10/2026: en 23 h de bitácora, 22 corridas CRON y 0 reportes diarios entregados. | Configurarla en `sara_cron.yml` como solución temporal para que el diario escriba en Blob mientras se migra `reporteDiario.mjs` a Drive. Cuando H-REPORTE-02 se cierre, la variable se puede eliminar definitivamente. |
| `SARA_LLM_KILL_SWITCH` | **No implementada en el código actual.** Verificado en la sesión del 29/10/2026: la variable está presente en `.env.local` pero no se consume en ningún archivo del repositorio revisado. Si vale `DISABLED`, no desactiva el modelo. | Verificar si es una feature pendiente o si la documentación anterior era prematura. Mientras no se implemente, no confiar en ella. |
| `SARA_ONDEMAND_TOKEN` | **NO debe configurarse.** Actualmente NO está configurada en Vercel. Si se configura, el endpoint `/api/reporte-ondemand` empieza a exigir el header `x-admin-token` que el frontend no envía. Esto rompe todos los reportes on-demand. Ver H-ONDEMAND-01. | Dejar sin configurar. La lógica defensiva del código (`if (!esperado) return true`) permite que el endpoint funcione mientras la variable esté ausente. |
| `VITE_SARA_ONDEMAND_TOKEN` | Eliminada del código (R-02, 27/10/2026). | No aplica. |

**Aclaración sobre `BLOB_READ_WRITE_TOKEN` (actualizada el 29/10/2026):** versiones previas decían que era "obsoleta" tras la migración a Drive. Eso sigue siendo incorrecto. `reporteDiario.mjs` todavía la usa. Mientras H-REPORTE-02 no se resuelva, configurarla es la única forma de que el diario se guarde (aunque sea en Blob). Cuando H-REPORTE-02 se cierre, la variable se podrá eliminar definitivamente.

**Aclaración sobre `SARA_ONDEMAND_TOKEN`:** el código tiene una lectura defensiva (`if (!esperado) return true`). Si se configura, activa una validación que el frontend no puede cumplir. **Nunca configurarla.** Ver H-ONDEMAND-01.

**Aclaración sobre `SARA_LLM_KILL_SWITCH`:** verificado el 29/10/2026. Presente en `.env.local` pero no consumida por el código. La documentación anterior (v2.6 §8.1) la describía como si funcionara. Corrección documental registrada. Si se decide implementarla, debe añadirse al sistema de decisiones y a `06_PENDIENTES.md`.

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

## 10. Decisiones pendientes que afectan la operación

Estas decisiones bloquean fixes que reducirían ruido en producción. Se registran aquí para que quien opera sepa qué esperar mientras se resuelven.

**Decisiones resueltas el 29/10/2026:**

| ID | Pregunta | Resolución | Documento |
|---|---|---|---|
| PEND-06 | ¿Qué criterio operativo debe disparar N2 por niebla? | **Opción C enriquecida.** La niebla deja de disparar nivel. Se expone como `contexto.niebla` con período y persistencia. | **DEC-012** |
| PEND-07 | ¿El `on.schedule` interno de `sara_cron.yml` se mantiene como respaldo o se elimina? | **Opción A.** Se mantienen ambos disparadores como capa de seguridad. | **ADR-010** |
| PEND-08 | ¿Cómo resolver N-MOTOR-09 (acoplamiento duplicado)? | **Opción A.** Se conserva `HIDRO_TERMICO=0.15`, se elimina `TERMICO_HIDRO=0.10`. | **ADR-011** |

**Decisiones pendientes (no resueltas):** PEND-03, PEND-04, PEND-05 (ver `08_DECISIONES.md` Parte C).

---

## 11. Documentos relacionados

- `docs/00_METODOLOGIA.md`: reglas de trabajo, protocolo de modificación, verificación de efecto real.
- `docs/01_CONTEXTO.md`: qué es SatRC, principios, glosario. Principio de precisión (DEC-011).
- `docs/02_ARQUITECTURA.md`: capas, flujo de datos, endpoints, almacenamiento, contratos (Zod).
- `docs/03_MOTOR_RIESGO.md`: reglas del motor hidrológico, evaluadores, orquestador, consenso. Pendiente de corrección de H-VIENTO-01 §5.1.
- `docs/04_HISTORIAL.md`: cronología de bugs resueltos, lecciones, commits. §7 contiene la auditoría empírica P0–P12 del 29/10/2026.
- `docs/05_PROMPT_SARA.md`: prompts de SARA, reglas, estado de la adaptación multivectorial.
- `docs/06_PENDIENTES.md`: única lista vigente de deudas y riesgos. §2 contiene las deudas activas confirmadas por la auditoría. §6 contiene PEND-06/07/08. §7 contiene el registro de las pruebas P0–P12.
- `docs/08_DECISIONES.md`: ADRs y decisiones de arquitectura. Parte C contiene PEND-06/07/08.
- `docs/archivo/FIXES_PROMPTS_2026-10-28.md`: propuestas de implementación de los fixes de prompts (H-PROMPT-05..10).
- `docs/LEEME_PRIMERO.md`: punto de entrada y estado general.

---

*Fin del documento.*