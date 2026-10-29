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

      it('PEND-06: acepta payload con contexto.niebla activo', () => {
        const payload = {
          ...payloadBlobValido,
          evaluaciones: [{
            ...payloadBlobValido.evaluaciones[0],
            contexto: {
              niebla: {
                activa: true,
                visibilidadMinKm: 0.2,
                persistenciaHoras: 2,
                periodo: 'MADRUGADA',
                ventana: { inicio: '00:00', fin: '01:00', duracionHoras: 2 }
              }
            }
          }]
        };
        const res = EstadoDiocesanoBlobSchema.safeParse(payload);
        expect(res.success).toBe(true);
      });

      it('PEND-06: acepta payload SIN contexto (retrocompatibilidad)', () => {
        const payload = {
          ...payloadBlobValido,
          evaluaciones: [{
            ...payloadBlobValido.evaluaciones[0]
            // sin contexto
          }]
        };
        const res = EstadoDiocesanoBlobSchema.safeParse(payload);
        expect(res.success).toBe(true);
      });

      it('PEND-06: acepta contexto.niebla.activa=false con campos en null', () => {
        const payload = {
          ...payloadBlobValido,
          evaluaciones: [{
            ...payloadBlobValido.evaluaciones[0],
            contexto: {
              niebla: {
                activa: false,
                visibilidadMinKm: null,
                persistenciaHoras: 0,
                periodo: null,
                ventana: { inicio: null, fin: null, duracionHoras: 0 }
              }
            }
          }]
        };
        const res = EstadoDiocesanoBlobSchema.safeParse(payload);
        expect(res.success).toBe(true);
      });

    it('acepta evaluaciones vacías [] (días tranquilos, H-DRIVE-02)', () => {
      // H-DRIVE-02 (commit 3053e29, 28/10/2026): el schema acepta [] y null
      // para representar días sin localidades en N3/N4. Antes exigía .min(1).
      // Ver 04_HISTORIAL.md §6.2 y 02_ARQUITECTURA.md §7.
      const payload = { ...payloadBlobValido, evaluaciones: [] };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(true);
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

    it('preserva los 5 campos del orquestador multiamenaza (H6.5)', () => {
      const payload = {
        ...payloadBlobValido,
        evaluaciones: [{
          ...payloadBlobValido.evaluaciones[0],
          nivel_alerta_global: 3,
          riesgo_continuo: 3.36,
          niveles_por_vector: { hidrologico: 3.03, viento: 1.78, termico: 1.0, convectivo: 1.05 },
          acciones_operativas: ['Restringir circulación en caminos de terracería.'],
          diagnosticos_por_vector: {
            hidrologico: { titulo: 'Corte Vial', causa: 'Terracería vulnerable' },
            viento: { titulo: 'Vientos Normales', causa: 'Ráfagas de 40.7 km/h' },
            termico: { titulo: 'Térmico Normal', causa: 'Sin amenaza' },
            convectivo: { titulo: 'Atmósfera Estable', causa: 'Sin convección' }
          }
        }]
      };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(true);
      const ev = res.data.evaluaciones[0];
      expect(ev.nivel_alerta_global).toBe(3);
      expect(ev.riesgo_continuo).toBe(3.36);
      expect(ev.niveles_por_vector).toEqual({ hidrologico: 3.03, viento: 1.78, termico: 1.0, convectivo: 1.05 });
      expect(ev.acciones_operativas).toEqual(['Restringir circulación en caminos de terracería.']);
      expect(ev.diagnosticos_por_vector.hidrologico.titulo).toBe('Corte Vial');
    });

    it('acepta payload sin los 5 campos del orquestador (retrocompatibilidad)', () => {
      // payloadBlobValido NO tiene los 5 campos. El schema debe aceptarlo.
      const res = EstadoDiocesanoBlobSchema.safeParse(payloadBlobValido);
      expect(res.success).toBe(true);
      const ev = res.data.evaluaciones[0];
      expect(ev.nivel_alerta_global).toBeUndefined();
      expect(ev.niveles_por_vector).toBeUndefined();
    });

    it('rechaza nivel_alerta_global fuera de rango (1-4)', () => {
      const payload = {
        ...payloadBlobValido,
        evaluaciones: [{
          ...payloadBlobValido.evaluaciones[0],
          nivel_alerta_global: 5
        }]
      };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });

    it('rechaza acciones_operativas si no es un array', () => {
      const payload = {
        ...payloadBlobValido,
        evaluaciones: [{
          ...payloadBlobValido.evaluaciones[0],
          acciones_operativas: 'Restringir circulación'  // string, no array
        }]
      };
      const res = EstadoDiocesanoBlobSchema.safeParse(payload);
      expect(res.success).toBe(false);
    });

});