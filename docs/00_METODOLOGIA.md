# SatRC V2.0 — Metodología de Trabajo (Obligatoria)

Este documento es la regla de oro del proyecto. Ningún desarrollador o IA puede saltarse estos pasos.

## Principio Rector
"Ninguna línea de código se escribe sin entender qué problema resuelve, qué archivo toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción con usuarios reales."

## FASE 1: ANTES DE TOCAR CÓDIGO
1.  **Auditoría previa:** Ejecutar `git status`, verificar el estado del Blob, ver la última corrida de GitHub Actions.
2.  **Diagnóstico:** No se ataca un síntoma, se ataca la causa raíz. (Ejemplo: si el semáforo no cambia, verificar si el runner falló o si el motor tiene un bug).
3.  **Preguntar antes de asumir:** Si hay ambigüedad, preguntar al líder del proyecto.

## FASE 2: DISEÑO
1.  **Alcance mínimo:** Buscar la solución más pequeña. Un cambio de 3 líneas es mejor que uno de 300.
2.  **Un commit por causa:** Si algo falla, se debe poder revertir con `git revert <hash>` sin afectar lo demás.

## FASE 3: VERIFICACIÓN ANTES DEL COMMIT
1.  **Sintaxis:** `node --check api/archivo.js` o `npm run build` para frontend.
2.  **Funcional:** Usar `Select-String -Path archivo -Pattern "texto-nuevo"` para confirmar que el cambio quedó.
3.  **Cruzada:** Si cambias `riskEvaluator.js`, verifica que el runner compile y el frontend haga build.

## FASE 4: COMMIT Y PUSH
- Formato: `tipo(área): descripción corta`. (Ej. `fix(motor): corrige lectura de visibilidad (N18)`).
- Verificar que Vercel haga "Ready" después del push.

## LAS 10 REGLAS DE ORO
1. Nunca asumir el estado. Verificar con comandos.
2. Atacar la causa raíz, no el síntoma.
3. Preguntar antes que asumir.
4. Un commit por causa.
5. Verificar sintaxis siempre.
6. Verificar con Select-String.
7. Verificar en producción.
8. Pruebas con datos reales.
9. Documentar decisiones y bugs.
10. Pausar antes de acumular cambios.