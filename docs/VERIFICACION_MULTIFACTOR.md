# Verificación del motor multifactor y de SARA

> **Fecha original:** 22/10/2026
> **Última actualización:** 27/10/2026 (Correcciones de H-MULTI aplicadas).
> **Propósito:** Documento histórico que registró el descubrimiento de la falla en el runner (H-MULTI). **Las correcciones detalladas aquí ya fueron implementadas y verificadas en producción.**
> **Estado actual:** El runner autónomo ya importa el consenso compartido y evalúa correctamente los 4 vectores. La bitácora distingue entre "sin riesgo" y "sin datos". El sistema es verdaderamente multifactor.

---

## 1. Resumen de la evolución

- **Hallazgo original (22/10/2026):** El runner usaba un consenso local (solo 9 variables) que descartaba las 8 variables de Etapa 4. Como resultado, el orquestador rellenaba los vectores térmico y convectivo con constantes (CAPE=0, etc.), anulándolos en la práctica.
- **Solución aplicada (23/10/2026):** Se eliminó el consenso local del runner y se importó `consensusEngine.js`. Además, se corrigió el operador lógico `||` por `??` en el orquestador para que los valores de cero reales (ej. temperatura de 0 °C) no se perdieran.
- **Bitácora:** Ahora registra `datos_disponibles_por_vector`. Si no hay datos de un vector, lo marca como `SIN_DATOS`.

---

## 2. Evidencia histórica (para contexto)

### 2.1 El consenso del runner (Antes)
El consenso local del runner solo generaba: `lluvia_mm`, `temperatura_c`, `viento_kmh`, `rafagas_kmh`, `humedad_relativa_pct`, `visibility_km`, entre otros. 
**Corrección:** El runner ahora importa `src/engine/consensusEngine.js` y produce las 17 variables, incluyendo `cape_jkg`, `nivel_congelacion_m`, `bulbo_humedo_c`, etc.

### 2.2 El orquestador y los valores por defecto (Antes)
El orquestador usaba `valor || default` y convertía ceros reales en valores por defecto, perdiendo alertas de heladas.
**Corrección:** Se cambiaron las 13 asignaciones a `valor ?? default` (H-MULTI-04).

### 2.3 La bitácora (Antes)
Mostraba `termico:0` cuando no había riesgo o cuando no había datos. Era imposible distinguir.
**Corrección:** La bitácora ahora utiliza el formato: `N3 [hidro:36(datos), viento:0(datos), termico:0(SIN_DATOS)]`. Esto permite a los operadores saber si un vector está en calma o si el sistema está ciego a él.

### 2.4 El respaldo en vivo (H-MULTI-06)
La Sala Operativa sigue usando el motor hidrológico como respaldo si el Blob falla. Esta deuda sigue abierta para V3.0.

---

## 3. Impacto actual en la aplicación

| Afirmación | Veredicto actual (27/10/2026) |
|---|---|
| "El runner evalúa cuatro vectores" | **Verdadero.** El runner lee los datos reales de los 4 vectores en producción. |
| "El runner consensúa las 8 variables de Etapa 4" | **Verdadero.** Usa el motor de consenso compartido. |
| "La aplicación es multifactor" | **Verdadero.** Apan y Almoloya bajaron de N3 a N1/N2 al corregir el motor convectivo, demostrando que el sistema reacciona a la física real. |
| "SARA es multifactorial" | **Verdadero.** El dictamen del runner y los reportes reciben `tipo_amenaza` y `acciones_operativas`. |

---

## 4. Correcciones documentales aplicadas

| Documento | Estado |
|---|---|
| `02_ARQUITECTURA.md` | Actualizado. El flujo refleja Google Drive y el consenso compartido. |
| `03_MOTOR_RIESGO.md` | Actualizado. Refleja los fixes de H-MOTOR-07 y H-CONV-03. |
| `05_PROMPT_SARA.md` | Actualizado. H-PROMPT-01 y H-PROMPT-02 cerrados. |
| `06_PENDIENTES.md` | Actualizado. H-MULTI-01 a 05 cerrados; solo queda H-MULTI-06. |

---

## 5. Conclusión

El sistema SatRC V2.0 es hoy una herramienta **verdaderamente multifactorial**. El runner autónomo en GitHub Actions evalúa la lluvia, el viento, el frío/calor y las tormentas severas con datos en vivo, publica el resultado en Google Drive, y alerta a la Diócesis con base en la física combinada de los cuatro vectores.