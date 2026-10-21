# SatRC V2.0 — Guía de Operación y Despliegue

> **Última actualización:** Octubre 2026 (Etapa 3 cerrada. H0–H9 completados).

## Índice

1. [Despliegue](#1-despliegue)
2. [Generación de reportes](#2-generación-de-reportes)
3. [Disparar el workflow manualmente](#3-disparar-el-workflow-manualmente)
4. [Verificar el estado de producción](#4-verificar-el-estado-de-producción)
5. [Recuperación ante fallos](#5-recuperación-ante-fallos)
6. [Acceso a los servicios](#6-acceso-a-los-servicios)
7. [Variables de entorno (desarrollo local)](#7-variables-de-entorno-desarrollo-local)
8. [Estado de la Etapa 3](#8-estado-de-la-etapa-3)
9. [Contacto y escalamiento](#9-contacto-y-escalamiento)
10. [Recursos y referencias](#10-recursos-y-referencias)

---

## 1. Despliegue

### Frontend + API (Vercel)

- **Deploy automático:** al hacer `git push origin main`, Vercel hace deploy.
- **Sin `vercel.json`:** el deploy usa autodetección (funciones en `api/`, frontend en `src/`).
- **Verificación:** en [Vercel Dashboard](https://vercel.com/dashboard) → proyecto `satrc-v2` → *Deployments*. El último commit debe aparecer como **Ready**.

### Runner (GitHub Actions)

- **Deploy automático:** al hacer `git push origin main`, el próximo workflow usa el código nuevo.
- **Workflow:** `.github/workflows/sara_cron.yml` (runner) y `.github/workflows/tests.yml` (tests).
- **Horario:** cada 3 horas (`cron '21 */3 * * *'`) + disparo manual.
- **Scheduler externo:** cron-job.org (llama a `/api/disparar-workflow`).

---

## 2. Generación de reportes

### Reporte diario automático (6:00 AM hora México)

| Aspecto | Detalle |
|---|---|
| **Quién** | El runner (`scripts/ejecutar_sara_autonomo.mjs`) |
| **Cuándo** | Primera corrida ≥ 6:00 AM del día |
| **Cómo se detecta** | Función `debeGenerarReporteDiario()` en el runner |
| **Qué hace** | Invoca `generarReporteDiario()` (en `scripts/reportes/reporteDiario.mjs`) |
| **Qué genera** | Reporte con ventana de 72 h (ayer + hoy + mañana) |
| **Dónde se guarda** | `reporte_diocesano_vigente.json` en Vercel Blob |

### Reporte on-demand

| Aspecto | Detalle |
|---|---|
| **Quién** | Operador diocesano autenticado |
| **Cómo** | Sala Operativa → botón **"Generar Reporte On-Demand"** → clave personal |
| **Qué hace** | `api/reporte-ondemand.js` → Groq → Blob |
| **Qué genera** | Reporte con ventana de 48 h (ayer + hoy) |
| **Dónde se guarda** | `reporte_diocesano_vigente.json` (solo si 14/14 zonas OK) |

> **Modo emergencia:** si faltan zonas, se genera un reporte parcial que **NO** se guarda en el Blob (protege el vigente).

> **Nota de tokens:** el LLM está configurado con `max_completion_tokens: 4096` (H8.5) para evitar que el JSON de 7 secciones se corte y Groq devuelva HTTP 400.

### Claves de operador

- **Ubicación:** `api/reporte-ondemand.js` (mapa `USUARIOS_AUTORIZADOS`).
- **Valores actuales:** `Antonio2026`, `Roberto2026`, `Omar2026`, `Obispo2026`.
- **Trazabilidad:** cada reporte queda registrado en la bitácora SHA-256 con `generado_por`.

---

## 3. Disparar el workflow manualmente

Hay 3 formas. **Recomendación:** usar `gh` CLI.

### Opción A — `gh` CLI (recomendada)

**Requisitos:** tener `gh` instalado y estar logueado (`gh auth login`).

```bash
gh workflow run sara_cron.yml --ref main --repo Maxiaintelligence/satrc-v2
```

Verificar que se disparó:

```bash
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 1
```

Ver el log en vivo:

```bash
gh run view <RUN_ID> --repo Maxiaintelligence/satrc-v2 --log
```

### Opción B — UI de GitHub

1. Abrir: <https://github.com/Maxiaintelligence/satrc-v2/actions/workflows/sara_cron.yml>
2. Click en **Run workflow**.
3. Branch: `main`.
4. Click en **Run workflow**.

### Opción C — PowerShell con `CRON_SECRET`

**Requisitos:** tener `CRON_SECRET` (en Vercel → Settings → Environment Variables).

```powershell
$secret = "<CRON_SECRET>"
Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/disparar-workflow" `
  -Method POST `
  -Headers @{ "x-cron-secret" = $secret }
```

---

## 4. Verificar el estado de producción

### Frontend + API

**1. ¿El index carga?**

```powershell
curl.exe -s -o NUL -w "/: HTTP %{http_code}`n" "https://satrc-v2.vercel.app/"
```

**2. ¿`/api/sara` responde y valida Zod? (H8)**

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "origen: $($sara.origen)" # Debe ser VERCEL_BLOB_ACTUALIZADO
Write-Host "Semáforo: N4=$($sara.semaforo.totalNivel4), N3=$($sara.semaforo.totalNivel3)"
Write-Host "Bitácora: $($sara.bitacora.Count) entradas"
```

**3. ¿`/api/smn` responde?**

```powershell
$smn = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/smn" -Method GET
Write-Host "SMN: activo=$($smn.alerta.activo), nivel=$($smn.alerta.nivel)"
```

**4. ¿`/api/latest-gif` responde?**

```powershell
$gif = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/latest-gif?p=geocolor" -Method GET
Write-Host "GIF: $($gif.url.Substring(0, 60))..."
```

### Runner (última corrida)

```bash
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 3
```

Esperado: corridas con ✓ (success).

### Tests locales (Vitest)

Antes de hacer un push, verificar que los 79 tests pasen:

```powershell
cd "C:\Users\anton\...\satrc-v3"
npm test
```

---

## 5. Recuperación ante fallos

### El cron falla (workflow rojo)

1. Ver el log: `gh run view <RUN_ID> --log`.
2. Buscar errores comunes:

| Error | Causa probable |
|---|---|
| `Cannot find module` | Import roto |
| `Open-Meteo HTTP 503` | Open-Meteo caído (transitorio) |
| `BLOB_READ_WRITE_TOKEN` | Credenciales faltantes |
| `❌ [ZOD] El paqueteMaestro no cumple el schema` | (H8) Bug en el motor. El runner abortó para no publicar datos corruptos. |

- **Si es transitorio (503):** esperar y reintentar.
- **Si es Zod (H8):** revisar el `console.error` que imprimió Zod. Indica exactamente qué campo falló (ej. `nivel_alerta` fuera de rango). Corregir el motor, pushear y reintentar.

### El Blob no se actualiza

1. Verificar que el runner corrió: `gh run list --workflow=sara_cron.yml --limit 1`.
2. Si el runner falló: ver el log.
3. Si el runner corrió OK pero el Blob no cambió: verificar `put()` en el log (`✅ [SARA RUNNER] Publicación exitosa`).
4. Si aparece `❌ Error al publicar en Vercel Blob`: verificar `BLOB_READ_WRITE_TOKEN`.

### `/api/sara` devuelve 500 o fallback en vivo

1. Verificar que Vercel esté en **Ready**.
2. Si Vercel está OK, pero `/api/sara` devuelve `origen: RESPUESTA_EN_VIVO` en vez de `VERCEL_BLOB_ACTUALIZADO`: Zod rechazó el Blob. Revisar los logs de Vercel (`[ZOD] El estado del Blob no cumple el schema`). Esto significa que el Blob tiene datos viejos o corruptos que no coinciden con el contrato actual.
3. **Rollback:** `git revert <hash-del-commit-roto>` + push.

### `/api/sara` devuelve datos viejos

Verificar el `actualizado_iso` del estado:

```powershell
$sara = Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/sara" -Method GET
Write-Host "Actualizado: $($sara.dictamen.timestamp)"
```

- **Muy viejo (> 6 h):** el cron no está corriendo. Disparar manualmente.
- **Reciente pero los datos no cambian:** verificar que el runner no esté en modo degradado (`CORRIDA_DEGRADADA` en la bitácora).

---

## 6. Acceso a los servicios

### Vercel

- **Dashboard:** <https://vercel.com/dashboard> → proyecto `satrc-v2`.
- **Environment Variables:** Settings → Environment Variables.
  - `GROQ_API_KEY`
  - `BLOB_READ_WRITE_TOKEN`
  - `SARA_ADMIN_TOKEN`
  - `SARA_ONDEMAND_TOKEN`
  - `CRON_SECRET`
  - `GITHUB_PAT`

### GitHub

- **Repo:** <https://github.com/Maxiaintelligence/satrc-v2>
- **Actions:** <https://github.com/Maxiaintelligence/satrc-v2/actions>
- **Secrets:** Settings → Secrets and variables → Actions.
  - `GROQ_API_KEY`
  - `BLOB_READ_WRITE_TOKEN`

### cron-job.org

- **Propósito:** disparar el workflow cada 3 h.
- **URL:** `https://satrc-v2.vercel.app/api/disparar-workflow`
- **Header:** `x-cron-secret: <CRON_SECRET>`
- **Configuración:** cada 3 h, zona `America/Mexico_City`.

### Groq

- **Consola:** <https://console.groq.com/>
- **Modelo:** `openai/gpt-oss-120b`
- **API Key:** `GROQ_API_KEY`

### Open-Meteo

- Sin API key. Uso libre (con límites de rate).
- **Endpoints:** `/v1/forecast` (pronóstico), `/v1/archive` (histórico).

### SMN / CONAGUA

- **Portal:** <https://smn.conagua.gob.mx/>
- Sin API key. Scraping de la página principal.

### NOAA GOES-19

- **CDN:** <https://cdn.star.nesdis.noaa.gov/GOES19/>
- Sin API key. Acceso público a los GIFs.

---

## 7. Variables de entorno (desarrollo local)

Ninguna está cargada por defecto en PowerShell. Si quieres correr el runner completo en local:

```powershell
$env:GROQ_API_KEY = "gsk_..."
$env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_..."
```

> **Decisión de Etapa 3:** la verificación funcional es 100 % en GitHub Actions.

---

## 8. Estado de la Etapa 3

- **Cerrados:** H0, H1, H2a, H2b, H2c, H3, H4, H5, H6, H7a, H7b, H8, H9.
- **Tests:** 79 passing (CI en GitHub Actions).
- **Producción:** validación estricta con Zod.

Ver `docs/08_ETAPA3_PLAN.md` para el detalle completo.

---

## 9. Contacto y escalamiento

| Rol | Persona | Clave de operador |
|---|---|---|
| Desarrollador principal | Ing. Antonio G. Madrigal | Preguntar clave al desarrollador |
| Coordinación pastoral | Padre Roberto López Medina | Preguntar clave al desarrollador |
| Coordinación pastoral | Padre Omar Martínez Vázquez | Preguntar clave al desarrollador |
| Autoridad eclesiástica | Mons. Óscar Roberto Domínguez C. | Preguntar clave al desarrollador |

**Para emergencias operativas:** contactar al coordinador de Cáritas diocesano.

---

## 10. Recursos y referencias

- [Open-Meteo docs](https://open-meteo.com/en/docs)
- [Groq API docs](https://console.groq.com/docs)
- [Vercel Blob docs](https://vercel.com/docs/vercel-blob)
- [NOAA GOES-19](https://www.star.nesdis.noaa.gov/goes/)
- [SMN](https://smn.conagua.gob.mx/)