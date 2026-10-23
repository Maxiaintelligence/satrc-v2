# SatRC V2.0 — Metodología de trabajo

> Este documento define cómo se trabaja en SatRC. Aplica por igual a personas y a asistentes de IA. Ningún cambio de código o documentación debe saltarse estos pasos.

## Principio rector

> Ningún cambio se escribe sin entender qué problema resuelve, qué archivos toca, cómo se verifica y cómo se revierte si falla. El sistema está en producción y lo usan personas reales.

---

## Fase 1: Antes de tocar nada

1. **Estado del repositorio:** ejecutar `git status` y confirmar que el árbol de trabajo está limpio.
2. **Estado de producción:** revisar la última corrida de GitHub Actions y el estado del despliegue en Vercel.
3. **Diagnóstico:** atacar la causa raíz, no el síntoma. Usar los logs de Vercel o de GitHub Actions para entender el error real.
4. **Preguntar antes de asumir:** si el alcance o el diseño son ambiguos, consultarlo con la persona que coordina el proyecto antes de escribir una sola línea.

---

## Fase 2: Diseño

1. **Alcance mínimo:** la solución más pequeña que resuelve el problema.
2. **Un commit por causa:** cada commit debe poder revertirse con `git revert <hash>` sin afectar lo demás. Los hitos grandes se dividen en commits atómicos (por ejemplo, H8.1, H8.2, H8.3).
3. **Pruebas primero en lógica crítica:** si el cambio toca el motor de riesgo o los contratos de datos, las pruebas se escriben antes que el código.

---

## Fase 3: Verificación local (antes del commit)

| Tipo | Qué hacer |
|---|---|
| Sintaxis | `node --check <archivo>` en `api/` y `scripts/`. `npm run build` para el frontend. |
| Pruebas | `npm test` debe quedar en verde. Si el cambio agrega una función, agrega su prueba. |
| Imports | Si cambias un `import`, verifica en tiempo de ejecución que el módulo carga. |
| Contratos | Si cambias el esquema de datos, verifica que los esquemas Zod sigan validando (`npm test`). |

> `npm test` no valida `api/` ni `scripts/`. Por eso `node --check` es obligatorio para esos archivos.

---

## Fase 4: Commit, despliegue y verificación en producción

- **Formato de commit:** `tipo(área): descripción corta`. Ejemplo: `fix(api): aumenta max_completion_tokens en Groq`.
- **Despliegue:** tras el push, confirmar en Vercel que el despliegue está en estado **Ready**.
- **CI:** confirmar que el workflow `tests.yml` pasa en verde.
- **Si el cambio toca el runner:** disparar manualmente `sara_cron.yml` y verificar que el log indique zonas completas y sin errores de validación.
- **Si el cambio afecta un endpoint público:** probarlo en la interfaz o con una petición HTTP antes de dar el hito por cerrado.

---

## Fase 5: Documentación (obligatoria en cada cierre)

Cada cierre de hito actualiza, en el mismo cambio:

1. `06_PENDIENTES.md`: se quita el ítem cerrado o se marca su estado.
2. `04_HISTORIAL.md`: se agrega el fix con síntoma, causa, solución, verificación y commit.
3. `LEEME_PRIMERO.md`: se actualiza el estado general si cambió.

Un ítem no puede estar en dos documentos a la vez. Si está en el historial, sale del backlog.

---

## Reglas de seguridad documental

- **Nunca** escribir en la documentación claves, tokens, contraseñas ni sus valores de ejemplo. Usa el nombre de la variable de entorno y un placeholder (`<CLAVE>`).
- **Nunca** incluir nombres personales de terceros. Usa el rol (por ejemplo, "Coordinación pastoral").
- **Nunca** incluir rutas locales con nombres de usuario.
- Si una credencial aparece en un commit, se considera comprometida: se rota aunque después se elimine del código.

---

## Reglas de calidad documental

- **Sin placeholders en commits.** Si falta un hash, escribir "pendiente de registrar" y completarlo después.
- **Sin cifras sin fuente.** Un conteo (tests, localidades, hitos) incluye la fecha y el comando que lo produjo.
- **Sin números de línea** en la documentación: cambian con cualquier edición. Referencia el archivo y la función.
- **Un solo lugar por dato.** Si un dato se repite en dos documentos, uno de ellos debe enlazar al otro en vez de copiarlo.

---

## Las reglas de oro

1. **Nunca asumir el estado.** Verificar con comandos: `git status`, logs de Vercel, `npm test`.
2. **Atacar la causa raíz, no el síntoma.**
3. **Preguntar antes que asumir.**
4. **Un commit por causa.**
5. **La suite de pruebas es obligatoria.** Si `npm test` falla, no se hace push.
6. **Verificar lo que se afirma.** Si un documento dice algo, debe poder comprobarse en el código.
7. **Verificar en producción.** Que compile en local no basta.
8. **Probar con datos reales** cuando el cambio depende de una API externa.
9. **Documentar decisiones y bugs** en `04_HISTORIAL.md` y `08_DECISIONES.md`.
10. **Pausar antes de acumular cambios.** Cerrar un hito antes de empezar el siguiente.
11. **Ningún secreto en el repositorio.**

---

*Fin de la metodología.*
