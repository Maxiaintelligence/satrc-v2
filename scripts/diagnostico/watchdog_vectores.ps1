# ============================================================
# SatRC V2.0 — Etapa 5: Watchdog de vectores no-hidrológicos
#
# Propósito: monitorear /api/sara cada N minutos y avisar cuando
# aparezca el primer registro con vector_dominante != HIDROLOGICO.
# Documenta el primer caso real de multiamenaza en producción.
#
# Uso:
#   .\scripts\diagnostico\watchdog_vectores.ps1
#   .\scripts\diagnostico\watchdog_vectores.ps1 -Iteraciones 10 -IntervaloMin 30
#
# Requisitos: ninguno (read-only).
# ============================================================

param(
    [int]$Iteraciones = 24,      # 24 iteraciones x 3h = 72h de monitoreo
    [int]$IntervaloMin = 180     # 3 horas
)

$ErrorActionPreference = "Continue"

$API_URL = "https://satrc-v2.vercel.app/api/sara"
$CARPETA_OUTPUT = "scripts\diagnostico\output"
$ARCHIVO_LOG = "$CARPETA_OUTPUT\watchdog_vectores.log"

if (-not (Test-Path $CARPETA_OUTPUT)) {
    New-Item -ItemType Directory -Path $CARPETA_OUTPUT -Force | Out-Null
}

function Write-Log($mensaje) {
    $linea = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $mensaje"
    Add-Content -Path $ARCHIVO_LOG -Value $linea
    Write-Host $linea
}

Write-Log "=== Watchdog iniciado ==="
Write-Log "Iteraciones: $Iteraciones, Intervalo: $IntervaloMin min"
Write-Log "Endpoint: $API_URL"

$primerCasoEncontrado = $false

for ($i = 1; $i -le $Iteraciones; $i++) {
    Write-Log "--- Iteracion $i/$Iteraciones ---"

    try {
        $r = Invoke-WebRequest -Uri "$API_URL?t=$(Get-Date -UFormat %s)" -UseBasicParsing -TimeoutSec 30
        $data = $r.Content | ConvertFrom-Json
    } catch {
        Write-Log "[X] Error consultando: $($_.Exception.Message)"
        Start-Sleep -Seconds ($IntervaloMin * 60)
        continue
    }

    if (-not $data.evaluaciones) {
        Write-Log "[X] Sin campo evaluaciones"
        Start-Sleep -Seconds ($IntervaloMin * 60)
        continue
    }

    $noHidro = $data.evaluaciones | Where-Object {
        $_.vector_dominante -and $_.vector_dominante -ne "HIDROLOGICO"
    }

    if ($noHidro -and $noHidro.Count -gt 0) {
        Write-Log "[!] PRIMER CASO NO-HIDROLOGICO DETECTADO: $($noHidro.Count) registros"
        foreach ($ev in $noHidro) {
            Write-Log "    - $($ev.nombre) ($($ev.municipio)): vector=$($ev.vector_dominante), nivel=$($ev.nivel_alerta)"
        }
        $primerCasoEncontrado = $true
        # Guardar snapshot completo
        $snapshot = "$CARPETA_OUTPUT\watchdog_snapshot_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        $noHidro | ConvertTo-Json -Depth 10 | Out-File -FilePath $snapshot -Encoding utf8
        Write-Log "    Snapshot guardado: $snapshot"
        break
    } else {
        $vecTop = ($data.evaluaciones | Group-Object vector_dominante | Sort-Object Count -Descending | Select-Object -First 1)
        Write-Log "[OK] Todo hidro. Top: $($vecTop.Name) ($($vecTop.Count))"
    }

    if ($i -lt $Iteraciones) {
        Write-Log "Esperando $IntervaloMin min..."
        Start-Sleep -Seconds ($IntervaloMin * 60)
    }
}

if (-not $primerCasoEncontrado) {
    Write-Log "=== Watchdog finalizado sin casos no-hidrologicos ==="
} else {
    Write-Log "=== Watchdog finalizado con caso detectado ==="
}