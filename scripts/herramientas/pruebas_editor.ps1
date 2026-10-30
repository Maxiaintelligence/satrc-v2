<#
  pruebas_editor.ps1
  Valida el helper REAL scripts/herramientas/editor.cjs (Fase 2.6) en PowerShell 5.1 + Node.
  Uso (desde la raiz del repo):
    powershell -NoProfile -ExecutionPolicy Bypass -File .\pruebas_editor.ps1
    powershell -NoProfile -ExecutionPolicy Bypass -File .\pruebas_editor.ps1 -Helper scripts\herramientas\editor.cjs
  Trabaja en una carpeta temporal: NO toca el repo. Termina con exit 0 (todo PASS) o 1.
  Solo ASCII a proposito (PowerShell 5.1 lee los .ps1 sin BOM como ANSI).
#>
param([string]$Helper = '')

if (-not $Helper) {
  $cand = $null
  if ($PSScriptRoot) { $cand = Join-Path $PSScriptRoot 'editor.cjs' }
  if ($cand -and (Test-Path -LiteralPath $cand)) { $Helper = $cand } else { $Helper = 'scripts\herramientas\editor.cjs' }
}
$res = Resolve-Path -LiteralPath $Helper -ErrorAction SilentlyContinue
if (-not $res) {
  Write-Host ("No se encontro el helper en: " + $Helper) -ForegroundColor Red
  exit 1
}
$origen = $res.Path
$repo = (Get-Location).Path

$dir = Join-Path $env:TEMP 'satrc_prueba_editor'
if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }
New-Item -ItemType Directory -Path $dir | Out-Null
Copy-Item -LiteralPath $origen -Destination (Join-Path $dir 'editor.cjs')
Set-Location $dir

$utf8 = New-Object System.Text.UTF8Encoding($false)
$script:ok = 0
$script:mal = 0

function Escribir($ruta, $texto) { [System.IO.File]::WriteAllText($ruta, $texto, $utf8) }
function Leer($ruta) { return [System.IO.File]::ReadAllText($ruta, $utf8) }
function Nuevo($nombre, $texto) { $r = Join-Path $dir $nombre; Escribir $r $texto; return $r }
function Js($nombre, $texto) { Escribir (Join-Path $dir $nombre) $texto }
function Contar($t) { return ($t -split '\r?\n').Count }
function Huella($ruta) { return (Get-FileHash $ruta -Algorithm SHA256).Hash }
function TieneBom($ruta) {
  $b = [System.IO.File]::ReadAllBytes($ruta)
  return ($b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF)
}
function Probar($nombre, $cond) {
  if ($cond) { Write-Host ("PASS  " + $nombre) -ForegroundColor Green; $script:ok++ }
  else { Write-Host ("FAIL  " + $nombre) -ForegroundColor Red; $script:mal++ }
}
function Invocar($prog, $archivo) {
  $argumentos = @((Join-Path $dir $prog))
  if ($archivo) { $argumentos += $archivo }
  $out = & node @argumentos 2>&1 | ForEach-Object { "$_" }
  $codigo = $LASTEXITCODE
  return [pscustomobject]@{ Codigo = $codigo; Salida = ($out -join ' / ') }
}

Write-Host "=== ENTORNO ===" -ForegroundColor Cyan
"PowerShell: " + $PSVersionTable.PSVersion.ToString()
"Node: " + (& node --version)
"Helper bajo prueba: " + $origen
"SHA256 del helper: " + (Huella $origen)
"Carpeta de pruebas: " + $dir

# ---------- Scripts de prueba (importan el helper real copiado como editor.cjs) ----------
Js 'p0_exports.cjs' @'
const m = require('./editor.cjs');
const nombres = ['abrir', 'reemplazarEnLinea', 'reemplazarPorContenido', 'insertarAntesDe', 'insertarDespuesDe', 'borrarLinea', 'reemplazarBloque', 'guardar'];
const faltan = nombres.filter(function (n) { return typeof m[n] !== 'function'; });
console.log(faltan.length === 0 ? 'EXPORTS_OK' : 'FALTAN: ' + faltan.join(','));
'@

Js 'p2_editar.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'ID-006', 'PENDIENTE', 'CERRADO', 'estado 006');
e.reemplazarPorContenido(d, 'Linea siete', 'Linea siete MODIFICADA con $& y $$ literales', 'sustitucion 007');
e.insertarAntesDe(d, 'ID-004', ['ID-003b Insertada antes de 004'], 'insertar antes de 004');
e.insertarDespuesDe(d, 'ID-004 ', ['ID-004b Insertada despues 1', 'ID-004c Insertada despues 2'], 'insertar despues de 004');
e.borrarLinea(d, 'Linea tres para borrar', 'borrar 003');
e.reemplazarEnLinea(d, 'ID-001', 'ni\u00f1o', 'ni\u00f1os', 'acento 001');
e.guardar(d);
'@

Js 'p3_anclaje_roto.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'ID-006', 'PENDIENTE', 'CERRADO', 'estado 006');
e.borrarLinea(d, 'Linea tres para borrar', 'borrar 003');
e.insertarDespuesDe(d, 'ID-004 ', ['ID-004b Insertada'], 'insertar 004b');
e.reemplazarEnLinea(d, 'ID-999', 'x', 'y', 'anclaje inexistente');
e.guardar(d);
'@

Js 'p3b_anclaje_duplicado.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.borrarLinea(d, 'Linea tres para borrar', 'borrar 003');
e.reemplazarPorContenido(d, 'Linea', 'X', 'anclaje duplicado');
e.guardar(d);
'@

Js 'p3c_buscar_ausente.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'ID-006', 'TEXTO_QUE_NO_ESTA', 'x', 'buscar ausente en la linea ancla');
e.guardar(d);
'@

Js 'p4_insertar.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.insertarDespuesDe(d, 'ID-008 ', ['ID-008b Nueva linea P4'], 'insertar P4');
e.guardar(d);
'@

Js 'p5a_multilinea.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarPorContenido(d, 'Linea siete\nLinea ocho', 'X', 'multilinea con reemplazarPorContenido');
e.guardar(d);
'@

Js 'p5b_bloque.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarBloque(d, 'ID-007', 'ID-008', ['ID-007 Bloque nuevo A', 'ID-008 Bloque nuevo B', 'ID-008b Bloque nuevo C'], 'bloque 007-008');
e.guardar(d);
'@

Js 'p5c_bloque_sin_cierre.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarBloque(d, 'ID-009', 'CIERRE_INEXISTENTE', ['x'], 'bloque sin cierre');
e.guardar(d);
'@

Js 'p6_codigo.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'timeout:', '1000', '2000', 'timeout');
e.reemplazarEnLinea(d, 'retries:', '3', '5', 'retries');
e.reemplazarPorContenido(d, 'const y = x * 2;', 'const y = x * 3;', 'factor');
e.insertarDespuesDe(d, 'const y = x * 3;', ["  if (Number.isNaN(y)) { throw new Error('NaN'); }"], 'validacion NaN');
e.reemplazarBloque(d, 'function otra', '}', ['function otra(a, b) {', '  return a - b;', '}'], 'otra()');
e.borrarLinea(d, "url: 'https://example.invalid/a',", 'quitar url');
e.guardar(d);
'@

Js 'p6b_rompe.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'return y;', 'return y;', 'return y +;', 'rompe sintaxis a proposito');
e.guardar(d);
'@

Js 'p7_basico.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.insertarDespuesDe(d, 'ID-001', ['ID-001b Nueva'], 'insertar basico');
e.guardar(d);
'@

Js 'p8_sin_salto_final.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'ID-002', 'dos', 'DOS', 'sin salto final');
e.guardar(d);
'@

Js 'p9_ancla_vacia.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.borrarLinea(d, '', 'ancla vacia');
e.guardar(d);
'@

Js 'p9_no_arreglo.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.insertarDespuesDe(d, 'ID-001', 'esto es texto, no arreglo', 'lineas nuevas no son arreglo');
e.guardar(d);
'@

Js 'p9_sin_cambios.cjs' @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.guardar(d);
'@

# ---------- Archivos de muestra (la n con tilde se arma por code point) ----------
$n = [string][char]0x00F1
$base = @(
  '# Documento de prueba',
  ('ID-001 Linea uno con acento: ni' + $n + 'o'),
  'ID-002 Linea dos con codigo `npm test` y $LASTEXITCODE',
  'ID-003 Linea tres para borrar',
  'ID-004 Linea cuatro ancla de insercion',
  'ID-005 Linea cinco con dinero $& literal',
  'ID-006 Linea seis estado: PENDIENTE',
  'ID-007 Linea siete',
  'ID-008 Linea ocho',
  '',
  'ID-009 Linea nueve final'
)
$crlf = ($base -join "`r`n") + "`r`n"
$lf = ($base -join "`n") + "`n"

# ================= P0: el helper en si =================
Write-Host "`n=== P0: el helper (sintaxis y exports) ===" -ForegroundColor Cyan
& node --check (Join-Path $dir 'editor.cjs')
Probar 'P0 node --check del helper sin errores' ($LASTEXITCODE -eq 0)
$r = Invocar 'p0_exports.cjs' $null
Probar 'P0 exporta las 8 funciones de la tabla 2.6.2' (($r.Codigo -eq 0) -and ($r.Salida -match 'EXPORTS_OK'))
if ($r.Salida -notmatch 'EXPORTS_OK') { Write-Host ("DIAG  " + $r.Salida) }

# ================= P1: codificacion =================
Write-Host "`n=== P1: codificacion y BOM del script ===" -ForegroundColor Cyan
$cps = 0x00F1,0x00E1,0x00E9,0x2014,0x2705
$esperado = (($cps | ForEach-Object { [string][char]$_ }) -join ' ')
$js1 = "const fs = require('fs');`nfs.writeFileSync(process.argv[2], '\u00f1 \u00e1 \u00e9 \u2014 \u2705', 'utf-8');`n"
$js1 | Out-File -FilePath (Join-Path $dir 'p1a.cjs') -Encoding utf8
Js 'p1b.cjs' $js1
Probar 'P1 Out-File utf8 agrega BOM al .cjs (informativo, esperado en 5.1)' (TieneBom (Join-Path $dir 'p1a.cjs'))
$sa = Join-Path $dir 'p1a_salida.txt'
$sb = Join-Path $dir 'p1b_salida.txt'
& node (Join-Path $dir 'p1a.cjs') $sa
Probar 'P1a Node ejecuta el .cjs con BOM' ($LASTEXITCODE -eq 0)
& node (Join-Path $dir 'p1b.cjs') $sb
Probar 'P1b Node ejecuta el .cjs sin BOM' ($LASTEXITCODE -eq 0)
Probar 'P1a salida identica a la esperada' ((Test-Path $sa) -and ((Leer $sa) -ceq $esperado))
Probar 'P1b salida identica a la esperada' ((Test-Path $sb) -and ((Leer $sb) -ceq $esperado))

# script que importa el helper, guardado con Out-File utf8 (con BOM), como en 2.6.6
$f = Nuevo 'p1c.md' $lf
@'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.reemplazarEnLinea(d, 'ID-006', 'PENDIENTE', 'CERRADO', 'estado 006 desde script con BOM');
e.guardar(d);
'@ | Out-File -FilePath (Join-Path $dir 'p1c.cjs') -Encoding utf8
$r = Invocar 'p1c.cjs' $f
Probar 'P1c script con BOM que importa el helper termina en 0' ($r.Codigo -eq 0)
Probar 'P1c el archivo editado NO queda con BOM' (-not (TieneBom $f))
Probar 'P1c bytes en disco: la n con tilde sigue siendo C3 B1' ([System.IO.File]::ReadAllBytes($f) -contains 0xC3)

# ================= P2: 6 ediciones, CRLF y LF =================
Write-Host "`n=== P2: 6 ediciones con los 5 patrones (CRLF y LF) ===" -ForegroundColor Cyan
$salidaCrlf = ''
foreach ($tipo in 'crlf','lf') {
  if ($tipo -eq 'crlf') { $texto = $crlf } else { $texto = $lf }
  $f = Nuevo ("p2_" + $tipo + ".md") $texto
  $antes = Contar (Leer $f)
  $r = Invocar 'p2_editar.cjs' $f
  if ($tipo -eq 'crlf') { $salidaCrlf = $r.Salida }
  Probar "P2 $tipo script termina en 0" ($r.Codigo -eq 0)
  if ($r.Codigo -ne 0) { Write-Host ("DIAG  " + $r.Salida) }
  $t = Leer $f
  Probar "P2 $tipo sin BOM" (-not (TieneBom $f))
  if ($tipo -eq 'crlf') {
    Probar "P2 crlf conserva CRLF (sin LF sueltos)" (-not [regex]::IsMatch($t, '(?<!\r)\n'))
    Probar "P2 crlf conserva el salto final" ($t.EndsWith("`r`n"))
  } else {
    Probar "P2 lf sin ningun CR" (-not $t.Contains("`r"))
    Probar "P2 lf conserva el salto final" ($t.EndsWith("`n"))
  }
  Probar "P2 $tipo suma neta de 2 lineas" ((Contar $t) -eq ($antes + 2))
  Probar "P2 $tipo reemplazo en linea (estado CERRADO)" ($t.Contains('ID-006 Linea seis estado: CERRADO'))
  Probar "P2 $tipo signos especiales literales" ($t.Contains('Linea siete MODIFICADA con $& y $$ literales'))
  Probar "P2 $tipo acento conservado (ninos con n con tilde)" ($t.Contains(('ni' + $n + 'os')))
  Probar "P2 $tipo linea borrada" (-not $t.Contains('Linea tres para borrar'))
  Probar "P2 $tipo orden de las inserciones" (($t.IndexOf('ID-003b') -lt $t.IndexOf('ID-004 ')) -and ($t.IndexOf('ID-004 ') -lt $t.IndexOf('ID-004b')) -and ($t.IndexOf('ID-004b') -lt $t.IndexOf('ID-004c')))
  Probar "P2 $tipo lineas no tocadas intactas (backticks y dolar)" ($t.Contains('ID-002 Linea dos con codigo `npm test` y $LASTEXITCODE') -and $t.Contains('ID-005 Linea cinco con dinero $& literal'))
}
Write-Host ("INFO  " + $salidaCrlf)
Probar 'P2 registro: un OK por cada cambio (6)' (([regex]::Matches($salidaCrlf, 'OK: ')).Count -eq 6)
Probar 'P2 registro: informa el separador detectado' ($salidaCrlf -match 'Separador: CRLF')
Probar 'P2 registro: informa longitudes original y nueva' ($salidaCrlf -match 'longitud: \d+ -> \d+')

# ================= P3: anclaje roto / duplicado / buscar ausente =================
Write-Host "`n=== P3: fallos de anclaje (el archivo debe quedar intacto) ===" -ForegroundColor Cyan
foreach ($caso in @(
    @('p3_anclaje_roto.cjs', 'anclaje inexistente (0 coincidencias)'),
    @('p3b_anclaje_duplicado.cjs', 'anclaje duplicado (mas de 1 coincidencia)'),
    @('p3c_buscar_ausente.cjs', 'texto a buscar ausente en la linea ancla'))) {
  $f = Nuevo ('p3_' + $caso[0] + '.md') $crlf
  $h0 = Huella $f
  $r = Invocar $caso[0] $f
  $h1 = Huella $f
  Probar ("P3 " + $caso[1] + ": exit 1") ($r.Codigo -eq 1)
  Probar ("P3 " + $caso[1] + ": archivo byte a byte igual (SHA256)") ($h0 -eq $h1)
  Probar ("P3 " + $caso[1] + ": mensaje FALLO visible") ($r.Salida -match 'FALLO')
  Write-Host ("INFO  " + $r.Salida)
}

# ================= P4: doble ejecucion =================
Write-Host "`n=== P4: doble ejecucion ===" -ForegroundColor Cyan
$f = Nuevo 'p4.md' $lf
$r1 = Invocar 'p4_insertar.cjs' $f
$h1 = Huella $f
$r2 = Invocar 'p4_insertar.cjs' $f
$h2 = Huella $f
Probar 'P4 primera ejecucion termina en 0' ($r1.Codigo -eq 0)
Probar 'P4 segunda ejecucion se detiene (exit 1, "ya existe")' (($r2.Codigo -eq 1) -and ($r2.Salida -match 'ya existe'))
Probar 'P4 la segunda ejecucion no cambia el archivo' ($h1 -eq $h2)
Probar 'P4 la linea insertada aparece una sola vez' (([regex]::Matches((Leer $f), 'ID-008b')).Count -eq 1)
$f = Join-Path $dir 'p2_crlf.md'
$h1 = Huella $f
$r = Invocar 'p2_editar.cjs' $f
$h2 = Huella $f
Probar 'P4b repetir el script de P2 sobre el archivo ya editado termina en 1' ($r.Codigo -eq 1)
Probar 'P4b el archivo ya editado no cambia' ($h1 -eq $h2)

# ================= P5: bloques multilinea =================
Write-Host "`n=== P5: bloques multilinea ===" -ForegroundColor Cyan
$f = Nuevo 'p5a.md' $crlf
$h0 = Huella $f
$r = Invocar 'p5a_multilinea.cjs' $f
Probar 'P5a reemplazarPorContenido NO cruza lineas (exit 1)' ($r.Codigo -eq 1)
Probar 'P5a archivo intacto' ($h0 -eq (Huella $f))
$f = Nuevo 'p5b.md' $crlf
$antes = Contar (Leer $f)
$r = Invocar 'p5b_bloque.cjs' $f
$t = Leer $f
Probar 'P5b reemplazarBloque termina en 0' ($r.Codigo -eq 0)
Probar 'P5b conserva CRLF' (-not [regex]::IsMatch($t, '(?<!\r)\n'))
Probar 'P5b el bloque viejo desaparecio' (-not $t.Contains('Linea siete'))
Probar 'P5b el bloque nuevo esta completo y en orden' (($t.IndexOf('ID-007 Bloque nuevo A') -lt $t.IndexOf('ID-008 Bloque nuevo B')) -and ($t.IndexOf('ID-008 Bloque nuevo B') -lt $t.IndexOf('ID-008b Bloque nuevo C')))
Probar 'P5b suma neta de 1 linea' ((Contar $t) -eq ($antes + 1))
$f = Nuevo 'p5c.md' $crlf
$h0 = Huella $f
$r = Invocar 'p5c_bloque_sin_cierre.cjs' $f
Probar 'P5c bloque sin linea de cierre: exit 1' ($r.Codigo -eq 1)
Probar 'P5c bloque sin cierre: archivo intacto' ($h0 -eq (Huella $f))

# ================= P6: archivo de codigo =================
Write-Host "`n=== P6: archivo .js con 6 ediciones + node --check ===" -ForegroundColor Cyan
$ejemploRaw = @'
const config = {
  timeout: 1000,
  retries: 3,
  url: 'https://example.invalid/a',
};

function procesar(x) {
  const y = x * 2;
  return y;
}

function otra(a, b) {
  return a + b;
}

module.exports = { procesar, otra };
'@
$ejemplo = $ejemploRaw.Replace("`r`n", "`n") + "`n"
$f = Nuevo 'ejemplo_edit.js' $ejemplo
$r = Invocar 'p6_codigo.cjs' $f
Probar 'P6 el script termina en 0 (6 ediciones sobre .js)' ($r.Codigo -eq 0)
if ($r.Codigo -ne 0) { Write-Host ("DIAG  " + $r.Salida) }
& node --check $f
Probar 'P6 node --check sin errores' ($LASTEXITCODE -eq 0)
$res = (& node -e "const m=require(process.argv[1]); console.log(m.procesar(2), m.otra(1,2))" $f)
Probar 'P6 el codigo editado se comporta como se espera (salida: 6 -1)' ($res -eq '6 -1')
$g = Nuevo 'ejemplo_rompe.js' $ejemplo
$r = Invocar 'p6b_rompe.cjs' $g
Probar 'P6b el helper no valida sintaxis (exit 0 con codigo roto, esperado)' ($r.Codigo -eq 0)
& node --check $g 2>$null
Probar 'P6b node --check SI detecta el error de sintaxis' ($LASTEXITCODE -ne 0)

# ================= P7: archivo que mezcla CRLF y LF =================
Write-Host "`n=== P7: separadores mezclados ===" -ForegroundColor Cyan
$f = Nuevo 'p7_mixto.md' ("ID-001 a`r`nID-002 b`nID-003 c`r`n")
$h0 = Huella $f
$r = Invocar 'p7_basico.cjs' $f
Probar 'P7 archivo mixto: exit 1' ($r.Codigo -eq 1)
Probar 'P7 archivo mixto: mensaje menciona CRLF y LF' ($r.Salida -match 'mezcla')
Probar 'P7 archivo mixto: intacto' ($h0 -eq (Huella $f))

# ================= P8: sin salto de linea final =================
Write-Host "`n=== P8: archivo sin salto de linea final ===" -ForegroundColor Cyan
$f = Nuevo 'p8.md' "ID-001 uno`nID-002 dos"
$r = Invocar 'p8_sin_salto_final.cjs' $f
Probar 'P8 termina en 0' ($r.Codigo -eq 0)
Probar 'P8 no agrega salto final y el contenido es exacto' ((Leer $f) -ceq "ID-001 uno`nID-002 DOS")

# ================= P9: BOM en el archivo editado y entradas invalidas =================
Write-Host "`n=== P9: BOM del archivo y entradas invalidas ===" -ForegroundColor Cyan
$f = Join-Path $dir 'p9_bom.md'
[System.IO.File]::WriteAllText($f, "ID-001 uno`r`nID-002 dos`r`n", (New-Object System.Text.UTF8Encoding($true)))
Probar 'P9 el archivo de partida SI tiene BOM' (TieneBom $f)
$r = Invocar 'p7_basico.cjs' $f
Probar 'P9 archivo con BOM se edita (exit 0)' ($r.Codigo -eq 0)
Probar 'P9 el BOM se quita al guardar' (-not (TieneBom $f))
Probar 'P9 conserva CRLF y el contenido' ((Leer $f) -ceq "ID-001 uno`r`nID-001b Nueva`r`nID-002 dos`r`n")

$r = Invocar 'p7_basico.cjs' (Join-Path $dir 'no_existe.md')
Probar 'P9 ruta inexistente: exit 1 con FALLO legible' (($r.Codigo -eq 1) -and ($r.Salida -match 'FALLO'))

foreach ($caso in @(
    @('p9_ancla_vacia.cjs', 'ancla vacia'),
    @('p9_no_arreglo.cjs', 'lineas nuevas que no son arreglo'),
    @('p9_sin_cambios.cjs', 'guardar sin ningun cambio'))) {
  $f = Nuevo ('p9_' + $caso[0] + '.md') $lf
  $h0 = Huella $f
  $r = Invocar $caso[0] $f
  Probar ("P9 " + $caso[1] + ": exit 1") ($r.Codigo -eq 1)
  Probar ("P9 " + $caso[1] + ": archivo intacto") ($h0 -eq (Huella $f))
  Write-Host ("INFO  " + $r.Salida)
}

# ================= P10: secuencia completa 2.6.6 (here-string con backticks + limpieza) =================
Write-Host "`n=== P10: secuencia 2.6.6 (script temporal, backticks, limpieza) ===" -ForegroundColor Cyan
$f = Nuevo 'p10.md' $lf
$temporal = Join-Path $dir 'editar_temporal.cjs'
$scriptTmp = @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.insertarDespuesDe(d, 'ID-001', ['Ver `archivo.md` y `npm test`'], 'backticks inline');
e.guardar(d);
'@
$scriptTmp | Out-File -FilePath $temporal -Encoding utf8
& node $temporal $f
$cod = $LASTEXITCODE
if ($cod -eq 0) { Remove-Item $temporal }
Probar 'P10 el script temporal termina en 0' ($cod -eq 0)
Probar 'P10 los backticks inline llegaron literales' ((Leer $f).Contains('Ver `archivo.md` y `npm test`'))
Probar 'P10 el temporal se elimina solo si node termino en 0' (-not (Test-Path $temporal))
$scriptMalo = @'
const e = require('./editor.cjs');
const d = e.abrir(process.argv[2]);
e.borrarLinea(d, 'ANCLA_QUE_NO_EXISTE', 'borrar inexistente');
e.guardar(d);
'@
$scriptMalo | Out-File -FilePath $temporal -Encoding utf8
$h0 = Huella $f
& node $temporal $f 2>$null
$cod = $LASTEXITCODE
if ($cod -eq 0) { Remove-Item $temporal }
Probar 'P10 con anclaje roto node termina distinto de 0' ($cod -ne 0)
Probar 'P10 con fallo el temporal se CONSERVA para diagnostico' (Test-Path $temporal)
Probar 'P10 con fallo el archivo no cambia' ($h0 -eq (Huella $f))

# ================= RESUMEN =================
Write-Host ("`n=== RESUMEN: " + $script:ok + " PASS, " + $script:mal + " FAIL ===") -ForegroundColor Cyan
Set-Location $repo
if ($script:mal -eq 0) {
  Remove-Item $dir -Recurse -Force
  Write-Host 'Todo en orden. Carpeta temporal eliminada.' -ForegroundColor Green
  exit 0
} else {
  Write-Host ("Hay fallos. Carpeta conservada para diagnostico: " + $dir) -ForegroundColor Red
  exit 1
}
