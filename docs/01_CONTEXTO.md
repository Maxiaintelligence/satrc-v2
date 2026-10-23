# SatRC V2.0 — Contexto, principios y glosario

> **Versión del documento:** 2.4 (22/10/2026)
> **Audiencia:** personas que coordinan, operan o mantienen el sistema, y asistentes de IA que retoman el proyecto.

---

## 1. Qué es SatRC

SatRC (Sistema de Alerta Temprana y Riesgos Climáticos) es una aplicación web progresiva diseñada para la Cáritas Pastoral Social de la Arquidiócesis de Tulancingo. Su propósito es apoyar la protección de la vida y del patrimonio de comunidades rurales frente a amenazas meteorológicas: lluvias intensas, deslaves, inundaciones, vientos fuertes, temperaturas extremas y tormentas convectivas.

**En una frase:** consensúa datos de modelos meteorológicos abiertos y avisos oficiales en un semáforo diocesano de cuatro niveles, con reportes redactados con apoyo de IA y una bitácora con encadenamiento criptográfico.

---

## 2. Principios

- **Subordinación institucional.** SatRC no sustituye a Protección Civil ni a CONAGUA. Traduce y orienta; las determinaciones oficiales prevalecen siempre.
- **Preferencia por el falso positivo.** Una alerta de más tiene un costo bajo. No alertar a tiempo puede costar vidas.
- **Trazabilidad.** Cada acción del sistema (corrida automática, reporte bajo demanda, reporte diario) deja un registro en la bitácora, encadenado con SHA-256.
- **Transparencia.** Las decisiones de diseño y sus límites están documentados en `08_DECISIONES.md`.

---

## 3. Usuarios

1. **Operadores diocesanos.** Coordinadores de Cáritas con acceso a la Sala Operativa, protegida por clave personal. Generan reportes, consultan el semáforo y la bitácora.
2. **Público general.** Párrocos, brigadistas y personas de las comunidades. Consultan el Monitor Climático para conocer la situación de su localidad.
3. **Sistema autónomo.** Un proceso automatizado que se ejecuta cada 3 horas, sin intervención humana, y publica el estado diocesano.

---

## 4. Alcance geográfico

- **405 localidades** con población mayor a 1,000 habitantes, en Hidalgo, la Sierra Norte de Puebla y laderas limítrofes de Veracruz.
- **14 zonas de resguardo**, cada una con un nodo meteorológico de referencia: la localidad más poblada de la zona (ver ADR-001 en `08_DECISIONES.md`).

| Grupo | Zonas |
|---|---|
| Altiplano (5) | ACT, APN, PMN, PMS, TIZ |
| Sierra (9) | ATG, CHG, HUA, HYC, SPP, TUL, XIC, ZAC, ZAH |

---

## 5. Amenazas evaluadas

El sistema evalúa cuatro vectores de riesgo, cada uno en su propio módulo:

| Vector | Qué evalúa | Módulo |
|---|---|---|
| Hidrológico | Lluvia acumulada, saturación del suelo, pendiente, cauces, aislamiento vial, niebla (visibilidad) | `riskEvaluator.js` e `hydroAdapter.js` |
| Viento | Ráfagas normalizadas a densidad de nivel del mar, con umbral por altitud | `windEvaluator.js` |
| Térmico | Heladas, frío extremo, nevadas, calor extremo | `thermalEvaluator.js` |
| Convectivo | Granizo, downbursts, supercélulas | `convectiveEvaluator.js` |

Un orquestador combina los cuatro vectores con un término de acoplamiento: dos amenazas moderadas simultáneas pueden elevar el nivel más de lo que lo haría cada una por separado. Detalle en `03_MOTOR_RIESGO.md`.

---

## 6. Límites del sistema

- **No emite avisos oficiales.** Traduce los avisos de CONAGUA y de Protección Civil.
- **No ordena evacuaciones.** Recomienda acciones.
- **No predice el clima.** Consensúa salidas de modelos existentes.
- **No reemplaza a las autoridades** de Protección Civil ni de CONAGUA.

---

## 7. Restricciones de diseño

- **Presupuesto cero.** El proyecto es una iniciativa sin financiamiento recurrente. Todo el sistema opera con planes gratuitos o servicios de dominio público. Un cambio en los límites de esos planes puede afectar la operación; ver DEU-19 en `06_PENDIENTES.md`.
- **Sin servidores propios.** El despliegue usa servicios administrados.
- **Operación sin ambiente local completo.** El almacenamiento y la IA solo están disponibles en producción. La verificación funcional se hace en GitHub Actions y en Vercel.

---

## 8. Arquitectura en una vista

```text
┌──────────────────────────────────────────────────────────────┐
│ Interfaz web (React 19 + Vite 8 + Tailwind 3)                │
│ Monitor Climático (público) · Sala Operativa (operadores)    │
│ Hosting: Vercel                                              │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Funciones serverless (Node 22) en api/                       │
│ sara · smn · latest-gif · reporte-ondemand · disparar-workflow│
│ Validación de contratos con Zod                              │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Proceso autónomo (GitHub Actions, cada 3 horas)              │
│ scripts/ejecutar_sara_autonomo.mjs                           │
│ Disparado por cron-job.org a través de /api/disparar-workflow│
│ Reporte diario automático (06:00, hora de México)            │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Almacenamiento (Vercel Blob)                                 │
│ estado_diocesano.json · bitacora_sara.json ·                 │
│ reporte_diocesano_vigente.json                               │
└──────────────────────────────────────────────────────────────┘
                              ↕
┌──────────────────────────────────────────────────────────────┐
│ Datos externos                                               │
│ Open-Meteo (modelos GFS, ICON, GEM) · Groq (IA) ·            │
│ SMN/CONAGUA (avisos) · NOAA GOES-19 (imágenes satelitales)   │
└──────────────────────────────────────────────────────────────┘
```

Detalle de componentes y contratos en `02_ARQUITECTURA.md`.

---

## 9. Glosario

| Término | Significado |
|---|---|
| **SatRC** | Nombre del sistema. |
| **Monitor Climático** | Vista pública de la aplicación. Archivo: `MonitorPublico.jsx`. |
| **Sala Operativa** | Vista protegida para operadores diocesanos. Archivo: `SatRCOperativo.jsx`. |
| **Zona de resguardo** | Agrupación de localidades que comparten un nodo meteorológico de referencia. Son 14. |
| **Nodo** | Localidad más poblada de una zona, cuyo pronóstico representa a la zona. |
| **Semáforo / nivel de alerta** | Clasificación de 1 a 4: 1 Normal, 2 Vigilancia, 3 Alerta temprana, 4 Emergencia. |
| **Vector** | Tipo de amenaza evaluada: hidrológico, viento, térmico o convectivo. |
| **Acoplamiento** | Efecto combinado de dos vectores simultáneos, calculado por el orquestador. |
| **SARA** | Agente de redacción de reportes con IA. Según el handover, sus siglas significan "Sistema de Alerta y Respuesta Automatizada". Confirmar la expansión con la coordinación. |
| **Bitácora** | Registro de cada corrida y reporte, encadenado con hashes SHA-256. |
| **Blob** | Almacenamiento de archivos en Vercel donde se publica el estado vigente. |
| **Etapa** | Fase de trabajo del proyecto. Etapa 3 (deuda técnica), Etapa 4 (multiamenaza), Etapa 5 (integración multivectorial). |
| **Hito (H)** | Subtarea dentro de una etapa, por ejemplo H6.4a. Un identificador de hito solo tiene sentido con su etapa: H5 de Etapa 3 y H5.0 de Etapa 5 son trabajos distintos. |
| **Versión 3.0** | Salto futuro de la aplicación: autenticación real, nuevos vectores, percentiles históricos. No es lo mismo que Etapa 3. |
| **satrc-v2** | Nombre del repositorio en GitHub. |
| **satrc-v3** | Nombre histórico de la carpeta local de trabajo. No indica versión del sistema. |
| **V2.0** | Versión actual de la aplicación. |
| **Protección Civil / CONAGUA / SMN** | Autoridades cuyas determinaciones prevalecen. SMN es el Servicio Meteorológico Nacional, parte de CONAGUA. |

---

## 10. Documentos relacionados

- `LEEME_PRIMERO.md`: punto de entrada y estado actual.
- `00_METODOLOGIA.md`: reglas de trabajo.
- `06_PENDIENTES.md`: deuda técnica y riesgos abiertos.
- `08_DECISIONES.md`: decisiones de arquitectura y su justificación.
