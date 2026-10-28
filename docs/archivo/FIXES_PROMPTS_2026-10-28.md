
### Fix 1 — H-PROMPT-05: `max_completion_tokens` en el dictamen del runner

1. **Archivo:** `scripts/ejecutar_sara_autonomo.mjs`

2. **Ubicación:** dentro de la llamada `fetch("https://api.groq.com/openai/v1/chat/completions", ...)`, en el body JSON, entre `temperature` y `response_format`.

3. **Bloque de reemplazo:**

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
model: "openai/gpt-oss-120b",
temperature: 0.1,
max_completion_tokens: 500,
response_format: { type: "json_object" },
// --- FIN DE LA MODIFICACIÓN ---
```

4. **Prueba PowerShell:**

```powershell
cd "C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3"
node --check scripts/ejecutar_sara_autonomo.mjs
# Debe imprimir "max_completion_tokens" en el prompt del dictamen
Select-String -Path "scripts\ejecutar_sara_autonomo.mjs" -Pattern "max_completion_tokens:\s*500"
# Salida esperada: una coincidencia
```

5. **Commit:**

```powershell
git add scripts/ejecutar_sara_autonomo.mjs
git commit -m "fix(prompt): agrega max_completion_tokens al dictamen del runner (H-PROMPT-05)"
git push origin main
```

---

### Fix 2 — H-PROMPT-06: regla de control de emergencias en el diario

1. **Archivo:** `scripts/reportes/reporteDiario.mjs`

2. **Ubicación:** dentro de `construirSystemPrompt()`, en el template string, después de la regla 15 (formato con viñetas) y antes de `${REGLAS_MULTIVECTOR}`.

3. **Bloque de reemplazo** (el bloque actual termina con la regla 15 y luego `${REGLAS_MULTIVECTOR}`; el cambio inserta una nueva regla):

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
15. FORMATO CON VIÑETAS: usa viñetas en las secciones 0, II, III, IV y V.
15.bis. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia". Usa lenguaje de precaución y vigilancia. Si Nivel 3 > 0 y Nivel 4 = 0, usa "alerta temprana" y "restringir actividades específicas". Solo si Nivel 4 > 0 puedes usar "suspender actividades expuestas" o "evacuar".
${REGLAS_MULTIVECTOR}
// --- FIN DE LA MODIFICACIÓN ---
```

4. **Prueba PowerShell:**

```powershell
cd "C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3"
node --check scripts/reportes/reporteDiario.mjs
# Debe contener "BAJO NINGUNA CIRCUNSTANCIA"
Select-String -Path "scripts\reportes\reporteDiario.mjs" -Pattern "BAJO NINGUNA CIRCUNSTANCIA"
# Salida esperada: una coincidencia
```

5. **Commit:**

```powershell
git add scripts/reportes/reporteDiario.mjs
git commit -m "fix(prompt): agrega regla de control de emergencias al reporte diario (H-PROMPT-06)"
git push origin main
```

---

### Fix 3 — H-PROMPT-07: alinear umbrales del viento con el motor

1. **Archivos:**
   - `scripts/reportes/reporteDiario.mjs`
   - `api/reporte-ondemand.js`

2. **Ubicación:** la regla 10 en ambos `systemPrompt`.

3. **Bloque de reemplazo:**

En ambos archivos, dentro de la regla 10, reemplazar:

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
10. CLASIFICACIÓN DE VIENTO (narrativa, no alerta): Para describir en el texto, usa ráfagas < 40 km/h = suaves; 40-59 = moderadas; ≥ 60 = fuertes. Para la alerta real, el motor usa umbrales más altos (45/65/90 +5 km/h por encima de 2200 msnm). No confundas los umbrales narrativos con los del semáforo.
// --- FIN DE LA MODIFICACIÓN ---
```

En el on-demand, el bloque actual es más corto:

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
10. VIENTO (narrativa, no alerta): < 40 suaves; 40-59 moderadas; ≥ 60 fuertes. Los umbrales reales del semáforo son 45/65/90 (+5 altitud). No los confundas.
// --- FIN DE LA MODIFICACIÓN ---
```

4. **Prueba PowerShell:**

```powershell
cd "C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3"
node --check scripts/reportes/reporteDiario.mjs
node --check api/reporte-ondemand.js
# Debe contener "45/65/90" en ambos
Select-String -Path "scripts\reportes\reporteDiario.mjs","api\reporte-ondemand.js" -Pattern "45/65/90"
# Salida esperada: dos coincidencias
```

5. **Commit:**

```powershell
git add scripts/reportes/reporteDiario.mjs api/reporte-ondemand.js
git commit -m "fix(prompt): alinea umbrales narrativos de viento con el motor (H-PROMPT-07)"
git push origin main
```

---

### Fix 4 — H-PROMPT-08 + H-PROMPT-10: implementar R18, R19, R20 en `promptsMultivector.js`

1. **Archivo:** `src/lib/compartido/promptsMultivector.js`

2. **Ubicación:** el archivo completo se reemplaza. Es pequeño (< 50 líneas) y el contenido cambia sustancialmente.

3. **Bloque de reemplazo completo** (reemplaza el archivo actual):

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
/**
 * SatRC V2.0 — Reglas de Prompts para SARA Multiamenaza (H5.5 + v2.0)
 *
 * Implementa las 4 reglas multivectoriales:
 *   R17 — Leer el vector dominante y redactar según su lenguaje.
 *   R18 — Traducir el vector a acciones operativas (incluye acciones_operativas).
 *   R19 — Sección V condicional por vector.
 *   R20 — Subtipos específicos vía tipo_amenaza.
 */
export const REGLAS_MULTIVECTOR = `
17. LEE EL VECTOR DOMINANTE Y REDACTA SEGÚN SU LENGUAJE. Cada foco crítico en el JSON incluye los campos "vector_dominante", "tipo_amenaza", "niveles_por_vector", "diagnosticos_por_vector" y "acciones_operativas". NO ASUMAS que todo es lluvia. Si el vector dominante es:
    - HIDROLOGICO: Habla de lluvias, deslaves, inundaciones, cortes viales. (Usa "tipo_amenaza" para ser específico: DESLAVE_CRITICO, INUNDACION_FLUVIAL, CORTE_VIAL).
    - VIENTO: Habla de ráfagas, caída de árboles, daños a techos. (NUNCA menciones lluvias si el vector es viento puro).
    - TERMICO: Habla de frío extremo, heladas, nevadas, golpe de calor. (Usa "tipo_amenaza" para distinguir entre NEVADA, HELADA_AGRICOLA, FRIO_EXTREMO, CALOR_EXTREMO).
    - CONVECTIVO: Habla de granizo, downbursts (rachas descendentes), tormentas severas. (Usa "tipo_amenaza" para distinguir entre GRANIZO, DOWNBURST, SUPER_CELULA).
    - Vectores Compuestos (HIDRO_VIENTO, CONVECTIVO_VIENTO, HIDRO_TERMICO): Combina los lenguajes. Ej: "Lluvia + Viento = Árboles caídos". "Convectivo + Viento = Downburst".

18. TRADUCE EL VECTOR A ACCIONES OPERATIVAS. Cada foco incluye el arreglo "acciones_operativas". En la Sección 0 (decisión operativa) y en la Sección II (focos críticos), usa EXACTAMENTE las acciones del arreglo. NO inventes acciones genéricas ni repitas "manténgase alerta". Si el arreglo está vacío o ausente, describe la acción con el lenguaje del vector dominante sin inventar. Bajo el principio de precisión (DEC-011), la acción debe corresponder al nivel del motor.

19. SECCIÓN V CONDICIONAL. Si un foco tiene un vector distinto de HIDROLOGICO (es decir, VIENTO, TERMICO, CONVECTIVO, o un compuesto), agrega en la Sección V (recomendaciones) al menos una viñeta específica para ese vector. Ejemplos: para VIENTO, "asegurar techos y objetos que puedan volar"; para TERMICO frío, "cubrir cultivos y proteger tuberías"; para CONVECTIVO, "resguardar vehículos y no refugiarse bajo árboles aislados". NO omitas la viñeta aunque el nivel sea N2.

20. SUBTIPOS ESPECÍFICOS. Usa el campo "tipo_amenaza" para redactar la causa exacta de cada foco. NO uses un lenguaje genérico de "mal tiempo". Si el tipo es NEVADA, habla de nieve; si es GRANIZO, de granizo; si es DOWNBURST, de rachas descendentes; si es SUPER_CELULA, de tormenta severa organizada. Usa también "diagnosticos_por_vector" si está disponible para enriquecer la causa.
`;
// --- FIN DE LA MODIFICACIÓN ---
```

4. **Prueba PowerShell:**

```powershell
cd "C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3"
node --check src/lib/compartido/promptsMultivector.js
# Debe contener las 4 reglas
Select-String -Path "src\lib\compartido\promptsMultivector.js" -Pattern "^\d+\." -AllMatches
# Salida esperada: 4 coincidencias (17, 18, 19, 20)

# Verificar que la constante se exporta
Select-String -Path "src\lib\compartido\promptsMultivector.js" -Pattern "export const REGLAS_MULTIVECTOR"

# Y que los 3 archivos lo importan
Select-String -Path "scripts\reportes\reporteDiario.mjs","api\reporte-ondemand.js","scripts\ejecutar_sara_autonomo.mjs" -Pattern "REGLAS_MULTIVECTOR" | Measure-Object | Select-Object -ExpandProperty Count
# Salida esperada: 6 (2 por archivo: import + uso)
```

5. **Commit:**

```powershell
git add src/lib/compartido/promptsMultivector.js
git commit -m "feat(prompts): implementa reglas multivectoriales 18, 19 y 20 en v2.0 (H-PROMPT-08, H-PROMPT-10)"
git push origin main
```

---

### Fix 5 — H-PROMPT-09: regla 12.bis en el on-demand

1. **Archivo:** `api/reporte-ondemand.js`

2. **Ubicación:** dentro de `const systemPrompt`, después de la regla 11 (anti-alucinación) y antes de la regla 17 (control de emergencias).

3. **Bloque de reemplazo:**

```javascript
// --- INICIO DE LA MODIFICACIÓN ---
11. ANTI-ALUCINACIÓN: usa EXCLUSIVAMENTE los datos reales.
12.bis. COHERENCIA SECCIÓN 0 ↔ SECCIÓN II (crítico): Las zonas mencionadas en la Sección 0 (Decisión Operativa) deben ser EXACTAMENTE las mismas que las listadas en la Sección II (Zonas que Requieren Atención). Si la Sección 0 menciona 3 zonas, la Sección II debe listar esas mismas 3 zonas. No puede haber divergencia entre ambas secciones.
17. CONTROL ESTRICTO DE EMERGENCIAS: Si Nivel 4 = 0 y Nivel 3 = 0, BAJO NINGUNA CIRCUNSTANCIA uses "suspender actividades", "evacuar" o "emergencia". Usa lenguaje de precaución y vigilancia.
// --- FIN DE LA MODIFICACIÓN ---
```

4. **Prueba PowerShell:**

```powershell
cd "C:\Users\anton\OneDrive\Documents\4. Maxia\Proyectos_Caritas\satrc-v3"
node --check api/reporte-ondemand.js
# Debe contener "12.bis"
Select-String -Path "api\reporte-ondemand.js" -Pattern "12\.bis"
# Salida esperada: una coincidencia
```

5. **Commit:**

```powershell
git add api/reporte-ondemand.js
git commit -m "fix(prompt): agrega coherencia Sección 0↔II al reporte on-demand (H-PROMPT-09)"
git push origin main
```

---

### 5. Orden de aplicación (obligatorio)

Los 5 fixes de prompts no tienen sentido operativo si el reporte diario sigue fallando por H-REPORTE-02. Ese fix está especificado en el bloque 02 (ya aplicado en documentación) y debe ejecutarse antes que cualquier fix de prompt.

| # | Fix | Motivo del orden |
|---|---|---|
| 1 | H-REPORTE-02 (bloque 02) | Sin esto, el reporte diario no se entrega. Los fixes de prompts del diario no tendrían efecto. |
| 2 | H-PROMPT-05 (token dictamen) | Independiente. Cierra el riesgo de truncamiento. |
| 3 | H-PROMPT-08 + H-PROMPT-10 (`promptsMultivector.js`) | Afecta a los 3 prompts. Es la base para R18, R19, R20. |
| 4 | H-PROMPT-06 (control emergencias en diario) | Depende de H-REPORTE-02 (para que el diario se ejecute). |
| 5 | H-PROMPT-09 (12.bis en on-demand) | Independiente. Cierra el riesgo del bug N29. |
| 6 | H-PROMPT-07 (umbrales del viento) | Cosmético. Puede ir al final. |
| 7 | H-REPORTE-03 (`debeGenerarReporteDiario`) | Requiere H-REPORTE-02 resuelto para tener lógica significativa. |

Los 5 fixes de prompts están especificados con los 5 puntos de metodología.

El orden de aplicación es estricto: H-REPORTE-02 primero, luego los 5 de prompts, luego H-REPORTE-03.

La función principal de la app está rota hoy (reporte diario no se entrega) y los fixes de prompts no la restauran por sí solos. H-REPORTE-02 es el bloqueador #1.

Los fixes de prompts mejoran la calidad del texto de SARA, cierran los riesgos de coherencia y control de emergencias, y permiten que acciones_operativas se usen como el motor las calculó.