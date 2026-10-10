# ============================================================
# SIMULACION DE CONFIGURACIONES DE NODOS - SatRC V2.0
# Compara el impacto de 1, 3, 6 y 14 nodos sobre el historico
# ============================================================

$ErrorActionPreference = "Continue"
$rutaLocalidades = ".\src\data\localidades.json"
$rutaSeries = ".\series_historicas_14_zonas.json"

$db = Get-Content $rutaLocalidades -Raw | ConvertFrom-Json

# --- 1. Definir nodos representativos por zona (mas poblada) ---
$nodosPorZona = @{}
$db.localidades | Group-Object zona_id | ForEach-Object {
    $zonaId = $_.Name
    $masPoblada = $_.Group | Sort-Object { [int]$_.vulnerabilidad.poblacion } -Descending | Select-Object -First 1
    $nodosPorZona[$zonaId] = @{
        lat = [double]$masPoblada.coords.lat
        lon = [double]$masPoblada.coords.lon
        localidad = $masPoblada.nombre
    }
}

Write-Host "`n=== 14 ZONAS CON NODO REPRESENTATIVO ===" -ForegroundColor Cyan
$nodosPorZona.Keys | Sort-Object | ForEach-Object {
    Write-Host ("  {0,-6} {1,-30} lat=$([math]::Round($nodosPorZona[$_].lat,2)) lon=$([math]::Round($nodosPorZona[$_].lon,2))" -f $_, $nodosPorZona[$_].localidad)
}

# --- 2. Descargar series historicas (o cargarlas si ya existen) ---
$series = @{}

if (Test-Path $rutaSeries) {
    Write-Host "`nCargando series desde $rutaSeries..." -ForegroundColor Yellow
    $json = Get-Content $rutaSeries -Raw | ConvertFrom-Json
    $json.PSObject.Properties | ForEach-Object {
        $series[$_.Name] = $_.Value
    }
    Write-Host "Series cargadas: $($series.Keys.Count) zonas" -ForegroundColor Green
} else {
    Write-Host "`nDescargando series historicas..." -ForegroundColor Cyan
    $fechaFin = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd")
    $fechaInicio = (Get-Date).AddDays(-91).ToString("yyyy-MM-dd")

    foreach ($zonaId in ($nodosPorZona.Keys | Sort-Object)) {
        $nodo = $nodosPorZona[$zonaId]
        $url = "https://archive-api.open-meteo.com/v1/archive" +
               "?latitude=$($nodo.lat)&longitude=$($nodo.lon)" +
               "&start_date=$fechaInicio&end_date=$fechaFin" +
               "&hourly=precipitation,temperature_2m,wind_speed_10m,wind_gusts_10m" +
               "&timezone=America%2FMexico_City"

        Write-Host -NoNewline ("  {0,-6} descargando... " -f $zonaId)
        try {
            $resp = Invoke-RestMethod -Uri $url -TimeoutSec 90
            $series[$zonaId] = @{
                time = @($resp.hourly.time)
                precip = @($resp.hourly.precipitation)
                temp = @($resp.hourly.temperature_2m)
                wind = @($resp.hourly.wind_speed_10m)
                gusts = @($resp.hourly.wind_gusts_10m)
            }
            Write-Host "$($resp.hourly.time.Count) horas" -ForegroundColor Green
            Start-Sleep -Milliseconds 700
        } catch {
            Write-Host "ERROR" -ForegroundColor Red
        }
    }

    # Guardar para no reconsultar
    $series | ConvertTo-Json -Depth 3 -Compress | Out-File $rutaSeries -Encoding UTF8
    Write-Host "Series guardadas en $rutaSeries" -ForegroundColor Green
}

# --- 3. Definir configuraciones de nodos ---
$configuraciones = [ordered]@{
    "1_nodo_HUA" = @{
        "ACT"="HUA"; "APN"="HUA"; "ATG"="HUA"; "CHG"="HUA"
        "HUA"="HUA"; "HYC"="HUA"; "PMN"="HUA"; "PMS"="HUA"
        "SPP"="HUA"; "TIZ"="HUA"; "TUL"="HUA"; "XIC"="HUA"
        "ZAC"="HUA"; "ZAH"="HUA"
    }
    "3_nodos_macro" = @{
        "ACT"="ACT"; "APN"="ACT"; "TIZ"="TIZ"; "PMN"="PMN"; "PMS"="PMS"; "TUL"="TUL"
        "HUA"="HUA"; "XIC"="HUA"; "ZAC"="HUA"; "SPP"="HUA"; "CHG"="CHG"; "ZAH"="ZAH"; "ATG"="ATG"
        "HYC"="HYC"
    }
    "6_nodos_climaticos" = @{
        "ACT"="PMS"; "APN"="PMS"; "TIZ"="PMS"; "PMN"="PMS"; "PMS"="PMS"
        "TUL"="TUL"
        "HUA"="HUA"; "XIC"="HUA"; "ZAC"="HUA"; "SPP"="HUA"
        "CHG"="CHG"
        "ZAH"="ZAH"; "ATG"="ZAH"
        "HYC"="HYC"
    }
    "14_nodos" = @{}
}
# 14 nodos: cada zona se asigna a si misma
$nodosPorZona.Keys | ForEach-Object { $configuraciones["14_nodos"][$_] = $_ }

# --- 4. Procesar cada zona: agrupar por dia ---
Write-Host "`n=== AGREGANDO DATOS POR DIA Y ZONA ===" -ForegroundColor Cyan
$diasPorZona = @{}

foreach ($zonaId in $series.Keys) {
    $serie = $series[$zonaId]
    $dias = @{}

    for ($i = 0; $i -lt $serie.time.Count; $i++) {
        $f = $serie.time[$i].Substring(0, 10)
        if (-not $dias.ContainsKey($f)) {
            $dias[$f] = @{
                lluvia = 0.0
                tmin = 999.0
                tmax = -999.0
                vientoMax = 0.0
                rafagaMax = 0.0
            }
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
    Write-Host "  $zonaId : $($dias.Keys.Count) dias"
}

# --- 5. Funcion de calculo de saturacion (replica del motor actual) ---
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
    return @{
        api = $api
        lluviaHoy = $lluviaHoy
        saturacion = $api + $lluviaHoy
    }
}

# --- 6. Funcion del motor (replica simplificada de riskEvaluator) ---
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

    if ($esAltiplano -and $pendiente -lt 15 -and $lluvia24h -lt 20 -and $tmin -gt 2 -and $vientoMax -lt 40) {
        return 1
    }

    if ($esSierra -and $esLadera -and $saturacion -ge 65.0) {
        if ($pendiente -ge 45.0) { $nivel = 4 }
        else { $nivel = [Math]::Max($nivel, 3) }
    }

    if ($distRio -le 0.8 -and $twi -ge 12.0 -and $lluvia24h -ge 35.0 -and -not $esAltiplano) {
        $nivel = [Math]::Max($nivel, 4)
    }

    if ($esTerraceria -and ($lluvia24h -ge 20.0 -or $saturacion -ge 50.0) -and $nivel -lt 3) {
        $nivel = 3
    }

    if ($nivel -eq 1 -and ($lluvia24h -ge 8.0 -or $saturacion -ge 30.0)) {
        $nivel = 2
    }

    return $nivel
}

# --- 7. Simular cada configuracion ---
Write-Host "`n=== SIMULANDO CONFIGURACIONES ===" -ForegroundColor Cyan

$fechasRef = @($diasPorZona.Values | ForEach-Object { $_.Keys } | Sort-Object -Unique)
$diasEvaluables = $fechasRef[7..($fechasRef.Count-1)]
Write-Host "Dias evaluables: $($diasEvaluables.Count)"

$resultados = [ordered]@{}

foreach ($configNombre in $configuraciones.Keys) {
    Write-Host -NoNewline "  $configNombre ... "
    $asig = $configuraciones[$configNombre]
    $conteos = @{ 1=0; 2=0; 3=0; 4=0 }
    $totalEval = 0

    # Tomar una muestra de 5 fechas espaciadas para no correr 83x405 calculos
    $muestraFechas = $diasEvaluables[0], $diasEvaluables[20], $diasEvaluables[40], $diasEvaluables[60], $diasEvaluables[-1]

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
        PctN2 = if ($totalEval) { [math]::Round(100 * $conteos[2] / $totalEval, 1) } else { 0 }
    }
    Write-Host "N1=$($conteos[1]) N2=$($conteos[2]) N3=$($conteos[3]) N4=$($conteos[4])" -ForegroundColor Green
}

# --- 8. Tabla comparativa ---
Write-Host "`n=== COMPARATIVA ===" -ForegroundColor Cyan
$tabla = $resultados.Keys | ForEach-Object {
    [PSCustomObject]@{
        Config  = $_
        N1      = $resultados[$_].N1
        N2      = $resultados[$_].N2
        N3      = $resultados[$_].N3
        N4      = $resultados[$_].N4
        Total   = $resultados[$_].Total
        PctN2   = $resultados[$_].PctN2
    }
}
$tabla | Format-Table -AutoSize

# --- 9. Guardar resultados ---
$resultados | ConvertTo-Json -Depth 4 | Out-File "simulacion_nodos_resultado.json" -Encoding UTF8
Write-Host "`nResultados guardados en simulacion_nodos_resultado.json" -ForegroundColor Green