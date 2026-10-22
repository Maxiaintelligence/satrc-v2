# ============================================================
# SatRC V2.0 — Etapa 5: Baseline de la bitácora SHA-256
#
# Propósito: documentar qué campos tiene la última entrada de
# bitácora. Confirma que NO registra vector_dominante (deuda H5.3).
#
# Uso:
#   .\scripts\diagnostico\verificar_bitacora_campos.ps1
#
# Requisitos: ninguno (read-only).
# ============================================================

$ErrorActionPreference = "Continue"

$API_URL = "https://satrc-v2.vercel.app/api/sara"
$CARPETA_OUTPUT = "scripts\diagnostico\output"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$ARCHIVO_LOG = "$CARPETA_OUTPUT\bitacora_campos_$TIMESTAMP.json"

if (-not (Test-Path $CARPETA_OUTPUT)) {
    New-Item -ItemType Directory -Path $CARPETA_OUTPUT -Force | Out-Null
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Baseline de la Bitácora SHA-256" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Consultando /api/sara..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$API_URL?t=$(Get-Date -UFormat %s)" -UseBasicParsing -TimeoutSec 30
} catch {
    Write-Host "[X] Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$data = $r.Content | ConvertFrom-Json

if (-not $data.bitacora -or $data.bitacora.Count -eq 0) {
    Write-Host "[X] No hay entradas en la bitácora" -ForegroundColor Red
    exit 1
}

Write-Host "  Total entradas: $($data.bitacora.Count)"
Write-Host ""

# --- Última entrada ---
Write-Host "[2/3] Inspeccionando la última entrada..." -ForegroundColor Yellow
$ultima = $data.bitacora[-1]

Write-Host ""
Write-Host "  Campo                          | Valor"
Write-Host "  -------------------------------+-----------------------------------------"
foreach ($prop in $ultima.PSObject.Properties) {
    $val = $prop.Value
    if ($val -is [array]) {
        $val = "[array de $($val.Count)]"
    } elseif ($val -is [string] -and $val.Length -gt 50) {
        $val = $val.Substring(0, 47) + "..."
    }
    Write-Host ("  {0,-30} | {1}" -f $prop.Name, $val)
}
Write-Host ""

# --- Veredicto ---
Write-Host "[3/3] Veredicto:" -ForegroundColor Yellow
$camposActuales = $ultima.PSObject.Properties.Name

$checks = @(
    @{ Campo = "vector_dominante"; Requerido = "vector dominante del top-1" },
    @{ Campo = "n4_por_vector"; Requerido = "desglose N4 por vector" },
    @{ Campo = "n3_por_vector"; Requerido = "desglose N3 por vector" },
    @{ Campo = "desglose_vectorial"; Requerido = "desglose completo" }
)

$faltantes = 0
foreach ($check in $checks) {
    $tiene = $camposActuales -contains $check.Campo
    if (-not $tiene) {
        Write-Host "  [FALTA] $($check.Campo) — $($check.Requerido)" -ForegroundColor Yellow
        $faltantes++
    } else {
        Write-Host "  [OK]    $($check.Campo)" -ForegroundColor Green
    }
}
Write-Host ""

if ($faltantes -gt 0) {
    Write-Host "  → La bitácora NO registra vector dominante. H5.3 justificado." -ForegroundColor Yellow
} else {
    Write-Host "  → La bitácora YA registra vector. H5.3 no es necesario." -ForegroundColor Green
}
Write-Host ""

# --- Guardar ---
$ultima | ConvertTo-Json -Depth 5 | Out-File -FilePath $ARCHIVO_LOG -Encoding utf8
Write-Host "[OK] Última entrada guardada en: $ARCHIVO_LOG" -ForegroundColor Green
Write-Host ""