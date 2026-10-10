import crypto from 'crypto';

/**
 * SatRC V2.0 - Disparador Autenticado de GitHub Actions vía API
 * 
 * Endpoint invocado por cron-job.org cada 3 horas.
 * Valida un secreto compartido (x-cron-secret) antes de disparar el workflow.
 * 
 * Variables de entorno requeridas:
 *   - GITHUB_PAT     : Personal Access Token con scope "workflow"
 *   - CRON_SECRET    : Secreto largo y aleatorio que cron-job.org envía en el header
 */

const GITHUB_OWNER = "Maxiaintelligence";
const GITHUB_REPO = "satrc-v2";
const GITHUB_WORKFLOW = "sara_cron.yml";
const GITHUB_REF = "main";

function secretoValido(req) {
  const esperado = process.env.CRON_SECRET;
  const recibido = req.headers['x-cron-secret'];
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  // Solo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Método no permitido. Usar POST." });
  }

  // Validar secreto
  if (!secretoValido(req)) {
    return res.status(401).json({ error: "No autorizado" });
  }

  const GITHUB_PAT = process.env.GITHUB_PAT;
  if (!GITHUB_PAT) {
    console.error("GITHUB_PAT no configurado en variables de entorno de Vercel");
    return res.status(500).json({ error: "Configuración incompleta del servidor" });
  }

  try {
    const respuesta = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          "Authorization": `Bearer ${GITHUB_PAT.trim()}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "SatRC-Maxiaintelligence"
        },
        body: JSON.stringify({ ref: GITHUB_REF })
      }
    );

    // GitHub devuelve 204 No Content cuando el dispatch es exitoso
    if (respuesta.status === 204) {
      console.log(`[disparar-workflow] Workflow ${GITHUB_WORKFLOW} disparado exitosamente en ${GITHUB_OWNER}/${GITHUB_REPO}@${GITHUB_REF}`);
      return res.json({
        exito: true,
        mensaje: "Workflow SARA disparado correctamente",
        repositorio: `${GITHUB_OWNER}/${GITHUB_REPO}`,
        workflow: GITHUB_WORKFLOW,
        ref: GITHUB_REF,
        timestamp: new Date().toISOString()
      });
    }

    const errTexto = await respuesta.text();
    console.error(`[disparar-workflow] GitHub respondió ${respuesta.status}: ${errTexto}`);
    return res.status(502).json({
      exito: false,
      error: `GitHub respondió ${respuesta.status}`,
      detalle: errTexto.slice(0, 200)
    });

  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error("[disparar-workflow] Timeout consultando GitHub");
      return res.status(504).json({ exito: false, error: "Timeout consultando GitHub" });
    }
    console.error("[disparar-workflow] Fallo inesperado:", error.message);
    return res.status(502).json({ exito: false, error: error.message });
  }
}