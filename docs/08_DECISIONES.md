# SatRC V2.0 — Registro de decisiones

> **Versión del documento:** 2.7 (29/10/2026)
> **Propósito:** explicar por qué el sistema está diseñado como está. Cada decisión tiene contexto, decisión, consecuencias y estado.
> **Regla:** una decisión nueva se agrega al final con el siguiente número. Una decisión se reemplaza con otra nueva; no se edita la original para cambiar su sentido.
> **Cambios de esta versión:**
> - **Notas correctivas** en ADR-002, ADR-005, ADR-009 y DEC-011 a partir de la auditoría empírica P0–P12 del 29/10/2026. Las notas se agregan al final de cada ADR/DEC, **sin editar el texto original**, conforme a la regla del documento.
> - **Nuevas decisiones pendientes** en la Parte C: **PEND-06** (criterio operativo para N2 por niebla), **PEND-07** (`on.schedule` interno redundante), **PEND-08** (resolución del acoplamiento duplicado de N-MOTOR-09).
> - **Confirmación empírica de ADR-003** (bitácora íntegra 23/23 eslabones).
> - **Reformulación parcial de DEC-011**: se confirma que la sobreestimación del 56 % (227/405 en N2) es precisamente lo que DEC-011 busca eliminar. No se edita el texto original; se agrega nota.
> - **La sesión 29/10/2026 no cambió arquitectura ni proveedores de servicios.** Fue una auditoría de diagnóstico. Ningún ADR nuevo se agrega en esta versión; solo notas correctivas y decisiones pendientes.

---

## Parte A. Decisiones de arquitectura

### ADR-001: Catorce nodos regionales de referencia

- **Estado:** vigente. Confirmado empíricamente el 29/10/2026 (P10): todas las localidades de una misma zona comparten el valor de su nodo. Comportamiento esperado y correcto.
- **Contexto:** en la primera versión, las 405 localidades se evaluaban con el pronóstico de un solo nodo (Huauchinango). Eso produjo falsas alarmas en el Altiplano por lluvias que solo caían en la Sierra.
- **Decisión:** dividir el territorio en 14 zonas de resguardo. Cada zona usa su localidad más poblada como nodo.
- **Evidencia:** auditoría del motor de octubre de 2026, con simulación de nodos y el caso de Pachuca (anexo D de la auditoría archivada en `docs/archivo/`). Eliminó el 86 % de las falsas emergencias N4 de la simulación.
- **Consecuencias:** cada zona depende de un solo nodo. Si el nodo no tiene datos, la zona completa queda sin evaluar, por eso existe el reintento por lotes (ver `02_ARQUITECTURA.md`).

### ADR-002: Consenso determinista de modelos (GFS, ICON y GEM)

- **Estado:** vigente, con **excepción confirmada empíricamente** para la visibilidad (ver nota correctiva).
- **Decisión:** calcular la mediana hora por hora entre los tres modelos, con filtro de ceros espurios en la lluvia. En Etapa 4 se agregaron ocho variables con estrategias propias: mediana para las de superficie, máximo para CAPE y viento en 700 hPa, y GFS preferente para la altura de congelación (GEM la devuelve nula).
- **Consecuencias:** el resultado es reproducible para las mismas entradas. El proceso autónomo ya utiliza el consenso compartido (H-MULTI-01 cerrado el 22/10/2026).

> **Nota correctiva del 29/10/2026 (auditoría P11):**
>
> **La visibilidad no puede ser consensuada.** Open-Meteo devuelve `visibility_gfs_seamless` con 240 valores válidos, pero `visibility_icon_seamless` y `visibility_gem_seamless` devuelven 240 `null` para el nodo de Xicotepec. Solo GFS provee el dato.
>
> **Implicación:** la variable que dispara el 95.6 % de las alertas N2 del sistema (217 de 227 en la corrida del 28/10/2026 19:03 MX) depende de **un único modelo**, sin redundancia ni contraste. Esto contradice el principio declarado en ADR-002.
>
> **No es un bug del código**: el código hace lo que puede con los datos disponibles. Es un **límite del proveedor Open-Meteo** que no estaba documentado en este ADR.
>
> **Acción registrada:** `06_PENDIENTES.md` §2.2 **N-MOTOR-11** (🟠 alta). Bajo DEC-011, se debe considerar:
> - (a) Pedir solo GFS explícitamente para visibilidad y documentarlo como excepción de consenso.
> - (b) Buscar un proveedor alternativo de visibilidad (NOAA, METAR de aeropuertos, cámaras).
> - (c) Reformular la Regla 6 para no depender de una única variable en un único modelo.
>
> La decisión queda pendiente bajo PEND-06.

### ADR-003: Bitácora con encadenamiento criptográfico

- **Estado:** vigente. **Confirmado empíricamente el 29/10/2026 (P6): 23/23 eslabones íntegros en producción tras 2 días de operación continua con mezcla de orígenes (`PROGRAMADO_CRON` + `ON_DEMAND_OPERADOR`).**
- **Decisión:** cada registro incluye el hash del registro anterior y su propio hash SHA-256. El primer registro encadena con un bloque génesis de ceros.
- **Consecuencias:** cualquier alteración de un registro anterior se detecta, porque cambia todos los hashes posteriores. La cadena **no impide** la alteración; solo la hace visible. La bitácora ahora se almacena en Google Drive (vía Apps Script), un servicio externo. La integridad depende de que quien revisa recalcule la cadena.
- **Verificación empírica del 29/10/2026:**
  - 23 entradas encadenadas correctamente.
  - `SARA_LOG_20` (`ON_DEMAND_OPERADOR`, 28/10 17:24:58) encadena con `SARA_LOG_19` (`PROGRAMADO_CRON`, 28/10 15:37:28) y con `SARA_LOG_21` (`PROGRAMADO_CRON`, 28/10 17:35:03).
  - **La mezcla de orígenes no rompió la cadena.** El fix H-BITACORA-01 (24/10/2026) funciona.
  - **H-BITACORA-02 (concurrencia) no se ha manifestado** en producción en 2 días.

### ADR-004: Módulos compartidos (DRY)

- **Estado:** vigente, con dos excepciones pendientes.
- **Decisión:** la lógica común entre frontend y backend vive en `src/lib/compartido/`, con una sola fuente.
- **Excepción:** la constante de tamaño de lote aparece en **cuatro** archivos (DEU-22 reformulada el 29/10/2026; antes se decía tres) y el parser del SMN está duplicado (DEU-29). Ambas son deuda abierta.
- **Además (agregado el 29/10/2026):** `construirResumenAtmosferico` está duplicada con **contratos divergentes** entre `SatRCOperativo.jsx` y `reportesRegionales.js` (N-OPS-02). Viola ADR-004 con el agravante de que los nombres de campo no coinciden entre ambas implementaciones.

### ADR-005: Orquestador multiamenaza con acoplamiento no lineal

- **Estado:** vigente, **con ADR de reemplazo pendiente por N-MOTOR-09** (ver nota correctiva).
- **Contexto:** un criterio de máximo (`Math.max` entre vectores) subestima las combinaciones. Dos amenazas moderadas simultáneas (por ejemplo, suelo saturado y viento) producen un efecto mayor que cada una por separado.
- **Decisión:** el riesgo global es el máximo de los cuatro vectores más un término de acoplamiento por pares, con la forma `γ · (r_i − 1) · (r_j − 1)`.
- **Coeficientes vigentes:** los definidos en el código (`crossThreatOrchestrator.js`): hidrológico–viento 0.20, hidrológico–térmico 0.15, convectivo–viento 0.30, térmico–hidrológico 0.10 y viento–térmico 0.05.
- **Consecuencias:** los coeficientes son una decisión de diseño sin validación empírica todavía. **Bajo el principio de precisión (DEC-011), el acoplamiento aditivo es una fuente potencial de sobreestimación** que debe validarse contra eventos reales. Revisarlos cuando exista un registro de eventos reales (PEND-03).

> **Nota correctiva del 29/10/2026 (auditoría P2):**
>
> **El código aplica dos coeficientes sobre el mismo par físico simétrico.** `crossThreatOrchestrator.js` ejecuta:
> ```
> acoplamiento += calcularAcoplamiento(rH, rT, GAMMAS.HIDRO_TERMICO);   // 0.15
> acoplamiento += calcularAcoplamiento(rT, rH, GAMMAS.TERMICO_HIDRO);   // 0.10
> ```
> Como `(r1-1)*(r2-1)` es simétrico, ambas llamadas calculan el mismo producto. **El acoplamiento hidro-térmico efectivo es `0.15 + 0.10 = 0.25`, no 0.15 ni 0.10.**
>
> **Verificación empírica P2:** escenario `rH=2.97, rT=2.88, rV=rC=1.0` → `riesgo_continuo = 3.90`. La fórmula de §9.1 de `03_MOTOR_RIESGO.md` (un solo par) predice `3.5255`. La fórmula del código predice `3.8959`. **El código coincide consigo mismo, no con la fórmula documentada.** La sobreestimación medida es `+0.37` en ese caso y `+0.9` en escenarios altos.
>
> **Naturaleza del hallazgo: diseño ambiguo, no bug.** Este ADR lista ambos γ sin aclarar si es uno o dos términos. El código es consistente con lo que dice el ADR; es el ADR el que es contradictorio con DEC-011.
>
> **Acción registrada:**
> - `06_PENDIENTES.md` §2.2 **N-MOTOR-09** (🟠 alta).
> - **PEND-08** en la Parte C de este documento: decisión pendiente sobre cómo resolver la duplicación.
> - Este ADR queda marcado como "vigente con ADR de reemplazo pendiente". No se edita el texto original por trazabilidad histórica.

### ADR-006: Adaptador de forma en el proceso autónomo

- **Estado:** vigente.
- **Contexto:** el orquestador entrega `nivel_alerta_global`, pero el esquema de validación y la interfaz esperan `nivel_alerta`.
- **Decisión:** el proceso autónomo copia el valor global en `nivel_alerta` y conserva los campos nuevos como opcionales. Si el orquestador falla para una localidad, se usa el motor hidrológico anterior para esa localidad.
- **Consecuencias:** un fallo del orquestador en una localidad no detiene la publicación, pero **no queda registrado** como degradación.
- **Nota del 29/10/2026:** el fallback documentado aquí aplica solo al **runner**. El fallback del **frontend** (Sala Operativa) usa solo el motor hidrológico, sin orquestador (H-MULTI-06 confirmado en código). Son dos mecanismos distintos con la misma filosofía ("no bloquear la operación") pero consecuencias operativas diferentes.

### ADR-007: Umbral de viento según altitud

- **Estado:** vigente.
- **Contexto:** en la auditoría H6.4, 47 localidades de Pachuca aparecían en N2 sin justificación. El viento basal de la sierra es más fuerte que el de los valles.
- **Decisión:** por encima de 2 200 msnm, los umbrales de viento suben 5 km/h. El cálculo también normaliza la ráfaga a densidad de nivel del mar.
- **Consecuencias:** coexisten dos mecanismos (densidad y altitud). Bajo DEC-011, la coexistencia debe revisarse si produce falsos positivos en zonas de altura.

### ADR-008: Nivel continuo con topes por nivel discreto

- **Estado:** vigente.
- **Contexto:** los evaluadores emiten un valor continuo que el orquestador compara entre vectores. Un valor continuo fuera del rango de su nivel discreto produjo falsos positivos (H-ORQ-02 y H-ORQ-03).
- **Decisión:** cada evaluador devuelve un valor continuo dentro de `[nivel, nivel + 0.99]`, y el mapeo a nivel global usa umbrales de 2.0, 3.0 y 4.0.
- **Consecuencias:** esta regla se ha verificado en todos los evaluadores, incluido el térmico (H-TERM-01 cerrado el 24/10/2026).

### ADR-009: Migración del almacenamiento a Google Drive

- **Estado:** vigente (27/10/2026). **Confirmado empíricamente el 29/10/2026 (P4): la lectura y escritura de Drive funcionan correctamente.**
- **Contexto:** Vercel Blob en el plan Hobby suspendió la tienda de datos por superar el límite de "Advanced Operations" (2,000/mes). Esto provocó errores 500 (FUNCTION_INVOCATION_FAILED) en la API y bloqueó el sistema en producción.
- **Decisión:** migrar todo el almacenamiento (estado diocesano, bitácora y reporte vigente) a Google Drive, utilizando Google Apps Script como puente (API Web). Se creó el adaptador `src/lib/compartido/googleDrive.js`.
- **Consecuencias:**
  - La aplicación ya no depende de Vercel Blob, eliminando el límite de operaciones y el riesgo de suspensión.
  - El almacenamiento es 100 % gratuito y persistente.
  - Se agregó una nueva variable de entorno crítica: `GOOGLE_SCRIPT_URL`.
  - El runner (`ejecutar_sara_autonomo.mjs`) fue migrado a Drive.
  - **Sin embargo, `scripts/reportes/reporteDiario.mjs` sigue usando `@vercel/blob` (H-REPORTE-02, ver `06_PENDIENTES.md`).** Como `BLOB_READ_WRITE_TOKEN` no está configurado en `sara_cron.yml`, el reporte diario falla silenciosamente al intentar escribir, aunque la corrida quede en verde. **Confirmado empíricamente el 29/10/2026 (P5): en 23 horas de bitácora, 22 corridas CRON y 0 reportes diarios entregados.**
  - **El adaptador `escribirJSONBlob` devuelve `null` en caso de fallo sin propagar el error.** El runner no verifica el valor devuelto, por lo que imprime "✅ Publicación exitosa" aunque Drive no haya recibido los datos (H-DRIVE-01).

> **Nota correctiva del 29/10/2026 (auditoría P4 + P7):**
>
> **H-DRIVE-01 es un riesgo latente, no un bug activo.** La verificación P4 confirma que la lectura y escritura de Drive **funcionaron correctamente hoy**: `estado_ligero.json` y `estado_diocesano.json` tienen `actualizado_iso: 2026-10-29T01:03:45.451Z` (28/10 19:03 MX), coherente con la última corrida CRON (`SARA_LOG_23`). El `return null` silencioso sigue en el código pero **no se ha manifestado**.
>
> **El problema real de esta arquitectura es otro: doble disparador del runner.** La auditoría P7 confirma que el sistema tiene **dos disparadores activos**:
> 1. `on.schedule: '21 */3 * * *'` interno del `sara_cron.yml`. Corre con jitter masivo (~3.4 corridas/día en lugar de 8). Timestamps irregulares: 20:45, 23:56, 03:10, 06:35, 07:19, 11:00, 14:58, 17:21, 22:56.
> 2. Planificador externo `cron-job.org` que dispara `/api/disparar-workflow`. **Estable, ~8.6 corridas/día con timestamps exactos (03:00, 06:00, 09:00, 12:00, 15:00, 18:00, 21:00).**
>
> **El total es ~11-12 corridas/día en vez de 8.** El `on.schedule` interno **no está documentado como activo** en `00_METODOLOGIA.md` Fase 4 ni en `07_GUIA_OPERACION.md` §1.2.
>
> **Impacto bajo DEC-011:** más corridas = más estados publicados = más falsos positivos potenciales. El doble disparador agrava H-MOTOR-05.
>
> **Acción registrada:**
> - `06_PENDIENTES.md` §2.4 **N-CRON-05** y **N-CRON-06** (🟠 alta).
> - **PEND-07** en la Parte C de este documento: decisión pendiente sobre si el `on.schedule` interno se mantiene como respaldo documentado o se elimina.

---

## Parte B. Decisiones de alcance y proceso

### DEC-001: Presupuesto cero

- **Estado:** vigente.
- **Decisión:** el sistema opera solo con servicios gratuitos o de dominio público. No hay servidores de pago, licencias comerciales ni suscripciones.
- **Consecuencias:** dependencia de los límites de planes gratuitos (DEU-19). La migración a Google Drive (ADR-009) es una consecuencia directa de esta decisión. **N-CRON-05 y N-OPS-01 (36 requests/hora por operador) acentúan esta dependencia.** El doble disparador del runner consume el doble de minutos de GitHub Actions y el doble de cuota de Apps Script.

### DEC-002: Preferencia por el falso positivo

- **Estado:** reemplazada por DEC-011 (28/10/2026).
- **Decisión (histórica):** ante la duda, el sistema alerta. Una alerta innecesaria tiene un costo bajo; una alerta omitida puede costar una vida.
- **Consecuencias (históricas):** el semáforo puede sobreestimar. Las decisiones de calibración (H-MOTOR-05) debían mantener este criterio.
- **Nota de reemplazo:** el criterio se sustituye por DEC-011. El texto original se conserva por trazabilidad histórica; el principio vigente es la precisión sobre la cobertura.

### DEC-003: Subordinación a las autoridades

- **Estado:** vigente.
- **Decisión:** el sistema traduce avisos oficiales y recomienda acciones; no emite avisos ni ordena evacuaciones. Las determinaciones de Protección Civil y de CONAGUA prevalecen.
- **Consecuencias:** el texto de los reportes y el aviso de disclaimer deben mantener este deslinde.

### DEC-004: Verificación en producción, no solo en local

- **Estado:** vigente.
- **Decisión:** la verificación funcional se hace en GitHub Actions y Vercel, porque el entorno local no tiene almacenamiento ni acceso al modelo de redacción.
- **Consecuencias:** cada cambio que afecte al proceso autónomo se valida con una corrida manual y con verificación del timestamp real del archivo en Google Drive (ver `00_METODOLOGIA.md` Fase 4).
- **Nota del 29/10/2026:** la sesión de auditoría P0–P12 cumple esta decisión: todas las verificaciones fueron empíricas contra el entorno real (Drive, GitHub Actions, Zod, Open-Meteo). **Ninguna de las 13 pruebas fue "en local aislado".** Todas cruzadas con datos de producción.

### DEC-005: Un commit por causa y pruebas antes de publicar

- **Estado:** vigente.
- **Decisión:** cada commit atiende una sola causa, y `npm test` debe pasar antes del push. Los hitos grandes se dividen en commits atómicos.
- **Consecuencias:** historial más largo, pero reversible por partes.
- **Nota del 29/10/2026:** el commit `3053e29` (H-DRIVE-02, Zod acepta `[]`) **violó esta decisión** al no actualizar los 2 tests obsoletos en el mismo commit. Dejó el baseline en "165 pass + 2 rojos" en lugar de "167 verdes". Lección registrada como **H-TEST-16** en `04_HISTORIAL.md` §8.

### DEC-006: Verificar la API antes de codificar contra ella

- **Estado:** vigente.
- **Decisión:** antes de usar una variable o un endpoint externo, se comprueba con una llamada real. Esta regla nació del hallazgo de H-E4-01 y se reforzó durante la migración a Google Drive.
- **Consecuencias:** cada nueva integración externa incluye una verificación empírica documentada.
- **Nota del 29/10/2026:** la auditoría P11 confirma el valor de esta decisión. **Se descubrió que ICON y GEM no proveen visibilidad** solo porque se hizo una llamada real a Open-Meteo. El código hubiera seguido "funcionando" con solo GFS sin que nadie supiera que las otras dos variables vienen en `null`.

### DEC-007: Etapa 3 es deuda técnica, no Versión 3.0

- **Estado:** vigente.
- **Decisión:** la Etapa 3 se dedicó a cerrar deuda, pruebas y documentación, sin funciones nuevas. Las funciones nuevas (autenticación real, nuevos vectores, percentiles históricos) quedan para la Versión 3.0.
- **Consecuencias:** los identificadores de etapa deben escribirse con su prefijo para evitar confusión (`E3-H5` frente a `E5-H5.0`).

### DEC-008: Repositorio público mientras se ejecute con cuentas gratuitas

- **Estado:** vigente, con condiciones.
- **Decisión (22/10/2026):** el repositorio permanece público. Motivos: el presupuesto es cero, y las corridas automáticas y el despliegue funcionan igual con repositorio privado. El plan gratuito de GitHub cubre 2 000 minutos al mes para repositorios privados.
- **Condiciones actualizadas (27/10/2026):**
  1. Las claves expuestas en el código ya fueron rotadas y movidas a variables de entorno (R-01, R-02, R-04 cerrados).
  2. Confirmar que las corridas de `sara_cron.yml` se mantienen dentro del límite mensual.
- **Revisión:** cuando cambie cualquiera de las condiciones.
- **Nota del 29/10/2026 (P7):** la condición (b) requiere atención. La auditoría de GitHub Actions confirma **60 corridas en 5 días = ~12/día** por el doble disparador (N-CRON-05). A 2 min/corrida, son ~1,440 min/mes, dentro del límite de 2,000 min del plan gratuito. **El margen es pequeño.** Si el doble disparador no se corrige (PEND-07), el margen se reduce al ~10 %.

### DEC-009: Documentación en español, con numeración fija

- **Estado:** vigente.
- **Decisión:** la documentación se mantiene en español. La numeración de `00` a `09` se conserva; `08` es el registro de decisiones.
- **Consecuencias:** los documentos archivados quedan en `docs/archivo/` y no se citan como vigentes.

### DEC-010: Documentación para quien retoma el proyecto con ayuda de IA

- **Estado:** vigente.
- **Decisión:** existe un punto de entrada (`LEEME_PRIMERO.md`) que resume el estado y define el orden de lectura. Cada documento declara su fuente de verdad (el código).
- **Consecuencias:** cuando un documento y el código no coinciden, prevalece el código, y la diferencia se registra en `06_PENDIENTES.md`.
- **Nota del 29/10/2026:** la auditoría P0–P12 confirma el valor de esta decisión. **Se detectaron discrepancias documentales en `07_GUIA_OPERACION.md` §5 (cifras de baseline), `LEEME_PRIMERO.md` §2 (cifras de baseline) y `04_HISTORIAL.md` §6.1 (H-VIENTO-01).** Las discrepancias se registran en `06_PENDIENTES.md` §2.9 (H-DOC-BASELINE-01, H-DOC-BASELINE-02, H-DOC-HVIENTO-01) para corrección al cierre del próximo hito.

### DEC-011: Precisión sobre cobertura

- **Estado:** vigente (28/10/2026). Reemplaza a DEC-002.
- **Contexto:** en versiones anteriores se emitían alertas de Nivel 3 cuando en las localidades no estaba ocurriendo ningún evento meteorológico relevante. La política anterior ("preferencia por el falso positivo") priorizaba la cobertura sobre la precisión. El resultado fue ruido: las comunidades aprendieron a desconfiar de las alertas porque muchas no se materializaban. Un sistema que alerta en exceso pierde eficacia real cuando el evento grave sí ocurre ("efecto del niño que gritó lobo").
- **Decisión:** el principio rector del sistema es la precisión sobre la cobertura. **Una alerta debe corresponder a un evento real.** Ante la duda, el sistema prioriza la verificación empírica antes que la emisión preventiva. La confiabilidad de la PWA se mide por cuántas alertas emitidas se materializan, no por cuántas alertas se emiten.
- **Consecuencias:**
  1. **Calibración de umbrales.** Los umbrales del motor deben revisarse para eliminar falsos positivos conocidos: H-MOTOR-05 (sobreclasificación N2 en XIC, HUA, ZAC) y H-DIAG-04 (motor no calibrado para esas zonas) pasan de 🟡 media a 🔴 crítica.
  2. **Acoplamiento del orquestador (ADR-005).** Los coeficientes γ del orquestador son aditivos y por lo tanto sobreestiman. Bajo DEC-011, deben validarse contra eventos reales antes de considerarse cerrados (PEND-03 se vuelve prioritario).
  3. **Trade-off aceptado.** Se acepta un aumento controlado de falsos negativos como costo de reducir falsos positivos. Este trade-off se evalúa empíricamente, no por intuición.
  4. **Verificación empírica.** Todo cambio en el motor debe acompañarse de un caso de prueba que demuestre que la alerta emitida corresponde a un evento real (documentado en `00_METODOLOGIA.md` Fase 3 y en `03_MOTOR_RIESGO.md`).
  5. **Métrica de confiabilidad.** Se propone medir, en cada corrida, la proporción de localidades N3/N4 que efectivamente registraron un evento meteorológico en las 24 horas siguientes. Esta métrica se vuelve parte del monitoreo operativo.

> **Nota del 29/10/2026 (auditoría P9–P12):**
>
> **La sobreestimación bajo DEC-011 está confirmada empíricamente y cuantificada.**
>
> **Datos de producción del 28/10/2026 19:03 MX:**
> - **N2 = 227 / 405 (56 %)**. N3 = 0. N4 = 0.
> - De las 227 N2: **217 son "Vigilancia por Niebla Densa"**, 8 "Acoplamiento viento + convección", 2 "Vigilancia por Ráfagas Moderadas".
> - Las 217 N2 de niebla tienen: `lluviaEvento24hMm = 0`, `saturacionTotalSueloMm < 30 mm`, `visibilidadMinKm ≤ 0.36 km`.
> - **Precisión estimada de N2 en producción: ~4.4 %** (10 legítimas de 227).
>
> **Causa raíz identificada (P12 + P11):**
> 1. **N-MOTOR-13:** la Regla 6 usa `Math.min(ventana 24 h)` sin persistencia. Un solo valor bajo de 2 h a las 00:00–01:00 dispara N2 para todo el día. Confirmado con datos de Xicotepec: niebla 00:00 (0.2 km) y 01:00 (0.5 km), resto del día > 6 km, y el sistema sigue en N2 a las 19:00.
> 2. **N-MOTOR-11:** la visibilidad solo la provee GFS. ICON y GEM devuelven `null`. Contra ADR-002.
> 3. **N-MOTOR-14:** el motor no distingue evento pasado de futuro. La alerta de niebla pierde sentido operativo cuando el evento ocurrió hace 19 horas.
> 4. **N-MOTOR-15:** la Regla 6 usa OR sin contexto agravante, a diferencia de las reglas 2–5 que exigen combinación de condiciones.
>
> **Concentración geográfica:** CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH al 100 % de sus localidades en N2. ACT, APN, PMS, TIZ al 0 %. La frontera es Altiplano vs Sierra.
>
> **Esta es exactamente la situación que DEC-011 se propuso eliminar.** El sistema está emitiendo el "grito del lobo" que esta decisión reemplazó a DEC-002 para evitar.
>
> **Acción registrada:**
> - `06_PENDIENTES.md` §2.2: H-MOTOR-05, H-DIAG-04, N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15, N-MOTOR-05-bis.
> - **PEND-06** en la Parte C: decisión pendiente sobre el criterio operativo que debe disparar N2 por niebla. Bloquea el fix.
> - **Hipótesis refutada:** N-MOTOR-12 (umbral de 2 km es alto). Los datos de P12 muestran niebla real de 0.2 km. El problema es el criterio de agregación, no el umbral.
>
> **El texto original de DEC-011 no se edita.** Esta nota es una confirmación empírica del principio, no una enmienda.

---

## Parte C. Decisiones pendientes

| ID | Pregunta | Quién decide | Origen |
|---|---|---|---|
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? Bajo DEC-011 esta calibración es prioritaria. | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| PEND-04 | ¿Se migrará el runner a un modelo de ejecución que no dependa de GitHub Actions (por ejemplo, Vercel Cron)? | Coordinación técnica | `08_DECISIONES.md` |
| PEND-05 | ¿Cuál es la métrica objetivo de confiabilidad (porcentaje de alertas que se materializan) que cierra DEC-011? | Coordinación técnica y pastoral | `08_DECISIONES.md` |
| **PEND-06** | **¿Qué criterio operativo debe disparar N2 por niebla?** Bajo DEC-011, las opciones son: (A) **persistencia ≥ 4 h consecutivas** de visibilidad ≤ 2 km; (B) **ventana próxima de 6 h** en vez de 24 h (solo si la niebla está por llegar); (C) **niebla + otra condición agravante** (lluvia o saturación) — niebla sola no dispara N2; (D) **niebla densa ≤ 1 km con persistencia ≥ 2 h**; (E) **híbrido** de las anteriores. **Cada opción tiene implicaciones operativas distintas para las brigadas.** La opción A reduce falsos positivos pero puede perder niebla real breve. La opción C es la más estricta y la más alineada con DEC-011. La opción B es la más justa temporalmente pero requiere distinguir "evento actual" de "evento futuro". **Bloquea el fix de H-MOTOR-05 y N-MOTOR-13, que son la prioridad #1 bajo DEC-011.** | Coordinación técnica y pastoral | P12 del 29/10/2026 |
| **PEND-07** | **¿El `on.schedule` interno de `sara_cron.yml` es un respaldo deliberado o se elimina?** Actualmente hay doble disparador no documentado (N-CRON-05 + N-CRON-06): `on.schedule: '21 */3 * * *'` interno con jitter masivo (~3.4 corridas/día) + `cron-job.org` externo estable (~8.6 corridas/día). Total efectivo: ~11-12 corridas/día en vez de 8. Bajo `00_METODOLOGIA.md` Fase 4 y `07_GUIA_OPERACION.md` §1.2, la documentación solo menciona el externo. Opciones: (A) mantener ambos y documentar el interno como respaldo; (B) eliminar el `on.schedule` interno y mantener solo el externo; (C) eliminar el externo y depender del interno (implica aceptar jitter); (D) mantener ambos pero reducir el externo a 1×/día como prueba de vida. Impacto: minutos de GitHub Actions, cuota de Apps Script, ruido en bitácora, más estados publicados. **Agrava H-MOTOR-05 si no se corrige.** | Coordinación técnica | P7 del 29/10/2026 |
| **PEND-08** | **¿Cómo debe resolverse N-MOTOR-09 (acoplamiento hidro-térmico duplicado)?** ADR-005 lista `HIDRO_TERMICO: 0.15` y `TERMICO_HIDRO: 0.10` sin aclarar si es uno o dos términos. El código suma ambos sobre el mismo producto simétrico, resultando en `0.25` efectivo. Confirmado con P2: sobreestima `+0.37` en escenarios medios y `+0.9` en altos. Opciones: (A) **un solo término con `HIDRO_TERMICO=0.15`** (el más alto de los dos documentados); (B) **un solo término con `TERMICO_HIDRO=0.10`**; (C) **mantener ambos pero reinterpretar** (e.g., `HIDRO_TERMICO` para frío y `TERMICO_HIDRO` para calor, sumando condicionalmente según el signo de la temperatura); (D) **fusión a un solo coeficiente nuevo calibrado empíricamente** en el rango 0.10–0.25 con eventos reales. **Naturaleza del hallazgo: diseño ambiguo, no bug.** La opción D es la más rigurosa bajo DEC-011 pero requiere PEND-03 (registro de eventos reales) primero. La opción A es la más rápida y reduce la sobreestimación sin perder la intención original. **Requiere ADR de reemplazo de ADR-005.** | Coordinación técnica y pastoral | P2 del 29/10/2026 |

**Nota sobre el proceso de decisión:**

- **PEND-06** y **PEND-08** están acopladas: resolver la niebla (PEND-06) reduce ~95 % del ruido actual de N2; resolver el acoplamiento (PEND-08) reduce el riesgo de que otras combinaciones sobreestimen. Ambas son necesarias bajo DEC-011.
- **PEND-07** es independiente y operativa. No requiere coordinación pastoral, solo técnica.
- Las tres bloquean fixes que ya están especificados en `06_PENDIENTES.md`. No se debe iniciar código de motor ni de cron hasta que las tres se resuelvan.

---

## Parte D. Notas de proceso del 29/10/2026

**La sesión del 29/10/2026 fue de auditoría y diagnóstico. No cambió arquitectura, no alteró proveedores de servicios, no introdujo patrones nuevos.** En consecuencia:

- **No se agrega ningún ADR nuevo en esta versión.** Un ADR se agrega cuando se toma una decisión de arquitectura; esta sesión no tomó ninguna. Se limitó a verificar empíricamente el estado del sistema.
- **No se cierra ningún ADR existente.** Todos los ADR vigentes siguen vigentes. Las notas correctivas son eso: notas, no reemplazos.
- **No se modifica DEC-011.** Se confirma empíricamente. La confirmación se registra como nota, no como enmienda.
- **Se agregan tres decisiones pendientes** (PEND-06, PEND-07, PEND-08) que sí requieren coordinación. Son las que bloquean los fixes derivados de la auditoría.

**Regla que se sigue aplicando:** *"Una decisión se reemplaza con otra nueva; no se edita la original para cambiar su sentido."* Por eso los ADR-002, ADR-005 y ADR-009 conservan su texto original íntegro y llevan notas correctivas al final. Cuando se tome PEND-08, se agregará ADR-010 (o el número que corresponda) como reemplazo de ADR-005, y ADR-005 quedará marcado como "reemplazada por ADR-XXX" en su encabezado.

---

*Fin del documento.*