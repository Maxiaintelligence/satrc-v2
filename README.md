# SatRC V2.0 — Sistema de Alerta Temprana y Riesgos Climáticos

**Cáritas Pastoral Social · Arquidiócesis de Tulancingo**
Cobertura: Hidalgo, Sierra Norte de Puebla y laderas limítrofes de Veracruz (405 localidades en 14 zonas).

---

## ¿Qué es?

Aplicación web para apoyar la protección de comunidades frente a lluvias intensas, deslaves, inundaciones, vientos fuertes, temperaturas extremas y tormentas. Consensúa pronósticos de tres modelos meteorológicos abiertos y avisos oficiales, y los clasifica en un semáforo de cuatro niveles.

**No emite avisos oficiales ni ordena evacuaciones.** Las determinaciones de Protección Civil y de CONAGUA prevalecen siempre.

---

## Documentación

Empieza por **[`docs/LEEME_PRIMERO.md`](docs/LEEME_PRIMERO.md)**. Ahí está el estado actual y el orden de lectura.

| Documento | Contenido |
|---|---|
| [00 Metodología](docs/00_METODOLOGIA.md) | Cómo se trabaja en el proyecto |
| [01 Contexto](docs/01_CONTEXTO.md) | Qué resuelve el sistema, para quién y con qué límites |
| [02 Arquitectura](docs/02_ARQUITECTURA.md) | Componentes, endpoints y contratos de datos |
| [03 Motor de riesgo](docs/03_MOTOR_RIESGO.md) | Reglas de evaluación y evaluadores de viento, térmico y convectivo |
| [04 Historial](docs/04_HISTORIAL.md) | Bugs resueltos e hitos por etapa |
| [05 Prompts de SARA](docs/05_PROMPT_SARA.md) | Redacción de reportes con apoyo de IA |
| [06 Pendientes](docs/06_PENDIENTES.md) | Deuda técnica y riesgos abiertos |
| [07 Guía de operación](docs/07_GUIA_OPERACION.md) | Despliegue, verificación y recuperación |
| [08 Decisiones](docs/08_DECISIONES.md) | Por qué el sistema está diseñado como está |

---

## Desarrollo local

Requisitos: Node.js 22 y npm.

```bash
git clone https://github.com/Maxiaintelligence/satrc-v2.git
cd satrc-v2
npm install
npm run dev        # servidor de desarrollo de Vite (puerto 5173)
```

Los endpoints de `api/` y el almacenamiento solo funcionan en producción (Vercel). En local, la interfaz puede usar su respaldo en vivo.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de la interfaz |
| `npm test` | Ejecuta las pruebas con Vitest |
| `npm run lint` | Análisis estático con Oxlint |
| `npm run build` | Genera la versión de producción en `dist/` |

Antes de subir cambios en `api/` o `scripts/`, ejecutar `node --check <archivo>`: `npm test` no los cubre.

---

## Variables de entorno

Se configuran en Vercel (producción) y en GitHub Secrets (proceso autónomo). **No se guardan en el repositorio.** La lista completa y su uso están en [`docs/07_GUIA_OPERACION.md`](docs/07_GUIA_OPERACION.md#81-variables-de-entorno).

---

## Costo

Opera con servicios gratuitos o de dominio público. No tiene costos recurrentes.

---

## Deslinde institucional

SatRC es una herramienta comunitaria y pastoral de apoyo preventivo, sin fines de lucro. **No sustituye a las autoridades civiles.** Las determinaciones, avisos y órdenes de Protección Civil y de la Comisión Nacional del Agua (CONAGUA) prevalecen siempre ante cualquier decisión civil o parroquial.

---

## Licencia

Pendiente de definir por la coordinación del proyecto.
