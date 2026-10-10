# ============================================================
# SIMULACION REFORZADA - SatRC V2.0
# Version 2: muestreo de 20 fechas (antes 5) para mayor robustez
# Usa las series ya descargadas en la ejecucion anterior
# ============================================================

$ErrorActionPreference = "Continue"
$rutaLocalidades = ".\src\data\localidades.json"
$rutaSeries = ".\series_historicas_14_zonas.json"

if (-not (Test-Path $rutaSeries)) {
    Write-Host "ERROR: No existe $rutaSeries. Corre primero simulacion_nodos.ps1" -ForegroundColor Red
    exit 1
}

$db = Get-Content $rutaLocalidades -Raw | ConvertFrom-Json
$jsonSeries = Get-Content $rutaSeries -Raw | ConvertFrom-Json
$series = @{}
$jsonSeries.PSObject.Properties | ForEach-Object { $series[$_.Name] = $_.Value }

Write-Host "Series cargadas: $($series.Keys.Count) zonas" -ForegroundColor Green

# --- 1. Agregar por dia ---
$diasPorZona = @{}
foreach ($zonaId in $series.Keys) {
    $serie = $series[$zonaId]
    $dias = @{}
    for ($i = 0; $i -lt $serie.time.Count; $i++) {
        $f = $serie.time[$i].Substring(0, 10)
        if (-not $dias.ContainsKey($f)) {
            $dias[$f] = @{ lluvia = 0.0; tmin = 999.0; tmax = -999.0; vientoMax = 0.0; rafagaMax = 0.0 }
        }
        $dias[$f].lluvia += [double]$serie.precip[$i]
        $t = [double]$serie.temp[$i]
        if ($t -lt $dias[$f].tmin) { $dias[$f].tmin = $t }
        if ($t -gt $dias[$f].tmax) { $dias[$f].tmax = $t }
        $w = [double]$serie.wind[$i]
        if ($w -gt $dias[$f].vientoMax) { $dias[$f].vientoMax = $w }
        $g = [double]$serie.gusts[$i]
        if ($g -gt $dias[$f].rafagaMax) { $dias[$f].rafagaMax = $g }
    }
    $diasPorZona[$zonaId] = $dias
}

# --- 2. Configuraciones ---
$configuraciones = [ordered]@{
    "1_nodo"  = @{}
    "10_nodos" = @{
        "ACT"="ACT"; "APN"="ACT"; "TIZ"="TIZ"; "PMN"="PMN"; "PMS"="PMS"; "TUL"="TUL"
        "HUA"="HUA"; "XIC"="HUA"; "ZAC"="HUA"; "SPP"="HUA"; "CHG"="CHG"; "ZAH"="ZAH"; "ATG"="ATG"
        "HYC"="HYC"
    }
    "6_nodos" = @{
        "ACT"="PMS"; "APN"="PMS"; "TIZ"="PMS"; "PMN"="PMS"; "PMS"="PMS"
        "TUL"="TUL"
        "HUA"="HUA"; "XIC"="HUA"; "ZAC"="HUA"; "SPP"="HUA"
        "CHG"="CHG"
        "ZAH"="ZAH"; "ATG"="ZAH"
        "HYC"="HYC"
    }
    "14_nodos" = @{}
}
foreach ($z in $diasPorZona.Keys) { $configuraciones["1_nodo"][$z] = "HUA" }
foreach ($z in $diasPorZona.Keys) { $configuraciones["14_nodos"][$z] = $z }

# --- 3. Funciones del motor ---
function Calcular-Saturacion($zonaId, $fechaActual, $diasZona) {
    $fechasOrd = @($diasZona.Keys | Sort-Object)
    $idxActual = [array]::IndexOf($fechasOrd, $fechaActual)
    if ($idxActual -lt 7) { return $null }
    $api = 0.0
    for ($d = 1; $d -le 7; $d++) {
        $fechaAnt = $fechasOrd[$idxActual - $d]
        $api += $diasZona[$fechaAnt].lluvia * [Math]::Pow(0.85, 8 - $d)
    }
    $lluviaHoy = $diasZona[$fechaActual].lluvia
    return @{ api = $api; lluviaHoy = $lluviaHoy; saturacion = $api + $lluviaHoy }
}

function Calcular-Nivel($loc, $saturacion, $lluvia24h, $tmin, $vientoMax) {
    $pendiente = [double]$loc.topografia.pendiente_max_deg
    $relieve = [string]$loc.topografia.relieve
    $zonaId = [string]$loc.zona_id
    $distRio = [double]$loc.hidrologia.distancia_cauce_km
    $twi = [double]$loc.topografia.twi
    $acceso = [string]$loc.vulnerabilidad.acceso_vial

    $esAltiplano = @('APN','TIZ','PMS','ACT') -contains $zonaId
    $esSierra = @('HUA','SPP','ZAC','CHG','ZAH','ATG','TUL') -contains $zonaId
    $esLadera = ($relieve -eq 'LADERA') -or ($pendiente -ge 25)
    $esTerraceria = ($acceso -eq 'CAMINO_TERRACERIA') -or ($acceso -eq 'BRECHA')

    $nivel = 1
    if ($esAltiplano -and $pendiente -lt 15 -and $lluvia24h -lt 20 -and $tmin -gt 2 -and $vientoMax -lt 40) { return 1 }
    if ($esSierra -and $esLadera -and $saturacion -ge 65.0) {
        if ($pendiente -ge 45.0) { $nivel = 4 } else { $nivel = [Math]::Max($nivel, 3) }
    }
    if ($distRio -le 0.8 -and $twi -ge 12.0 -and $lluvia24h -ge 35.0 -and -not $esAltiplano) { $nivel = [Math]::Max($nivel, 4) }
    if ($esTerraceria -and ($lluvia24h -ge 20.0 -or $saturacion -ge 50.0) -and $nivel -lt 3) { $nivel = 3 }
    if ($nivel -eq 1 -and ($lluvia24h -ge 8.0 -or $saturacion -ge 30.0)) { $nivel = 2 }
    return $nivel
}

# --- 4. Muestreo de 20 fechas ---
$fechasRef = @($diasPorZona.Values | ForEach-Object { $_.Keys } | Sort-Object -Unique)
$diasEvaluables = $fechasRef[7..($fechasRef.Count-1)]
$totalDias = $diasEvaluables.Count

$paso = [math]::Floor($totalDias / 20)
$muestraFechas = @()
for ($k = 0; $k -lt 20; $k++) {
    $idx = $k * $paso
    if ($idx -lt $totalDias) { $muestraFechas += $diasEvaluables[$idx] }
}
$muestraFechas = $muestraFechas | Sort-Object -Unique

Write-Host "`nDias disponibles: $totalDias" -ForegroundColor Cyan
Write-Host "Dias muestreados: $($muestraFechas.Count)" -ForegroundColor Cyan
Write-Host "Rango: $($muestraFechas[0]) a $($muestraFechas[-1])" -ForegroundColor Cyan

# --- 5. Simular ---
Write-Host "`n=== SIMULANDO (20 fechas x 405 loc x 4 configs) ===" -ForegroundColor Cyan
$resultados = [ordered]@{}

foreach ($configNombre in $configuraciones.Keys) {
    Write-Host -NoNewline ("  {0,-10} ... " -f $configNombre)
    $asig = $configuraciones[$configNombre]
    $conteos = @{ 1=0; 2=0; 3=0; 4=0 }
    $totalEval = 0

    foreach ($fecha in $muestraFechas) {
        foreach ($loc in $db.localidades) {
            $zona = $loc.zona_id
            if (-not $asig.ContainsKey($zona)) { continue }
            $nodoAsignado = $asig[$zona]
            if (-not $diasPorZona.ContainsKey($nodoAsignado)) { continue }

            $satData = Calcular-Saturacion $nodoAsignado $fecha $diasPorZona[$nodoAsignado]
            if ($null -eq $satData) { continue }

            $diaNodo = $diasPorZona[$nodoAsignado][$fecha]
            $nivel = Calcular-Nivel $loc $satData.saturacion $satData.lluviaHoy $diaNodo.tmin $diaNodo.vientoMax

            $conteos[$nivel]++
            $totalEval++
        }
    }

    $resultados[$configNombre] = @{
        N1 = $conteos[1]; N2 = $conteos[2]; N3 = $conteos[3]; N4 = $conteos[4]
        Total = $totalEval
        PctN1 = [math]::Round(100 * $conteos[1] / $totalEval, 1)
        PctN2 = [math]::Round(100 * $conteos[2] / $totalEval, 1)
        PctN3 = [math]::Round(100 * $conteos[3] / $totalEval, 1)
        PctN4 = [math]::Round(100 * $conteos[4] / $totalEval, 1)
    }
    Write-Host "N1=$($conteos[1]) N2=$($conteos[2]) N3=$($conteos[3]) N4=$($conteos[4]) | Total=$totalEval"
}

# --- 6. Tabla ---
Write-Host "`n=== COMPARATIVA ABSOLUTA ===" -ForegroundColor Cyan
$tabla = $resultados.Keys | ForEach-Object {
    [PSCustomObject]@{
        Config = $_
        N1     = $resultados[$_].N1
        N2     = $resultados[$_].N2
        N3     = $resultados[$_].N3
        N4     = $resultados[$_].N4
        Total  = $resultados[$_].Total
    }
}
$tabla | Format-Table -AutoSize

Write-Host "`n=== COMPARATIVA PORCENTUAL ===" -ForegroundColor Cyan
$tablaPct = $resultados.Keys | ForEach-Object {
    [PSCustomObject]@{
        Config = $_
        PctN1  = "$($resultados[$_].PctN1)%"
        PctN2  = "$($resultados[$_].PctN2)%"
        PctN3  = "$($resultados[$_].PctN3)%"
        PctN4  = "$($resultados[$_].PctN4)%"
    }
}
$tablaPct | Format-Table -AutoSize

# --- 7. Deltas respecto a 14_nodos (el optimo) ---
Write-Host "`n=== DELTA vs 14_nodos (falsos positivos por configuracion) ===" -ForegroundColor Cyan
$base = $resultados["14_nodos"]

foreach ($config in $resultados.Keys) {
    if ($config -eq "14_nodos") { continue }
    $r = $resultados[$config]
    $deltaN2 = $r.N2 - $base.N2
    $deltaN3 = $r.N3 - $base.N3
    $deltaN4 = $r.N4 - $base.N4

    Write-Host "`n$config vs 14_nodos:"
    Write-Host "  N2 falsos: $deltaN2  ($([math]::Round(100 * $deltaN2 / $base.N2, 1))% mas)"
    Write-Host "  N3 falsos: $deltaN3"
    Write-Host "  N4 falsos: $deltaN4  ($([math]::Round(100 * $deltaN4 / [Math]::Max(1, $base.N4), 1))% mas)"
}

# --- 8. Guardar ---
$resultados | ConvertTo-Json -Depth 4 | Out-File "simulacion_nodos_resultado_v2.json" -Encoding UTF8
Write-Host "`nResultados guardados en simulacion_nodos_resultado_v2.json" -ForegroundColor Green