# SatRC V2.0 — Motor de Evaluación de Riesgo

El motor (`src/engine/riskEvaluator.js` y `scripts/ejecutar_sara_autonomo.mjs`) evalúa cada localidad usando dos capas:
1.  **Nodo Regional:** Datos meteorológicos de la zona.
2.  **Perfil Local:** Topografía, hidrología y vulnerabilidad de la comunidad.

## 1. Cálculo de Saturación del Suelo (API)
Se calcula con la lluvia de los últimos 7 días con un factor de decaimiento del 0.85.
`Saturación Total = API (7 días) + Lluvia de las últimas 24h`.
*Umbrales: <20mm (Seco), 20-30mm (Húmedo), >65mm (Crítico).*

## 2. Las 6 Reglas de Evaluación
1.  **Protección Altiplano (N1):** Zonas planas (ACT, APN, PMN, PMS, TIZ), pendiente <15°, lluvia <20mm, temp >2°C, viento <40km/h.
2.  **Deslave Crítico (N4):** Zonas de Sierra, pendiente ≥45°, saturación ≥65mm. *Falla geomecánica inminente.*
3.  **Deslave Moderado (N3):** Zonas de Sierra, pendiente 25°-44°, saturación ≥65mm.
4.  **Inundación Fluvial (N4/N3):** Distancia a río ≤0.8km, TWI ≥12, lluvia ≥35mm.
5.  **Corte Vial (N3):** Acceso por terracería/brecha, lluvia ≥20mm o saturación ≥50mm.
6.  **Vigilancia (N2):** Lluvia ≥8mm, saturación ≥30mm o visibilidad ≤2km (Niebla).

## 3. Consenso Multi-Modelo
Para evitar errores de un solo modelo, el sistema consulta GFS (EE.UU.), ICON (Alemania) y GEM (Canadá).
- **Lluvia/Temperatura/Viento:** Se usa la **Mediana** de los 3 modelos.
- **Ráfagas:** Se usa el **Máximo** (criterio conservador).
- **Filtro de ceros:** Si 2 modelos predicen lluvia y 1 predice 0, se ignora el cero.