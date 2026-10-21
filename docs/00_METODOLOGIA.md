# SatRC V2.0 — Metodología de Trabajo (Obligatoria)

> Este documento es la regla de oro del proyecto. Ningún desarrollador o IA puede saltarse estos pasos.

## Principio rector

> *"Ninguna línea de código se escribe sin entender qué problema resuelve, qué archivo toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción con usuarios reales."*

---

## Fase 1: Antes de tocar código

1. **Auditoría previa:** ejecutar `git status` para confirmar que el árbol de trabajo está limpio. Revisar la última corrida de GitHub Actions y el estado de Vercel.
2. **Diagnóstico:** no se ataca un síntoma, se ataca la causa raíz. Usar los logs de Vercel o GitHub Actions para entender el error real, no solo el mensaje de la UI.
3. **Preguntar antes de asumir:** si hay ambigüedad en el alcance o en el diseño, preguntar al líder del proyecto antes de escribir una sola línea.

---

## Fase 2: Diseño

1. **Alcance mínimo:** buscar la solución más pequeña. Un cambio de 3 líneas es mejor que uno de 300.
2. **Un commit por causa:** si algo falla, se debe poder revertir con `git revert <hash>` sin afectar lo demás. Los hitos grandes (como H8) se dividen en commits atómicos (H8.1, H8.2, H8.3).
3. **Red de seguridad:** Si el cambio toca lógica core, primero se escriben los tests (como se hizo en H7a antes de H4).

---

## Fase 3: Verificación antes del commit (Local)

| Tipo | Qué hacer |
|---|---|
| **Sintaxis** | `node --check archivo.js` o `npm run build` para el frontend. |
| **Tests** | **Obligatorio:** ejecutar `npm test` y asegurar que los 79 tests pasen en verde. Si se agregó una funcionalidad nueva, agregar su test correspondiente. |
| **Imports críticos** | Si se modifica un `import`, verificar en runtime con `node -e "import('./archivo.js').then(...)"`. |
| **Validación de contratos** | Si se modifica el esquema de datos, verificar que `EstadoDiocesanoBlobSchema` y `EstadoDiocesanoResponseSchema` sigan validando correctamente (usar `npm test`). |

---

## Fase 4: Commit, Push y Verificación en Producción

- **Formato de commit:** `tipo(área): descripción corta` (ej. `fix(api): aumenta max_completion_tokens en Groq`).
- **Verificar Vercel:** después del push, esperar a que Vercel marque el deploy como **Ready**.
- **Verificar CI:** confirmar que el workflow `tests.yml` pase en verde en GitHub Actions.
- **Si toca el runner:** disparar manualmente `sara_cron.yml` (`gh workflow run`) y verificar que el log diga **14/14 zonas OK** y que no haya errores de Zod.
- **Verificar en vivo:** si el cambio afecta un endpoint público (ej. `/api/sara` o `reporte-ondemand`), probarlo en la UI o vía `Invoke-WebRequest` antes de dar el hito por cerrado.

---

## Las 10 reglas de oro

1. **Nunca asumir el estado.** Verificar con comandos (`git status`, logs de Vercel, `npm test`).
2. **Atacar la causa raíz, no el síntoma.** 
3. **Preguntar antes que asumir.** 
4. **Un commit por causa.**
5. **La suite de tests es sagrada.** Si `npm test` falla, no se pushea.
6. **Verificar con `Select-String`.** 
7. **Verificar en producción.** No alcanza con que compile en local.
8. **Pruebas con datos reales.** 
9. **Documentar decisiones y bugs** (en `04_HISTORIAL_BUGS.md`).
10. **Pausar antes de acumular cambios.**

---
**Fin de la metodología.**