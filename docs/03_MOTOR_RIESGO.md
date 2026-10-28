# SatRC V2.0 — Motor de evaluación de riesgo

> **Versión del documento:** 2.6 (27/10/2026)  
> **Fuente de verdad:** el código. Este documento describe el comportamiento actual y señala donde las especificaciones de diseño no coinciden con él.  
> **Alcance:** motor hidrológico (Etapa 3), evaluadores de viento, térmico y convectivo, adaptador hidrológico y orquestador (Etapa 4), y el consenso de modelos que los alimenta.  
> **Cambios de esta versión:** cierra H-MOTOR-07 (lectura de viento corregida), cierra H-CONV-03 (CAPE mínimo para Downburst), cierra H-TERM-01 (commit `343f80d`) y cierra H-VIENTO-01 como documental. Actualiza el conteo de pruebas a 167/17 (verificado 27/10/2026).

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

> **Regla de diseño:** el motor hidrológico (`riskEvaluator.js`) no se modifica. Los demás evaluadores se agregan alrededor de él.

---

## 2. Motor hidrológico (Etapa 3)

- **Archivo canónico (interfaz):** `src/engine/riskEvaluator.js`  
- **Gemelo (runner):** `scripts/engine/riskEvaluatorRunner.mjs`  
- **Función principal:** `evaluarLocalidad(localidad, serieHoraria, contexto)`

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

### 2.4 Aviso del SMN
El piso de lluvia del aviso solo se aplica a localidades de los estados afectados (Hidalgo, Puebla o Veracruz, según el aviso). Así un aviso para Veracruz no eleva el riesgo en Hidalgo. Esta regla corrige H-MOTOR-06 (Etapa 3).

**Fuente del aviso:** scraping del recuadro de alerta activa del SMN (ver `api/smn.js`). Es una fuente frágil: ver H-SMN-WS y DEU-29 en `06_PENDIENTES.md`.

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

> **Deuda:** unificar ambas versiones (H-MOTOR-01). Ver `06_PENDIENTES.md`.

---

## 4. Consenso de modelos

- **Archivos:** `src/engine/meteoFetcher.js` (descarga) y `src/engine/consensusEngine.js` (consenso).

### 4.1 Variables pedidas
`meteoFetcher.js` pide 15 variables horarias para tres modelos: GFS, ICON y GEM.

- **Hidrológicas (7):** `precipitation`, `temperature_2m`, `relative_humidity_2m`, `wind_speed_10m`, `wind_gusts_10m`, `visibility`, `weather_code`.
- **Etapa 4 (8):** `surface_pressure`, `apparent_temperature`, `cloud_cover`, `wet_bulb_temperature_2m`, `cape`, `freezing_level_height`, `relative_humidity_700hPa`, `wind_speed_700hPa`.

### 4.2 Estrategia por variable

| Estrategia | Variables |
|---|---|
| Mediana de los tres modelos | Variables de superficie e hidrológicas |
| Máximo de los tres modelos | `cape`, `wind_speed_700hPa` |
| GFS preferente | `freezing_level_height` (GEM devuelve nulo) |

### 4.3 Nombres de variable en la respuesta
Cuando se piden varios modelos, Open-Meteo agrega un sufijo con el nombre del modelo (`_gfs_seamless`, `_icon_seamless`, `_gem_seamless`). Si no se considera, el pipeline falla en silencio. El consenso expone los valores sin sufijo.

Este hallazgo se verificó con scripts de PowerShell (H-E4-01). Ver `04_HISTORIAL.md`.

### 4.4 Pruebas con datos reales
El fixture `src/engine/__tests__/fixtures/openmeteo_sample.json` contiene 240 horas de datos reales de Pachuca (con las 8 variables de Etapa 4 para los tres modelos). Siete pruebas lo usan.

---

## 5. Evaluador de viento (Etapa 4)

- **Archivo:** `src/engine/windEvaluator.js`

### 5.1 Principio
Las ráfagas se normalizan a una velocidad equivalente al nivel del mar, para que una misma ráfaga no dé el mismo riesgo a 2 500 msnm que a nivel del mar:

```text
ρ = P_superficie / (287.05 × T_kelvin)          densidad del aire local
v_eq = ráfaga × √(ρ / 1.225)                     velocidad equivalente
```

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

**Suavizado y rugosidad:** la especificación original (11) incluía un suavizado de 3 horas sobre la serie y un factor de rugosidad por relieve. El código no los implementa. Se cierra H-VIENTO-01 como documental: el código es la referencia (DEC-010), la especificación se corrige.

### 5.4 Vector y diagnóstico
- **Vector:** `VIENTO`.
- **Diagnóstico:** Título y causa en español, que incluye la ráfaga real y la velocidad equivalente.
- **Discrepancia de nombre:** la especificación original usa `VIENTO_FUERTE` como vector. El código usa `VIENTO`.

---

## 6. Evaluador térmico (Etapa 4)

- **Archivo:** `src/engine/thermalEvaluator.js`  
- **Entrada:** sensación térmica, temperatura, nubosidad, viento, bulbo húmedo, lluvia y altura de la isoterma de 0 °C.

### 6.1 Reglas discretas
Se evalúa la ventana de 24 horas. El nivel final es el máximo entre el riesgo por frío y el riesgo por calor.

**Frío:**

| Condición | Nivel | Título |
|---|---|---|
| Sensación térmica mínima < −5 °C | 3 | Alerta por Frío Extremo |
| Sensación térmica mínima < 0 °C | 2 | Vigilancia por Frío |
| Temperatura de superficie estimada < 0 °C | 3 | Alerta por Helada Agrícola |
| Lluvia > 0 y bulbo húmedo mínimo < 1 °C y altura de la isoterma a menos de 500 m sobre la localidad | 3 | Alerta por Nevada |

*Temperatura de superficie:* se estima restando 3.5 °C a la temperatura del aire cuando la nubosidad promedio es menor a 20 % y el viento promedio es menor a 10 km/h. Es el efecto de enfriamiento radiativo sobre el suelo. Si no se cumplen esas dos condiciones, la superficie se toma igual que el aire.

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

*Fórmula anterior (pre-fix, eliminada):* `1.0 + (nivelFrio - 1) * pesoFrio`. Producía valores fuera del rango del nivel discreto. Ejemplo: nevada N3 daba 2.64, que el orquestador leía como N2.

**Re-auditoría de invierno pendiente:** en la verificación del 24/10/2026, las 405 localidades tenían `niveles_por_vector.termico = 1.0` (no hay frío en octubre). El impacto del fix en el semáforo se medirá en la primera corrida de invierno que dispare el térmico. Ver `06_PENDIENTES.md` §2.9.

### 6.3 Vector
Valores posibles: `FRIO_EXTREMO`, `HELADA_AGRICOLA`, `NEVADA`, `CALOR_EXTREMO`, o `TERMICO_NORMAL` cuando no hay riesgo.

> **Discrepancia de nombre:** la especificación original usa `FRIO` y `CALOR` como tipo de amenaza. El código usa los nombres descritos anteriormente.

---

## 7. Evaluador convectivo (Etapa 4)

- **Archivo:** `src/engine/convectiveEvaluator.js`  
- **Entrada:** CAPE, altura de la isoterma de 0 °C, humedad en 700 hPa, viento en 700 hPa, lluvia y altitud de la localidad.

### 7.1 Variables calculadas

| Variable | Cálculo | Significado |
|---|---|---|
| CAPE máximo | Máximo de la ventana de 24 horas | Energía disponible para tormentas |
| Espesor de fusión | Altura de la isoterma de 0 °C − altitud de la localidad | Capa cálida por donde cae el granizo |
| Potencial de desplome | CAPE máximo × (100 − humedad mínima en 700 hPa) / 100 | Potencial de downburst cuando el aire medio es seco |
| Cizalladura | Diferencia máxima de viento entre niveles | Organización de la tormenta |

> **Discrepancia detectada (H-CONV-02, 24/10/2026):** el cálculo de la cizalladura usa `(vientos700[i] || 0) - (vientos10m[i] || 0)`, una diferencia escalar de velocidades sin dirección. Dos vientos de 40 km/h en direcciones opuestas dan `diff = 0`, pero la cizalladura vectorial real es máxima. Puede producir falsos negativos de downburst/supercélula en eventos con cambio de dirección. Corregir requiere agregar `wind_direction_10m` y `wind_direction_700hPa` al fetcher y al consenso. Ver `06_PENDIENTES.md` §2.2.

### 7.2 Reglas

| Regla | Condición | Nivel | Vector |
|---|---|---|---|
| Granizo | CAPE > 1 000 y espesor de fusión < 1 000 m y lluvia > 5 mm; con CAPE > 1 500 | 3 | GRANIZO |
| Downburst | CAPE > 1000 y potencial de desplome > 100 y cizalladura > 15 km/h | 3 | `DOWNBURST` |
| Supercélula | Potencial de desplome > 150 y cizalladura > 25 km/h y CAPE > 2 500 | 4 | SUPERCELULA |
| Tormentas dispersas | Ninguna de las anteriores y CAPE > 800 | 2 | CONVECTIVO |
| Estable | Ninguna de las anteriores | 1 | SIN_AMENAZA |

### 7.3 Nivel continuo
Se pondera con una sigmoide de la inestabilidad (centro 1 500 J/kg, pendiente 0.002):

- **Nivel 1:** `continuo = 1 + 0.99 × peso`
- **Nivel 2:** `continuo = 2 + 0.5 × peso`
- **Nivel 3:** `continuo = 3 + 0.9 × peso`
- **Nivel 4:** `continuo = 4`

Estos rangos respetan el contrato `[nivel, nivel + 0.99]`.

> **Discrepancia de unidades:** la especificación original (13) define los umbrales de potencial de desplome en 50 000, 100 000 y 150 000. El código usa 100 y 150, porque su fórmula produce valores de ese orden. La especificación tiene un error de unidades. Corregirla y verificar con pruebas.

---

## 8. Hidrológico adaptador (Etapa 4)

- **Archivo:** `src/engine/hydroAdapter.js`  
- **Función:** `evaluarHidrologico(localidad, serieHoraria, contexto)`

Envuelve al motor hidrológico sin modificarlo. Agrega un nivel continuo, para que el orquestador pueda comparar los cuatro vectores en la misma escala.

Usa una sigmoide centrada en 62 mm de saturación, con pendiente 0.5:

| Nivel discreto del motor | Condición | Continuo |
|---|---|---|
| 3 | Pendiente ≥ 25° y saturación > 30 mm | 3 + 0.99 × proximidad |
| 2 | Saturación > 20 mm | 2 + 0.99 × proximidad |
| 4 | — | 4 |
| Otros | — | Sin cambio |

> **Discrepancia:** la especificación original (16) describía solo el caso N3, con escala 0.9 y un factor basado en la pendiente. El código aplica la sigmoide también al N2 y usa escala 0.99. Lo que vale es el código.
> 
> *Ejemplo de la especificación con error aritmético:* la especificación afirma que una proximidad de 0.81 da 3.8. Con la fórmula de la especificación, el resultado es 3.73.

El campo `diagnostico` original se conserva sin cambios.

---

## 9. Orquestador (Etapa 4)

- **Archivo:** `src/engine/crossThreatOrchestrator.js`  
- **Función:** `evaluarMultiamenaza(localidad, serieHoraria, contexto)`

### 9.1 Fórmula

```text
R = max(r_hidro, r_viento, r_térmico, r_convectivo)
    + Σ γ_ij × (r_i − 1) × (r_j − 1)      para los pares con γ definido
R = min(R, 4.0)
```

Los pares son los que aparecen en la tabla de coeficientes de la sección 9.2. El término `(r − 1)` excluye la línea base de N1, que no aporta energía destructiva.

### 9.2 Coeficientes γ (código)

| Par | γ |
|---|---|
| Hidrológico – Viento | 0.20 |
| Hidrológico – Térmico | 0.15 |
| Convectivo – Viento | 0.30 |
| Térmico – Hidrológico | 0.10 |
| Viento – Térmico | 0.05 |

> **Discrepancia:** la especificación original (14) usaba 0.15, 0.10, 0.25 y 0.05 para los mismos pares, y no incluía los dos últimos. El ADR-005 cita esa especificación como fuente. Corregir el ADR.

### 9.3 Mapeo a nivel global

```text
R ≥ 4.0 → N4
R ≥ 3.0 → N3
R ≥ 2.0 → N2
R < 2.0 → N1
```

> **Discrepancia:** la especificación original usaba `Math.round`. El código usa los umbrales de arriba, que son distintos: por ejemplo, `R = 1.6` da N1 en el código y N2 con `Math.round`.

### 9.4 Salida

| Campo | Contenido |
|---|---|
| `nivel_alerta_global` | Entero de 1 a 4 |
| `riesgo_continuo` | Valor R |
| `vector_dominante` | Vector con el nivel continuo más alto, o `SIN_AMENAZA` si el global es N1 |
| `tipo_amenaza` | Subtipo estructurado (`NEVADA`, `GRANIZO`, `DOWNBURST`, `SUPER_CELULA`, etc.). Usado por los prompts de SARA (H-PROMPT-02). |
| `niveles_por_vector` | Nivel continuo de cada vector |
| `datos_disponibles_por_vector` | Booleanos por vector (H-MULTI-02). |
| `diagnostico` | Título y causa. Si el nivel global supera al del vector dominante, el título describe el acoplamiento entre los dos vectores principales |
| `acciones_operativas` | Lista de acciones según el vector y el nivel |

**Regla de Etapa 5:** cuando el nivel global es N1, el vector dominante se marca `SIN_AMENAZA`. Sin esta regla aparecían falsos positivos de vientos y convección en localidades tranquilas.

> **Nota (H-ORQ-08, 24/10/2026):** `determinarVectorDominante()` usa `prioridad.indexOf(a)` sobre el array que se está mutando durante el `sort`. Funciona por casualidad en V8 moderno, pero es un anti-patrón frágil. Ver `06_PENDIENTES.md` §2.5.

---

## 10. Interacción con el semáforo

El paquete publicado por el runner contiene, por localidad, `nivel_alerta` (igual a `nivel_alerta_global`, por compatibilidad) y los campos del orquestador. Ver `02_ARQUITECTURA.md` §8.

---

## 11. Pruebas

La suite se ejecuta con `npm test`. **Resultado verificado el 27/10/2026:** 17 archivos y 167 pruebas, todas en verde. El conteo cambia con el tiempo; actualizar esta cifra con cada cierre de hito. Las pruebas del motor están en `src/engine/__tests__/` y `scripts/engine/__tests__/`.

Cada campo nuevo que se publica debe tener una prueba que verifique su valor y su rango (lección H-TEST-05 en `04_HISTORIAL.md`). Los tests 9 a 14 de `thermalEvaluator.test.js` son el ejemplo del cumplimiento de esta regla en el cierre de H-TERM-01.

---

## 12. Discrepancias y deuda del motor

| ID | Descripción | Estado |
|---|---|---|
| **H-CONV-01** | Unidades erróneas en la especificación convectiva (§7.3) | Documental |
| **H-CONV-02** | Cizalladura escalar en lugar de vectorial (§7.1) | Abierta; requiere expandir el contrato del consenso |
| **H-ORQ-07** | Coeficientes γ y mapeo del orquestador distintos de la especificación (§9.2, §9.3) | Documental; el código es la referencia |
| **H-ORQ-08** | `determinarVectorDominante` con `indexOf` en `sort` (§9.4) | Abierta, cosmética |
| **H-MOTOR-01** | Gemelo del runner distinto del canónico (§3) | Abierta, V3.0 |
| **H-MOTOR-05** | Sobreclasificación de N2 en zonas húmedas (XIC, HUA, ZAC) | Abierta, V3.0 |
| **H-MOTOR-03** | El reporte diario exige 216 h; el runner usa 192 h | Abierta |

**Cerrados en esta versión (27/10/2026):**
- **H-CONV-03:** Falso positivo de Downburst con CAPE bajo (§7.2). Se exigió CAPE > 1000.
- **H-MOTOR-07:** Regla 1 del Altiplano leía el campo de viento equivocado (§2.1).
- **H-TERM-01:** Nivel continuo térmico fuera del contrato (commit `343f80d`).
- **H-VIENTO-01:** Suavizado no implementado en el código (documental).

Los detalles de cada ítem están en `06_PENDIENTES.md`.