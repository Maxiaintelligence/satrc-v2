# ============================================================
# SatRC V2.0 -- Verificacion NIVEL 2 de variables E4
# H-E4-01 -- Segundo diagnostico: probar variantes de consulta
#
# Objetivo: determinar POR QUE las 8 variables E4 no aparecen
# en la consulta con modelos blend. Probar:
#   - Variables individuales
#   - GFS puro vs ICON puro vs blend
#   - Parametro forecast_hours
#   - Endpoint /v1/forecast
#
# Uso:
#   .\scripts\diagnostico\verificar_variables_e4_nivel2.ps1
# ============================================================

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  SatRC V2.0 -- Verificacion NIVEL 2" -ForegroundColor Cyan
Write-Host "  H-E4-01: Variantes de consulta Open-Meteo" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Coordenadas de Pachuca (zona PMN) como referencia
$lat = 20.12
$lon = -98.74
$zonaRef = "PMN (Pachuca de Soto Centro)"

$variablesE4 = @(
    "surface_pressure",
    "apparent_temperature",
    "cloud_cover",
    "wet_bulb_temperature_2m",
    "cape",
    "freezing_level_height",
    "relative_humidity_700hPa",
    "wind_speed_700hPa"
)

$modelos = @("gfs_seamless", "icon_seamless", "gem_seamless")

function Test-Consulta {
    param(
        [string]$Nombre,
        [string]$Url
    )
    Write-Host ""
    Write-Host "--- $Nombre ---" -ForegroundColor Yellow
    Write-Host "URL: $Url" -ForegroundColor DarkGray

    try {
        $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 30

        if (-not $resp.hourly) {
            Write-Host "  [X] Sin bloque hourly" -ForegroundColor Red
            return
        }

        $varsRecibidas = $resp.hourly.PSObject.Properties.Name | Where-Object { $_ -ne "time" }
        Write-Host "  Variables recibidas: $($varsRecibidas -join ', ')" -ForegroundColor Cyan
        Write-Host "  Horas: $($resp.hourly.time.Count)" -ForegroundColor Cyan

        foreach ($var in $variablesE4) {
            if ($resp.hourly.PSObject.Properties.Name -contains $var) {
                $valores = $resp.hourly.$var
                $noNull = @($valores | Where-Object { $null -ne $_ }).Count
                $total = $valores.Count
                if ($noNull -gt 0) {
                    Write-Host ("    [OK] {0,-28} {1}/{2} no-null" -f $var, $noNull, $total) -ForegroundColor Green
                } else {
                    Write-Host ("    [!]  {0,-28} 0/{1} no-null (TODOS NULL)" -f $var, $total) -ForegroundColor Yellow
                }
            } else {
                Write-Host ("    [X]  {0,-28} AUSENTE" -f $var) -ForegroundColor Red
            }
        }
    } catch {
        Write-Host "  [X] Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 300
}

# --- Variante 1: surface_pressure solo, GFS puro ---
Test-Consulta -Nombre "V1: surface_pressure con GFS puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=surface_pressure&models=gfs_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 2: cape solo, GFS puro ---
Test-Consulta -Nombre "V2: cape con GFS puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=cape&models=gfs_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 3: relative_humidity_700hPa solo, GFS puro ---
Test-Consulta -Nombre "V3: relative_humidity_700hPa con GFS puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=relative_humidity_700hPa&models=gfs_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 4: Todas las 8 variables, GFS puro ---
$vars4 = $variablesE4 -join ","
Test-Consulta -Nombre "V4: 8 variables con GFS puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=$vars4&models=gfs_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 5: Todas las 8 variables, ICON puro ---
Test-Consulta -Nombre "V5: 8 variables con ICON puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=$vars4&models=icon_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 6: Todas las 8 variables, GEM puro ---
Test-Consulta -Nombre "V6: 8 variables con GEM puro" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=$vars4&models=gem_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 7: Variables de superficie SOLO, sin modelos (default) ---
Test-Consulta -Nombre "V7: variables superficie sin 'models' (default)" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=surface_pressure,apparent_temperature,cloud_cover&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

# --- Variante 8: Documentar la URL con todos los modelos pero variables de superficie ---
Test-Consulta -Nombre "V8: superficie con los 3 modelos blend" `
    -Url "https://api.open-meteo.com/v1/forecast?latitude=$lat&longitude=$lon&hourly=surface_pressure,apparent_temperature,cloud_cover&models=gfs_seamless,icon_seamless,gem_seamless&past_days=1&forecast_days=1&timezone=America%2FMexico_City"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  FIN DEL DIAGNOSTICO NIVEL 2" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Instrucciones:"
Write-Host "  - Si V4 (GFS puro) devuelve datos pero V8 (blend) no:"
Write-Host "    => el blend 'seamless' omite las variables E4."
Write-Host "    => Solucion H6: pedir GFS puro para las variables E4."
Write-Host "  - Si V1, V2, V3 devuelven datos pero V4 no:"
Write-Host "    => las variables son incompatibles entre si (raro)."
Write-Host "    => Solucion H6: consultas separadas."
Write-Host "  - Si TODAS devuelven 0/no-null:"
Write-Host "    => las variables no existen con estos nombres."
Write-Host "    => Solucion H6: reescribir los 3 modulos E4 sin esas variables."
Write-Host "  - Si todas devuelven datos:"
Write-Host "    => el problema fue solo el blend. H6 puede proceder."
Write-Host ""