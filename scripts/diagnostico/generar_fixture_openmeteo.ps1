# ============================================================
# SatRC V2.0 -- Genera fixture real de Open-Meteo para tests (H6.7)
#
# Descarga 240h de datos reales de Open-Meteo para Pachuca (PMN)
# con las 7 variables hidrológicas + 8 variables E4, los 3 modelos
# (gfs_seamless, icon_seamless, gem_seamless), y lo guarda como
# fixture versionado en src/engine/__tests__/fixtures/
#
# Uso:
#   .\scripts\diagnostico\generar_fixture_openmeteo.ps1
#
# Salida:
#   src/engine/__tests__/fixtures/openmeteo_sample.json
# ============================================================

$ErrorActionPreference = "Continue"

# --- Configuración ---
$lat = 20.12
$lon = -98.74
$zonaRef = "PMN (Pachuca de Soto Centro)"
$rutaFixture = "src\engine\__tests__\fixtures\openmeteo_sample.json"

# --- Crear carpeta si no existe ---
$carpetaFixture = Split-Path -Parent $rutaFixture
if (-not (Test-Path $carpetaFixture)) {
    New-Item -ItemType Directory -Path $carpetaFixture -Force | Out-Null
    Write-Host "[OK] Carpeta creada: $carpetaFixture" -ForegroundColor Green
}

# --- Variables a pedir ---
$variablesHidro = @(
    "precipitation",
    "temperature_2m",
    "relative_humidity_2m",
    "wind_speed_10m",
    "wind_gusts_10m",
    "visibility"
) -join ","

$variablesE4 = @(
    "surface_pressure",
    "apparent_temperature",
    "cloud_cover",
    "wet_bulb_temperature_2m",
    "cape",
    "freezing_level_height",
    "relative_humidity_700hPa",
    "wind_speed_700hPa"
) -join ","

$variablesTotales = "$variablesHidro,$variablesE4"

# --- URL ---
$url = "https://api.open-meteo.com/v1/forecast" +
       "?latitude=$lat&longitude=$lon" +
       "&hourly=$variablesTotales" +
       "&models=gfs_seamless,icon_seamless,gem_seamless" +
       "&past_days=7&forecast_days=3" +
       "&timezone=America%2FMexico_City"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Generador de Fixture Open-Meteo (H6.7)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Zona: $zonaRef"
Write-Host "Lat/Lon: $lat / $lon"
Write-Host "Variables: $($variablesHidro.Split(',').Count + $variablesE4.Split(',').Count) (7 hidro + 8 E4)"
Write-Host "Modelos: gfs_seamless, icon_seamless, gem_seamless"
Write-Host "Rango: 7 días pasados + 3 días futuros (240 horas)"
Write-Host ""
Write-Host "URL:"
Write-Host $url
Write-Host ""

# --- Descargar ---
Write-Host "Descargando..." -ForegroundColor Yellow
try {
    $resp = Invoke-RestMethod -Uri $url -TimeoutSec 60
} catch {
    Write-Host "[X] Error en la descarga: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not $resp.hourly -or -not $resp.hourly.time) {
    Write-Host "[X] Respuesta sin bloque hourly" -ForegroundColor Red
    exit 1
}

$totalHoras = $resp.hourly.time.Count
$camposHourly = $resp.hourly.PSObject.Properties.Name | Where-Object { $_ -ne "time" }

Write-Host "[OK] Descarga exitosa" -ForegroundColor Green
Write-Host "  Horas: $totalHoras"
Write-Host "  Campos en hourly: $($camposHourly.Count)"
Write-Host ""

# --- Verificar variables E4 ---
Write-Host "Verificación de las 8 variables E4:" -ForegroundColor Yellow
$varsE4Lista = @(
    "surface_pressure",
    "apparent_temperature",
    "cloud_cover",
    "wet_bulb_temperature_2m",
    "cape",
    "freezing_level_height",
    "relative_humidity_700hPa",
    "wind_speed_700hPa"
)

$varsOk = 0
foreach ($var in $varsE4Lista) {
    $encontrada = $false
    foreach ($modelo in @("gfs_seamless", "icon_seamless", "gem_seamless")) {
        $nombreCampo = "${var}_${modelo}"
        if ($camposHourly -contains $nombreCampo) {
            $encontrada = $true
            break
        }
    }
    if ($encontrada) {
        Write-Host "  [OK] $var" -ForegroundColor Green
        $varsOk++
    } else {
        Write-Host "  [X] $var AUSENTE" -ForegroundColor Red
    }
}
Write-Host "  Total: $varsOk/8" -ForegroundColor $(if ($varsOk -eq 8) { "Green" } else { "Red" })
Write-Host ""

# --- Guardar como JSON sin BOM ---
$json = $resp | ConvertTo-Json -Depth 10 -Compress
$rutaAbsoluta = Join-Path $PWD $rutaFixture
$utf8SinBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($rutaAbsoluta, $json, $utf8SinBom)

$tamanoKB = [math]::Round((Get-Item $rutaAbsoluta).Length / 1024, 1)
Write-Host "[OK] Fixture guardado en: $rutaAbsoluta" -ForegroundColor Green
Write-Host "  Tamaño: $tamanoKB KB"
Write-Host ""

# --- Instrucciones ---
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Fixture generado correctamente" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Siguiente paso:"
Write-Host "  1. Verificar el contenido:"
Write-Host "     Get-Content '$rutaFixture' -TotalCount 1 | Out-String -Width 200"
Write-Host ""
Write-Host "  2. Commit del fixture:"
Write-Host "     git add '$rutaFixture'"
Write-Host "     git commit -m 'test(engine): agrega fixture real de Open-Meteo para tests E4 (H6.7)'"
Write-Host ""