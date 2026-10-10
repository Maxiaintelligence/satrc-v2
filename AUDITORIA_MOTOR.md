# Auditoría del motor meteorológico — SatRC V2.0

**Fecha:** 10 de octubre de 2026
**Auditor:** Revisión técnica del flujo de evaluación de riesgo
**Estado:** Diagnóstico cerrado. Decisión arquitectónica tomada.

---

## Resumen ejecutivo

El motor actual de SatRC V2.0 consulta Open-Meteo **en un solo punto** (la localidad de Huauchinango) y aplica esa serie meteorológica a las 405 localidades del sistema. Esto produce una **sobreclasificación de riesgo severa** medida empíricamente sobre 90 días de datos históricos:

- **44% de las evaluaciones caen en Nivel 2 (vigilancia)** cuando solo el 17% debería estarlo.
- **22 emergencias N4 se generan en 20 días** cuando solo deberían generarse **3**.
- **Las configuraciones intermedias (3, 6 o 10 nodos) no resuelven el problema.** Solo la configuración de 14 nodos, uno por zona de resguardo, elimina las falsas emergencias.

La decisión técnica es migrar a **14 nodos meteorológicos**, uno por cada zona de resguardo.

---

## 1. Contexto y motivación

### 1.1 El síntoma observado

Durante los primeros días de operación del sistema, se observó que el semáforo diocesano mostraba valores prácticamente estáticos:

- 286 localidades en Nivel 2 (vigilancia)
- 119 localidades en Nivel 1 (estables)

Estos números permanecían sin cambios durante más de 24 horas consecutivas, incluso cuando la dinámica meteorológica regional sí estaba cambiando. Un sistema de alerta temprana cuya clasificación no reacciona a los cambios atmosféricos pierde su propósito.

### 1.2 La hipótesis inicial

Se planteó la hipótesis de que el problema podría ser de calibración de umbrales. Es decir: que los umbrales del motor fueran demasiado sensibles y mantuvieran localidades en N2 artificialmente.

### 1.3 El método de verificación

En lugar de asumir una causa, se realizó una auditoría sistemática:

1. **Verificación matemática** del cálculo de saturación del suelo en un caso concreto.
2. **Análisis de calibración** sobre 90 días de datos históricos de las 14 zonas.
3. **Simulación multi-escenario** de 4 configuraciones de nodos sobre 20 fechas muestreadas.

El resultado descartó la hipótesis de calibración y confirmó un bug arquitectónico de mayor alcance.

---

## 2. Metodología

### 2.1 Fuente de datos

Open-Meteo Archive API (reanálisis ERA5). Se descargaron 2184 horas (91 días) de las siguientes variables para la localidad más poblada de cada una de las 14 zonas de resguardo:

- Precipitación horaria (mm)
- Temperatura a 2 m (°C)
- Viento sostenido a 10 m (km/h)
- Ráfagas a 10 m (km/h)

### 2.2 Réplica del motor

Se implementó una versión simplificada del motor `riskEvaluator.js` en PowerShell, replicando las reglas principales:

- Cálculo del índice de precipitación antecedente (API) con decaimiento exponencial 0.85
- Regla de protección del Altiplano seco
- Regla de deslave crítico (pendiente ≥45° + saturación ≥65 mm)
- Regla de deslave moderado (pendiente 25-44° + saturación ≥65 mm)
- Regla de inundación fluvial (dist. cauce ≤0.8 km + TWI ≥12 + lluvia ≥35 mm)
- Regla de corte vial (terracería + lluvia ≥20 mm)
- Regla de vigilancia N2 (lluvia ≥8 mm OR saturación ≥30 mm)

### 2.3 Limitaciones reconocidas

La simulación **no incluye**:

- La regla de visibilidad reducida (que además está rota por el bug N18, ver Anexo B)
- La regla del aviso federal SMN/CONAGUA
- El cálculo de población aguas arriba
- El comportamiento estacional completo (solo se analizó julio-octubre)

Estas omisiones afectan la magnitud absoluta de los números, pero no la dirección del hallazgo ni la comparación relativa entre configuraciones.

---

## 3. Hallazgos

### 3.1 Hallazgo 1 — El cálculo de saturación es correcto

Se tomó una localidad real del Altiplano (Chicavasco, zona ACT) con saturación reportada de 39.7 mm. Se reconstruyó manualmente el cálculo con los datos históricos de la semana anterior:

| Día | Lluvia | Peso (0.85^(8-d)) | Aporte |
|-----|--------|-------------------|--------|
| Hace 7 días | 6.6 mm | 0.320 | 2.11 mm |
| Hace 6 días | 39.0 mm | 0.377 | 14.70 mm |
| Hace 5 días | 10.6 mm | 0.444 | 4.71 mm |
| Hace 4 días | 5.2 mm | 0.522 | 2.71 mm |
| Hace 3 días | 3.4 mm | 0.614 | 2.09 mm |
| Hace 2 días | 3.6 mm | 0.723 | 2.60 mm |
| Hace 1 día | 6.9 mm | 0.850 | 5.87 mm |
| **API previo** | | | **34.79 mm** |

Saturación = API + lluvia 24h = 34.79 + 4.9 = **39.69 mm** ≈ **39.7 mm**

**El cálculo coincide exactamente con el valor reportado por el sistema.** El motor está funcionando correctamente.

### 3.2 Hallazgo 2 — El umbral Sat≥30 no es el problema

El análisis de 90 días mostró que, con los parámetros actuales, el sistema solo clasifica como N2 por saturación el **19.2% de los días** en promedio de las 14 zonas. Este porcentaje es razonable para un sistema de alerta temprana. El umbral no necesita ajustarse.

### 3.3 Hallazgo 3 — El bug del nodo único produce sobreclasificación sistemática

El motor consulta Open-Meteo en **un solo punto** (Huauchinango, la localidad más al norte de la zona HUA) y aplica esa serie a **las 405 localidades**, sin importar su ubicación geográfica ni su zona climática.

La diferencia climática entre Huauchinango y las zonas del Altiplano es dramática:

| Zona | Lluvia 90 días | Días sin lluvia | Saturación promedio |
|------|---------------|-----------------|---------------------|
| HUA (Huauchinango) | 636.7 mm | 2 | 31.8 mm |
| ACT (Actopan) | 269.8 mm | 22 | 13.9 mm |
| PMS (Pachuca Sur) | 260.3 mm | 16 | 13.5 mm |
| PMN (Pachuca Norte) | 302.7 mm | 14 | 15.5 mm |

**Huauchinango es 2.3x más húmedo que las zonas del Altiplano**, pero su serie meteorológica se aplica a las 405 localidades por igual.

### 3.4 Hallazgo 4 — Las configuraciones intermedias no resuelven el problema

Se simularon 4 configuraciones de nodos sobre 20 fechas representativas de los 90 días históricos:

- **1_nodo**: todas las zonas usan la serie de Huauchinango (comportamiento actual)
- **10_nodos**: algunas zonas comparten nodo con una zona vecina
- **6_nodos**: 6 macro-nodos climáticos
- **14_nodos**: cada zona usa su propia serie

### 3.5 Resultados de la simulación

**Clasificaciones absolutas (20 fechas × 405 localidades = 8100 evaluaciones):**

| Configuración | N1 | N2 | N3 | N4 |
|---------------|-----|-----|-----|-----|
| 1_nodo | 4382 | 3552 | 144 | 22 |
| 10_nodos | 6028 | 1931 | 119 | 22 |
| 6_nodos | 6108 | 1851 | 119 | 22 |
| **14_nodos** | **6613** | **1392** | **92** | **3** |

**Clasificaciones porcentuales:**

| Configuración | %N1 | %N2 | %N3 | %N4 |
|---------------|-----|-----|-----|-----|
| 1_nodo | 54.1% | 43.9% | 1.8% | 0.3% |
| 10_nodos | 74.4% | 23.8% | 1.5% | 0.3% |
| 6_nodos | 75.4% | 22.9% | 1.5% | 0.3% |
| **14_nodos** | **81.6%** | **17.2%** | **1.1%** | **0%** |

**Delta respecto a 14_nodos (falsos positivos):**

| Configuración | N2 falsos | N3 falsos | N4 falsos |
|---------------|-----------|-----------|-----------|
| 1_nodo | +2160 (+155%) | +52 | +19 (**+633%**) |
| 10_nodos | +539 (+38.7%) | +27 | +19 (**+633%**) |
| 6_nodos | +459 (+33%) | +27 | +19 (**+633%**) |

### 3.6 Interpretación crítica

**Las configuraciones 1, 6 y 10 nodos producen exactamente las mismas 22 falsas emergencias N4.** Las configuraciones intermedias no reducen las emergencias falsas en absoluto, porque agrupan zonas climáticamente heterogéneas.

**Solo la configuración de 14 nodos elimina 19 de las 22 falsas emergencias.** La ganancia es de 7.3x menos falsos N4.

En un sistema de alerta temprana, sobre-alertar emergencias (N4) es tan peligroso como sub-alertar. El día que ocurra una emergencia real, la comunidad ya no responderá con la urgencia requerida.

---

## 4. Decisión arquitectónica

**Migrar el motor de evaluación a un sistema de 14 nodos regionales**, uno por cada zona de resguardo.

### 4.1 Justificación

1. **Elimina el 87% de las falsas emergencias N4** (de 22 a 3 en 20 días).
2. **Reduce la sobreclasificación N2 del 43.9% al 17.2%**.
3. **Respeta el diseño pastoral original** de las 14 zonas de resguardo definidas por criterios de cuenca y clima.
4. **El costo operativo es aceptable**: 14 fetches en paralelo con caché de 30 minutos.
5. **Open-Meteo no tiene costo monetario** por volumen de consultas.

### 4.2 Arquitectura de dos capas

El nodo regional **informa**, no **sustituye**. La evaluación final sigue siendo por localidad:
