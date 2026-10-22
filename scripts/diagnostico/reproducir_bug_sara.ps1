# ============================================================
# SatRC V2.0 — Etapa 5: Reproducir el bug de H5.5 (SARA hidro)
#
# Propósito: llamar a /api/reporte-ondemand con un focosCriticos
# sintético que tenga nivel=4 y causa="Downburst". Verificar que
# SARA (prompt actual) narra "lluvias torrenciales" en vez de
# "ráfagas descendentes". Reproduce el bug de H5.5.
#
# MODO SEGURO: zonas_ok=13 (<14) + esModoEmergencia=true.
#   → NO sobrescribe reporte_diocesano_vigente.json
#   → SÍ registra 1 entrada en bitácora (ON_DEMAND_OPERADOR_PARCIAL)
#
# Uso:
#   .\scripts\diagnostico\reproducir_bug_sara.ps1
#
# Requisitos:
#   - SARA_ONDEMAND_TOKEN (Vercel → Environment Variables)
#   - Clave de operador (Antonio2026, Roberto2026, Omar2026, Obispo2026)
# ============================================================

$ErrorActionPreference = "Continue"

$API_URL = "https://satrc-v2.vercel.app/api/reporte-ondemand"
$CARPETA_OUTPUT = "scripts\diagnostico\output"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$ARCHIVO_RESPUESTA = "$CARPETA_OUTPUT\sara_hidro_output_$TIMESTAMP.json"
$ARCHIVO_RESUMEN = "$CARPETA_OUTPUT\sara_hidro_resumen_$TIMESTAMP.txt"

if (-not (Test-Path $CARPETA_OUTPUT)) {
    New-Item -ItemType Directory -Path $CARPETA_OUTPUT -Force | Out-Null
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Reproducir bug SARA hidro (H5.5)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# --- Pedir tokens (no quedan en disco) ---
$SARA_ONDEMAND_TOKEN = Read-Host "Pega el SARA_ONDEMAND_TOKEN (no se guarda)"
if ([string]::IsNullOrWhiteSpace($SARA_ONDEMAND_TOKEN)) {
    Write-Host "[X] Token vacío. Abortando." -ForegroundColor Red
    exit 1
}

$XUserKey = Read-Host "Pega la clave de operador (ej. Antonio2026)"
if ([string]::IsNullOrWhiteSpace($XUserKey)) {
    Write-Host "[X] Clave vacía. Abortando." -ForegroundColor Red
    exit 1
}

# --- Payload sintético (modo parcial, no contamina reporte vigente) ---
$bodyObj = @{
    resumenSeveridad = @{
        totalNivel4 = 1
        totalNivel3 = 0
        totalNivel2 = 0
        totalNivel1 = 404
    }
    focosCriticos = @(
        @{
            nombre   = "Huauchinango (Sintetico)"
            municipio = "Huauchinango"
            nivel    = 4
            causa    = "Emergencia por Supercelula y Downburst"
            pendiente = "10deg"
            acceso   = "CARRETERA_FEDERAL"
        }
    )
    alertaSMN = $null
    datosRegionales = @{
        zonas_totales = 14
        zonas_ok = 13
        zonas_fallidas = @("TUL")
        resumenes = @()
    }
    esModoEmergencia = $true
}

$bodyJson = $bodyObj | ConvertTo-Json -Depth 10 -Compress

Write-Host ""
Write-Host "[1/3] POST a /api/reporte-ondemand..." -ForegroundColor Yellow
Write-Host "  Modo: PARCIAL (zonas_ok=13 < 14). No sobrescribe reporte vigente."
Write-Host "  Escenario: N4 con causa='Emergencia por Supercelula y Downburst'"
Write-Host "  (Esperando respuesta de Groq, ~15-30s)..."
Write-Host ""

$headers = @{
    "Content-Type" = "application/json"
    "x-admin-token" = $SARA_ONDEMAND_TOKEN
    "x-user-key" = $XUserKey
}

try {
    $r = Invoke-WebRequest -Uri $API_URL -Method POST -Headers $headers -Body $bodyJson -UseBasicParsing -TimeoutSec 90
} catch {
    Write-Host "[X] Error POST: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errBody = $reader.ReadToEnd()
        Write-Host "[X] Body del error:" -ForegroundColor Red
        Write-Host $errBody -ForegroundColor Red
    }
    exit 1
}

$data = $r.Content | ConvertFrom-Json
Write-Host "[OK] Respuesta recibida (HTTP $($r.StatusCode))" -ForegroundColor Green
Write-Host ""

# --- Guardar respuesta completa ---
$r.Content | Out-File -FilePath $ARCHIVO_RESPUESTA -Encoding utf8
Write-Host "[OK] Respuesta completa guardada en: $ARCHIVO_RESPUESTA" -ForegroundColor Green
Write-Host ""

# --- Extraer las 7 secciones ---
Write-Host "[2/3] Secciones del reporte:" -ForegroundColor Yellow
Write-Host ""
$rep = $data.reporte_generado.reporte
if (-not $rep) {
    $rep = $data.reporte_guardado.reporte
}

if (-not $rep) {
    Write-Host "[X] No se pudo extraer el reporte" -ForegroundColor Red
    exit 1
}

$secciones = @(
    "seccion_0_decision",
    "seccion_I_atmosfera",
    "seccion_II_focos_sierra",
    "seccion_III_condiciones_altiplano",
    "seccion_IV_evolucion",
    "seccion_V_recomendaciones_pastorales",
    "seccion_VI_deslinde"
)

$textoCompleto = ""
foreach ($sec in $secciones) {
    $contenido = $rep.$sec
    if ([string]::IsNullOrWhiteSpace($contenido)) { $contenido = "(vacio)" }
    $textoCompleto += "$sec`n$contenido`n`n"

    Write-Host "  --- $sec ---" -ForegroundColor Cyan
    Write-Host "  $contenido" -ForegroundColor Gray
    Write-Host ""
}

# --- Veredicto automático ---
Write-Host "[3/3] Veredicto automatico:" -ForegroundColor Yellow
Write-Host ""

$textoLower = $textoCompleto.ToLower()

$checks = @(
    @{ Termino = "downburst"; Desc = "menciona 'downburst'" },
    @{ Termino = "racha descendente"; Desc = "menciona 'racha descendente'" },
    @{ Termino = "rafaga descendente"; Desc = "menciona 'rafaga descendente'" },
    @{ Termino = "granizo"; Desc = "menciona 'granizo'" },
    @{ Termino = "supercelula"; Desc = "menciona 'supercelula'" },
    @{ Termino = "lluvia torrencial"; Desc = "menciona 'lluvia torrencial'" },
    @{ Termino = "torrencial"; Desc = "menciona 'torrencial' (cualquier forma)" },
    @{ Termino = "deslave"; Desc = "menciona 'deslave'" },
    @{ Termino = "inundacion"; Desc = "menciona 'inundacion'" },
    @{ Termino = "corte vial"; Desc = "menciona 'corte vial'" }
)

$resumen = @()
foreach ($c in $checks) {
    $encontrado = $textoLower.Contains($c.Termino)
    $marca = if ($encontrado) { "[SI]" } else { "[NO]" }
    $color = if ($encontrado) { "Green" } else { "Gray" }
    Write-Host "  $marca $($c.Desc)" -ForegroundColor $color
    $resumen += "$marca $($c.Desc)"
}
Write-Host ""

# --- Diagnóstico final ---
$mencionaDownburst = $textoLower.Contains("downburst") -or $textoLower.Contains("racha descendente") -or $textoLower.Contains("rafaga descendente")
$mencionaLluvia = $textoLower.Contains("lluvia torrencial") -or $textoLower.Contains("torrencial")

Write-Host "  ==========================================" -ForegroundColor Yellow
if ($mencionaDownburst -and -not $mencionaLluvia) {
    Write-Host "  [OK] SARA narro correctamente el downburst." -ForegroundColor Green
    Write-Host "  → El bug H5.5 NO esta presente. H5.5 es preventivo." -ForegroundColor Gray
} elseif ($mencionaLluvia -and -not $mencionaDownburst) {
    Write-Host "  [BUG REPRODUCIDO] SARA narro lluvia para un downburst." -ForegroundColor Red
    Write-Host "  → H5.5 (prompts multivector) CONFIRMADO empiricamente." -ForegroundColor Red
    Write-Host "  → Evidencia reproducible: ver $ARCHIVO_RESPUESTA" -ForegroundColor Red
} else {
    Write-Host "  [MIXTO] SARA menciona ambos o ninguno." -ForegroundColor Yellow
    Write-Host "  → Revisar manualmente $ARCHIVO_RESPUESTA" -ForegroundColor Gray
}
Write-Host "  ==========================================" -ForegroundColor Yellow
Write-Host ""

# --- Guardar resumen ---
@"
RESUMEN DE REPRODUCCION DE BUG H5.5
====================================
Timestamp: $TIMESTAMP
Endpoint: $API_URL
Modo: PARCIAL (zonas_ok=13 < 14). No sobrescribe reporte vigente.
Escenario: N4 con causa='Emergencia por Supercelula y Downburst'

VEREDICTO:
- Menciona downburst: $(if ($mencionaDownburst) { "SI" } else { "NO" })
- Menciona lluvia torrencial: $(if ($mencionaLluvia) { "SI" } else { "NO" })

CHECKS:
$($resumen -join "`n")

Archivo de respuesta completa: $ARCHIVO_RESPUESTA
"@ | Out-File -FilePath $ARCHIVO_RESUMEN -Encoding utf8

Write-Host "[OK] Resumen guardado en: $ARCHIVO_RESUMEN" -ForegroundColor Green
Write-Host ""