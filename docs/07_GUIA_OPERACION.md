# SatRC V2.0 — Guía de operación

> **Versión del documento:** 2.4 (22/10/2026)
> **Audiencia:** quien opera, despliega o recupera el sistema.
> **Alcance:** procedimientos. Los servicios externos, sus cuentas y sus variables de entorno están en la referencia de servicios (sección 8).
> **Regla:** este documento no contiene claves, tokens ni nombres de personas. Las claves se gestionan en Vercel y en GitHub Secrets. Los contactos se consultan por el canal interno de coordinación.

---

## 1. Despliegue

### 1.1 Frontend y API (Vercel)

- **Despliegue automático:** cada `git push origin main` genera un despliegue en Vercel.
- **Configuración:** no existe `vercel.json`. Vercel detecta las funciones en `api/` y el frontend en `src/`.
- **Verificación:** en el panel de Vercel, el último despliegue debe aparecer como **Ready**.

### 1.2 Proceso autónomo (GitHub Actions)

- **Workflows:** `.github/workflows/sara_cron.yml` (proceso autónomo) y `.github/workflows/tests.yml` (pruebas).
- **Horario:** cada 3 horas (`21 */3 * * *`, en UTC) y ejecución manual.
- **Disparo externo:** el planificador cron-job.org llama a `/api/disparar-workflow` con el encabezado de secreto del cron.
- **Cambios:** el siguiente workflow usa el código nuevo; no hace falta desplegar nada más.

---

## 2. Reportes

### 2.1 Reporte diario automático

| Aspecto | Detalle |
|---|---|
| Quién lo genera | El proceso autónomo (`scripts/ejecutar_sara_autonomo.mjs`) |
| Cuándo | Primera corrida a partir de las 6:00 hora de México del día |
| Qué genera | Reporte con ventana de 72 horas (ayer, hoy y mañana) |
| Dónde se guarda | `reporte_diocesano_vigente.json` en Vercel Blob |

### 2.2 Reporte bajo demanda

| Aspecto | Detalle |
|---|---|
| Quién lo solicita | Operador autorizado, desde la Sala Operativa |
| Qué genera | Reporte con ventana de 48 horas (ayer y hoy) |
| Dónde se guarda | `reporte_diocesano_vigente.json`, solo si las 14 zonas tienen datos |

**Modo parcial:** si faltan zonas, el backend genera un reporte parcial. Un reporte parcial **no** se guarda en Blob, para no sustituir al vigente. La decisión la toma el backend (`esParcialReal`), no el navegador.

**Acceso de operadores:** cada operador tiene una clave personal, gestionada fuera del repositorio. Si una clave se pierde o se compromete, se rota y se actualiza en Vercel. Cada reporte queda registrado en la bitácora con el operador que lo generó.

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
Invoke-RestMethod -Uri "https://<DOMINIO_DE_PRODUCCION>/api/disparar-workflow" `
  -Method POST -Headers @{ "x-cron-secret" = $plano }
Remove-Variable plano
```

---

## 4. Verificar producción

Ejecutar en PowerShell. Sustituir `<DOMINIO_DE_PRODUCCION>`.

**Interfaz y API**

```powershell
curl.exe -s -o NUL -w "/: HTTP %{http_code}`n" "https://<DOMINIO_DE_PRODUCCION>/"
```

**Estado publicado** (debe indicar `VERCEL_BLOB_ACTUALIZADO`):

```powershell
$sara = Invoke-RestMethod -Uri "https://<DOMINIO_DE_PRODUCCION>/api/sara?t=$(Get-Date -UFormat %s)" -Method GET
Write-Host "origen: $($sara.origen)"
Write-Host "Semáforo: N4=$($sara.semaforo.totalNivel4), N3=$($sara.semaforo.totalNivel3)"
```

**Aviso del SMN:**

```powershell
$smn = Invoke-RestMethod -Uri "https://<DOMINIO_DE_PRODUCCION>/api/smn" -Method GET
Write-Host "SMN: activo=$($smn.alerta.activo), nivel=$($smn.alerta.nivel)"
```

**Última corrida del proceso autónomo:**

```powershell
gh run list --workflow=sara_cron.yml --repo Maxiaintelligence/satrc-v2 --limit 3
```

Resultado esperado: corridas con éxito. En el log, la línea de zonas debe indicar 14 de 14.

---

## 5. Pruebas locales

Antes de cualquier `git push`:

```powershell
cd "<RUTA_DEL_PROYECTO>"
npm test
npm run lint
node --check api\sara.js
```

Referencia verificada el 22/10/2026: 143 pruebas en 16 archivos, todas en verde; el lint reporta 0 errores y 50 advertencias. Las advertencias están en `06_PENDIENTES.md` (DEU-24 y DEU-25).

`node --check` es obligatorio para `api/` y `scripts/`, porque `npm test` no los cubre.

---

## 6. Recuperación ante fallos

### 6.1 El proceso autónomo falla

1. Revisar el log: `gh run view <RUN_ID> --log`.
2. Identificar la causa:

| Mensaje | Causa probable | Acción |
|---|---|---|
| `Open-Meteo HTTP 503` | Servicio externo caído, transitorio | Esperar y disparar de nuevo |
| `BLOB_READ_WRITE_TOKEN` | Variable faltante o vencida | Revisar la variable en GitHub Secrets y Vercel |
| `[ZOD] El paqueteMaestro no cumple el schema` | Error en el motor; la publicación se abortó a propósito | Leer el campo indicado en el log, corregir, subir y disparar |
| `Cannot find module` | Importación rota | Revisar el último commit |

### 6.2 El Blob no se actualiza

1. Confirmar que la última corrida terminó bien (sección 4).
2. Buscar en el log la línea `Publicación exitosa`.
3. Si aparece un error al publicar, revisar `BLOB_READ_WRITE_TOKEN`.

### 6.3 `/api/sara` devuelve el respaldo en vivo

`origen: RESPUESTA_EN_VIVO` significa que el estado publicado no pasó la validación. Revisar en los logs de Vercel la línea `[ZOD] El estado del Blob no cumple el schema`. El sistema sigue mostrando datos, pero el estado publicado debe corregirse.

### 6.4 Los datos están viejos

Revisar la hora del dictamen en `/api/sara`. Si tiene más de 6 horas, el proceso autónomo no está corriendo: disparar manualmente.

### 6.5 Reversión

```powershell
git revert <HASH_DEL_COMMIT_DEFECTUOSO> --no-edit
git push origin main
```

Después de revertir, confirmar el despliegue en Vercel y una corrida del proceso autónomo.

### 6.6 Error 400 del modelo de redacción

Causa habitual: el texto del reporte se corta antes de cerrar el JSON. El límite de salida configurado es 4096 tokens. Si vuelve a ocurrir, revisar la longitud de los reportes antes de cambiar el límite (ver `05_PROMPT_SARA.md`).

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
| Vercel | Hosting, funciones y Blob | Variables de entorno del proyecto |
| GitHub | Código, pruebas y proceso autónomo | Secrets de Actions |
| Groq | Redacción de reportes (modelo `openai/gpt-oss-120b`) | Variable `GROQ_API_KEY` |
| cron-job.org | Disparo cada 3 horas | Encabezado con el secreto del cron |
| Open-Meteo | Pronósticos (sin clave) | No aplica |
| SMN / CONAGUA | Avisos oficiales (consulta pública) | No aplica |
| NOAA GOES-19 | Imágenes satelitales (acceso público) | No aplica |

### 8.1 Variables de entorno

| Variable | Uso | Obligatoria en producción |
|---|---|---|
| `SARA_ADMIN_TOKEN` | Forzar recálculo en `/api/sara` | Sí |
| `SARA_ONDEMAND_TOKEN` | Validar la consola de reportes | Sí |
| `GROQ_API_KEY` | Redacción de reportes | Sí |
| `BLOB_READ_WRITE_TOKEN` | Acceso a Vercel Blob | Sí |
| `CRON_SECRET` | Autorizar el disparo externo | Sí |
| `GITHUB_PAT` | Disparar el workflow desde la API | Sí, para el disparo externo |
| `SARA_LLM_KILL_SWITCH` | Si vale `DISABLED`, desactiva el modelo | No |

> **Nota:** la variable `VITE_SARA_ONDEMAND_TOKEN` aparecía en versiones anteriores. No debe configurarse: las variables con prefijo `VITE_` se incluyen en el código que descarga el navegador. Ver R-02 en `06_PENDIENTES.md`.

---

## 9. Contactos

Las personas responsables y sus datos de contacto se consultan por el canal interno de coordinación. No se publican en este repositorio.

| Rol | Responsabilidad |
|---|---|
| Desarrollo principal | Código, despliegue y claves técnicas |
| Coordinación pastoral | Decisiones operativas y uso de los reportes |
| Autoridad eclesiástica | Aprobación institucional |

**Para emergencias operativas:** comunicarse con la coordinación de Cáritas diocesana por el canal establecido.
