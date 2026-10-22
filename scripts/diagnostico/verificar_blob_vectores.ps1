# ============================================================
# SatRC V2.0 — Etapa 5: Baseline del Blob por vector dominante
#
# Propósito: documentar cuántos registros tienen vector_dominante
# distinto de HIDROLOGICO en producción. Línea base para Etapa 5.
#
# Uso:
#   .\scripts\diagnostico\verificar_blob_vectores.ps1
#
# Requisitos: ninguno (read-only).
# Salida: tabla por vector + JSON completo en output/
# ============================================================

$ErrorActionPreference = "Continue"

# --- Configuración ---
$API_URL = "https://satrc-v2.vercel.app/api/sara"
$CARPETA_OUTPUT = "scripts\diagnostico\output"
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$ARCHIVO_LOG = "$CARPETA_OUTPUT\blob_vectores_$TIMESTAMP.json"

# --- Crear carpeta de output si no existe ---
if (-not (Test-Path $CARPETA_OUTPUT)) {
    New-Item -ItemType Directory -Path $CARPETA_OUTPUT -Force | Out-Null
    Write-Host "[OK] Carpeta creada: $CARPETA_OUTPUT" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Baseline del Blob por Vector Dominante" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Endpoint: $API_URL"
Write-Host ""

# --- Llamar a /api/sara ---
Write-Host "[1/3] Consultando /api/sara..." -ForegroundColor Yellow
try {
    $r = Invoke-WebRequest -Uri "$API_URL?t=$(Get-Date -UFormat %s)" -UseBasicParsing -TimeoutSec 30
} catch {
    Write-Host "[X] Error consultando /api/sara: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$data = $r.Content | ConvertFrom-Json

if (-not $data.evaluaciones) {
    Write-Host "[X] La respuesta no tiene campo 'evaluaciones'" -ForegroundColor Red
    exit 1
}

Write-Host "  Origen: $($data.origen)"
Write-Host "  Evaluaciones recibidas: $($data.evaluaciones.Count)"
Write-Host "  Semáforo: N4=$($data.semaforo.totalNivel4), N3=$($data.semaforo.totalNivel3), N2=$($data.semaforo.totalNivel2), N1=$($data.semaforo.totalNivel1)"
Write-Host ""

# --- Agrupar por vector_dominante ---
Write-Host "[2/3] Agrupando por vector_dominante..." -ForegroundColor Yellow
$conteo = @{}
foreach ($ev in $data.evaluaciones) {
    $vec = $ev.vector_dominante
    if ([string]::IsNullOrEmpty($vec)) { $vec = "(sin vector)" }
    if (-not $conteo.ContainsKey($vec)) { $conteo[$vec] = 0 }
    $conteo[$vec]++
}

$total = $data.evaluaciones.Count

# --- Imprimir tabla ---
Write-Host ""
Write-Host "  Vector             | Cantidad | % del total"
Write-Host "  -------------------+----------+------------"
foreach ($vec in ($conteo.Keys | Sort-Object)) {
    $cnt = $conteo[$vec]
    $pct = [math]::Round(($cnt / $total) * 100, 1)
    $color = if ($vec -eq "HIDROLOGICO") { "Gray" } else { "Green" }
    Write-Host ("  {0,-19} | {1,8} | {2,9}%" -f $vec, $cnt, $pct) -ForegroundColor $color
}
Write-Host ("  {0,-19} | {1,8} | {2,9}%" -f "TOTAL", $total, 100) -ForegroundColor White
Write-Host ""

# --- Veredicto ---
$noHidro = 0
foreach ($vec in $conteo.Keys) {
    if ($vec -ne "HIDROLOGICO" -and $vec -ne "(sin vector)") {
        $noHidro += $conteo[$vec]
    }
}

Write-Host "[3/3] Veredicto:" -ForegroundColor Yellow
if ($noHidro -eq 0) {
    Write-Host "  [OK] Cero registros con vector no-hidrológico hoy." -ForegroundColor Green
    Write-Host "  → H5.5 (prompts) y H5.7 (frontend) son PREVENTIVOS, no urgentes." -ForegroundColor Gray
} else {
    Write-Host "  [ALERTA] $noHidro registros con vector no-hidrológico." -ForegroundColor Yellow
    Write-Host "  → Hay casos reales para validar H5.5 y H5.6." -ForegroundColor Green
}
Write-Host ""

# --- Guardar JSON completo ---
$r.Content | Out-File -FilePath $ARCHIVO_LOG -Encoding utf8
Write-Host "[OK] Respuesta completa guardada en: $ARCHIVO_LOG" -ForegroundColor Green
Write-Host ""