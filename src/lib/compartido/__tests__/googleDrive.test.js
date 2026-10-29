// --- INICIO DEL NUEVO ARCHIVO ---
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('googleDrive.js', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('escribirJSONBlob — H-DRIVE-01: fallo de escritura debe lanzar', () => {
    it('lanza si falta GOOGLE_SCRIPT_URL', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', '');
      const { escribirJSONBlob } = await import('../googleDrive.js');
      await expect(escribirJSONBlob('test.json', '{}')).rejects.toThrow('Falta GOOGLE_SCRIPT_URL');
    });

    it('lanza si fetch responde no-ok (HTTP 500)', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', 'https://fake.example/exec');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
      const { escribirJSONBlob } = await import('../googleDrive.js');
      await expect(escribirJSONBlob('test.json', '{}')).rejects.toThrow('HTTP 500');
    });

    it('lanza si fetch rechaza (error de red)', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', 'https://fake.example/exec');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
      const { escribirJSONBlob } = await import('../googleDrive.js');
      await expect(escribirJSONBlob('test.json', '{}')).rejects.toThrow('Network error');
    });

    it('devuelve el JSON si fetch responde ok', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', 'https://fake.example/exec');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ exito: true }) }));
      const { escribirJSONBlob } = await import('../googleDrive.js');
      const res = await escribirJSONBlob('test.json', '{}');
      expect(res).toEqual({ exito: true });
    });
  });

  describe('leerJSONBlob — contrato actual (null en fallo de red, no se modifica)', () => {
    it('lanza si falta GOOGLE_SCRIPT_URL (fuera del try)', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', '');
      const { leerJSONBlob } = await import('../googleDrive.js');
      await expect(leerJSONBlob('test.json')).rejects.toThrow('Falta GOOGLE_SCRIPT_URL');
    });

    it('devuelve null si fetch responde no-ok (contrato de lectura tolerante)', async () => {
      vi.stubEnv('GOOGLE_SCRIPT_URL', 'https://fake.example/exec');
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
      const { leerJSONBlob } = await import('../googleDrive.js');
      const res = await leerJSONBlob('test.json');
      expect(res).toBeNull();
    });
  });
});
// --- FIN DEL NUEVO ARCHIVO ---