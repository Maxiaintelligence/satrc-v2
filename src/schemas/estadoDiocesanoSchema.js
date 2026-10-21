import { z } from 'zod';

/**
 * Contrato Inmutable de Datos: SatRC V2.0
 *
 * Dos esquemas:
 * - EstadoDiocesanoBlobSchema: valida lo que el runner publica en `estado_diocesano.json`.
 * - EstadoDiocesanoResponseSchema: valida lo que `/api/sara` devuelve al frontend (hereda del Blob).
 */

// 1. Estructura de una Evaluación (Localidad)
const EvaluacionSchema = z.object({
  localidad_id: z.string(),
  nombre: z.string(),
  municipio: z.string(),
  estado: z.string(),
  zona_id: z.string(),
  zona_nombre: z.string().optional(),
  nivel_alerta: z.number().min(1).max(4),
  color_alerta: z.string(),
  estado_alerta: z.string(),
  vector_dominante: z.string().optional(),
  sin_datos_regionales: z.boolean().optional(),
  diagnostico: z.object({
    titulo: z.string(),
    causa: z.string()
  }),
  donde: z.object({
    coordenadas: z.object({ lat: z.number(), lon: z.number() })
  }).passthrough(), // Permite otros campos en 'donde' (ej. subcuenca)
  geografia: z.object({
    relieve: z.string(),
    pendienteMax: z.number(),
    distanciaRioKm: z.number(),
    twi: z.number()
  }).passthrough(),
  tiempos: z.object({
    inicio: z.string(),
    picoMaximo: z.string(),
    ventanaAccionHoras: z.number()
  }).passthrough(),
  impactoSistemico: z.object({
    poblacionDirecta: z.number(),
    accesoVial: z.string(),
    distanciaHospitalKm: z.number(),
    saturacionTotalSueloMm: z.number(),
    lluviaEvento24hMm: z.number()
  }).passthrough(),
  protocolo: z.string().optional()
}).passthrough(); // Permite campos extra en la evaluación

// 2. Schema para el Blob (lo que guarda el runner)
export const EstadoDiocesanoBlobSchema = z.object({
  schema_version: z.string().default("2.1.0"),
  actualizado_iso: z.string().optional(),
  hora_local_mexico: z.string(),
  motor_consenso: z.string().optional(),
  zonas_sin_datos: z.array(z.string()).optional(),
  series_por_zona: z.record(z.any()).optional(),
  dictamen: z.object({
    estado_situacion: z.string(),
    color: z.string(),
    titulo: z.string(),
    comentario_oficial: z.string()
  }).passthrough().optional(),
  semaforo: z.object({
    totalNivel4: z.number().nonnegative(),
    totalNivel3: z.number().nonnegative(),
    totalNivel2: z.number().nonnegative(),
    totalNivel1: z.number().nonnegative()
  }),
  evaluaciones: z.array(EvaluacionSchema).min(1).nullable() // Acepta null si el sistema está degradado
}).passthrough(); // Ignora campos extra que el runner pueda agregar en el futuro

// 3. Schema para la API (lo que devuelve /api/sara)
export const EstadoDiocesanoResponseSchema = EstadoDiocesanoBlobSchema.extend({
  exito: z.boolean().optional(),
  origen: z.string(),
  hora_servidor_mexico: z.string().optional(),
  bitacora: z.array(z.any()),
  ultimo_reporte_ondemand: z.any().nullable(),
  bitacora_guardada: z.boolean().optional(),
  // H8.4 — La API usa hora_servidor_mexico, no hora_local_mexico (heredado del Blob).
  hora_local_mexico: z.string().optional()
});