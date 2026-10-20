import { describe, it, expect } from 'vitest';
import { EstadoDiocesanoBlobSchema, EstadoDiocesanoResponseSchema } from '../../../schemas/estadoDiocesanoSchema.js';

// Payload mínimo válido para el Blob (lo que genera el runner)
const payloadBlobValido = {
  hora_local_mexico: "06:00 a.m.",
  semaforo: { totalNivel4: 0, totalNivel3: 0, totalNivel2: 0, totalNivel1: 405 },
  evaluaciones: [{
    localidad_id: "LOC_001",
    nombre: "Test",
    municipio: "Test",
    estado: "Hidalgo",
    zona_id: "ACT",
    nivel_alerta: 1,
    color_alerta: "#10B981",
    estado_alerta: "NORMAL",
    diagnostico: { titulo: "Estable", causa: "Sin lluvia" },
    donde: { coordenadas: { lat: 20.0, lon: -98.0 } },
    geografia: { relieve: "MESETA", pendienteMax: 5, distanciaRioKm: 10, twi: 8 },
    tiempos: { inicio: "En curso", picoMaximo: "Periodo activo", ventanaAccionHoras: 6 },
    impactoSistemico: {
      poblacionDirecta: 1000, accesoVial: "CARRETERA", distanciaHospitalKm: 10,
      saturacionTotalSueloMm: 0, lluviaEvento24hMm: 0
    }
  }]
};

// Payload válido para la Response (lo que devuelve /api/sara)
const payloadResponseValido = {
  ...payloadBlobValido,
  origen: "VERCEL_BLOB_ACTUALIZADO",
  bitacora: [],
  ultimo_reporte_ondemand: null
};

describe('EstadoDiocesanoSchemas', () => {
  describe('EstadoDiocesanoBlobSchema', () => {
    it('acepta un payload válido del runner', () => {
      const res = EstadoDiocesanoBlobSchema.safeParse(payloadBlobValido);
      expect(res.success).toBe(true);
    });

    it('acepta evaluaciones: null (modo degradado)', () => {
      const payload = { ...payloadBlobValido, evaluaciones: null };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(true);
    });

    it('rechaza evaluaciones vacías []', () => {
      const payload = { ...payloadBlobValido, evaluaciones: [] };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });

    it('rechaza semáforo negativo', () => {
      const payload = { ...payloadBlobValido, semaforo: { ...payloadBlobValido.semaforo, totalNivel4: -1 } };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });

    it('rechaza nivel_alerta fuera de rango (1-4)', () => {
      const payload = {
        ...payloadBlobValido,
        evaluaciones: [{ ...payloadBlobValido.evaluaciones[0], nivel_alerta: 5 }]
      };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });
  });

  describe('EstadoDiocesanoResponseSchema', () => {
    it('acepta un payload válido de la API', () => {
      const res = EstadoDiocesanoResponseSchema.safeParse(payloadResponseValido);
      expect(res.success).toBe(true);
    });

    it('rechaza si falta "origen" (requerido en la API)', () => {
      const payload = { ...payloadResponseValido };
      delete payload.origen;
      const res = EstadoDiocesanoResponseSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });
  });
});