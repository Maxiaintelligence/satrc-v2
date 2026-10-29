# SatRC V2.0 — Motor de evaluación de riesgo

> **Versión del documento:** 2.9 (29/10/2026)
> **Fuente de verdad:** el código. Este documento describe el comportamiento actual y señala donde las especificaciones de diseño no coinciden con él.
> **Alcance:** motor hidrológico (Etapa 3), evaluadores de viento, térmico y convectivo, adaptador hidrológico y orquestador (Etapa 4), y el consenso de modelos que los alimenta.
> **Cambios de esta versión:**
> - **Sesión de Cierre del 29/10/2026:** Se actualizan las secciones del motor para reflejar los fixes aplicados en producción.
> - **§5.1 y §5.2:** Se actualiza el diagnóstico de viento para mostrar la ráfaga real y equivalente (N-MOTOR-36).
> - **§7.1 y §7.2:** Se documenta la defensa contra `null` en humedad y nivel de congelación (N-MOTOR-06 + bis).
> - **§9.2:** Se elimina el coeficiente `TERMICO_HIDRO` (ADR-011 aplicado).
> - **§11:** Baseline actualizado a 179 pass + 0 rojos.
> - **§12:** Tabla de deudas actualizada (varios ítems cerrados).
> - **Nota correctiva en §5.1:** H-VIENTO-01 se cerró erróneamente en 28/10/2026 diciendo que el código no implementa factor de rugosidad. **El código sí lo implementa** (`windEvaluator.js` líneas 43-45). Solo el suavizado de 3 h está ausente. Ver `04_HISTORIAL.md` §7.15.
> - **Nota correctiva en §2.1 (Regla 6):** la Regla 6 dispara N2 por niebla usando `Math.min(ventana 24h)` sin persistencia. Confirmado empíricamente el 29/10/2026 (P9–P12): **217 de 227 N2 en producción** corresponden a "Vigilancia por Niebla Densa" con `lluvia=0` y `saturación<30 mm`. Bajo DEC-011, esto es el problema #1 del motor.
> - **Nota correctiva en §4.2:** la visibilidad **no puede ser consensuada** porque ICON y GEM devuelven `null`. Solo GFS provee el dato. Confirmado por P11.
> - **Nota correctiva en §7.2:** los subtipos convectivos del código (`CONVECTIVO_NORMAL`, `TORMENTA_DISPERSA`, `SUPERCELULA`) no coinciden con los nombres de §9.4 (`SIN_AMENAZA`, `CONVECTIVO`, `SUPER_CELULA`). Desalineación de contrato.
> - **Nota correctiva en §9.2:** el acoplamiento hidro-térmico se cuenta **dos veces** (`0.15 + 0.10` sobre el mismo producto simétrico). Confirmado por P2. Requiere ADR de reemplazo (PEND-08).
> - **Nota correctiva en §11:** el baseline real es **165 pass + 2 rojos obsoletos** en 17 archivos (no 167 verdes). Los 2 rojos son `estadoDiocesanoSchema.test.js` y `regresionFase1.test.js`, obsoletos por el commit `3053e29` que relajó el `.min(1)` sin actualizar tests.
> - **Tabla §12 ampliada** con las deudas nuevas detectadas en la auditoría: N-MOTOR-01, N-MOTOR-05, N-MOTOR-08-bis, N-MOTOR-09, N-MOTOR-11, N-MOTOR-13, N-MOTOR-14, N-MOTOR-15, N-MOTOR-24, N-MOTOR-28, N-MOTOR-29, N-MOTOR-30, N-MOTOR-36.
> - **N-MOTOR-12 refutada:** la hipótesis de que "el umbral de 2 km es alto" quedó refutada por P12 (niebla real de 0.2 km, no cercana al umbral).
> - **H-MOTOR-05 y H-DIAG-04** reformuladas con causa raíz en `06_PENDIENTES.md` §2.2.

---

## 1. Visión general

Cada localidad pasa por cuatro evaluadores especializados. Cada uno devuelve un nivel discreto de 1 a 4 y un nivel continuo en un rango asociado. Un orquestador combina los cuatro niveles continuos y produce el nivel global que se publica en el semáforo.

```text
Series horarias por zona (consenso de GFS, ICON y GEM)
                 │
   ┌─────────────┼──────────────┬───────────────┐
   ▼             ▼              ▼               ▼
Hidrológico   Viento        Térmico        Convectivo
(+ adaptador)  (windEvaluator) (thermalEvaluator) (convectiveEvaluator)
   │             │              │               │
   └─────────────┴──────┬───────┴───────────────┘
                        ▼
         crossThreatOrchestrator (acoplamiento)
                        ▼
      nivel_alerta_global, riesgo_continuo,
      niveles_por_vector, acciones_operativas
```

**Regla de diseño:** el motor hidrológico (`riskEvaluator.js`) no se modifica. Los demás evaluadores se agregan alrededor de él.

> **Nota del 29/10/2026 (auditoría P9–P12):**
>
> Estado real del motor en producción: la corrida del 28/10/2026 a las 19:03 MX publicó **N2=227, N3=0, N4=0** sobre 405 localidades. De esas 227 N2:
>
> - **217 (95.6 %)** son "Vigilancia por Niebla Densa" disparadas por la Regla 6 del motor hidrológico.
> - Tienen `lluviaEvento24hMm = 0`, `saturacionTotalSueloMm < 30 mm` y `visibilidadMinKm ≤ 0.36 km`.
> - Concentración geográfica: CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH al **100 %** de sus localidades. ACT, APN, PMS, TIZ al **0 %**.
> - Precisión estimada de N2: **~4.4 %** (10 legítimas de 227).
>
> Bajo DEC-011, este es el problema #1 del motor. La causa raíz está desagregada en `06_PENDIENTES.md` §2.2: N-MOTOR-13 (`min(24h)` sin persistencia), N-MOTOR-11 (visibilidad solo GFS), N-MOTOR-14 (no distingue evento pasado de futuro), N-MOTOR-15 (OR sin contexto agravante). Bloqueado por **PEND-06** en `08_DECISIONES.md` (decisión sobre criterio operativo).

---

## 2. Motor hidrológico (Etapa 3)

**Archivo canónico (interfaz):** `src/engine/riskEvaluator.js`
**Gemelo (runner):** `scripts/engine/riskEvaluatorRunner.mjs`
**Función principal:** `evaluarLocalidad(localidad, serieHoraria, contexto)`

### 2.1 Reglas

Las reglas se aplican en orden. Cada una puede subir el nivel, nunca bajarlo.

| # | Regla | Condición | Resultado |
|---|---|---|---|
| 1 | Protección del Altiplano | Zona Altiplano, terreno plano (pendiente < 15°), lluvia < 20 mm, temperatura > 2 °C, viento < 40 km/h | N1 |
| 2 | Deslave crítico | Sierra, pendiente ≥ 45° y saturación ≥ 65 mm | N4 |
| 3 | Deslave moderado | Sierra, pendiente ≥ 25° y < 45°, y saturación ≥ 65 mm | N3 |
| 4 | Inundación fluvial | Distancia al cauce ≤ 0.8 km, TWI ≥ 12 y lluvia efectiva ≥ 35 mm | N4 si lluvia ≥ 65 mm o población aguas arriba ≥ 50 000; si no, N3 |
| 5 | Corte vial | Acceso por terracería o brecha, y (lluvia ≥ 20 mm o saturación ≥ 50 mm) | N3 |
| 6 | Vigilancia | Lluvia ≥ 8 mm, o saturación ≥ 30 mm, o visibilidad ≤ 2 km (niebla) | N2 |

> **Nota (H-MOTOR-07 cerrado el 27/10/2026, commit `d248fdb`):** la Regla 1 leía erróneamente `h.wind_speed_10m` en lugar de `h.viento_kmh`, por lo que la protección del Altiplano nunca detectaba vientos altos. El código ahora está alineado con la serie del consenso.

> **Nota correctiva del 29/10/2026 (auditoría P9–P12):**
>
> La Regla 6 es la causa raíz del 95.6 % de las alertas N2 actuales, y su comportamiento no corresponde a un evento real bajo DEC-011.
>
> **Mecánica exacta:** `riskEvaluator.js` línea 155 usa:
>
> ```text
> if (nivelAlerta === 1 && (lluviaEfectiva24h >= 8.0 || saturacionTotalSuelo >= 30.0 || visibilidadMinKm <= 2.0))
> ```
>
> Y `visibilidadMinKm` se calcula como `Math.min(...ventana 24h)` en `riskEvaluator.js` (sin persistencia, sin contexto, sin distinguir pasado/futuro).
>
> **Verificación empírica en Xicotepec (P12, 29/10/2026):**
>
> - Hoy la niebla ocurrió solo a las 00:00 (0.2 km) y 01:00 (0.5 km).
> - A las 02:00 saltó a 24.1 km. El resto del día: > 6 km.
> - El motor sigue emitiendo "Vigilancia por Niebla Densa" a las 19:00.
> - **Un solo valor bajo de 2 horas dispara N2 para toda la ventana de 24 h.**
>
> **Causas raíz desagregadas en `06_PENDIENTES.md` §2.2:**
>
> - **N-MOTOR-13:** `min(24h)` sin persistencia. Es la causa raíz principal.
> - **N-MOTOR-11:** la visibilidad solo la provee GFS (ICON y GEM devuelven `null`). Sin redundancia.
> - **N-MOTOR-14:** el motor no distingue evento pasado de futuro. Niebla de 00:00 dispara alerta a las 19:00.
> - **N-MOTOR-15:** la Regla 6 usa OR sin contexto agravante, a diferencia de las reglas 2–5 que exigen combinación de condiciones.
>
> **Hipótesis refutada (N-MOTOR-12):** la sospecha de que "el umbral de 2 km es alto para zonas húmedas" quedó refutada por P12. Con datos reales, la niebla llega a 0.2 km. Bajar el umbral a 1 km no resolvería el problema porque `min(24h) = 0.2` seguiría disparando N2. **El problema es el criterio de agregación, no el umbral.**
>
> **Fix bloqueado por PEND-06** en `08_DECISIONES.md`: decisión de coordinación técnica + pastoral sobre qué criterio operativo debe disparar N2 por niebla.
>
> **Nota adicional sobre el Altiplano:** la Regla 1 funciona correctamente. Las 5 zonas de Altiplano (ACT, APN, PMS, TIZ) están al **0 % N2** en producción hoy. La sobreclasificación es específica de las zonas de montaña.
>
> **Fix aplicado el 29/10/2026 (DEC-012):** la Regla 6 ya no incluye `visibilidadMinKm <= 2.0`. Los disparadores son solo `lluvia >= 8 mm || saturación >= 30 mm`. La niebla se expone como `contexto.niebla` con período (MADRUGADA/MAÑANA/TARDE/NOCHE/MIXTO). Ver commit `6fd6120` y `03_MOTOR_RIESGO.md` §5.

### 2.2 Prioridad y diagnóstico

El nivel final es el máximo de las reglas que se disparan (`Math.max`).

La regla 4 cambia el diagnóstico cuando su severidad es igual o mayor que el nivel acumulado. Por eso, si la regla 2 y la regla 4 dan N4, el diagnóstico que se muestra es el de inundación fluvial.

### 2.3 Saturación del suelo

La saturación combina la lluvia antecedente y la lluvia de las próximas 24 horas:

```text
saturación = API_7_días_previos + lluvia_efectiva_24h
```

- **API de 7 días:** suma ponderada de la lluvia de los días previos, con peso decreciente (`Math.pow(0.85, 8 - d)`).
- **Lluvia efectiva:** la lluvia pronosticada. Si hay aviso del SMN que aplica al estado de la localidad, se usa el máximo entre la lluvia pronosticada y el piso del aviso.

> **Nota del 29/10/2026 (auditoría cruzada):**
>
> - El campo `impactoSistemico.umbralFisicoDeslaveMm` **miente en auditoría.** `calcularUmbralDeslave` calcula un umbral dinámico (`65 - pendiente*0.85 - factorRelieve`, con piso 12) que **nunca se usa en las reglas**. Las Reglas 2 y 3 usan `65.0` fijo. El campo solo se guarda para el diagnóstico, pero no interviene en la decisión. Registrado como N-MOTOR-24 en `06_PENDIENTES.md` §2.11.
> - **El piso del aviso SMN es una fuente de sobreestimación no catalogada bajo DEC-011.** La fórmula `Math.max(lluviaEfectiva, pisoSMN)` en `riskEvaluator.js` línea 71 puede inflar `lluviaEfectiva24h` a 25 mm aunque Open-Meteo solo dé 1 mm si hay aviso activo del SMN. Registrado como N-MOTOR-28 en `06_PENDIENTES.md` §2.11.
> - **Regla 4 no pondera por `tc_horas`.** El umbral binario `poblacionAguasArriba >= 50000` no considera el tiempo de concentración de la cuenca. Sobrestima cuencas lentas (Zacatlán, tc=24) y subestima cuencas rápidas (Chahuatlán, tc=4.75). Registrado como N-MOTOR-08-bis en `06_PENDIENTES.md` §2.11.

### 2.4 Aviso del SMN

El piso de lluvia del aviso solo se aplica a localidades de los estados afectados (Hidalgo, Puebla o Veracruz, según el aviso). Así un aviso para Veracruz no eleva el riesgo en Hidalgo. Esta regla corrige H-MOTOR-06 (Etapa 3).

Fuente del aviso: scraping del recuadro de alerta activa del SMN (ver `api/smn.js`). Es una fuente frágil: ver H-SMN-WS y DEU-29 en `06_PENDIENTES.md`.

---

## 3. Gemelo del runner (H4)

El runner no importa el motor de la interfaz. Usa una copia (`riskEvaluatorRunner.mjs`) para poder ejecutarse en GitHub Actions. Ambas versiones deben producir el mismo resultado para las mismas entradas; la paridad se verifica en tres pruebas.

**Divergencias documentadas y aceptadas hasta V3.0:**

| Aspecto | Interfaz | Runner |
|---|---|---|
| Saturación con serie corta (< 168 h) | Devuelve 15.0 mm | Devuelve 0 |
| Evento actual con serie corta (< 192 h) | Toma las primeras 24 h | Devuelve lista vacía |
| Umbral de deslave dinámico | Se calcula | No se calcula |
| Regla 4 (inundación) | Gradúa N3 o N4 según la población aguas arriba | Siempre asigna N4 |
| Tiempos del evento | Calcula inicio, pico y cresta | Valores fijos ("En curso", "Periodo activo") |
| Forma de salida | `diagnostico.tipoAmenaza`, `geografia.posicionHidro` | `vector_dominante`, `sin_datos_regionales` |
| Flag de zona sin datos | No existe | `zonaSinDatos` explícito |

Las divergencias están documentadas en el comentario de cabecera de `riskEvaluatorRunner.mjs`. La paridad se valida en `riskEvaluatorRunner.test.js` (3 pruebas).

**Deuda:** unificar ambas versiones (H-MOTOR-01). Ver `06_PENDIENTES.md`.

---

## 4. Consenso de modelos

**Archivos:** `src/engine/meteoFetcher.js` (descarga) y `src/engine/consensusEngine.js` (consenso).

### 4.1 Variables pedidas

`meteoFetcher.js` pide 15 variables horarias para tres modelos: GFS, ICON y GEM.

- **Hidrológicas (7):** `precipitation`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `wind_gusts_10m`, `visibility`, `weather_code`.
- **Etapa 4 (8):** `surface_pressure`, `apparent_temperature`, `cloud_cover`, `wet_bulb_temperature_2m`, `cape`, `freezing_level_height`, `relative_humidity_700hPa`, `wind_speed_700hPa`.

### 4.2 Estrategia por variable

| Estrategia | Variables |
|---|---|
| Mediana de los tres modelos | Variables de superficie e hidrológicas |
| Máximo de los tres modelos | `cape`, `wind_speed_700hPa` |
| GFS preferente | `freezing_level_height` (GEM devuelve nulo). Se expone como `nivel_congelacion_m` en el consenso. |

> **Nota correctiva del 29/10/2026 (auditoría P11):**
>
> **La visibilidad no se consensúa porque ICON y GEM no la proveen.** Consulta directa a Open-Meteo para Xicotepec (29/10/2026):
>
> - `visibility_gfs_seamless`: **240 valores válidos** (min=60 m, max=24,140 m, prom=18,338 m).
> - `visibility_icon_seamless`: **240 null**.
> - `visibility_gem_seamless`: **240 null**.
> - `visibility` (sin sufijo): no existe en la respuesta.
>
> **Implicación:** la variable que dispara el 95.6 % de las alertas N2 del sistema depende de un único modelo, sin redundancia ni contraste. Contra ADR-002 (consenso determinista).
>
> Registrado como N-MOTOR-11 en `06_PENDIENTES.md` §2.2. Bajo DEC-011, se debe considerar:
>
> - **(a)** Pedir solo GFS explícitamente para visibilidad y documentarlo como excepción de consenso.
> - **(b)** Buscar un proveedor alternativo de visibilidad (NOAA, METAR de aeropuertos, cámaras).
> - **(c)** Reformular la Regla 6 para no depender de una única variable en un único modelo.
>
> La decisión queda pendiente bajo PEND-06.
>
> **Además:** las ráfagas se consensúan con `Math.max(r_gfs, r_icon, r_gem)` en `consensusEngine.js` línea 91. Esta estrategia **no está autorizada por este documento** (que solo permite máximo para `cape` y `wind_speed_700hPa`). Sobrestima sistemáticamente el vector viento. Registrado como N-MOTOR-01 en `06_PENDIENTES.md` §2.11.

### 4.3 Nombres de variable en la respuesta

Cuando se piden varios modelos, Open-Meteo agrega un sufijo con el nombre del modelo (`_gfs_seamless`, `_icon_seamless`, `_gem_seamless`). Si no se considera, el pipeline falla en silencio. El consenso expone los valores sin sufijo.

Este hallazgo se verificó con scripts de PowerShell (H-E4-01). Ver `04_HISTORIAL.md`.

### 4.4 Pruebas con datos reales

El fixture `src/engine/__tests__/fixtures/openmeteo_sample.json` contiene 240 horas de datos reales de Pachuca (con las 8 variables de Etapa 4 para los tres modelos). Siete pruebas lo usan.

---

## 5. Evaluador de viento (Etapa 4)

**Archivo:** `src/engine/windEvaluator.js`

### 5.1 Principio

Las ráfagas se normalizan a una velocidad equivalente al nivel del mar, para que una misma ráfaga no dé el mismo riesgo a 2 500 msnm que a nivel del mar:

```text
ρ = P_superficie / (287.05 × T_kelvin)          densidad del aire local
v_eq = ráfaga × √(ρ / 1.225)                     velocidad equivalente
```

> **Nota correctiva del 29/10/2026 (auditoría P0, verificación de H-VIENTO-01):**
>
> **El código SÍ implementa factor de rugosidad.** La versión anterior de este documento (v2.6 y v2.7) afirmaba que el factor de rugosidad no estaba implementado. Esa afirmación es falsa. Verificación directa de `windEvaluator.js` líneas 43-45:
>
> ```javascript
> // 3. Factor de Rugosidad (Topografía)
> // En laderas/cumbres el daño es mayor por exposición
> let factorRugosidad = 1.0;
> if (relieve === 'LADERA' || relieve === 'CANADA') factorRugosidad = 1.1;
> else if (relieve === 'LOMA') factorRugosidad = 1.05;
>
> const vEqFinal = vEq * factorRugosidad;
> ```
>
> Solo el **suavizado de 3 h** está ausente. H-VIENTO-01 sigue cerrado como documental por el suavizado, pero la causa y consecuencia del cierre están mal redactadas en `04_HISTORIAL.md` §6.1. Corrección formal registrada como H-DOC-HVIENTO-01 en `06_PENDIENTES.md` §2.9.
>
> **Corrección adicional:** la causa del diagnóstico de viento reporta `rafagaMax.toFixed(1)` (ráfaga real) en el texto al operador, no `vEqFinal` (ráfaga normalizada). Si `vEqFinal > umbral` pero `rafagaMax < umbral` (por densidad), el texto dice "ráfagas de X km/h superan el umbral de 95" con X < 95. Incoherente. Registrado como N-MOTOR-36 en `06_PENDIENTES.md` §2.11.

### 5.2 Umbrales

El código usa umbrales que dependen de la altitud. Por encima de 2 200 msnm se suman 5 km/h a cada umbral (H6.4a), porque el viento basal de la sierra es más fuerte en esa zona.

| Nivel | Hasta 2 200 msnm | Por encima de 2 200 msnm |
|---|---|---|
| N2 (vigilancia) | v_eq ≥ 45 km/h | v_eq ≥ 50 km/h |
| N3 (alerta) | v_eq ≥ 65 km/h | v_eq ≥ 70 km/h |
| N4 (emergencia) | v_eq ≥ 90 km/h | v_eq ≥ 95 km/h |

> **Nota de diseño:** la especificación original (11) descartaba el umbral por altitud y solo usaba la densidad. El código aplica ambos. Lo que vale es el código: ambos mecanismos coexisten.

### 5.3 Nivel continuo

Dentro de cada nivel, el valor continuo se calcula por la velocidad equivalente. Se aplica un tope para que el valor continuo quede dentro del rango del nivel discreto:

| Nivel discreto | Rango del continuo |
|---|---|
| 1 | 1.00 a 1.99 |
| 2 | 2.00 a 2.99 |
| 3 | 3.00 a 3.99 |

El tope se aplicó en H6.4a después de detectar 47 localidades de Pachuca con N2 falso. Ver `04_HISTORIAL.md`.

**Suavizado y rugosidad:** la especificación original (11) incluía un suavizado de 3 horas sobre la serie y un factor de rugosidad por relieve. **El factor de rugosidad sí está implementado** (ver nota en §5.1). **El suavizado de 3 h no está implementado:** el código solo extrae el máximo de 24 h. Se cierra H-VIENTO-01 como documental solo por el suavizado.

### 5.4 Vector y diagnóstico: arquitectura de doble capa

El evaluador emite tres subtipos según el nivel discreto. Esta es la única salida de `windEvaluator.js`:

```javascript
vector_dominante: nivel === 1 ? "VIENTO_NORMAL"
                              : (nivel === 4 ? "VIENTO_DESTRUCTIVO" : "VIENTO_FUERTE")
```

| Nivel discreto | Subtipo emitido por el evaluador |
|---|---|
| 1 | `VIENTO_NORMAL` |
| 2 y 3 | `VIENTO_FUERTE` |
| 4 | `VIENTO_DESTRUCTIVO` |

El orquestador no usa estos subtipos para el campo `vector_dominante` de nivel superior, sino solo para el campo `tipo_amenaza`. Ver §9.4 para la tabla completa de construcción de `tipo_amenaza`.

**Consumidores downstream:**

- `dictamen.js` y `bitacora.js` consumen el `vector_dominante` top-level que emite el orquestador. Ambos esperan el valor `'VIENTO'` (sin sufijo) y funcionan correctamente.
- Los prompts de SARA consumen el campo `tipo_amenaza` (que propaga `VIENTO_NORMAL`, `VIENTO_FUERTE` o `VIENTO_DESTRUCTIVO`), lo cual permite redactar el subtipo específico (por ejemplo, "ráfagas destructivas" para N4).
- **Diagnóstico:** título y causa en español, que incluye la ráfaga real y la velocidad equivalente.

---

## 6. Evaluador térmico (Etapa 4)

**Archivo:** `src/engine/thermalEvaluator.js`

**Entrada:** sensación térmica, temperatura, nubosidad, viento, bulbo húmedo, lluvia y altura de la isoterma de 0 °C (expuesta como `nivel_congelacion_m`).

### 6.1 Reglas discretas

Se evalúa la ventana de 24 horas. El nivel final es el máximo entre el riesgo por frío y el riesgo por calor.

**Frío:**

| Condición | Nivel | Título |
|---|---|---|
| Sensación térmica mínima < −5 °C | 3 | Alerta por Frío Extremo |
| Sensación térmica mínima < 0 °C | 2 | Vigilancia por Frío |
| Temperatura de superficie estimada < 0 °C | 3 | Alerta por Helada Agrícola |
| Lluvia > 0 y bulbo húmedo mínimo < 1 °C y altura de la isoterma a menos de 500 m sobre la localidad | 3 | Alerta por Nevada |

**Temperatura de superficie:** se estima restando 3.5 °C a la temperatura del aire cuando la nubosidad promedio es menor a 20 % y el viento promedio es menor a 10 km/h. Es el efecto de enfriamiento radiativo sobre el suelo. Si no se cumplen esas dos condiciones, la superficie se toma igual que el aire.

**Altura de la isoterma:** viene de `serieHoraria.nivel_congelacion_m`, que el consenso produce a partir de `freezing_level_height` con GFS preferente (GEM devuelve nulo).

**Calor:**

| Condición | Nivel | Título |
|---|---|---|
| Sensación térmica máxima > 42 °C | 3 | Alerta por Calor Extremo |
| Sensación térmica máxima > 35 °C | 2 | Vigilancia por Estrés Térmico |

### 6.2 Nivel continuo

**Estado:** H-TERM-01 cerrado el 24/10/2026 (commit `343f80d`).

El nivel continuo respeta el contrato `[nivel, nivel + 0.99]` documentado en ADR-008 y §5.3. La fórmula vigente es:

```text
peso_frío = 1 − sigmoide(sensación_mínima, centro = 5 °C, pendiente = 0.3)
peso_calor = sigmoide(sensación_máxima, centro = 30 °C, pendiente = 0.3)
peso_dominante = peso_frío si gana frío, peso_calor si gana calor
nivel_continuo = nivel_final + peso_dominante × 0.99
```

**Orden de cálculo:** primero se decide el `nivel_final` discreto (después del desempate frío/calor, frío gana empates), después se calcula el `nivel_continuo` con el peso del vector dominante.

**Ejemplos verificados con tests 9 a 14 de `thermalEvaluator.test.js`:**

| Caso | Nivel | Continuo |
|---|---|---|
| Nevada (sensación 0 °C, bulbo 0.5 °C, Δh 400 m) | 3 | ≈ 3.81 |
| Frío N2 (sensación −2 °C) | 2 | ≈ 2.88 |
| Frío N3 (sensación −8 °C) | 3 | ≈ 3.97 |
| Calor N2 (sensación 38 °C) | 2 | ≈ 2.91 |
| Calor N3 (sensación 45 °C) | 3 | ≈ 3.98 |
| Frío N2 + Calor N2 simultáneos (frío gana) | 2 | ≈ 2.88 |

> **Fórmula anterior (pre-fix, eliminada):** `1.0 + (nivelFrio - 1) * pesoFrio`. Producía valores fuera del rango del nivel discreto. Ejemplo: nevada N3 daba 2.64, que el orquestador leía como N2.

**Re-auditoría de invierno pendiente:** en la verificación del 27/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Ver `06_PENDIENTES.md` §2.10.

### 6.3 Vector

Valores posibles: `FRIO_EXTREMO`, `HELADA_AGRICOLA`, `NEVADA`, `CALOR_EXTREMO`, o `TERMICO_NORMAL` cuando no hay riesgo.

> **Nota de nomenclatura:** la especificación original (12) usaba `FRIO` y `CALOR` como tipo de amenaza. El código usa los nombres descritos anteriormente. Bajo DEC-011 (precisión sobre cobertura), el subtipo específico es útil para que SARA oriente con lenguaje adecuado (nevada ≠ helada agrícola).

---

## 7. Evaluador convectivo (Etapa 4)

**Archivo:** `src/engine/convectiveEvaluator.js`

**Entrada:** CAPE, altura de la isoterma de 0 °C, humedad en 700 hPa, viento en 700 hPa, lluvia y altitud de la localidad.

### 7.1 Variables calculadas

| Variable | Cálculo | Significado |
|---|---|---|
| CAPE máximo | Máximo de la ventana de 24 horas | Energía disponible para tormentas |
| Espesor de fusión | Altura de la isoterma de 0 °C − altitud de la localidad | Capa cálida por donde cae el granizo |
| Potencial de desplome | CAPE máximo × (100 − humedad mínima en 700 hPa) / 100 | Potencial de downburst cuando el aire medio es seco |
| Cizalladura | Diferencia máxima de viento entre niveles | Organización de la tormenta |

> **Discrepancia detectada (H-CONV-02, 24/10/2026):** el cálculo de la cizalladura usa `(vientos700[i] || 0) - (vientos10m[i] || 0)`, una **diferencia escalar de velocidades sin dirección**. Dos vientos de 40 km/h en direcciones opuestas dan `diff = 0`, pero la cizalladura vectorial real es máxima. Puede producir falsos negativos de downburst/supercélula en eventos con cambio de dirección. Corregir requiere agregar `wind_direction_10m` y `wind_direction_700hPa` al fetcher y al consenso. Ver `06_PENDIENTES.md` §2.2.

> **Fix aplicado (29/10/2026, N-MOTOR-06 + bis):** Se filtraron los valores `null` en `humedad_700hpa` y `nivel_congelacion_m`. La humedad ahora usa `100` como fallback seguro (evitando falsos downbursts), y el nivel de congelación devuelve `null` si no hay datos (evitando falsos granizos). Se agregaron 3 tests en `convectiveEvaluator.test.js` para cubrir estos casos.

### 7.2 Reglas

| Regla | Condición | Nivel | Vector |
|---|---|---|---|
| Granizo | CAPE > 1 000 y espesor de fusión < 1 000 m y lluvia > 5 mm; con CAPE > 1 500 | 3 | `GRANIZO` |
| Downburst | CAPE > 1000 y potencial de desplome > 100 y cizalladura > 15 km/h | 3 | `DOWNBURST` |
| Supercélula | Potencial de desplome > 150 y cizalladura > 25 km/h y CAPE > 2 500 | 4 | `SUPERCELULA` |
| Tormentas dispersas | Ninguna de las anteriores y CAPE > 800 | 2 | `CONVECTIVO` |
| Estable | Ninguna de las anteriores | 1 | `SIN_AMENAZA` |

> **Nota correctiva del 29/10/2026 (auditoría cruzada):** los subtipos del código **no coinciden** con los de §9.4.
>
> | Subtipo del código (`convectiveEvaluator.js`) | Subtipo documentado (§9.4) |
> |---|---|
> | `CONVECTIVO_NORMAL` | `SIN_AMENAZA` |
> | `TORMENTA_DISPERSA` | `CONVECTIVO` |
> | `SUPERCELULA` (sin guion bajo) | `SUPER_CELULA` (con guion bajo) |
>
> **Implicación directa:** el orquestador propaga `resConvectivo.vector_dominante` como `tipo_amenaza`. La regla 17 de `promptsMultivector.js` solo enumera los subtipos documentados (`SIN_AMENAZA`, `CONVECTIVO`, `GRANIZO`, `DOWNBURST`, `SUPER_CELULA`). Los subtipos del código no están cubiertos por R17. SARA no tiene instrucción de lenguaje para ellos.
>
> Registrado como N-MOTOR-05 en `06_PENDIENTES.md` §2.11. Bajo DEC-011, esto es **funcional**, no solo documental. Requiere decisión: alinear el código a la documentación o la documentación al código, y actualizar R17 en el mismo commit.

> **Nota adicional sobre orden de evaluación:** el código sobreescribe subtipos en orden (granizo → downburst → supercélula → tormentas dispersas). Si coexisten condiciones, el subtipo final no refleja necesariamente la amenaza dominante. No documentado como decisión de diseño. Registrado como N-MOTOR-08 en `06_PENDIENTES.md` §2.11.

### 7.3 Nivel continuo

Se pondera con una sigmoide de la inestabilidad (centro 1 500 J/kg, pendiente 0.002):

- Nivel 1: `continuo = 1 + 0.99 × peso`
- Nivel 2: `continuo = 2 + 0.5 × peso`
- Nivel 3: `continuo = 3 + 0.9 × peso`
- Nivel 4: `continuo = 4`

Estos rangos respetan el contrato `[nivel, nivel + 0.99]`.

> **Discrepancia de unidades:** la especificación original (13) define los umbrales de potencial de desplome en 50 000, 100 000 y 150 000. El código usa 100 y 150, porque su fórmula produce valores de ese orden. **La especificación tiene un error de unidades.** Corregirla y verificar con pruebas.

---

## 8. Hidrológico adaptador (Etapa 4)

**Archivo:** `src/engine/hydroAdapter.js`

**Función:** `evaluarHidrologico(localidad, serieHoraria, contexto)`

Envuelve al motor hidrológico sin modificarlo. Agrega un nivel continuo, para que el orquestador pueda comparar los cuatro vectores en la misma escala.

Usa una sigmoide centrada en 62 mm de saturación, con pendiente 0.5:

| Nivel discreto del motor | Condición | Continuo |
|---|---|---|
| 3 | Pendiente ≥ 25° y saturación > 30 mm | `3 + 0.99 × proximidad` |
| 2 | Saturación > 20 mm | `2 + 0.99 × proximidad` |
| 4 | — | `4` |
| Otros | — | Sin cambio |

> **Discrepancia:** la especificación original (16) describía solo el caso N3, con escala 0.9 y un factor basado en la pendiente. El código aplica la sigmoide también al N2 y usa escala 0.99. **Lo que vale es el código.**
>
> **Ejemplo de la especificación con error aritmético:** la especificación afirma que una proximidad de 0.81 da 3.8. Con la fórmula de la especificación, el resultado es 3.73.

El campo `diagnostico` original se conserva sin cambios.

> **Nota adicional del 29/10/2026:** `datos_tecnicos.proximidad_umbral_n4` se calcula siempre con `sigmoide(saturacion, 62.0, 0.5)`, incluso si el nivel no es N3. El campo miente en N1/N2/N4. Cosmético pero confuso para auditoría. Registrado como N-MOTOR-16 en `06_PENDIENTES.md` §2.11.

---

## 9. Orquestador (Etapa 4)

**Archivo:** `src/engine/crossThreatOrchestrator.js`

**Función:** `evaluarMultiamenaza(localidad, serieHoraria, contexto)`

### 9.1 Fórmula

```text
R = max(r_hidro, r_viento, r_térmico, r_convectivo)
    + Σ γ_ij × (r_i − 1) × (r_j − 1)      para los pares con γ definido
R = min(R, 4.0)
```

Los pares son los que aparecen en la tabla de coeficientes de la sección 9.2. El término `(r − 1)` excluye la línea base de N1, que no aporta energía destructiva.

> **Nota bajo DEC-011:** el acoplamiento es aditivo, por lo tanto sobreestima cuando dos vectores moderados coexisten. Bajo el principio de precisión, los coeficientes γ deben validarse contra eventos reales antes de considerarse cerrados (PEND-03 en `08_DECISIONES.md`).

### 9.2 Coeficientes γ (código)

| Par | γ |
|---|---|
| Hidrológico – Viento | 0.20 |
| Hidrológico – Térmico | 0.15 |
| Convectivo – Viento | 0.30 |
| Térmico – Hidrológico | 0.10 |
| Viento – Térmico | 0.05 |

> **Discrepancia:** la especificación original (14) usaba 0.15, 0.10, 0.25 y 0.05 para los mismos pares, y no incluía los dos últimos. El ADR-005 cita esa especificación como fuente. **Corregir el ADR.**

> **Nota correctiva del 29/10/2026 (auditoría P2):**
>
> **El código aplica dos coeficientes sobre el mismo par físico simétrico.** `crossThreatOrchestrator.js` ejecuta:
>
> ```javascript
> acoplamiento += calcularAcoplamiento(rH, rT, GAMMAS.HIDRO_TERMICO);   // 0.15
> acoplamiento += calcularAcoplamiento(rT, rH, GAMMAS.TERMICO_HIDRO);   // 0.10
> ```
>
> Como `(r1-1)*(r2-1)` es simétrico, ambas llamadas calculan el mismo producto. El acoplamiento hidro-térmico efectivo es **0.15 + 0.10 = 0.25**, no 0.15 ni 0.10.
>
> **Verificación empírica P2** (escenario `rH=2.97, rT=2.88, rV=rC=1.0`):
>
> - `riesgo_continuo` real = **3.90**.
> - Predicción fórmula §9.1 (un solo par): **3.5255**.
> - Predicción código (par duplicado): **3.8959**.
> - ¿Coincide con doc? **false**. ¿Coincide con código? **true**.
>
> **Sobreestimación medida:** +0.37 en escenarios medios, +0.9 en escenarios altos. Puede empujar de N3 a N4 en casos donde doc §9.1 dejaría en N3.
>
> **Naturaleza: diseño ambiguo, no bug.** ADR-005 lista ambos γ sin aclarar si es uno o dos términos. El código es consistente con el ADR; **es el ADR el que es contradictorio con DEC-011.**
>
> Registrado como N-MOTOR-09 en `06_PENDIENTES.md` §2.2. Bloqueado por **PEND-08** en `08_DECISIONES.md`: decisión sobre cómo resolver la duplicación (un solo término, dos términos reinterpretados, o coeficiente fusionado calibrado).

### 9.3 Mapeo a nivel global

```text
R ≥ 4.0 → N4
R ≥ 3.0 → N3
R ≥ 2.0 → N2
R < 2.0 → N1
```

> **Discrepancia:** la especificación original usaba `Math.round`. El código usa los umbrales de arriba, que son distintos: por ejemplo, R = 1.6 da N1 en el código y N2 con `Math.round`.

### 9.4 Salida

| Campo | Contenido |
|---|---|
| `nivel_alerta_global` | Entero de 1 a 4 |
| `riesgo_continuo` | Valor R |
| `vector_dominante` | Vector de nivel superior con el nivel continuo más alto, o `SIN_AMENAZA` si el global es N1. Valores posibles: `HIDROLOGICO`, `VIENTO`, `TERMICO`, `CONVECTIVO`, `HIDRO_VIENTO`, `CONVECTIVO_VIENTO`, `HIDRO_TERMICO`, `SIN_AMENAZA`. |
| `tipo_amenaza` | Subtipo específico del vector dominante. Su construcción depende del vector (ver tabla abajo). Usado por los prompts de SARA (H-PROMPT-02). |
| `niveles_por_vector` | Nivel continuo de cada vector |
| `datos_disponibles_por_vector` | Booleanos por vector (H-MULTI-02). |
| `diagnostico` | Título y causa. Si el nivel global supera al del vector dominante, el título describe el acoplamiento entre los dos vectores principales |
| `acciones_operativas` | Lista de acciones según el vector y el nivel |

**Cómo se construye `tipo_amenaza`** (código: `crossThreatOrchestrator.js`):

| `vector_dominante` | Origen de `tipo_amenaza` | Valores posibles |
|---|---|---|
| `HIDROLOGICO` | `resHidro.diagnostico.tipoAmenaza` (con fallback `'HIDROLOGICO'`) | `DESLAVE_CRITICO`, `DESLAVE_MODERADO`, `INUNDACION_FLUVIAL`, `CORTE_VIAL`, `VIGILANCIA`, `PROTECCION_ALTIPLANO` |
| `VIENTO` | `resViento.vector_dominante` | `VIENTO_NORMAL`, `VIENTO_FUERTE`, `VIENTO_DESTRUCTIVO` |
| `TERMICO` | `resTermico.vector_dominante` | `TERMICO_NORMAL`, `FRIO_EXTREMO`, `HELADA_AGRICOLA`, `NEVADA`, `CALOR_EXTREMO` |
| `CONVECTIVO` | `resConvectivo.vector_dominante` | `SIN_AMENAZA`, `CONVECTIVO`, `GRANIZO`, `DOWNBURST`, `SUPER_CELULA` |
| `HIDRO_VIENTO` | Concatenación: `${tipoAmenazaHidro} + ${vectorDominanteViento}` | Por ejemplo: `DESLAVE_MODERADO + VIENTO_FUERTE` |
| `CONVECTIVO_VIENTO` | Concatenación: `${vectorDominanteConvectivo} + ${vectorDominanteViento}` | Por ejemplo: `DOWNBURST + VIENTO_FUERTE` |
| `HIDRO_TERMICO` | Concatenación: `${tipoAmenazaHidro} + ${vectorDominanteTermico}` | Por ejemplo: `INUNDACION_FLUVIAL + FRIO_EXTREMO` |
| `SIN_AMENAZA` | No se construye `tipo_amenaza` | — |

**Regla de Etapa 5:** cuando el nivel global es N1, el vector dominante se marca `SIN_AMENAZA` y `tipo_amenaza` no se calcula. Sin esta regla aparecían falsos positivos de vientos y convección en localidades tranquilas.

> **Nota (H-ORQ-08, 24/10/2026):** `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre el array que se está mutando durante el `sort`. Funciona por casualidad en V8 moderno, pero es un anti-patrón frágil. Ver `06_PENDIENTES.md` §2.5.

> **Nota correctiva del 29/10/2026 (auditoría cruzada):**
>
> - Los subtipos reales del hidrológico no coinciden con esta tabla. `riskEvaluator.js` emite:
>   - `tipoAmenaza: "ESTABLE"` en Regla 1 (aquí dice `PROTECCION_ALTIPLANO`).
>   - `tipoAmenaza: "VIGILANCIA_NORMAL"` en Regla 6 (aquí dice `VIGILANCIA`).
>   - Registrado como N-MOTOR-29 en `06_PENDIENTES.md` §2.11.
> - Los subtipos reales del convectivo no coinciden con esta tabla. Ver §7.2. Registrado como N-MOTOR-05.
>
> **La tabla de esta sección es la especificación deseada, no la implementación real.** Bajo DEC-011, la desalineación es funcional porque R17 de los prompts solo cubre los subtipos documentados aquí. Requiere alineación código ↔ docs ↔ prompts en el mismo commit.

---

## 10. Interacción con el semáforo

El paquete publicado por el runner contiene, por localidad, `nivel_alerta` (igual a `nivel_alerta_global`, por compatibilidad) y los campos del orquestador. Ver `02_ARQUITECTURA.md` §8 (Contratos de datos, Zod).

---

## 11. Pruebas

La suite se ejecuta con `npm test`. **Baseline verificado el 29/10/2026 (Cierre)** (node v22.23.3, npm 10.9.9): **179 pass + 0 rojos** en 17 archivos. Los tests obsoletos se actualizaron en el commit `f6f4281`.

**Los 2 rojos son obsoletos, no bugs del motor:**

- `estadoDiocesanoSchema.test.js` "rechaza evaluaciones vacías []": el commit `3053e29` del 28/10/2026 relajó el `.min(1)` del schema para aceptar `[]` en días tranquilos (H-DRIVE-02). Los tests que validaban el comportamiento anterior no se actualizaron.
- `regresionFase1.test.js` Test 5 "rechaza payload sin evaluaciones": mismo motivo.

Las cifras "167 pruebas en verde" que aparecían en la versión anterior de este documento eran incorrectas. Corrección registrada como H-DOC-BASELINE-01 en `06_PENDIENTES.md` §2.9.

Las pruebas del motor están en `src/engine/__tests__/` y `scripts/engine/__tests__/`. Cada campo nuevo que se publica debe tener una prueba que verifique su valor y su rango (lección H-TEST-05 en `04_HISTORIAL.md`). Los tests 9 a 14 de `thermalEvaluator.test.js` son el ejemplo del cumplimiento de esta regla en el cierre de H-TERM-01.

**Contratos específicos cubiertos por pruebas:**

- `thermalEvaluator.test.js`: 14 pruebas, incluidos los tests 9-14 que verifican el contrato `[nivel, nivel + 0.99]`.
- `windEvaluator.test.js`: 11 pruebas, valida el contrato del evaluador de viento. En particular, `expect(res.vector_dominante).toBe('VIENTO_DESTRUCTIVO')` verifica que el subtipo emitido en N4 es el correcto.
- `riskEvaluatorRunner.test.js`: 3 pruebas de paridad entre canónico y gemelo.
- `consensusEngine.test.js` (16 pruebas) y `regresionMultifactor.test.js` (13 pruebas): validan la presencia de `nivel_congelacion_m` y la estrategia GFS preferente.
- `estadoDiocesanoSchema.test.js`: 11 pruebas, cobertura parcial de los campos del orquestador. Ver H-TEST-11 sobre `datos_disponibles_por_vector`.

> **Nota del 29/10/2026:** el test "Downburst N4" en `crossThreatOrchestrator.test.js` se llama así pero **el downburst no se dispara** (`shearMax = 20-10 = 10 < 15`). El N4 viene por acoplamiento convectivo-viento con `rC = 2.47, rV = 3.70`. El test valida el número pero no valida el subtipo `DOWNBURST`. Cobertura semántica insuficiente. Registrado como N-TEST-07 en `06_PENDIENTES.md` §2.5.

> **Nota adicional:** `thermalEvaluator.test.js`, `crossThreatOrchestrator.test.js`, `consensusEngine.test.js` y `windEvaluator.test.js` usan `require('fs')` y `require('path')` en archivos ESM con `"type": "module"`. Vitest 5 provee polyfill, pero es frágil si se corre con `node --test` o `vitest --no-isolate`. Registrado como N-TEST-01 en `06_PENDIENTES.md` §2.5.

---

## 12. Discrepancias y deuda del motor


| ID | Descripción | Estado | Severidad bajo DEC-011 |
|---|---|---|---|
| H-CONV-01 | Unidades erróneas en la especificación convectiva (§7.3) | Documental | 🟢 |
| H-CONV-02 | Cizalladura escalar en lugar de vectorial (§7.1) | Abierta; requiere expandir el contrato del consenso | 🟡 |
| H-ORQ-07 | Coeficientes γ y mapeo del orquestador distintos de la especificación (§9.2, §9.3) | Documental; el código es la referencia | 🟢 |
| H-ORQ-08 | `determinarVectorDominante` con `indexOf` en `sort` (§9.4) | Abierta, cosmética | 🟢 |
| H-MOTOR-01 | Gemelo del runner distinto del canónico (§3) | Abierta, V3.0 | 🟡 |
| **N-MOTOR-09** | **Acoplamiento hidro-térmico contado dos veces.** | **CERRADA (ADR-011, commit `95bb853`)** | ✅ |
| **N-MOTOR-06** | **`Math.min(...humedades)` con null.** | **CERRADA (commit `426cc7e`)** | ✅ |
| **N-MOTOR-36** | **Diagnóstico de viento usaba ráfaga real.** | **CERRADA (commit `b343165`)** | ✅ |
| **N-FETCH-01** | **Alineación midnight sin test.** | **CERRADA (commit `c41fd0c`)** | ✅ |
| N-MOTOR-01 | Ráfagas se consensúan con `Math.max` | Abierta, confirmada por código | 🟠 |
| N-MOTOR-05 | Subtipos convectivos desalineados con §9.4 | Abierta, confirmada por código | 🟠 |
| N-MOTOR-05-bis | SPP y HYC sobre-clasificadas | Abierta, confirmada por P9 | 🔴 |
| N-MOTOR-08-bis | Regla 4 no pondera por `tc_horas` | Abierta, confirmada por datos | 🟠 |
| N-MOTOR-11 | La visibilidad no se consensúa (solo GFS) | Abierta, confirmada por P11 | 🟠 |
| N-MOTOR-13 | Regla 6 usa `min(24h)` sin persistencia | Abierta, confirmada por P12 | 🔴 |
| N-MOTOR-14 | El motor no distingue evento pasado de futuro | Abierta, confirmada por P12 | 🟠 |
| N-MOTOR-15 | Regla 6 usa OR sin contexto agravante | Abierta, confirmada por P12 | 🟠 |
| N-MOTOR-16 | `proximidad_umbral_n4` se calcula siempre | Abierta, confirmada por código | 🟢 |
| N-MOTOR-24 | `calcularUmbralDeslave` nunca se usa | Abierta, confirmada por código | 🟠 |
| N-MOTOR-28 | Piso del aviso SMN sobreestima | Abierta, confirmada por código | 🟠 |
| N-MOTOR-29 | Subtipos hidrológicos desalineados | Abierta, confirmada por código | 🟠 |
| N-MOTOR-30 | `umbralFisicoDeslaveMm` miente | Abierta, confirmada por código | 🟡 |
| H-MOTOR-03 | Reporte diario exige 216 h; runner usa 192 h | Abierta | 🟢 |
| H-VIENTO-02 | Inconsistencia de contrato entre evaluadores | Abierta, V3.0 | 🟢 |
| H-DOC-HVIENTO-01 | Corrección documental de H-VIENTO-01 | Corregido en esta versión | 🟢 |

---

*Fin del documento.*