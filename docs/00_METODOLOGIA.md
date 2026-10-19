# SatRC V2.0 — Metodología de Trabajo (Obligatoria)

> Este documento es la regla de oro del proyecto. Ningún desarrollador o IA puede saltarse estos pasos.

## Principio rector

> *"Ninguna línea de código se escribe sin entender qué problema resuelve, qué archivo toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción con usuarios reales."*

---

## Fase 1: Antes de tocar código

1. **Auditoría previa:** ejecutar `git status`, verificar el estado del Blob y revisar la última corrida de GitHub Actions.
2. **Diagnóstico:** no se ataca un síntoma, se ataca la causa raíz. Ejemplo: si el semáforo no cambia, verificar si el runner falló o si el motor tiene un bug.
3. **Preguntar antes de asumir:** si hay ambigüedad, preguntar al líder del proyecto.

---

## Fase 2: Diseño

1. **Alcance mínimo:** buscar la solución más pequeña. Un cambio de 3 líneas es mejor que uno de 300.
2. **Un commit por causa:** si algo falla, se debe poder revertir con `git revert <hash>` sin afectar lo demás. Si un hito tiene múltiples sub-tareas (ej. H6.4), se dividen en sub-hitos atómicos (H6.4.1, H6.4.2, …).

---

## Fase 3: Verificación antes del commit

| Tipo | Qué hacer |
|---|---|
| **Sintaxis** | `node --check api/archivo.js` o `npm run build` para el frontend. |
| **Funcional (imports críticos)** | Si se agrega o modifica un `import`, verificar en runtime con `node -e "import('./archivo.js').then(...)"` para asegurar que el módulo carga sin `Cannot find module`. |
| **Funcional (búsqueda)** | `Select-String -Path archivo -Pattern "texto-nuevo"` para confirmar que el cambio quedó. |
| **Cruzada** | Si cambias `riskEvaluator.js`, verifica que el runner compile y que el frontend haga build. |

---

## Fase 4: Commit y push

- **Formato:** `tipo(área): descripción corta`
  Ejemplo: `fix(motor): corrige lectura de visibilidad (N18)`
- Verificar que Vercel llegue a **Ready** después del push.
- Si el commit toca el runner (`ejecutar_sara_autonomo.mjs`), disparar el workflow de GitHub Actions (`gh workflow run`) y verificar que llegue a **14/14 zonas OK**.

---

## Las 10 reglas de oro

1. Nunca asumir el estado. Verificar con comandos.
2. Atacar la causa raíz, no el síntoma.
3. Preguntar antes que asumir.
4. Un commit por causa.
5. Verificar sintaxis siempre.
6. Verificar con `Select-String`.
7. Verificar en producción.
8. Pruebas con datos reales.
9. Documentar decisiones y bugs.
10. Pausar antes de acumular cambios.