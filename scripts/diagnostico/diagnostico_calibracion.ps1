# ============================================================
# DIAGNÓSTICO DE CALIBRACIÓN SatRC V2.0
# Análisis histórico 90 días sobre las 14 zonas de resguardo
# Evalúa 4 vectores de riesgo puntuales
# ============================================================

$ErrorActionPreference = "Continue"
$rutaLocalidades = ".\src\data\localidades.json"

$db = Get-Content $rutaLocalidades -Raw | ConvertFrom-Json

# --- 1. Selección de nodo de referencia por zona (más poblada) ---
Write-Host "`n=== NODOS DE REFERENCIA POR ZONA ===" -ForegroundColor Cyan
$zonasRef = @{}
$db.localidades | Group-Object zona_id | ForEach-Object {
    $zonaId = $_.Name
    $masPoblada = $_.Group | Sort-Object { [int]$_.vulnerabilidad.poblacion } -Descending | Select-Object -First 1
    $zonasRef[$zonaId] = @{
        zona_id = $zonaId
        zona_nombre = $masPoblada.zona_nombre
        localidad = $masPoblada.nombre
        municipio = $masPoblada.municipio
        lat = [double]$masPoblada.coords.lat
        lon = [double]$masPoblada.coords.lon
        poblacion = [int]$masPoblada.vulnerabilidad.poblacion
    }
    Write-Host ("  {0,-6} {1,-22} {2,7} hab." -f $zonaId, $masPoblada.nombre, $masPoblada.vulnerabilidad.poblacion)
}

# --- 2. Rango histórico ---
$fechaFin = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
$fechaInicio = (Get-Date).AddDays(-91).ToString("yyyy-MM-dd")
Write-Host "`nRango: $fechaInicio → $fechaFin (90 días)" -ForegroundColor Cyan

# --- 3. Consulta Open-Meteo Archive por zona ---
Write-Host "`n=== CONSULTANDO ARCHIVE API ===" -ForegroundColor Cyan
$resultados = @()

foreach ($zonaId in ($zonasRef.Keys | Sort-Object)) {
    $ref = $zonasRef[$zonaId]
    $url = "https://archive-api.open-meteo.com/v1/archive" +
           "?latitude=$($ref.lat)&longitude=$($ref.lon)" +
           "&start_date=$fechaInicio&end_date=$fechaFin" +
           "&hourly=precipitation,temperature_2m" +
           "&timezone=America%2FMexico_City"

    Write-Host -NoNewline ("  {0,-6} " -f $zonaId)

    try {
        $resp = Invoke-RestMethod -Uri $url -TimeoutSec 90
        $resultados += @{
            zona_id = $zonaId
            zona_nombre = $ref.zona_nombre
            localidad = $ref.localidad
            municipio = $ref.municipio
            poblacion = $ref.poblacion
            time = $resp.hourly.time
            precip = $resp.hourly.precipitation
            temp   = $resp.hourly.temperature_2m
        }
        Write-Host "$($resp.hourly.time.Count) horas" -ForegroundColor Green
        Start-Sleep -Milliseconds 700
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
    }
}

# --- 4. Análisis por zona ---
Write-Host "`n=== ANÁLISIS POR ZONA ===" -ForegroundColor Cyan
$analisis = @()

foreach ($r in $resultados) {
    # Agrupar por día
    $dias = @{}
    for ($i = 0; $i -lt $r.time.Count; $i++) {
        $f = $r.time[$i].Substring(0, 10)
        if (-not $dias.ContainsKey($f)) {
            $dias[$f] = @{ lluvia = 0.0; tmin = 999.0; tmax = -999.0 }
        }
        $dias[$f].lluvia += [double]$r.precip[$i]
        $t = [double]$r.temp[$i]
        if ($t -lt $dias[$f].tmin) { $dias[$f].tmin = $t }
        if ($t -gt $dias[$f].tmax) { $dias[$f].tmax = $t }
    }

    $fechas = $dias.Keys | Sort-Object

    # Vectores acumulados
    $lluvia90d = 0.0
    $diasSinLluvia = 0
    $diasHelada = 0
    $diasCalor35 = 0

    foreach ($f in $fechas) {
        $lluvia90d += $dias[$f].lluvia
        if ($dias[$f].lluvia -lt 0.5) { $diasSinLluvia++ }
        if ($dias[$f].tmin -lt 2.0) { $diasHelada++ }
        if ($dias[$f].tmax -gt 35.0) { $diasCalor35++ }
    }

    # Simular saturación con fórmula actual (decay 0.85)
    $satArr = @()
    $diasN2 = 0
    $diasN3 = 0
    $diasEval = 0

    for ($i = 7; $i -lt $fechas.Count; $i++) {
        $api = 0.0
        for ($d = 1; $d -le 7; $d++) {
            $api += $dias[$fechas[$i - $d]].lluvia * [Math]::Pow(0.85, 8 - $d)
        }
        $sat = $api + $dias[$fechas[$i]].lluvia
        $satArr += $sat
        $diasEval++
        if ($sat -ge 30) { $diasN2++ }
        if ($sat -ge 65) { $diasN3++ }
    }

    $satProm = if ($satArr.Count) { ($satArr | Measure-Object -Average).Average } else { 0 }
    $satMax  = if ($satArr.Count) { ($satArr | Measure-Object -Maximum).Maximum } else { 0 }
    $satMin  = if ($satArr.Count) { ($satArr | Measure-Object -Minimum).Minimum } else { 0 }

    $analisis += [PSCustomObject]@{
        Zona       = $r.zona_id
        Localidad  = $r.localidad
        Lluvia90d  = [math]::Round($lluvia90d, 1)
        Secos      = $diasSinLluvia
        Heladas    = $diasHelada
        Calor35    = $diasCalor35
        SatProm    = [math]::Round($satProm, 1)
        SatMax     = [math]::Round($satMax, 1)
        SatMin     = [math]::Round($satMin, 1)
        DiasN2     = $diasN2
        DiasN3     = $diasN3
        PctN2      = if ($diasEval) { [math]::Round(100 * $diasN2 / $diasEval, 1) } else { 0 }
    }
}

# --- 5. Tabla resumen ---
Write-Host "`n=== RESUMEN ===" -ForegroundColor Cyan
$analisis | Format-Table -AutoSize

# --- 6. Interpretación automática ---
Write-Host "`n=== INTERPRETACIÓN ===" -ForegroundColor Cyan

$promedioPctN2 = ($analisis | Measure-Object PctN2 -Average).Average
Write-Host "`nPorcentaje promedio de días en N2 (por saturación): $([math]::Round($promedioPctN2, 1))%"

if ($promedioPctN2 -gt 70) {
    Write-Host "  ⚠️  El sistema pasa más del 70% del tiempo en N2" -ForegroundColor Red
    Write-Host "     El umbral Sat>=30 es demasiado sensible para la humedad real de la zona" -ForegroundColor Red
} elseif ($promedioPctN2 -gt 40) {
    Write-Host "  🟡 El sistema pasa entre 40-70% del tiempo en N2" -ForegroundColor Yellow
    Write-Host "     Umbral en zona gris: revisar por zona" -ForegroundColor Yellow
} else {
    Write-Host "  ✅ El sistema pasa menos del 40% del tiempo en N2" -ForegroundColor Green
    Write-Host "     Umbral razonable: la distribución es operativa" -ForegroundColor Green
}

Write-Host "`n--- Rango de lluvia 90 días ---"
$analisis | Sort-Object Lluvia90d | Format-Table Zona, Localidad, Lluvia90d -AutoSize

Write-Host "`n--- Días sin lluvia (proxy de sequía) ---"
$analisis | Sort-Object Secos -Descending | Format-Table Zona, Localidad, Secos, Heladas, Calor35 -AutoSize

Write-Host "`n--- Guardando resultados ---"
$analisis | ConvertTo-Json -Depth 3 | Out-File "diagnostico_calibracion.json" -Encoding UTF8
Write-Host "✅ Resultados en diagnostico_calibracion.json" -ForegroundColor Green