/**
 * SatRC V2.0 - Disparador Manual de GitHub Actions vía API
 */
export default async function handler(req, res) {
  const GITHUB_PAT = process.env.GITHUB_PAT;
  // Reemplaza con tu usuario y repo si no vienen en variables
  const GITHUB_REPO = process.env.VERCEL_GIT_REPO_SLUG || "satrc-v2";
  const GITHUB_OWNER = process.env.VERCEL_GIT_REPO_OWNER || "tu_usuario";

  if (!GITHUB_PAT) {
    return res.status(500).json({ error: "GITHUB_PAT no está configurado en Vercel" });
  }

  try {
    const respuesta = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/sara_cron.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GITHUB_PAT}`,
          "Accept": "application/vnd.github.v3+json",
          "Content-Type": "application/json",
          "User-Agent": "SatRC-Caritas"
        },
        body: JSON.stringify({ ref: "main" })
      }
    );

    if (!respuesta.ok) {
      const errTexto = await respuesta.text();
      throw new Error(`GitHub respondió ${respuesta.status}: ${errTexto}`);
    }

    return res.json({ exito: true, mensaje: "Workflow autónomo SARA activado en GitHub Actions" });
  } catch (error) {
    console.error("Fallo al disparar workflow:", error.message);
    return res.status(502).json({ error: error.message });
  }
}