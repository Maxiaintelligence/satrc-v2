import { z } from 'zod';

/**
 * Contrato Inmutable de Datos: SatRC V2.0 Estado Diocesano
 * Validación estricta en el borde (Zod safeParse)
 */
export const EstadoDiocesanoSchema = z.object({
  schema_version: z.string().default("2.1.0"),
  timestamp_iso: z.string(),
  hora_local_mexico: z.string(),
  fuente_oficial_smn: z.object({
    parseo_exitoso: z.boolean(),
    activo: z.boolean(),
    folio_oficial: z.string().optional(),
    vigencia_inicio_iso: z.string().optional(),
    vigencia_fin_iso: z.string().optional(),
    rango_lluvia_mm: z.tuple([z.number(), z.number()]).optional(),
    estados_afectados: z.array(z.string()).default([])
  }).optional(),
  semaforo: z.object({
    totalNivel4: z.number().nonnegative(),
    totalNivel3: z.number().nonnegative(),
    totalNivel2: z.number().nonnegative(),
    totalNivel1: z.number().nonnegative()
  }),
  dictamen: z.object({
    estado_situacion: z.string(),
    color: z.string(),
    titulo: z.string(),
    comentario_oficial: z.string()
  }).optional(),
  evaluaciones: z.array(z.object({
    localidad_id: z.string(),
    nombre: z.string(),
    municipio: z.string(),
    estado: z.string(),
    zona_id: z.string(),
    nivel_alerta: z.number().min(1).max(4),
    color_alerta: z.string(),
    estado_alerta: z.string(),
    diagnostico: z.object({
      titulo: z.string(),
      causa: z.string()
    }),
    donde: z.object({
      coordenadas: z.object({ lat: z.number(), lon: z.number() })
    }),
    impactoSistemico: z.object({
      poblacionDirecta: z.number(),
      accesoVial: z.string(),
      distanciaHospitalKm: z.number(),
      saturacionTotalSueloMm: z.number(),
      lluviaEvento24hMm: z.number()
    })
  })).min(1)
});