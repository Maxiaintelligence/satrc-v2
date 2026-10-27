import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { clave } = req.body || {};
  const claveEsperada = process.env.CLAVE_SALA_OPERATIVA;

  if (!claveEsperada) {
    console.error("[Auth] Falta configurar CLAVE_SALA_OPERATIVA en Vercel");
    return res.status(500).json({ error: "Configuración incompleta del servidor" });
  }

  if (!clave || typeof clave !== 'string') {
    return res.status(401).json({ error: "Clave requerida" });
  }

  // Comparación segura para evitar ataques de tiempo
  const a = Buffer.from(clave);
  const b = Buffer.from(claveEsperada);
  
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
    return res.json({ exito: true });
  }

  return res.status(401).json({ error: "Clave incorrecta" });
}