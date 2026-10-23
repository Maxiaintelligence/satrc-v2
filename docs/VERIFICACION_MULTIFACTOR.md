# Verificación del motor multifactor y de SARA

> **Fecha:** 22/10/2026
> **Pregunta:** ¿el runner evalúa realmente cuatro vectores de riesgo, y SARA redacta con esa información?
> **Método:** lectura del código del repositorio `satrc-v2`, contrastada con la bitácora publicada (captura del 22/10/2026, registros SARA_LOG_238 y SARA_LOG_239). No se modificó código.
> **Confirmación en HEAD:** `890ba6e` (rama `main`, árbol limpio). En ese HEAD, `scripts/ejecutar_sara_autonomo.mjs` tiene la función local `generarConsensoDeterminista` en la línea 58, la URL de Open-Meteo con las ocho variables de Etapa 4 en la línea 134, la llamada `generarConsensoDeterminista(data.hourly)` en la línea 147 y `evaluarMultiamenaza` en la línea 507. No aparece `cape_jkg` en el runner.
> **Verificación sin red:** el consenso del runner produce 9 campos; el consenso compartido produce 17, incluidos los 8 de Etapa 4 (probado con datos sintéticos).
> **Confirmado con datos reales (PMN):** ver §2.1. **Pendiente:** confirmación de H-MULTI-02 en zonas con actividad, mediante `diagnostico_externo/prueba_orquestador_produccion.mjs` (ver `diagnostico_externo/LEEME.md`).
> **Alcance:** runner (`scripts/ejecutar_sara_autonomo.mjs`), orquestador y evaluadores, consenso, interfaz operativa y prompts de reporte.

---

## 1. Respuesta corta

- **La cadena multifactor está conectada en el runner.** Las 405 localidades pasan por `evaluarMultiamenaza`, y el fallback al motor hidrológico solo se activa si el orquestador lanza un error.
- **Pero tres de los cuatro vectores operan casi siempre con valores por defecto.** El consenso del runner no produce las variables que necesitan el evaluador térmico y el convectivo. El orquestador rellena esos campos con constantes, así que esos evaluadores no pueden disparar en producción.
- **La bitácora no permite distinguir "no hay riesgo" de "no hay datos".** Las tres columnas en cero (`viento:0`, `termico:0`, `conv:0`) son compatibles con ambas situaciones.
- **SARA está diseñada para ser multifactor, pero en la práctica recibe casi solo información hidrológica.** Las reglas multivectoriales existen y están inyectadas, pero llegan a un conjunto de datos que, con el consenso actual del runner, es casi siempre hidrológico.
- **La documentación afirma lo contrario en varios puntos.** Las correcciones están en §6.

---

## 2. Evidencia

### 2.1 El consenso del runner no produce las variables de Etapa 4

**`scripts/ejecutar_sara_autonomo.mjs`, líneas 58–131 (`generarConsensoDeterminista`).** La serie que se construye contiene solo estos campos:

`fecha_hora`, `lluvia_mm`, `temperatura_c`, `viento_kmh`, `rafagas_kmh`, `humedad_relativa_pct`, `visibility_km`, `confiabilidad`, `detalle_modelos`.

No aparecen: `presion_hpa`, `sensacion_termica_c`, `cobertura_nubosa_pct`, `bulbo_humedo_c`, `cape_jkg`, `nivel_congelacion_m`, `humedad_700hpa`, `viento_700hpa`.

**`src/engine/consensusEngine.js`, líneas 126–147.** Este consenso sí los produce, con los mismos nombres que espera el orquestador. Pero el runner **no lo importa**. Lo importan la Sala Operativa, el Monitor Climático y `reportesRegionales.js`.

**Demostración con datos reales (22/10/2026, HEAD `890ba6e`, zona PMN):** la serie que reproduce el runner tiene 0 de 240 horas con cada uno de los ocho campos de Etapa 4. El consenso compartido, con los mismos datos de Open-Meteo, tiene 240 de 240 en cada uno. La diferencia está en el consenso, no en la descarga.

### 2.2 El runner pide las variables y luego las descarta

**`scripts/ejecutar_sara_autonomo.mjs`, línea 134.** La petición a Open-Meteo incluye `surface_pressure`, `apparent_temperature`, `cloud_cover`, `wet_bulb_temperature_2m`, `cape`, `freezing_level_height`, `relative_humidity_700hPa` y `wind_speed_700hPa`. Esos datos llegan y no se usan. Es consumo de la API sin beneficio.

### 2.3 El orquestador rellena los campos ausentes con constantes

**`src/engine/crossThreatOrchestrator.js`, líneas 107–119.** Construye los arreglos para los evaluadores con estos valores por defecto cuando el campo falta:

| Campo | Valor por defecto | Efecto |
|---|---|---|
| `cape_jkg` | 0 | El potencial de desplome es 0 y no dispara granizo ni downburst |
| `nivel_congelacion_m` | 4000 | El espesor de fusión queda muy grande y no hay granizo |
| `bulbo_humedo_c` | 10 | La nevada no se puede detectar (requiere menos de 1 °C) |
| `cobertura_nubosa_pct` | 50 | La helada radiativa no se activa (requiere menos de 20 %) |
| `humedad_700hpa` | 50 | El potencial de desplome queda en cero |
| `presion_hpa` | 1013 | La densidad del aire se calcula con presión estándar |
| `sensacion_termica_c` | temperatura | La sensación térmica queda igual a la temperatura |

**Consecuencia:**

- **Convectivo:** con CAPE = 0 ninguna regla puede disparar. Es estructuralmente imposible que haya granizo, downburst o supercélula en producción.
- **Térmico:** puede detectar frío y calor por temperatura. No puede detectar nevada ni helada radiativa.
- **Viento:** sí tiene datos reales (ráfagas y viento sostenido). Solo usa un valor estándar para la presión.
- **Hidrológico:** no se ve afectado, porque sus campos sí existen en la serie del runner.

### 2.4 La bitácora es consistente con esta situación

Captura de la bitácora, registro SARA_LOG_239:

```text
N4: 0 | N3 [hidro:36, viento:0, termico:0, conv:0] | N2: 197 | N1: 172 | Top-1: HIDROLOGICO
```

Todos los N3 son hidrológicos. Eso es coherente con un sistema en que solo el hidrológico puede llegar a N3. **Pero la bitácora no registra si cada vector tuvo datos.** Un cero puede significar "sin riesgo" o "sin datos". Con esta bitácora no se puede saber cuál es.

### 2.5 Valores cero tratados como ausentes

Expresiones `valor || default` en las que un cero real se convierte en el valor por defecto:

| Archivo | Línea | Efecto |
|---|---|---|
| `crossThreatOrchestrator.js` | 109 | `temperatura_c` de 0 °C se convierte en 15 °C |
| `crossThreatOrchestrator.js` | 110 | `sensacion_termica_c` de 0 °C se convierte en 15 °C |
| `crossThreatOrchestrator.js` | 114 | `bulbo_humedo_c` de 0 °C se convierte en 10 °C |
| `windEvaluator.js` | 52 | `temperatura_c` de 0 °C se convierte en 15 °C |

El cero es justamente el umbral de las heladas. Una temperatura de 0 °C no puede activar la alerta de helada en este caso.

### 2.6 Dos implementaciones de consenso

| Implementación | Archivo | Quién la usa | Variables de Etapa 4 |
|---|---|---|---|
| Runner | `scripts/ejecutar_sara_autonomo.mjs` (función local) | Runner de GitHub Actions | No |
| Compartida | `src/engine/consensusEngine.js` | Sala Operativa, Monitor Climático, `reportesRegionales.js` | Sí |

Esto significa que el mismo sitio puede tener un semáforo distinto en el runner y en la interfaz. El runner publica el semáforo oficial.

### 2.7 El respaldo en vivo es hidrológico

**`src/views/SatRCOperativo.jsx`, línea 223.** El respaldo en vivo usa `evaluarLocalidad`, el motor hidrológico. No usa el orquestador. Si el Blob falla, la Sala Operativa muestra solo hidrología, aunque el sistema diga que es multifactor.

### 2.8 SARA sí recibe los campos multifactor

- **`reporteDiario.mjs`, líneas 303–306.** Pasa `vector_dominante`, `niveles_por_vector`, `acciones_operativas` a los focos.
- **`SatRCOperativo.jsx`, líneas 356–359.** Pasa los mismos campos al reporte bajo demanda.
- **`promptsMultivector.js`.** Las reglas 17 a 19 están inyectadas en los dos reportes (`reporte-ondemand.js` línea 230, `reporteDiario.mjs` línea 196).

Pero el dictamen del runner, que es el texto que aparece en la bitácora, **no importa** `REGLAS_MULTIVECTOR`. Su prompt es hidrológico. Eso coincide con el título de la captura: "Alerta Temprana por Lluvias y Deslaves".

---

## 3. Qué significa para la aplicación

| Afirmación | Veredicto |
|---|---|
| "El runner evalúa cuatro vectores" | **Parcialmente cierto.** Los cuatro se evalúan, pero tres casi nunca tienen datos reales. |
| "El runner consensúa las 8 variables de Etapa 4" | **Falso.** Las pide y las descarta. |
| "La aplicación es multifactor" | **En el diseño, sí. En producción, principalmente hidrológica.** |
| "SARA es multifactorial" | **En el diseño, sí. En la práctica, recibe casi solo datos hidrológicos.** |
| "Las alertas de viento, calor o frío son confiables" | **Viento: sí tiene datos. Frío y calor: solo por temperatura, sin helada ni nevada. Convectivo: no.** |

---

## 4. Por qué es coherente con la historia del proyecto

La primera versión fue solo de lluvia. El motor de Etapa 4 se construyó y se probó con datos reales de Pachuca. El runner se adaptó después, con el adaptador de forma (ADR-006), pero **su consenso local no se actualizó**. Esto es lo que se desprende del código: el consenso compartido (`consensusEngine.js`) tiene las variables de Etapa 4, y el del runner no. No verifiqué qué consenso usan exactamente las pruebas del orquestador; conviene confirmarlo para cerrar esta explicación.

Esta es la razón por la que la verificación debe hacerse sobre la ruta real de producción y no solo sobre los módulos.

---

## 5. Lo que la bitácora debería registrar

Para que la trazabilidad sea real, cada corrida debería indicar, por vector, si tuvo datos. Propuesta de formato:

```text
N3 [hidro:36(datos), viento:0(datos), termico:0(SIN_DATOS), conv:0(SIN_DATOS)]
```

Esto no cambia el cálculo. Solo hace visible el problema.

---

## 6. Correcciones de documentación derivadas

| Documento | Afirmación incorrecta | Corrección |
|---|---|---|
| `02_ARQUITECTURA.md` §2 | "Consenso determinista por variable" en el runner | Aclarar que el runner usa un consenso local sin variables de Etapa 4 |
| `03_MOTOR_RIESGO.md` §4 | Consenso compartido por el runner y la interfaz | Aclarar que son dos implementaciones distintas |
| `10_HANDOVER` (archivado) | "H6.3: consensúa las 8 variables" | Falso para el runner. Se registra como H-MULTI-01 |
| `05_PROMPT_SARA.md` §8 | "H7 hecho" | Hecho en reportes. Pendiente en el dictamen del runner (H-PROMPT-01) |

---

## 7. Deudas que genera este hallazgo

Se registran en `06_PENDIENTES.md`, sección 2.7:

| ID | Descripción | Severidad |
|---|---|---|
| H-MULTI-01 | El runner no consensúa las variables de Etapa 4; el orquestador usa valores por defecto. | 🟠 Alta |
| H-MULTI-02 | Los valores por defecto anulan los vectores convectivo y térmico sin dejar rastro en la bitácora. | 🟠 Alta |
| H-MULTI-03 | Dos implementaciones de consenso (runner e interfaz) con resultados que pueden diferir. | 🟡 Media |
| H-MULTI-04 | Valores cero tratados como ausentes en el orquestador y en el evaluador de viento. | 🟡 Media |
| H-MULTI-05 | El runner consume llamadas a la API para variables que descarta. | 🟢 Baja |
| H-MULTI-06 | El respaldo en vivo de la Sala Operativa es solo hidrológico. | 🟡 Media |

---

## 8. Limitaciones

- No ejecuté el runner en producción. La prueba sin red verificó la forma de los datos, no los valores reales. La conclusión sobre los valores por defecto es una lectura del código y la bitácora; debe confirmarse con una corrida que registre la serie que recibe el orquestador.
- No verifiqué si las 405 localidades reciben siempre la misma ruta. Asumí que el fallback se activa solo ante errores, según el código.
- Las reglas de SARA se verificaron por su inyección en el código, no por la respuesta real del modelo.
