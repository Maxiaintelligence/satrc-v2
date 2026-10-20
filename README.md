# SatRC V2.0 — Sistema de Alerta Temprana y Riesgos Climáticos

**Cáritas Pastoral Social • Arquidiócesis de Tulancingo**
Cobertura: Hidalgo, Sierra Norte de Puebla y laderas limítrofes de Veracruz (405 localidades)

[![Estado](https://img.shields.io/badge/Estado-Producci%C3%B3n%20Operativa-10b981)](https://github.com/Maxiaintelligence/satrc-v2)
[![Node.js](https://img.shields.io/badge/Node.js-v22-blue)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-19-06b6d4)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-8b5cf6)](https://vitejs.dev)
[![Costo de operación](https://img.shields.io/badge/Costo%20de%20Operaci%C3%B3n-%240.00-brightgreen)](https://github.com/Maxiaintelligence/satrc-v2)

---

## 📖 ¿Qué es SatRC V2.0?

SatRC es una **Progressive Web App (PWA)** humanitaria desarrollada para alertar tempranamente a párrocos, brigadistas comunitarios y autoridades eclesiásticas ante fenómenos hidrometeorológicos severos: lluvias torrenciales, saturación geomecánica de suelo, riesgo de deslave en cañadas, crecidas de ríos y nieblas densas.

El sistema consensúa:

- Pronósticos numéricos de 3 supercomputadoras meteorológicas globales (GFS de EE. UU., ICON de Alemania y GEM de Canadá, vía Open-Meteo).
- Scraping de avisos oficiales de CONAGUA / SMN.
- Imágenes satelitales en tiempo real de NOAA GOES-19.

---

## 🚀 Inicio Rápido (Desarrollo Local)

```bash
# 1. Clonar el repositorio
git clone https://github.com/Maxiaintelligence/satrc-v2.git
cd satrc-v2

# 2. Copiar variables de entorno base
cp .env.example .env

# 3. Instalar dependencias exactas
npm install

# 4. Iniciar el servidor unificado (puerto 3000)
npm run dev
```

Abra <http://localhost:3000> en su navegador.

---

## 🛠️ Comandos Principales

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor unificado (Express + APIs + Vite SPA). |
| `npm run lint` | Ejecuta el análisis estático ultrarrápido con Oxlint. |
| `node test_sistemico.mjs` | Ejecuta la prueba de regresión del motor de riesgo geomecánico. |
| `npm run build` | Genera el bundle de producción en `dist/`. |
| `npm start` | Inicia el servidor en modo producción. |

---

## 📚 Documentación Técnica Completa

Toda la documentación técnica, arquitectónica y operativa se encuentra en la carpeta [`/docs`](./docs):

- [**Documento Maestro de Handover**](./docs/10_HANDOVER.md) 👈 *Lectura obligatoria para nuevos desarrolladores.*
- [01. Contexto y Manifiesto](./docs/01_CONTEXTO.md): propósito pastoral, 14 zonas y principios éticos.
- [02. Arquitectura del Sistema](./docs/02_ARQUITECTURA.md): capas de software, estado y módulos compartidos.
- [03. Motor de Riesgo](./docs/03_MOTOR_RIESGO.md): formulación física y matemática de las 6 reglas.
- [04. Historial de Bugs](./docs/04_HISTORIAL_BUGS.md): anomalías resueltas y lecciones aprendidas.
- [05. Prompt SARA](./docs/05_PROMPT_SARA.md): ingeniería de prompts para el agente de IA meteorológica.
- [06. Backlog de Pendientes](./docs/06_PENDIENTES.md): deuda técnica y hoja de ruta post-Etapa 3.
- [07. Guía de Operación](./docs/07_GUIA_OPERACION.md): procedimientos de despliegue, contingencias y rollback.
- [08. Plan de la Etapa 3](./docs/08_ETAPA3_PLAN.md): desglose de hitos de estabilización (H0 a H9).
- [Auditoría del Motor](./docs/00_METODOLOGIA.md): diagnóstico empírico de 90 días que motivó la arquitectura de 14 nodos.

---

## 🏛️ Deslinde Institucional

> SatRC es una plataforma comunitaria y pastoral orientada al auxilio preventivo, sin fines de lucro. **No sustituye a las autoridades civiles.** Las determinaciones, avisos y órdenes de Protección Civil y de la Comisión Nacional del Agua (CONAGUA) prevalecen siempre ante cualquier decisión civil o parroquial.
