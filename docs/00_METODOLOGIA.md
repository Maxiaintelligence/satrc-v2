# SatRC V2.0 — Metodología de trabajo

> Este documento define cómo se trabaja DURANTE EL DESARROLLO DE SatRC. Aplica por igual a personas y a asistentes de IA. Ningún cambio de código o documentación debe saltarse estos pasos.

## Principio rector

> Ningún cambio se escribe sin entender qué problema resuelve, qué archivos toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción y lo usan personas reales.
>
> **Principio de precisión (DEC-011, 28/10/2026):** una alerta debe corresponder a un evento real. Los falsos positivos erosionan la confianza de las comunidades y hacen que ignoren las alertas verdaderas. La metodología prioriza la verificación empírica sobre la suposición, y la comprobación del efecto real sobre la confianza en el código de salida.

---

## Fase 0: Contrato de interacción humano-IA

> Vigente desde el 30/10/2026. Es de cumplimiento obligatorio para cualquier asistente de IA, en cualquier sesión. Si la IA se sale del método o pierde el contexto, la persona escribe **COLIBRI** y la IA vuelve a esta fase (ver 0.11).

### 0.1 Dos modos con compuerta

- **Modo ADQUISICIÓN DE CONTEXTO (modo por defecto al iniciar una sesión).** La IA solo recibe y comprende la documentación y los archivos. Está prohibido proponer código, refactors, mejoras o cambios, y emitir dictámenes, evaluaciones, críticas o recomendaciones. Está prohibido resumir de forma superficial: se busca comprender la arquitectura, los flujos, los motores, las dependencias y las decisiones de diseño, con una cobertura objetivo superior al 95 %.
- **Respuesta por bloque recibido.** La IA responde únicamente con: (1) el encabezado de estado (0.6); (2) el porcentaje aproximado de cobertura y por qué, anclado a una lista de **lo recibido** y **lo faltante** (por ejemplo: documentos `00` a `09`, `api/`, `scripts/`, `src/`); (3) la línea `Contradicciones detectadas: N (se detallan al final)`.
- **Contradicciones.** Las contradicciones entre archivos se guardan y se detallan **solo al final**, en la primera respuesta posterior a que la persona indique que no hay más bloques; no antes.
- **Entendimiento acumulativo.** La IA mantiene y actualiza su entendimiento del proyecto (arquitectura, stack, módulos, flujos de datos, convenciones, estado actual, pendientes). Como ese entendimiento no es verificable ni persiste entre mensajes, la lista de recibido y faltante y el contador de contradicciones son la parte visible y verificable.
- **Modo EJECUCIÓN.** Se activa únicamente cuando la persona escribe exactamente **INICIAR EJECUCIÓN**. Hasta entonces no se propone ni se escribe ningún cambio.

### 0.2 Ciclo fijo por problema

El contexto se pierde entre postulados infinitos, análisis múltiples y escenarios diversos. Por eso SIEMPRE se aplica el paso a paso:

**PROBLEMA → ANÁLISIS → ESTRATEGIA → autorización de la persona → IMPLEMENTACIÓN → PRUEBAS DE ÉXITO → COMMIT ATÓMICO**

Se avanza un paso a la vez. No se pasa al siguiente sin haber cerrado el anterior.

### 0.3 Evidencia antes de recomendar

- Siempre se realizan pruebas antes de generar recomendaciones o estrategias. La solidez se construye con hechos, pruebas y tests, no con afirmaciones sin fundamento.
- Si la evidencia superficial no garantiza el éxito, se buscan pruebas de grado secundario, terciario y cuaternario: en la superficie muchas veces no se ven las causas reales escondidas en el fondo del código o del problema.
- Las estrategias se presentan para decisión solo cuando se entiende que son una solución sólida, y siempre con la justificación de por qué se recomiendan.
- Si no se sabe resolver un problema con la información, el contexto o las pruebas disponibles, o si se entra en un bucle, la IA lo declara y pide ayuda de consultor experto para abrir un diálogo de discernimiento, en lugar de insistir.
- **Nomenclatura.** La *profundidad de evidencia* se expresa en **grados** (primario, secundario, terciario, cuaternario). Los **niveles 1 a 4 de la Fase 6** son capas del sistema (Endpoints, Almacenamiento, Runner, Contratos) y no son grados de evidencia.

### 0.4 Autorización

La IA pide autorización explícita antes de proceder en cada paso del ciclo (0.2) y no ejecuta el siguiente paso sin recibirla. Ante la duda, pregunta antes de asumir.

### 0.5 Nada sin fundamento

- Toda afirmación se basa exclusivamente en los archivos y la documentación entregados.
- Si algo no está en el contexto, la IA responde "No tengo esa información" y la pide.
- Está prohibido inventar nombres de archivos, funciones, endpoints, variables, versiones o dependencias.

### 0.6 Encabezado de estado obligatorio

Toda respuesta de la IA empieza con una línea de estado:

`FASE: <modo o paso> | Autorización pendiente: sí/no | Archivos tocados: <lista o ninguno>`

Sirve para detectar la deriva de un vistazo, antes de que se acumule.

### 0.7 Entorno PowerShell 5.1

La persona trabaja con Windows PowerShell 5.1 (verificado el 30/10/2026: 5.1.26100) y Node.js (verificado el 30/10/2026: v22), y cuenta con un entorno local con las claves en `.env.local` para probar los servicios reales.

- **Inicio de cada bloque.** Todo bloque de PowerShell empieza con `cd "<RAIZ_REPO>"`, porque la persona abre y cierra terminales continuamente. La ruta literal la fija el prompt inicial de la sesión. La carpeta local se llama `satrc-v3` aunque el proyecto sea V2.0, y es correcto. Los bloques son completos y copiables.
- **Sin `&&`.** PowerShell 5.1 no lo admite (verificado el 30/10/2026: `ParserError`). Los comandos van en líneas separadas con verificación de `$LASTEXITCODE`.
- **Bloques con compuertas.** Un `return` en el nivel raíz de un bloque pegado no detiene el resto de lo pegado. Los bloques con compuertas se envuelven en `& { ... }` para que `return` los detenga por completo.
- **Lectura de archivos.** Siempre con `Get-Content -Encoding UTF8` o con `[System.IO.File]::ReadAllText(<ruta absoluta>, <UTF8>)`. Nunca `Get-Content`, `gc`, `type` ni `cat` sin codificación. Con .NET se usan rutas absolutas (`Resolve-Path`), porque .NET no sigue el `cd` de PowerShell; con `node` las rutas relativas funcionan después del `cd`.
- **Mojibake falso.** Hechos verificados el 30/10/2026 (PowerShell 5.1.26100, consola en página de códigos 437), sobre un archivo UTF-8 sin BOM sano en disco (bytes `C3 B1` para la `ñ`):
  - `Get-Content` sin `-Encoding` muestra `Ã±` en lugar de `ñ`.
  - `Get-Content -Encoding UTF8`, `Select-String` y `ReadAllText` con UTF-8 lo leen bien.
  - La consola dibuja correctamente `ñ`, `✅` y las comillas tipográficas cuando el texto se decodificó bien.

  **Regla:**
  1. `Ã±`, `Ã¡` o `â€”` en una salida pegada **no son evidencia** de un archivo dañado: suelen indicar una lectura sin codificación.
  2. Antes de concluir que hay daño se pide la **prueba de bytes** (`C3 B1` es una `ñ` correcta; `EF BB BF` es un BOM) o se relee con `-Encoding UTF8`.
  3. Está prohibido reescribir, "reparar" o recodificar un archivo por esa causa: hacerlo agrega un BOM o doble-codifica, y convierte un daño aparente en un daño real.
  4. La estrategia en curso no se abandona por un mojibake aparente.
  5. Solo si la prueba de bytes confirma doble codificación real (por ejemplo `C3 83 C2 B1` en lugar de `C3 B1`) se abre un diagnóstico, con autorización.

  Prueba de bytes de referencia (solo lectura):

  ```powershell
  cd "<RAIZ_REPO>"
  $p = (Resolve-Path "docs\ARCHIVO.md").Path
  $t = [System.IO.File]::ReadAllText($p, (New-Object System.Text.UTF8Encoding($false)))
  $pat = [string][char]0x00C3 + '|' + [string][char]0x00E2 + [string][char]0x20AC
  "Mojibake real en el texto: " + [regex]::IsMatch($t, $pat)
  ```

  Salida esperada en un archivo sano: `False`.

### 0.8 Formato de entrega de cada cambio

El formato obligatorio de toda propuesta de cambio está en la **Fase 2.5** (fuente única).

### 0.9 Umbral de reemplazo de archivos

El umbral está en la **Fase 2.5**, punto 4, y en la **Regla de oro 12** (fuente única: 50 líneas). Con más de 4 ediciones en un mismo archivo se aplica la **Fase 2.6**.

### 0.10 Idioma

Todas las preguntas y respuestas son en español.

### 0.11 Palabra de emergencia: COLIBRI

Cuando el mensaje completo de la persona sea exactamente `COLIBRI` (en mayúsculas, sin acento y sin más texto), la IA:

1. se detiene;
2. descarta el plan o bloque que tenía pendiente;
3. relee esta Fase 0;
4. responde únicamente con el encabezado de estado, el último paso que la persona autorizó explícitamente y lo que falta por autorizar;
5. espera instrucciones.

La orden tiene prioridad sobre el formato de "solo porcentaje" del modo ADQUISICIÓN. La palabra dentro de otro texto no activa nada. Se eligió por no tener relación con el proyecto: la búsqueda del 30/10/2026 no la encontró en ningún archivo `.md`, `.js`, `.mjs`, `.cjs`, `.jsx`, `.json` ni `.yml` del repositorio.

---

## Fase 1: Antes de tocar nada

1. **Estado del repositorio:** ejecutar `git status` y confirmar que el árbol de trabajo está limpio.
2. **Estado de producción:** revisar la última corrida de GitHub Actions, el estado del despliegue en Vercel y **el timestamp real de los archivos en Google Drive** (`estado_ligero.json`, `estado_diocesano.json`). Una corrida en verde no garantiza que Drive se haya actualizado: el runner puede imprimir `✅ Publicación exitosa` aunque `escribirJSONBlob` haya devuelto `null` (ver H-DRIVE-01).
3. **Diagnóstico:** SIEMPRE ATACAR LA CAUSA RAÍZ, NO ASUMIR NADA, NO EL SÍNTOMA. Usar PowerShell y pruebas en la terminal. El entorno local está configurado con `.env.local` para pruebas profundas contra los servicios reales, pero la verificación del efecto final se debe hacer en producción (Drive, Vercel, GitHub Actions) para no confundir el comportamiento del entorno local con el de la nube.
4. **Preguntar antes de asumir:** si el alcance o el diseño son ambiguos, consultarlo con la persona que coordina el proyecto antes de escribir una sola línea.

---

## Fase 2: Diseño

1. **Pruebas primero en lógica crítica:** si el cambio toca el motor de riesgo o los contratos de datos, las pruebas se escriben antes que el código.
2. **Un commit por causa:** cada commit debe poder revertirse con `git revert <hash>` sin afectar lo demás. Los hitos grandes se dividen en commits atómicos (por ejemplo, H8.1, H8.2, H8.3).

---

## Fase 2.5: Protocolo estricto de modificación de código

> **Regla de oro (aplicable a humanos y a asistentes de IA):** El código de este repositorio está en producción. Una instrucción ambigua o un "reemplaza todo el archivo" es una falla grave de metodología. Toda instrucción de cambio debe ser atómica, verificable y sin márgenes de error.

Cuando se solicite un cambio de código (fix, feature o refactor), la propuesta debe incluir **obligatoriamente** los siguientes puntos. El punto 7 aplica solo cuando el cambio depende de servicios externos. Si el cambio requiere más de 4 ediciones en un mismo archivo, se sigue la **Fase 2.6**.

### 1. Archivo exacto a modificar
Se debe indicar la ruta completa y exacta desde la raíz del proyecto.

*Ejemplo:* `api/reporte-ondemand.js`

### 2. Pasos de la estrategia
Los pasos se presentan numerados y se avanza de uno en uno, con la autorización de la persona (Fase 0.4). Cada recomendación incluye su justificación (Fase 0.3).

### 3. Ubicación precisa (referencia)
Se debe indicar el nombre de la función, variable o bloque lógico que se va a modificar, y una estimación de la línea para encontrarlo rápido. Se muestra el bloque actual lo suficiente para dar la referencia adecuada.

*Ejemplo:* "Dentro de la función `componentesAVelocidadYDir`, busca la constante `const speedMs = ...` (alrededor de la línea 130)." y dar el ejemplo del bloque a reemplazar con suficiente contexto para facilitar su ubicacion desde donde inicia la edicion hasta donde termina. esta cambion inicia en `function componentesAVelocidadYDir(u, v)` y termina en `}`

function componentesAVelocidadYDir(u, v) {
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  const speedMs = Math.sqrt(u * u + v * v);
  let dirDeg = Math.atan2(-u, -v) * 180 / Math.PI;
  if (dirDeg < 0) dirDeg += 360;
  return { speedMs, dirDeg };
}

### 4. Bloque de código de reemplazo (con inicio y fin)
**Queda estrictamente prohibido reemplazar un archivo existente de más de 50 líneas** (Regla de oro 12). Los archivos nuevos y los de hasta 50 líneas pueden entregarse completos. Cuando el cambio requiere demasiadas ediciones, se aplica la Fase 2.6 y la persona proporciona la última versión del archivo para hacer las ediciones sobre ella.
Se debe escribir el bloque exacto y completo a reemplazar, indicando explícitamente con comentarios dónde inicia y dónde termina la edición, y garantizando que las llaves de cierre (`}`, `);`) queden intactas.

*Ejemplo:*

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
const nuevaVariable = "valor";
// --- FIN DE LA MODIFICACIÓN ---
```

### 5. Prueba empírica en PowerShell
Ningún cambio se da por bueno sin una prueba local. Se debe incluir el comando exacto para validar que el cambio se aplicó correctamente y que no rompió la sintaxis, en un solo bloque completo y copiable que cumpla la Fase 0.7. Se debe indicar la salida esperada (ej. "No debe devolver ningún texto").

*Ejemplo:* `node --check api/archivo.js` o `npm run build`.

### 6. Commit atómico
Cada propuesta debe terminar con las instrucciones exactas de Git para subir el cambio, garantizando que solo se agreguen los archivos afectados. PowerShell 5.1 no admite `&&` (Fase 0.7): cada comando va en su línea, con verificación de `$LASTEXITCODE`, dentro de `& { ... }`.

*Ejemplo:*

```powershell
cd "<RAIZ_REPO>"
& {
  git add api/archivo.js
  if ($LASTEXITCODE -ne 0) { Write-Host "FALLO git add"; return }
  git commit -m "fix(api): corrige variable X"
  if ($LASTEXITCODE -ne 0) { Write-Host "FALLO git commit"; return }
  git push origin main
  if ($LASTEXITCODE -ne 0) { Write-Host "FALLO git push"; return }
}
```

### 7. Pruebas en el entorno (si aplica)
Cuando el cambio depende de servicios externos, se incluyen las pruebas contra los servicios reales con las claves de `.env.local`, con pausas (`Start-Sleep`) entre llamadas para respetar los límites de cada servicio, y la verificación del efecto final en producción según la Fase 4.

---

## Fase 2.6: Modo edición por script (código y documentación)

> Método vigente desde el 29/10/2026 para documentos y ampliado el 30/10/2026 a código y a un helper compartido, tras un bloque de pruebas ejecutado en PowerShell 5.1.26100 con Node v22 (codificación, CRLF y LF, anclajes rotos, doble ejecución, bloques multilínea, archivo de código).

### 2.6.1 Cuándo se usa

- **Obligatorio** cuando el cambio requiere **más de 4 ediciones en un mismo archivo**, o afecta **más de 10 líneas**, sea documentación o código.
- Con 4 ediciones o menos se sigue la Fase 2.5.
- Lo que activa este modo no se edita a mano en VS Code.

### 2.6.2 La herramienta: `scripts/herramientas/editor.cjs`

Los scripts de edición **importan** el helper con `require` y **no reescriben los patrones**. Reescribirlos en cada sesión fue la fuente de los fallos intermitentes de los scripts generados por la IA.

| Función | Para qué sirve |
|---|---|
| `abrir(ruta)` | Lee el archivo, quita el BOM, detecta CRLF o LF (aborta si el archivo mezcla ambos) y lo divide en líneas. |
| `reemplazarEnLinea(d, id, buscar, reemplazo, etiqueta)` | Localiza una línea por su ID único y reemplaza una substring dentro de ella. |
| `reemplazarPorContenido(d, sub, reemplazo, etiqueta)` | Reemplaza una substring que aparece en una sola línea del documento. **No cruza líneas.** |
| `insertarAntesDe(d, id, nuevas, etiqueta)` | Inserta N líneas antes de la línea que contiene el ID. |
| `insertarDespuesDe(d, id, nuevas, etiqueta)` | Inserta N líneas después de la línea que contiene el ID. |
| `borrarLinea(d, sub, etiqueta)` | Elimina la única línea que contiene la substring. |
| `reemplazarBloque(d, inicio, fin, nuevas, etiqueta)` | Reemplaza desde la línea única que contiene `inicio` hasta la primera línea posterior que contiene `fin`, ambas incluidas. Es el patrón para bloques multilínea. |
| `guardar(d)` | Escribe UTF-8 sin BOM con el separador original e imprime un `OK` por cambio, el separador y las longitudes. |

Comportamiento comprobado:

- **Anclaje único.** Si un anclaje aparece 0 veces o más de 1, el script imprime `FALLO`, termina con código 1 y **no escribe nada**: el archivo queda byte a byte igual (comprobado con hash SHA256).
- **Doble ejecución.** Las inserciones se detienen si la primera línea nueva ya existe, y los reemplazos fallan porque su anclaje ya no está. Una segunda corrida no duplica ni cambia nada.
- **Signos especiales.** Los reemplazos usan una función, de modo que `$&` y `$$` en el texto nuevo quedan literales.
- **Separadores y codificación.** Se conserva CRLF o LF según el archivo, se conserva el salto de línea final y no se agrega BOM.
- **No valida sintaxis.** Un script puede dejar código con sintaxis rota y terminar con código 0. En código, `node --check` es obligatorio (2.6.5).

### 2.6.3 Estructura del script (tres fases)

- **Fase A:** abrir el archivo con `abrir` (lee, quita BOM, detecta separador y divide en líneas).
- **Fase B:** aplicar todos los cambios sobre la copia en memoria. Cada cambio verifica su anclaje; si falla, `process.exit(1)`. **Nunca se escribe nada hasta que todos los cambios pasaron.**
- **Fase C:** `guardar`, que escribe una sola vez.

Un script con 20 cambios y 1 anclaje roto no deja el archivo a medio editar.

Lección del 29/10/2026: hacer `split('\n')` y `join('\n')` sin detectar el separador deja un `\r` al final de cada línea en los archivos CRLF y rompe cualquier reemplazo. Por eso no se escriben scripts propios de lectura y escritura: se usa el helper. Tampoco se usa `.replace()` sobre el string completo del archivo (falla con CRLF y con múltiples ocurrencias, y no da diagnóstico legible).

### 2.6.4 Reglas de ejecución en PowerShell 5.1

1. **Extensión `.cjs` obligatoria.** El `package.json` declara `"type": "module"`: un `.mjs` fuerza ESM (sin `require`) y un `.cjs` fuerza CommonJS. Nunca se usa `.mjs` para scripts de edición.
2. **Here-string con comillas simples** `@' ... '@`, con el terminador `'@` al inicio de su línea. Nunca `@" ... "@`: los backticks de markdown inline (`archivo.md`, `npm test`) se interpretan como escapes y rompen el script. Es la corrección que resolvió el fallo de la sesión del 29/10/2026.
3. **BOM.** Guardar el script con `Out-File -Encoding utf8` agrega BOM al `.cjs`; Node lo tolera (verificado el 30/10/2026). Los archivos que se editan se escriben siempre **sin** BOM (lo garantiza el helper).
4. **Acentos.** Pegar caracteres acentuados dentro del here-string funciona (verificado el 30/10/2026 en la consola de PowerShell 5.1); no hace falta escaparlos.
5. **Script temporal.** Vive en la raíz del repositorio, se elimina **solo si `node` terminó con código 0** (si falla, se conserva para el diagnóstico) y nunca se agrega con `git add`.
6. **Un script por archivo.** La atomicidad está garantizada por archivo, no entre varios.
7. **Rutas.** Con `node`, relativas tras el `cd`; con .NET, absolutas (Fase 0.7).

### 2.6.5 Compuertas de verificación

**Documentación** (documentos `00` a `09`, `LEEME_PRIMERO.md` y similares):

```powershell
Select-String -Path "docs\ARCHIVO.md" -Pattern "ID1|ID2|ID3" | Select-Object LineNumber, Line
git --no-pager diff --stat docs/ARCHIVO.md
```

El diff debe mostrar el número esperado de inserciones y eliminaciones. Si el diff está vacío, el script falló silenciosamente. La salida del script debe mostrar un `OK: <etiqueta>` por cada cambio aplicado, más el separador detectado y las longitudes original y nueva; sin esos registros el script no se considera completado.

**Código** (`api/`, `scripts/`, `src/`):

1. `node --check <archivo>` en cada archivo de backend tocado. Es obligatorio: el helper no valida sintaxis (comprobado el 30/10/2026: un script que rompe la sintaxis termina con código 0 y solo `node --check` lo detecta).
2. `npm test` y `npm run lint` (Fase 3); `npm run build` si se tocó `src/`.
3. `git --no-pager diff` revisado antes del commit.
4. Commit atómico por causa (Fase 2).

### 2.6.6 Secuencia completa

1. **Prueba K (solo lectura):** volcado del contenido actual con `node -e "..."` o con `Get-Content -Encoding UTF8`.
2. **Script en PowerShell**, que importa el helper:

```powershell
cd "<RAIZ_REPO>"
$script = @'
const e = require('./scripts/herramientas/editor.cjs');
const d = e.abrir('docs/06_PENDIENTES.md');
// ...cambios con los patrones del helper...
e.guardar(d);
'@
$script | Out-File -FilePath "editar_temporal.cjs" -Encoding utf8
node editar_temporal.cjs
if ($LASTEXITCODE -eq 0) { Remove-Item "editar_temporal.cjs" } else { Write-Host "FALLO: no se escribio nada; se conserva editar_temporal.cjs" }
```

3. **Verificación** según 2.6.5.
4. **Confirmación:** si el diff es el esperado, se continúa con el siguiente archivo. Si no, se reporta y se detiene.

### 2.6.7 Límites conocidos

- El helper opera por líneas: un anclaje es una substring dentro de una sola línea.
- Aborta si el archivo mezcla CRLF y LF; hay que normalizarlo antes.
- Se probó con archivos de texto UTF-8. No se probó con edición simultánea de varios archivos en un mismo script.

---

## Fase 3: Verificación local (antes del commit)

| Tipo | Qué hacer | Obligatorio |
|---|---|---|
| Sintaxis | `node --check <archivo>` en `api/` (.js) y `scripts/` (.mjs y .cjs). | Sí, si se tocó backend |
| Build | `npm run build` para el frontend. | Sí, si se tocó `src/` |
| Lint | `npm run lint` (oxlint). Se toleran advertencias, no errores. | Sí |
| Pruebas | `npm test` debe quedar en verde. Si el cambio agrega una función, agrega su prueba. | Sí |
| Imports | Si cambias un import, verifica en tiempo de ejecución que el módulo carga. | Sí |
| Contratos | Si cambias el esquema de datos, verifica que los esquemas Zod sigan validando (`npm test`). | Sí, si se tocó `src/schemas/` |
| Edición por script | Compuertas de la Fase 2.6.5. | Sí, si se usó el modo script |

**Referencia verificada el 27/10/2026** con pruebas empíricas (P1, P2, P3): `npm test` → 167 pruebas en 17 archivos, todas en verde. `npm run build` → verde (solo warning benigno de chunks > 500 kB). `npm run lint` → 51 advertencias, 0 errores. Reverificar estas cifras al cierre de cada hito con `npm test`, `npm run build` y `npm run lint`. Si difieren, actualizar esta línea antes de dar el hito por cerrado.

> `npm test` no valida `api/`, `scripts/*.mjs` ni el build de React. Por eso `node --check` es obligatorio para backend, y `npm run build` para el frontend.

---

## Fase 4: Commit, despliegue y verificación en producción

**Formato de commit:** `tipo(área): descripción corta`. Ejemplo: `fix(api): aumenta max_completion_tokens en Groq`.

**Despliegue:** tras el push, confirmar en Vercel que el despliegue está en estado `Ready`.

**Doble disparador del runner (ADR-010, 29/10/2026):** el proceso autónomo tiene **dos disparadores activos simultáneamente** como capa de seguridad deliberada:
- **Primario:** `cron-job.org` externo invoca `/api/disparar-workflow` cada 3 h (timestamps exactos: 03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00 MX).
- **Respaldo:** `on.schedule: '21 */3 * * *'` interno de `sara_cron.yml` (timestamps irregulares por jitter de GitHub Actions).

Total efectivo: ~11-12 corridas/día. Documentado en `08_DECISIONES.md` ADR-010. Si `cron-job.org` falla o la URL externa se rompe, el respaldo interno mantiene el sistema actualizado. Bajo DEC-008, el margen de minutos de GitHub Actions es ~10 % del límite del plan gratuito. Revisar si el uso supera el 90 %.

**CI:** confirmar que el workflow `tests.yml` pasa en verde.

**Si el cambio toca el runner (`scripts/`):**
- Disparar manualmente `sara_cron.yml`.
- Verificar que el log indique cobertura completa (14/14 zonas) y sin errores de validación.
- Verificar el efecto real en Google Drive: consultar el timestamp de `estado_ligero.json` y `estado_diocesano.json`. El timestamp debe ser posterior al disparo. Si el log dice "Publicación exitosa" pero el timestamp no cambió, el fix falló silenciosamente.
- Consultar `/api/sara` y confirmar que devuelve `origen: GOOGLE_DRIVE_ACTUALIZADO` (no `RESPUESTA_EN_VIVO`) en días con y sin emergencias.

**Si el cambio toca el almacenamiento (`googleDrive.js`, `bitacora.js`, `sara.js`, `reporte-ondemand.js`):**
- Leer el archivo real desde Drive con una llamada directa a `leerJSONBlob` desde PowerShell o desde un script de prueba.
- Confirmar que la estructura es la esperada (no `null`, no HTML de login de Apps Script, no error).
- Si el cambio toca la bitácora, verificar que el `prev_hash` del último registro nuevo coincida con el `hash_completo` del registro anterior.

**Si el cambio afecta un endpoint público:** probarlo en la interfaz o con una petición HTTP antes de dar el hito por cerrado.

---

## Fase 5: Documentación (obligatoria en cada cierre)

Cada cierre de hito actualiza, en el mismo cambio:

- **`06_PENDIENTES.md`:** se quita el ítem cerrado o se marca su estado. Si el fix reveló deuda nueva, se agrega con su identificador y severidad.
- **`04_HISTORIAL.md`:** se agrega el fix con síntoma, causa, solución, verificación y commit.
- **`08_DECISIONES.md`:** se registra el ADR si el cambio altera la arquitectura o los proveedores de servicios.
- **`LEEME_PRIMERO.md`:** se actualiza el estado general si cambió.

Un ítem no puede estar en dos documentos a la vez. Si está en el historial, sale del backlog.

### Edición de los documentos fundacionales

Toda edición masiva o crítica de los documentos fundacionales (00 a 09) se hace con el **modo edición por script de la Fase 2.6** (fuente única de las reglas): más de 4 ediciones en un archivo o más de 10 líneas afectadas, con el helper `scripts/herramientas/editor.cjs`. El objetivo es preservar la codificación UTF-8 sin BOM, respetar el separador de línea nativo del archivo (CRLF o LF) y fallar ruidosamente antes de escribir si un anclaje no coincide. La verificación es la de la Fase 2.6.5.

### Reglas de seguridad documental

- Nunca escribir en la documentación claves, tokens, contraseñas ni sus valores de ejemplo. Usa el nombre de la variable de entorno y un placeholder (`<CLAVE>`).
- Nunca incluir nombres personales de terceros. Usa el rol (por ejemplo, "Coordinación pastoral").
- Nunca incluir rutas locales con nombres de usuario.
- Si una credencial aparece en un commit, se considera comprometida: se rota aunque después se elimine del código.

### Reglas de calidad documental

- Sin placeholders en commits. Si falta un hash, escribir "pendiente de registrar" y completarlo después.
- Sin cifras sin fuente. Un conteo (tests, localidades, hitos) incluye la fecha y el comando que lo produjo.
- Sin números de línea en la documentación: cambian con cualquier edición. Referenciar el archivo y la función.
- Un solo lugar por dato. Si un dato se repite en dos documentos, uno de ellos debe enlazar al otro en vez de copiarlo.

---

## Las reglas de oro

1. Nunca asumir el estado. Verificar con comandos: `git status`, logs de Vercel, `npm test`, timestamp en Drive.
2. Atacar la causa raíz, no el síntoma.
3. Preguntar antes que asumir.
4. Un commit por causa.
5. La suite de pruebas es obligatoria. Si `npm test` falla, no se hace push.
6. Verificar lo que se afirma. Si un documento dice algo, debe poder comprobarse en el código.
7. Verificar en producción. Que compile en local no basta.
8. Probar con datos reales cuando el cambio depende de una API externa.
9. Documentar decisiones y bugs en `04_HISTORIAL.md` y `08_DECISIONES.md`.
10. Pausar antes de acumular cambios. Cerrar un hito antes de empezar el siguiente.
11. Ningún secreto en el repositorio.
12. Prohibido reemplazar archivos enteros si tienen más de 50 líneas. Los cambios se hacen por bloques quirúrgicos con referencias de inicio y fin; con más de 4 ediciones en un mismo archivo se usa el modo script (Fase 2.6).
13. Prueba de sintaxis obligatoria. Antes de cualquier `git commit`, ejecutar `node --check` en los archivos de backend modificados.
14. Verificar el efecto real, no solo el código de salida. Un proceso que termina en 0 puede haber fallado silenciosamente. Los logs de "publicación exitosa" no sustituyen la verificación del archivo en Drive.
15. Si el fix toca el almacenamiento o la bitácora, incluir una prueba de lectura real desde Drive antes de dar el cambio por cerrado.
16. Un mojibake visto en la consola no es evidencia de un archivo dañado: se verifica con bytes o con lectura UTF-8 explícita, y nunca se reescribe un archivo por esa causa (Fase 0.7).
17. Si la IA pierde el método, la persona escribe COLIBRI y la IA vuelve a la Fase 0 (Fase 0.11).

---

## Fase 6: Protocolo de rescate de producción y pruebas en 4 niveles

> **Contexto:** Tras el incidente del 28/10/2026, se estableció este protocolo obligatorio para diagnosticar y resolver fallos en producción. El método empírico demostró que la intuición falla; solo los datos y la verificación en capas revelan la causa raíz.

Cuando la aplicación falle en producción (por ejemplo, `/api/sara` devuelve `RESPUESTA_EN_VIVO`, el semáforo está vacío o hay errores 500), es **obligatorio** seguir este orden:

1. **Nivel 1: Prueba de Endpoints (Frontend → Vercel)**
   - Hacer peticiones HTTP directas con `Invoke-RestMethod` a `/api/sara`, `/api/smn`, etc.
   - Comparar el `origen` y los datos devueltos con lo esperado.

2. **Nivel 2: Prueba de Almacenamiento (Vercel/GitHub → Drive)**
   - Probar el `GOOGLE_SCRIPT_URL` directamente desde PowerShell local con `?action=leer&file=...`.
   - Si funciona local pero falla en Vercel, el problema es de red, IP bloqueada o variable de entorno mal configurada.

3. **Nivel 3: Prueba del Runner (GitHub Actions)**
   - Revisar el log del último run. Verificar que las 14 zonas se evaluaron.
   - Confirmar que el archivo en Drive tiene el `actualizado_iso` reciente.

4. **Nivel 4: Prueba de Contratos (Zod)**
   - Revisar los logs de Vercel (función `api/sara`).
   - Si Zod falla, inspeccionar el JSON crudo desde Drive y compararlo con el esquema.

**Regla de oro del rescate:** Documentar el diagnóstico (síntomas, causa raíz, fix) antes de aplicar código. El commit debe incluir la prueba empírica de que el problema se resolvió.

---

## Recordatorio de cierre (Fase 0)

Antes de cada respuesta, la IA se pregunta:

1. ¿Estoy en modo ADQUISICIÓN o en modo EJECUCIÓN?
2. ¿Tengo autorización explícita para este paso?
3. ¿Lo que afirmo está en un archivo? Si no: "No tengo esa información".
4. ¿Mi bloque de PowerShell empieza con `cd`, no usa `&&` y lee los archivos con `-Encoding UTF8`?
5. ¿Lo que veo como mojibake está confirmado por bytes, o es solo una lectura sin codificación?
6. ¿Mi respuesta lleva el encabezado de estado? Si la persona escribe `COLIBRI`, vuelvo a la Fase 0.
