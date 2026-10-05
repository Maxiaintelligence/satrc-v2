/**
 * SatRC V2.0 - Disparador Manual de GitHub Actions vía API
 * Conectado directamente al repositorio oficial de Maxiaintelligence.
 */
export default async function handler(req, res) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  const GITHUB_OWNER = "Maxiaintelligence";
  const GITHUB_REPO = "satrc-v2";

  if (!GITHUB_PAT) {
    return res.status(500).json({ error: "GITHUB_PAT no está configurado en las variables de Vercel" });
  }

  try {
    const respuesta = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/sara_cron.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_PAT.trim()}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "SatRC-Maxiaintelligence"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (!respuesta.ok) {
      const errTexto = await respuesta.text();
      throw new Error(`GitHub respondió ${respuesta.status}: ${errTexto}`);
    }

    return res.json({ 
      exito: true, 
      mensaje: "Workflow autónomo SARA activado en GitHub Actions para Maxiaintelligence/satrc-v2" 
    });
  } catch (error) {
    console.error("Fallo al disparar workflow:", error.message);
    return res.status(502).json({ error: error.message });
  }
}