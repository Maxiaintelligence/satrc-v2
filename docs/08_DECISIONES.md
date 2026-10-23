# SatRC V2.0 — Registro de decisiones

> **Versión del documento:** 2.4 (22/10/2026)
> **Propósito:** explicar por qué el sistema está diseñado como está. Cada decisión tiene contexto, decisión, consecuencias y estado.
> **Regla:** una decisión nueva se agrega al final con el siguiente número. Una decisión se reemplaza con otra nueva; no se edita la original para cambiar su sentido.

---

## Parte A. Decisiones de arquitectura

### ADR-001: Catorce nodos regionales de referencia

- **Estado:** vigente.
- **Contexto:** en la primera versión, las 405 localidades se evaluaban con el pronóstico de un solo nodo (Huauchinango). Eso produjo falsas alarmas en el Altiplano por lluvias que solo caían en la Sierra.
- **Decisión:** dividir el territorio en 14 zonas de resguardo. Cada zona usa su localidad más poblada como nodo.
- **Evidencia:** auditoría del motor de octubre de 2026, con simulación de nodos y el caso de Pachuca (anexo D de la auditoría archivada en `docs/archivo/`). Eliminó el 86 % de las falsas emergencias N4 de la simulación.
- **Consecuencias:** cada zona depende de un solo nodo. Si el nodo no tiene datos, la zona completa queda sin evaluar, por eso existe el reintento por lotes (ver `02_ARQUITECTURA.md`).

### ADR-002: Consenso determinista de modelos (GFS, ICON y GEM)

- **Estado:** vigente, con una excepción documentada.
- **Decisión:** calcular la mediana hora por hora entre los tres modelos, con filtro de ceros espurios en la lluvia. En Etapa 4 se agregaron ocho variables con estrategias propias: mediana para las de superficie, máximo para CAPE y viento en 700 hPa, y GFS preferente para la altura de congelación (GEM la devuelve nula).
- **Consecuencias:** el resultado es reproducible para las mismas entradas. La versión del consenso que usa el proceso autónomo no incluye las ocho variables de Etapa 4. Ver H-MULTI-01 en `06_PENDIENTES.md` y `VERIFICACION_MULTIFACTOR.md`.
- **Excepción:** la decisión de incluir las variables de Etapa 4 está vigente; la implementación del proceso autónomo no la cumple todavía.

### ADR-003: Bitácora con encadenamiento criptográfico

- **Estado:** vigente.
- **Decisión:** cada registro incluye el hash del registro anterior y su propio hash SHA-256. El primer registro encadena con un bloque génesis de ceros.
- **Consecuencias:** cualquier alteración de un registro anterior se detecta, porque cambia todos los hashes posteriores. La cadena **no impide** la alteración; solo la hace visible. La bitácora se almacena en Vercel Blob, que es un servicio externo; la integridad depende de que quien revisa recalcule la cadena.
- **Nota:** en documentos anteriores se describía como "inmutable" o "imposible de adulterar". Esa redacción se corrige aquí.

### ADR-004: Módulos compartidos (DRY)

- **Estado:** vigente, con una excepción pendiente.
- **Decisión:** la lógica común entre frontend y backend vive en `src/lib/compartido/`, con una sola fuente.
- **Excepción:** el proceso autónomo tiene su propia versión del consenso (ver ADR-002) y la constante de tamaño de lote aparece en tres archivos (DEU-22). Ambas son deuda abierta.

### ADR-005: Orquestador multiamenaza con acoplamiento no lineal

- **Estado:** vigente.
- **Contexto:** un criterio de máximo (`Math.max` entre vectores) subestima las combinaciones. Dos amenazas moderadas simultáneas (por ejemplo, suelo saturado y viento) producen un efecto mayor que cada una por separado.
- **Decisión:** el riesgo global es el máximo de los cuatro vectores más un término de acoplamiento por pares, con la forma `γ · (r_i − 1) · (r_j − 1)`.
- **Coeficientes vigentes:** los definidos en el código (`crossThreatOrchestrator.js`): hidrológico–viento 0.20, hidrológico–térmico 0.15, convectivo–viento 0.30, térmico–hidrológico 0.10 y viento–térmico 0.05.
- **Corrección:** versiones anteriores de este registro citaban coeficientes distintos (0.15, 0.10, 0.25 y 0.05) de una especificación de diseño. Esos valores no coinciden con el código y quedan sustituidos por los vigentes.
- **Consecuencias:** los coeficientes son una decisión de diseño sin validación empírica todavía. Revisarlos cuando exista un registro de eventos reales.

### ADR-006: Adaptador de forma en el proceso autónomo

- **Estado:** vigente.
- **Contexto:** el orquestador entrega `nivel_alerta_global`, pero el esquema de validación y la interfaz esperan `nivel_alerta`.
- **Decisión:** el proceso autónomo copia el valor global en `nivel_alerta` y conserva los campos nuevos como opcionales. Si el orquestador falla para una localidad, se usa el motor hidrológico anterior para esa localidad.
- **Consecuencias:** un fallo del orquestador en una localidad no detiene la publicación, pero **no queda registrado** como degradación. Ver H-MULTI-02 en `06_PENDIENTES.md`.

### ADR-007: Umbral de viento según altitud

- **Estado:** vigente.
- **Contexto:** en la auditoría H6.4, 47 localidades de Pachuca aparecían en N2 sin justificación. El viento basal de la sierra es más fuerte que el de los valles.
- **Decisión:** por encima de 2 200 msnm, los umbrales de viento suben 5 km/h. El cálculo también normaliza la ráfaga a densidad de nivel del mar.
- **Consecuencias:** coexisten dos mecanismos (densidad y altitud). La especificación original descartaba el segundo; el código lo conserva.

### ADR-008: Nivel continuo con topes por nivel discreto

- **Estado:** vigente.
- **Contexto:** los evaluadores emiten un valor continuo que el orquestador compara entre vectores. Un valor continuo fuera del rango de su nivel discreto produjo falsos positivos (H-ORQ-02 y H-ORQ-03).
- **Decisión:** cada evaluador devuelve un valor continuo dentro de `[nivel, nivel + 0.99]`, y el mapeo a nivel global usa umbrales de 2.0, 3.0 y 4.0.
- **Consecuencias:** el evaluador térmico no cumple esta regla en todos sus casos (H-TERM-01). Pendiente de prueba y corrección.

---

## Parte B. Decisiones de alcance y proceso

### DEC-001: Presupuesto cero

- **Estado:** vigente.
- **Decisión:** el sistema opera solo con servicios gratuitos o de dominio público. No hay servidores de pago, licencias comerciales ni suscripciones.
- **Consecuencias:** dependencia de los límites de planes gratuitos (DEU-19). Un cambio en esos límites puede afectar la operación.

### DEC-002: Preferencia por el falso positivo

- **Estado:** vigente.
- **Decisión:** ante la duda, el sistema alerta. Una alerta innecesaria tiene un costo bajo; una alerta omitida puede costar una vida.
- **Consecuencias:** el semáforo puede sobreestimar. Las decisiones de calibración (H-MOTOR-05) deben mantener este criterio.

### DEC-003: Subordinación a las autoridades

- **Estado:** vigente.
- **Decisión:** el sistema traduce avisos oficiales y recomienda acciones; no emite avisos ni ordena evacuaciones. Las determinaciones de Protección Civil y de CONAGUA prevalecen.
- **Consecuencias:** el texto de los reportes y el aviso de disclaimer deben mantener este deslinde.

### DEC-004: Verificación en producción, no solo en local

- **Estado:** vigente.
- **Decisión:** la verificación funcional se hace en GitHub Actions y Vercel, porque el entorno local no tiene almacenamiento ni acceso al modelo de redacción.
- **Consecuencias:** cada cambio que afecte al proceso autónomo se valida con una corrida manual.

### DEC-005: Un commit por causa y pruebas antes de publicar

- **Estado:** vigente.
- **Decisión:** cada commit atiende una sola causa, y `npm test` debe pasar antes del push. Los hitos grandes se dividen en commits atómicos.
- **Consecuencias:** historial más largo, pero reversible por partes.

### DEC-006: Verificar la API antes de codificar contra ella

- **Estado:** vigente.
- **Decisión:** antes de usar una variable o un endpoint externo, se comprueba con una llamada real. Esta regla nació del hallazgo de H-E4-01: las variables existían, pero con un sufijo por modelo que la primera verificación no encontró.
- **Consecuencias:** cada nueva integración externa incluye una verificación empírica documentada.

### DEC-007: Etapa 3 es deuda técnica, no Versión 3.0

- **Estado:** vigente.
- **Decisión:** la Etapa 3 se dedicó a cerrar deuda, pruebas y documentación, sin funciones nuevas. Las funciones nuevas (autenticación real, nuevos vectores, percentiles históricos) quedan para la Versión 3.0.
- **Consecuencias:** los identificadores de etapa deben escribirse con su prefijo para evitar confusión (`E3-H5` frente a `E5-H5.0`).

### DEC-008: Repositorio público mientras se ejecute con cuentas gratuitas

- **Estado:** vigente, con condiciones.
- **Decisión (22/10/2026):** el repositorio permanece público. Motivos: el presupuesto es cero, y las corridas automáticas y el despliegue funcionan igual con repositorio privado. El plan gratuito de GitHub cubre 2 000 minutos al mes para repositorios privados.
- **Condiciones:**
  1. Rotar las claves expuestas en el código antes de publicar cambios de documentación (R-01).
  2. Confirmar que las corridas de `sara_cron.yml` se mantienen dentro del límite mensual.
  3. Atender R-02 y R-04 en código. La visibilidad del repositorio no los resuelve, porque la exposición ya existe en el sitio desplegado.
- **Revisión:** cuando cambie cualquiera de las condiciones.

### DEC-009: Documentación en español, con numeración fija

- **Estado:** vigente.
- **Decisión:** la documentación se mantiene en español. La numeración de `00` a `08` se conserva; `08` pasa a ser el registro de decisiones, en lugar del plan de la Etapa 3, que se archiva.
- **Consecuencias:** los documentos archivados quedan en `docs/archivo/` y no se citan como vigentes.

### DEC-010: Documentación para quien retoma el proyecto con ayuda de IA

- **Estado:** vigente.
- **Decisión:** existe un punto de entrada (`LEEME_PRIMERO.md`) que resume el estado y define el orden de lectura. Cada documento declara su fuente de verdad (el código).
- **Consecuencias:** cuando un documento y el código no coinciden, prevalece el código, y la diferencia se registra en `06_PENDIENTES.md`.

---

## Parte C. Decisiones pendientes

| ID | Pregunta | Quién decide |
|---|---|---|
| PEND-01 | ¿El Monitor Climático muestra el semáforo N1 a N4 y el desglose por vector? (H-UI-01 a H-UI-03, H6.6) | Coordinación pastoral |
| PEND-02 | ¿Se corrige la interfaz para que no lea el token de administración desde el navegador? (R-02) | Coordinación técnica |
| PEND-03 | ¿Los coeficientes de acoplamiento (ADR-005) se recalibran con eventos reales? | Coordinación técnica y pastoral |
