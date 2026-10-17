# SatRC V2.0 — Guía de Operación y Despliegue

## 1. Despliegue
- El sistema se despliega automáticamente en Vercel al hacer push a la rama `main`.
- El runner se ejecuta en GitHub Actions (`.github/workflows/sara_cron.yml`).

## 2. Generación de Reportes
- **Automático:** El runner genera un reporte diario a las 6:00 AM (hora México). Detecta si ya se generó uno ese día para no duplicar.
- **On-Demand:** El operador entra a la Sala Operativa, pulsa "Generar Reporte" e ingresa su clave personal (`Antonio2026`, `Roberto2026`, `Omar2026`, `Obispo2026`).

## 3. Claves y Accesos
- **Acceso a Consola:** Clave `emergencia` (Hardcodeada en `App.jsx`).
- **Generación de Reportes:** Claves personales (Validadas en `api/reporte-ondemand.js`).
- **Token Técnico:** `SARA_ONDEMAND_TOKEN` (Variable de entorno).

## 4. Recuperación ante Fallos
- Si el cron falla, se puede disparar manualmente usando PowerShell:
  ```powershell
  $secret = (Get-Content "$env:USERPROFILE\Documents\cron_secret_satrc.txt" -Raw).Trim()
  Invoke-RestMethod -Uri "https://satrc-v2.vercel.app/api/disparar-workflow" -Method POST -Headers @{"x-cron-secret" = $secret}